import { createClerkClient } from '@clerk/backend'
import dotenv from 'dotenv'

dotenv.config()

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY
})

const { data: users } = await clerk.users.getUserList()
const user = users[0]

console.log('Generating sign-in token for:', user.emailAddresses[0]?.emailAddress)

// Create a sign-in token (valid for 30 days)
const signInToken = await clerk.signInTokens.createSignInToken({
  userId: user.id,
  expiresInSeconds: 2592000  // 30 days
})

console.log('\n=== SIGN IN TOKEN ===')
console.log(signInToken.token)
console.log('====================')
console.log('\nUse this URL to sign in and get a session:')
console.log(`http://localhost:4000/test-login.html?__clerk_ticket=${signInToken.token}`)