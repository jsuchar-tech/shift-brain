import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import authRoutes from './routes/auth.js'
import chatRoutes from './routes/chat.js'
import adminRoutes from './routes/admin.js'
import usageRoutes from './routes/usage.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Dynamic CORS configuration including Railway deployment domains
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4000',
  'https://shiftshack.org',
  'https://www.shiftshack.org',
  process.env.RAILWAY_PUBLIC_DOMAIN ? `https://shift-brain-api-production.up.railway.app/` : null,
  process.env.CLIENT_URL
].filter(Boolean)

app.use(cors({
  origin: function(origin, callback) {
    // Allow server-to-server requests or CLI tools (like Postman/curl) where origin is undefined
    if (!origin) return callback(null, true)
    
    // Check exact matches or Railway app subdomains (*.up.railway.app)
    const isAllowed = allowedOrigins.includes(origin) || origin.endsWith('.up.railway.app')
    if (isAllowed) return callback(null, true)
    
    return callback(new Error(`Not allowed by CORS: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json())

// Serve built frontend static files
// Serve built widget files with explicit CORS headers
const publicDir = join(__dirname, 'public')
if (existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    setHeaders: (res, path) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    }
  }))
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/auth', authRoutes)
app.use('/chat', chatRoutes)
app.use('/admin', adminRoutes)
app.use('/usage', usageRoutes)

// SPA Fallback: Serve index.html for non-API frontend page reloads
app.get('*', (req, res, next) => {
  const indexPath = join(publicDir, 'index.html')
  if (existsSync(indexPath)) {
    return res.sendFile(indexPath)
  }
  next()
})

// 404 Handler for missing API endpoints
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message || err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`SHIFT Brain API running on port ${PORT}`)
})