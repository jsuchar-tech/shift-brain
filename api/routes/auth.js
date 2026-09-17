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
    const registrationPending = req.body?.registration_pending === true

    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle()

    if (existing) {
      if (registrationPending) {
        const { data: pendingUser, error: pendingError } = await supabase
          .from('users')
          .update({ is_active: false })
          .eq('id', existing.id)
          .select()
          .single()
        if (pendingError) throw pendingError
        return res.json({ message: 'User awaiting approval', user: pendingUser })
      }
      // Participant records are curated locally. Do not overwrite approved
      // names, offices, roles or other profile fields with Clerk metadata.
      return res.json({ message: 'User synced', user: existing })
    }

    const clerkUser = await clerkClient.users.getUser(clerkUserId)
    const profile = clerkProfile(clerkUser, req.body)
    const requiresApproval = registrationPending || clerkUser?.unsafeMetadata?.approval_required === true

    // Recover accounts created in Clerk before local synchronization finished.
    // A verified matching email is safe to reconnect, while preserving all
    // locally curated participant fields and approval status.
    if (profile.work_email) {
      const { data: emailMatch, error: emailLookupError } = await supabase
        .from('users')
        .select('*')
        .eq('work_email', profile.work_email)
        .maybeSingle()

      if (emailLookupError) throw emailLookupError
      if (emailMatch) {
        const { data: linkedUser, error: linkError } = await supabase
          .from('users')
          .update({ clerk_user_id: clerkUserId, ...(requiresApproval ? { is_active: false } : {}) })
          .eq('id', emailMatch.id)
          .select()
          .single()

        if (linkError) throw linkError
        return res.json({ message: 'User linked', user: linkedUser })
      }
    }

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

    if (error) {
      // A simultaneous first load may have created the row between the lookup
      // and insert. Return that row instead of leaving the user on an error.
      const { data: recovered } = await supabase
        .from('users')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .maybeSingle()
      if (recovered) return res.json({ message: 'User synced', user: recovered })
      throw error
    }

    await supabase.from('token_limits').insert({
      user_id: user.id,
      daily_limit: Number.parseInt(process.env.DAILY_TOKEN_LIMIT, 10) || 30000,
      monthly_limit: Number.parseInt(process.env.MONTHLY_TOKEN_LIMIT, 10) || 500000
    })

    res.json({ message: 'User created', user })
  } catch (err) {
    console.error('Sync error:', err)
    res.status(500).json({ error: 'Failed to sync user', details: err.message, code: err.code || 'USER_SYNC_FAILED' })
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
