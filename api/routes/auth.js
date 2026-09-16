import { Router } from 'express'
import { verifyToken } from '@clerk/backend'
import { clerkClient } from '../lib/clerk.js'
import { clerkProfile } from '../lib/clerkProfile.js'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import crypto from 'crypto'

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
    const clerkUser = await clerkClient.users.getUser(clerkUserId)
    const profile = clerkProfile(clerkUser, req.body)

    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle()

    if (existing) {
      const { data: user, error } = await supabase
        .from('users')
        .update(profile)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return res.json({ message: 'User synced', user })
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        clerk_user_id: clerkUserId,
        ...profile,
        role: profile.role || 'participant',
        is_active: true
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

router.post('/invite', requireAuth, requireAdmin, async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase.from('invite_links').insert({
      token,
      created_by: req.user.id,
      expires_at: expiresAt
    })
    if (error) throw error
    res.json({ invite_url: `${process.env.FRONTEND_URL}/register?token=${token}`, expires_at: expiresAt })
  } catch (err) {
    console.error('Invite error:', err)
    res.status(500).json({ error: 'Failed to generate invite' })
  }
})

router.get('/invite/validate/:token', async (req, res) => {
  try {
    const { data: invite, error } = await supabase
      .from('invite_links').select('*').eq('token', req.params.token).single()
    if (error || !invite) return res.status(404).json({ error: 'Invalid invite link' })
    if (new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: 'Invite link has expired' })
    if (invite.used_at) return res.status(410).json({ error: 'Invite link has already been used' })
    res.json({ valid: true, expires_at: invite.expires_at })
  } catch (err) {
    console.error('Validate error:', err)
    res.status(500).json({ error: 'Failed to validate invite' })
  }
})

router.post('/invite/use/:token', requireAuth, async (req, res) => {
  try {
    const { data: invite, error } = await supabase
      .from('invite_links').select('*').eq('token', req.params.token).single()
    if (error || !invite) return res.status(404).json({ error: 'Invalid invite link' })
    if (new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: 'Invite link has expired' })
    if (invite.used_at) return res.status(410).json({ error: 'Invite link already used' })

    await supabase.from('invite_links').update({
      used_at: new Date().toISOString(),
      used_by_user_id: req.user.id
    }).eq('token', req.params.token)
    res.json({ message: 'Invite marked as used' })
  } catch (err) {
    console.error('Use invite error:', err)
    res.status(500).json({ error: 'Failed to mark invite as used' })
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
