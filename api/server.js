import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import authRoutes from './routes/auth.js'
import chatRoutes from './routes/chat.js'
import adminRoutes from './routes/admin.js'
import usageRoutes from './routes/usage.js'
import { publicSettingsRouter, adminSettingsRouter } from './routes/settings.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

app.use(helmet())

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4000',
  'https://shiftshack.org',
  'https://www.shiftshack.org',
  process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null,
  process.env.CLIENT_URL
].filter(Boolean)

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error(`Not allowed by CORS: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json())

const publicDir = join(__dirname, 'public')
if (existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    setHeaders: (res, path) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    }
  }))
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/config', publicSettingsRouter)
app.use('/auth', authRoutes)
app.use('/chat', chatRoutes)
app.use('/admin', adminRoutes)
app.use('/admin/settings', adminSettingsRouter)
app.use('/usage', usageRoutes)

app.get('*', (req, res, next) => {
  const indexPath = join(publicDir, 'index.html')
  if (existsSync(indexPath)) {
    return res.sendFile(indexPath)
  }
  next()
})

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`SHIFT Brain API running on port ${PORT}`)
})

