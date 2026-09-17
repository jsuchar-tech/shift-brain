import { Router } from 'express'
import { verifyToken } from '@clerk/backend'
import { clerkClient } from '../lib/clerk.js'
import { clerkProfile } from '../lib/clerkProfile.js'
import { supabase } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// POST /auth/sync
// Refreshes the local profile from Clerk after every successful login.
router.post('/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
    if (!payload) return res.status(401).json({ error: 'Invalid token' })

    const clerkUserId = payload.sub

    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle()

    if (existing) {
      // Participant records are curated locally. Do not overwrite approved
      // names, offices, roles or other profile fields with Clerk metadata.
      return res.json({ message: 'User synced', user: existing })
    }

    const clerkUser = await clerkClient.users.getUser(clerkUserId)
    const profile = clerkProfile(clerkUser, req.body)

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        clerk_user_id: clerkUserId,
        ...profile,
        role: profile.role || 'participant',
        is_active: false
      })
      .select()
      .single()

    if (error) throw error

    await supabase.from('token_limits').insert({
      user_id: user.id,
      daily_limit: Number.parseInt(process.env.DAILY_TOKEN_LIMIT, 10) || 30000,
      monthly_limit: Number.parseInt(process.env.MONTHLY_TOKEN_LIMIT, 10) || 500000
    })

    res.json({ message: 'User created', user })
  } catch (err) {
    console.error('Sync error:', err)
    res.status(500).json({ error: 'Failed to sync user', details: err.message })
  }
})

router.get('/me', requireAuth, async (req, res) => res.json({ user: req.user }))

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { language_preference, font_size } = req.body
    if (font_size && (font_size < 12 || font_size > 24)) {
      return res.status(400).json({ error: 'Font size must be between 12 and 24' })
    }

    const updates = {}
    if (language_preference) updates.language_preference = language_preference
    if (font_size) updates.font_size = font_size
    const { data: user, error } = await supabase
      .from('users').update(updates).eq('id', req.user.id).select().single()
    if (error) throw error
    res.json({ user })
  } catch (err) {
    console.error('Update error:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

export default router
