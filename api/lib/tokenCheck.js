import { supabase } from './supabase.js'

export async function checkTokenLimits(userId) {
  // Bypass token limits during testing
  if (process.env.DISABLE_TOKEN_LIMITS === 'true') {
    return { allowed: true }
  }
  const { data, error } = await supabase
    .from('user_token_usage')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    // No usage record yet — user is within limits
    return { allowed: true, usage: null }
  }

  const dailyRemaining = data.daily_limit - data.tokens_used_today
  const monthlyRemaining = data.monthly_limit - data.tokens_used_this_month

  if (dailyRemaining <= 0) {
    return {
      allowed: false,
      reason: 'daily',
      message: 'You have reached your daily token limit. Your limit resets tomorrow.',
      tokens_used_today: data.tokens_used_today,
      daily_limit: data.daily_limit
    }
  }

  if (monthlyRemaining <= 0) {
    return {
      allowed: false,
      reason: 'monthly',
      message: 'You have reached your monthly token limit. Please contact your administrator.',
      tokens_used_this_month: data.tokens_used_this_month,
      monthly_limit: data.monthly_limit
    }
  }

  return {
    allowed: true,
    daily_remaining: dailyRemaining,
    monthly_remaining: monthlyRemaining
  }
}