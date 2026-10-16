import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { tokenLimitsAreDisabled } from '../lib/tokenLimitsConfig.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /usage/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    if (tokenLimitsAreDisabled()) {
      return res.json({
        unlimited: true,
        tokens_used_today: 0,
        tokens_used_this_month: 0,
        daily_limit: null,
        monthly_limit: null,
        daily_remaining: null,
        monthly_remaining: null
      })
    }

    const { data, error } = await supabase
      .from('user_token_usage')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (error) throw error

    const dailyLimit = Number(data?.daily_limit ?? process.env.DAILY_TOKEN_LIMIT ?? 30000)
    const monthlyLimit = Number(data?.monthly_limit ?? process.env.MONTHLY_TOKEN_LIMIT ?? 500000)
    const tokensUsedToday = Number(data?.tokens_used_today || 0)
    const tokensUsedThisMonth = Number(data?.tokens_used_this_month || 0)

    res.json({
      unlimited: false,
      tokens_used_today: tokensUsedToday,
      tokens_used_this_month: tokensUsedThisMonth,
      daily_limit: dailyLimit,
      monthly_limit: monthlyLimit,
      daily_remaining: Math.max(0, dailyLimit - tokensUsedToday),
      monthly_remaining: Math.max(0, monthlyLimit - tokensUsedThisMonth)
    })
  } catch (err) {
    console.error('Usage error:', err)
    res.status(500).json({ error: 'Failed to fetch usage' })
  }
})

export default router
