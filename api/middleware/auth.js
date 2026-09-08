import { verifyToken } from '@clerk/backend'
import { supabase } from '../lib/supabase.js'
import dotenv from 'dotenv'

dotenv.config()

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    })

    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_user_id', payload.sub)
      .single()

    if (error || !user) {
      return res.status(401).json({ error: 'User not found' })
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account disabled' })
    }

    req.user = user

    Promise.allSettled([
      supabase.from('login_history').insert({
        user_id: user.id,
        ip_address: req.ip || req.headers['x-forwarded-for'],
        logged_in_at: new Date().toISOString(),
      }),
      supabase
        .from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', user.id),
    ]).catch((err) => console.error('Background activity log error:', err))

    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}