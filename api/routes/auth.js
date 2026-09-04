import { Router } from 'express'
import { verifyToken } from '@clerk/backend'
import { clerkClient } from '../lib/clerk.js'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import crypto from 'crypto'

const router = Router()

// POST /auth/sync
// Called after Clerk login to create user record in your DB
router.post('/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    })

    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const clerkUserId = payload.sub
    const { full_name, work_email, country_office, shifter_year } = req.body

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (existing) {
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .single()
      return res.json({ message: 'User already synced', user })
    }

    // Create user record
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        clerk_user_id: clerkUserId,
        full_name: full_name || 'SHIFT User',
        work_email: work_email || '',
        country_office: country_office || 'Unknown',
        shifter_year: parseInt(shifter_year) || 1,
        role: 'participant',
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    await supabase.from('token_limits').insert({
      user_id: user.id,
      daily_limit: parseInt(process.env.DAILY_TOKEN_LIMIT) || 30000,
      monthly_limit: parseInt(process.env.MONTHLY_TOKEN_LIMIT) || 500000
    })

    res.json({ message: 'User created', user })
  } catch (err) {
    console.error('Sync error:', err)
    res.status(500).json({ error: 'Failed to sync user', details: err.message })
  }
})

// POST /auth/invite
router.post('/invite', requireAuth, requireAdmin, async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    const { data: invite, error } = await supabase
      .from('invite_links')
      .insert({
        token,
        created_by: req.user.id,
        expires_at: expiresAt
      })
      .select()
      .single()

    if (error) throw error

    const inviteUrl = `${process.env.FRONTEND_URL}/register?token=${token}`

    res.json({
      invite_url: inviteUrl,
      expires_at: expiresAt
    })
  } catch (err) {
    console.error('Invite error:', err)
    res.status(500).json({ error: 'Failed to generate invite' })
  }
})

// GET /auth/invite/validate/:token
router.get('/invite/validate/:token', async (req, res) => {
  try {
    const { token } = req.params

    const { data: invite, error } = await supabase
      .from('invite_links')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !invite) {
      return res.status(404).json({ error: 'Invalid invite link' })
    }

    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Invite link has expired' })
    }

    if (invite.used_at) {
      return res.status(410).json({ error: 'Invite link has already been used' })
    }

    res.json({ valid: true, expires_at: invite.expires_at })
  } catch (err) {
    console.error('Validate error:', err)
    res.status(500).json({ error: 'Failed to validate invite' })
  }
})

// POST /auth/invite/use/:token
router.post('/invite/use/:token', requireAuth, async (req, res) => {
  try {
    const { token } = req.params

    const { data: invite, error } = await supabase
      .from('invite_links')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !invite) {
      return res.status(404).json({ error: 'Invalid invite link' })
    }

    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Invite link has expired' })
    }

    if (invite.used_at) {
      return res.status(410).json({ error: 'Invite link already used' })
    }

    await supabase
      .from('invite_links')
      .update({
        used_at: new Date().toISOString(),
        used_by_user_id: req.user.id
      })
      .eq('token', token)

    res.json({ message: 'Invite marked as used' })
  } catch (err) {
    console.error('Use invite error:', err)
    res.status(500).json({ error: 'Failed to mark invite as used' })
  }
})

// GET /auth/me
router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user })
})

// PATCH /auth/me
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { language_preference, font_size } = req.body
    const allowed = ['en', 'es', 'fr', 'pt']

    if (language_preference && !allowed.includes(language_preference)) {
      return res.status(400).json({ error: 'Invalid language' })
    }

    if (font_size && (font_size < 12 || font_size > 24)) {
      return res.status(400).json({ error: 'Font size must be between 12 and 24' })
    }

    const updates = {}
    if (language_preference) updates.language_preference = language_preference
    if (font_size) updates.font_size = font_size

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single()

    if (error) throw error
    res.json({ user })
  } catch (err) {
    console.error('Update error:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

export default router