import { createClerkClient, verifyToken } from '@clerk/backend'
import dotenv from 'dotenv'

dotenv.config()

const secretKey = process.env.CLERK_SECRET_KEY

export const clerkClient = createClerkClient({ secretKey })

function configuredAuthorizedParties() {
  const configured = String(process.env.CLERK_AUTHORIZED_PARTIES || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)

  const applicationOrigins = [
    'https://shiftshack.org',
    'https://www.shiftshack.org',
    process.env.CLIENT_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : null,
    process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : null,
    process.env.NODE_ENV !== 'production' ? 'http://localhost:4000' : null
  ].filter(Boolean)

  return [...new Set([...configured, ...applicationOrigins])]
}

export async function verifySessionToken(token) {
  const options = {
    secretKey,
    authorizedParties: configuredAuthorizedParties()
  }

  if (process.env.CLERK_JWT_AUDIENCE) {
    options.audience = process.env.CLERK_JWT_AUDIENCE
  }

  return verifyToken(token, options)
}
