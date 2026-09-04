import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '../middleware/auth.js'
import { rateLimitPerUser } from '../middleware/rateLimit.js'
import { embedQuery } from '../lib/voyage.js'
import { retrieveChunks, formatChunksForPrompt, formatChunksForCitation } from '../lib/retrieval.js'
import { checkTokenLimits } from '../lib/tokenCheck.js'
import { checkSafetyTriggers } from '../lib/safety.js'
import { buildSystemPrompt } from '../lib/systemPrompt.js'
import { getConversationHistory, createConversation, saveMessage } from '../lib/conversationHistory.js'
import { supabase } from '../lib/supabase.js'
import dotenv from 'dotenv'

dotenv.config()

const router = Router()
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

router.post('/', requireAuth, rateLimitPerUser, async (req, res) => {
  const startTime = Date.now()
  const {
    message,
    conversation_id,
    language = 'en'
  } = req.body

  // Validate input
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' })
  }

  try {
    // Step 1 — Check token limits
    const limitCheck = await checkTokenLimits(req.user.id)
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'token_limit',
        reason: limitCheck.reason,
        message: limitCheck.message
      })
    }

    // Step 2 — Check safety guardrails
    const safetyCheck = checkSafetyTriggers(message)
    if (safetyCheck.triggered) {
      // Log safety event
      await supabase.from('safety_events').insert({
        user_id: req.user.id,
        conversation_id: conversation_id || null,
        message_content: message,
        trigger_category: safetyCheck.category
      })

      // Save to conversation if exists
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

    // Step 3 — Create or continue conversation
    let convId = conversation_id
    if (!convId) {
      const conversation = await createConversation(req.user.id, message, language)
      convId = conversation.id
    }

    // Step 4 — Save user message
    await saveMessage(convId, 'user', message, { language })

    // Step 5 — Embed the query
    const queryEmbedding = await embedQuery(message)

    // Step 6 — Retrieve relevant chunks
    const chunks = await retrieveChunks(queryEmbedding, message)
    const contextText = formatChunksForPrompt(chunks)
    const citationData = formatChunksForCitation(chunks)

    // Step 7 — Get conversation history
    const history = await getConversationHistory(convId)

    // Step 8 — Build messages array for Claude
    const messages = [
      ...history,
      {
        role: 'user',
        content: `Here are relevant excerpts from SHIFT's documents:\n\n${contextText}\n\n---\n\nBased on the above documents, please answer this question:\n\n${message}`
      }
    ]

    // Step 9 — Set up SSE streaming
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Conversation-Id', convId)

    // Send conversation ID immediately so frontend can store it
    res.write(`data: ${JSON.stringify({ type: 'conversation_id', conversation_id: convId })}\n\n`)

    // Step 10 — Stream Claude response
    let fullResponse = ''
    let inputTokens = 0
    let outputTokens = 0

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      system: buildSystemPrompt(language),
      messages
    })

    stream.on('text', (text) => {
      fullResponse += text
      res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`)
    })

    stream.on('message', (message) => {
      inputTokens = message.usage.input_tokens
      outputTokens = message.usage.output_tokens
    })

    await stream.finalMessage()

    const latencyMs = Date.now() - startTime

    // Step 11 — Save assistant response with metadata
    await saveMessage(convId, 'assistant', fullResponse, {
      chunks_used: citationData,
      tokens_in: inputTokens,
      tokens_out: outputTokens,
      latency_ms: latencyMs,
      language
    })

    // Step 12 — Send citations and done signal
    res.write(`data: ${JSON.stringify({
      type: 'citations',
      citations: citationData
    })}\n\n`)

    res.write(`data: ${JSON.stringify({
      type: 'done',
      tokens_in: inputTokens,
      tokens_out: outputTokens,
      latency_ms: latencyMs
    })}\n\n`)

    res.end()

  } catch (err) {
    console.error('Chat error:', err)

    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to process message' })
    }

    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: 'Something went wrong. Please try again.'
    })}\n\n`)
    res.end()
  }
})

// GET /chat/conversations
// List past conversations for current user
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, language, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) throw error
    res.json({ conversations: data })
  } catch (err) {
    console.error('Conversations error:', err)
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
})

// GET /chat/conversations/:id
// Get full conversation thread
router.get('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single()

    if (convError || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    // Get messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (msgError) throw msgError

    res.json({ conversation, messages })
  } catch (err) {
    console.error('Conversation thread error:', err)
    res.status(500).json({ error: 'Failed to fetch conversation' })
  }
})

export default router