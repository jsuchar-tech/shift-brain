import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'
import { requireAuth } from '../middleware/auth.js'
import { rateLimitPerUser } from '../middleware/rateLimit.js'
import { embedQuery } from '../lib/voyage.js'
import { retrieveChunks, formatChunksForPrompt, formatChunksForCitation } from '../lib/retrieval.js'
import { checkTokenLimits } from '../lib/tokenCheck.js'
import { checkSafetyTriggers } from '../lib/safety.js'
import { buildSystemPrompt } from '../lib/systemPrompt.js'
import { detectLanguage } from '../lib/detectLanguage.js'
import { getConversationHistory, createConversation, saveMessage } from '../lib/conversationHistory.js'
import { supabase } from '../lib/supabase.js'
import multer from 'multer'
import dotenv from 'dotenv'

dotenv.config()

const router = Router()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_MESSAGE_LENGTH = 6000

// NOTE: legacy .doc (application/msword) removed — that binary format
// can't be reliably parsed and was previously forwarded to Claude
// mislabeled as text/plain, producing garbage input.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('File type not supported'))
    }
  }
})

// POST /chat/upload
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const { originalname, mimetype, buffer, size } = req.file
    const timestamp = Date.now()
    const safeName = originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${req.user.id}/${timestamp}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(storagePath, buffer, {
        contentType: mimetype,
        upsert: false
      })

    if (uploadError) throw uploadError

    res.json({
      storage_path: storagePath,
      file_name: originalname,
      file_type: mimetype,
      file_size: size
    })
  } catch (err) {
    console.error('Upload error:', err)
    res.status(500).json({ error: 'Failed to upload file' })
  }
})

// Helper — download file from Supabase as a raw Buffer
async function getFileBuffer(storagePath) {
  const { data, error } = await supabase.storage
    .from('attachments')
    .download(storagePath)

  if (error) throw error

  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function getFileAsBase64(storagePath) {
  const buffer = await getFileBuffer(storagePath)
  return buffer.toString('base64')
}

async function extractDocxText(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  } catch (err) {
    console.error('DOCX extraction failed:', err)
    return ''
  }
}

// Helper — build Claude message content with optional attachment
async function buildUserMessageContent(message, attachment) {
  if (!attachment) {
    return message
  }

  const { storage_path, file_type, file_name } = attachment
  const isImage = file_type.startsWith('image/')

  if (isImage) {
    const base64 = await getFileAsBase64(storage_path)
    return [
      { type: 'image', source: { type: 'base64', media_type: file_type, data: base64 } },
      { type: 'text', text: message }
    ]
  }

  if (file_type === 'application/pdf') {
    const base64 = await getFileAsBase64(storage_path)
    return [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        title: file_name
      },
      { type: 'text', text: message }
    ]
  }

  if (file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const buffer = await getFileBuffer(storage_path)
    const text = await extractDocxText(buffer)
    if (!text.trim()) {
      return `[Note: the attached Word document "${file_name}" could not be read]\n\n${message}`
    }
    return [
      { type: 'document', source: { type: 'text', media_type: 'text/plain', data: text }, title: file_name },
      { type: 'text', text: message }
    ]
  }

  // Plain text fallback
  const buffer = await getFileBuffer(storage_path)
  const text = buffer.toString('utf-8')
  return [
    { type: 'document', source: { type: 'text', media_type: 'text/plain', data: text }, title: file_name },
    { type: 'text', text: message }
  ]
}

