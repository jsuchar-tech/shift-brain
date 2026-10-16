import { supabase } from './supabase.js'
import { tokenLimitsAreDisabled } from './tokenLimitsConfig.js'

export async function checkTokenLimits(userId) {
  if (tokenLimitsAreDisabled()) {
    return {
      allowed: true,
      unlimited: true,
      daily_remaining: null,
      monthly_remaining: null
    }
  }

  const { data, error } = await supabase
    .from('user_token_usage')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  // A new account can legitimately have no usage row yet, but it must still
  // have a configured token-limit record. Other missing/error states fail
  // closed instead of silently granting unlimited model access.
  if (!data) {
    const { data: limits, error: limitsError } = await supabase
      .from('token_limits')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (limitsError) throw limitsError
    if (!limits) throw new Error('Token limits are not configured for this account')
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
    monthly_remaining: monthlyRemaining,
    daily_limit: data.daily_limit,
    monthly_limit: data.monthly_limit,
    tokens_used_today: data.tokens_used_today,
    tokens_used_this_month: data.tokens_used_this_month
  }
}
