import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /usage/me
// Returns token usage for the current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_token_usage')
      .select('*')
      .eq('user_id', req.user.id)
      .single()

    if (error) throw error

    res.json({
      tokens_used_today: data?.tokens_used_today || 0,
      tokens_used_this_month: data?.tokens_used_this_month || 0,
      daily_limit: data?.daily_limit || 30000,
      monthly_limit: data?.monthly_limit || 500000,
      daily_remaining: Math.max(0, (data?.daily_limit || 30000) - (data?.tokens_used_today || 0)),
      monthly_remaining: Math.max(0, (data?.monthly_limit || 500000) - (data?.tokens_used_this_month || 0))
    })
  } catch (err) {
    console.error('Usage error:', err)
    res.status(500).json({ error: 'Failed to fetch usage' })
  }
})

export default router