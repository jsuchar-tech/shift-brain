const activeRequests = new Map()

export function rateLimitPerUser(req, res, next) {
  const userId = req.user?.id
  if (!userId) return next()

  if (activeRequests.get(userId)) {
    return res.status(429).json({
      error: 'Please wait for your current request to complete'
    })
  }

  activeRequests.set(userId, true)

  // Clean up when response finishes
  res.on('finish', () => activeRequests.delete(userId))
  res.on('close', () => activeRequests.delete(userId))

  next()
}