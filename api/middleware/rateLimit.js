import { supabase } from '../lib/supabase.js'

async function acquireGuard({ scope, key, limit, windowSeconds, lockSeconds = 0, exclusive = false }) {
  const { data, error } = await supabase.rpc('acquire_request_guard', {
    p_scope: scope,
    p_guard_key: String(key),
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_lock_seconds: lockSeconds,
    p_exclusive: exclusive
  })

  if (error) throw error
  return data
}

export async function releaseGuard(scope, key) {
  const { error } = await supabase.rpc('release_request_guard', {
    p_scope: scope,
    p_guard_key: String(key)
  })
  if (error) console.error(`Failed to release ${scope} request guard:`, error)
}

function distributedRateLimit({ scope, limit, windowSeconds, lockSeconds = 0, exclusive = false }) {
  return async function enforceRateLimit(req, res, next) {
    const key = req.user?.id
    if (!key) return next()

    try {
      const result = await acquireGuard({
        scope,
        key,
        limit,
        windowSeconds,
        lockSeconds,
        exclusive
      })

      if (!result?.allowed) {
        const isActive = result?.reason === 'active'
        return res.status(429).json({
          error: isActive
            ? 'Please wait for your current request to complete'
            : 'Too many requests. Please slow down and try again shortly.',
          retry_after_seconds: result?.retry_after_seconds || 1
        })
      }

      if (exclusive) {
        let released = false
        const release = () => {
          if (released) return
          released = true
          void releaseGuard(scope, key)
        }
        res.once('finish', release)
        res.once('close', release)
      }

      return next()
    } catch (error) {
      console.error(`${scope} rate-limit error:`, error)
      return res.status(503).json({
        error: 'Request protection is temporarily unavailable. Please try again shortly.'
      })
    }
  }
}

export const rateLimitPerUser = distributedRateLimit({
  scope: 'chat',
  limit: 8,
  windowSeconds: 60,
  lockSeconds: 120,
  exclusive: true
})

export const rateLimitUploads = distributedRateLimit({
  scope: 'upload',
  limit: 10,
  windowSeconds: 10 * 60
})

export async function acquireGlobalGuard(scope, lockSeconds) {
  return acquireGuard({
    scope,
    key: 'global',
    limit: 1,
    windowSeconds: lockSeconds,
    lockSeconds,
    exclusive: true
  })
}
