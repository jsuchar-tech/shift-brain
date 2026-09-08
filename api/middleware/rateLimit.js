const activeRequests = new Map()      // userId -> lock timestamp
const requestTimestamps = new Map()   // userId -> [timestamps]

const LOCK_TIMEOUT_MS = 2 * 60 * 1000 // backstop in case finish/close never fires
const WINDOW_MS = 60 * 1000
const MAX_PER_WINDOW = 8

export function rateLimitPerUser(req, res, next) {
  const userId = req.user?.id
  if (!userId) return next()

  const now = Date.now()

  // Concurrency lock — with a timeout backstop so a crashed/hung
  // request can't permanently lock a user out.
  const lockedAt = activeRequests.get(userId)
  if (lockedAt && now - lockedAt < LOCK_TIMEOUT_MS) {
    return res.status(429).json({
      error: 'Please wait for your current request to complete'
    })
  }

  // Sliding-window burst limit — the lock above only stops overlapping
  // requests, not rapid-fire sequential ones.
  const timestamps = (requestTimestamps.get(userId) || []).filter(t => now - t < WINDOW_MS)
  if (timestamps.length >= MAX_PER_WINDOW) {
    return res.status(429).json({
      error: 'Too many requests. Please slow down and try again shortly.'
    })
  }
  timestamps.push(now)
  requestTimestamps.set(userId, timestamps)

  activeRequests.set(userId, now)

  const release = () => activeRequests.delete(userId)
  res.on('finish', release)
  res.on('close', release)

  next()
}