import { verifySessionToken } from '../lib/clerk.js'
import { supabase } from '../lib/supabase.js'

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
    }

    const payload = await verifySessionToken(header.slice(7))

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_user_id', payload.sub)
      .maybeSingle()

    if (error) throw error
    if (!user) {
      return res.status(401).json({ error: 'User profile has not been created', code: 'USER_NOT_SYNCED' })
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is awaiting curator approval', code: 'ACCOUNT_PENDING_APPROVAL' })
    }

    req.user = user
    req.auth = payload
    return next()
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(401).json({ error: 'Invalid or expired session', code: 'INVALID_SESSION' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required', code: 'ADMIN_REQUIRED' })
  }
  return next()
}