router.post('/', requireAuth, rateLimitPerUser, async (req, res) => {
  const startTime = Date.now()
  const { message, conversation_id, attachment = null } = req.body

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' })
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`
    })
  }

  // Attachments are only ever valid if they live under this user's own
  // storage prefix. storage_path is client-supplied, so without this
  // check a user could pass another user's path and have the server
  // read and forward that person's file to Claude on their behalf.
  if (attachment) {
    if (
      typeof attachment.storage_path !== 'string' ||
      !attachment.storage_path.startsWith(`${req.user.id}/`)
    ) {
      return res.status(403).json({ error: 'Invalid attachment' })
    }
  }

  // Language is detected from the message text itself rather than
  // trusting a client-supplied value — this also removes the need for
  // a manual language toggle in the UI.
  const language = detectLanguage(message)

  try {
    const limitCheck = await checkTokenLimits(req.user.id)
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'token_limit',
        reason: limitCheck.reason,
        message: limitCheck.message
      })
    }

    const safetyCheck = checkSafetyTriggers(message)
    if (safetyCheck.triggered) {
      await supabase.from('safety_events').insert({
        user_id: req.user.id,
        conversation_id: conversation_id || null,
        message_content: message,
        trigger_category: safetyCheck.category
      })

      if (conversation_id) {
        await saveMessage(conversation_id, 'user', message, { language, safety_triggered: true })
        await saveMessage(conversation_id, 'assistant', safetyCheck.message, { language, safety_triggered: true })
      }

      return res.status(200).json({
        response: safetyCheck.message,
        safety_triggered: true,
        category: safetyCheck.category
      })
    }

    let convId = conversation_id
    if (!convId) {
      const conversation = await createConversation(req.user.id, message, language)
      convId = conversation.id
    }

    const userMessage = await saveMessage(convId, 'user', message, { language })

    if (attachment) {
      await supabase.from('message_attachments').insert({
        message_id: userMessage.id,
        conversation_id: convId,
        user_id: req.user.id,
        file_name: attachment.file_name,
        file_type: attachment.file_type,
        file_size: attachment.file_size,
        storage_path: attachment.storage_path
      })
    }

    const queryEmbedding = await embedQuery(message)
    const chunks = await retrieveChunks(queryEmbedding, message)

    console.log('Retrieved chunks (after reranking):')
    chunks.forEach((c, i) => {
      const score = c.rerank_score !== undefined
        ? `rerank: ${c.rerank_score?.toFixed(3)}`
        : `similarity: ${c.similarity?.toFixed(3)}`
      console.log(`  [${i+1}] ${c.source_file_name} (${score})`)
      console.log(`       ${c.content.slice(0, 150).replace(/\n/g, ' ')}...`)
    })

    const contextText = formatChunksForPrompt(chunks)
    const citationData = formatChunksForCitation(chunks)

    const history = await getConversationHistory(convId)

    const userContent = await buildUserMessageContent(
      `Here are relevant excerpts from SHIFT's documents:\n\n${contextText}\n\n---\n\nBased on the above documents, please answer this question:\n\n${message}`,
      attachment
    )

    const messages = [...history, { role: 'user', content: userContent }]

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Conversation-Id', convId)

    res.write(`data: ${JSON.stringify({ type: 'conversation_id', conversation_id: convId })}\n\n`)

    let fullResponse = ''
    let inputTokens = 0
    let outputTokens = 0

const stream = anthropic.messages.stream({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 2048,
  system: buildSystemPrompt(),   // ← was buildSystemPrompt(language)
  messages
})

    stream.on('text', (text) => {
      fullResponse += text
      res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`)
    })

    stream.on('message', (msg) => {
      inputTokens = msg.usage.input_tokens
      outputTokens = msg.usage.output_tokens
    })

    await stream.finalMessage()

    const latencyMs = Date.now() - startTime

    await saveMessage(convId, 'assistant', fullResponse, {
      chunks_used: citationData,
      tokens_in: inputTokens,
      tokens_out: outputTokens,
      latency_ms: latencyMs,
      language
    })

    res.write(`data: ${JSON.stringify({ type: 'citations', citations: citationData })}\n\n`)
    res.write(`data: ${JSON.stringify({ type: 'done', tokens_in: inputTokens, tokens_out: outputTokens, latency_ms: latencyMs })}\n\n`)
    res.end()

  } catch (err) {
    console.error('Chat error:', err)
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to process message' })
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Something went wrong. Please try again.' })}\n\n`)
    res.end()
  }
})

// GET /chat/conversations
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, language, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) throw error

    res.json({
      conversations: data || []
    })
  } catch (err) {
    console.error('Conversations error:', err)
    res.status(500).json({
      error: 'Failed to fetch conversations'
    })
  }
})

// GET /chat/conversations/:id
router.get('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single()

    if (convError || !conversation) {
      return res.status(404).json({
        error: 'Conversation not found'
      })
    }

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (msgError) throw msgError

    const messageIds = messages.map(m => m.id)

    let attachments = []

    if (messageIds.length > 0) {
      const { data, error: attachmentError } = await supabase
        .from('message_attachments')
        .select('*')
        .in('message_id', messageIds)

      if (attachmentError) throw attachmentError

      attachments = data || []
    }

    const attachmentsByMessage = {}

    attachments.forEach(a => {
      if (!attachmentsByMessage[a.message_id]) {
        attachmentsByMessage[a.message_id] = []
      }

      attachmentsByMessage[a.message_id].push(a)
    })

    const messagesWithAttachments = messages.map(m => ({
      ...m,
      attachments: attachmentsByMessage[m.id] || []
    }))

    res.json({
      conversation,
      messages: messagesWithAttachments
    })
  } catch (err) {
    console.error('Conversation thread error:', err)
    res.status(500).json({
      error: 'Failed to fetch conversation'
    })
  }
})

export default router