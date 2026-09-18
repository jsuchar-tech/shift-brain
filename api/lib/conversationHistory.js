import { supabase } from './supabase.js'

const MAX_HISTORY_TURNS = 6
const MAX_HISTORY_CHARS = 16_000
const MAX_RETRIEVAL_QUERY_CHARS = 1_200
const FOLLOW_UP_MAX_WORDS = 14
const FOLLOW_UP_PREFIX = /^(and|also|but|so|then|what about|how about|why|when|where|which|who|can you|could you|does that|is that|are they|what does that|tell me more)\b/i
const FOLLOW_UP_REFERENCE = /\b(it|that|this|they|them|those|these|one|ones|same|former|latter)\b/i

export async function conversationBelongsToUser(conversationId, userId) {
  if (!conversationId || !userId) return false

  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

export async function getConversationHistory(conversationId) {
  if (!conversationId) return []

  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MAX_HISTORY_TURNS)

  if (error) throw error
  return compactHistory((data || []).reverse())
}

function compactHistory(messages) {
  const selected = []
  let remaining = MAX_HISTORY_CHARS

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!['user', 'assistant'].includes(message?.role)) continue
    const content = String(message.content || '').trim()
    if (!content) continue

    if (content.length > remaining) break
    selected.unshift({ role: message.role, content })
    remaining -= content.length
  }

  // Claude accepts consecutive same-role messages, but merging them produces a
  // smaller, cleaner prompt and handles histories left by interrupted requests.
  const normalized = []
  for (const message of selected) {
    const previous = normalized[normalized.length - 1]
    if (previous?.role === message.role) {
      previous.content += `\n\n${message.content}`
    } else {
      normalized.push({ ...message })
    }
  }

  // A history slice must start with a participant turn. The current question
  // is appended later by the chat route.
  while (normalized[0]?.role === 'assistant') normalized.shift()
  return normalized
}

// Resolve short/contextual follow-ups for retrieval without another model call.
// The main Claude prompt already receives normal chat history; this only helps
// the existing embedding and reranking calls search for the right topic.
export function buildRetrievalQuery(history, message) {
  const current = String(message || '').trim()
  if (!current) return ''

  const wordCount = current.match(/[\p{L}\p{N}]+/gu)?.length || 0
  const looksContextual = wordCount <= 5 ||
    FOLLOW_UP_PREFIX.test(current) ||
    (wordCount <= FOLLOW_UP_MAX_WORDS && FOLLOW_UP_REFERENCE.test(current))
  if (!looksContextual) return current

  const previousUserMessage = [...(history || [])]
    .reverse()
    .find(item => item?.role === 'user' && String(item.content || '').trim())

  if (!previousUserMessage) return current

  const labelsLength = 'Earlier question:\n\nFollow-up:\n'.length
  const availableForPrevious = Math.max(
    0,
    MAX_RETRIEVAL_QUERY_CHARS - current.length - labelsLength
  )
  const previous = String(previousUserMessage.content).trim().slice(0, availableForPrevious)
  if (!previous) return current

  return `Earlier question: ${previous}\n\nFollow-up: ${current}`
}

export async function createConversation(userId, firstMessage, language) {
  const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? '...' : '')

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title, language })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function saveMessage(conversationId, role, content, extras = {}) {
  const payload = {
    conversation_id: conversationId,
    role,
    content,
    chunks_used: extras.chunks_used || [],
    tokens_in: extras.tokens_in || 0,
    tokens_out: extras.tokens_out || 0,
    latency_ms: extras.latency_ms || 0,
    language: extras.language,
    safety_triggered: extras.safety_triggered || false
  }

  // Only send the optional reaction column when a caller supplies a reaction.
  // This keeps regular chat available if application code is deployed shortly
  // before the corresponding database migration reaches PostgREST's cache.
  if (Object.hasOwn(extras, 'reaction_emoji')) {
    payload.reaction_emoji = extras.reaction_emoji || null
  }

  let result = await supabase
    .from('messages')
    .insert(payload)
    .select()
    .single()

  // A missing optional reaction column must not prevent a safety response from
  // being stored and returned. The reaction remains visible for the live reply
  // and will persist after the migration below is applied.
  if (
    result.error?.code === 'PGRST204' &&
    result.error?.message?.includes('reaction_emoji') &&
    Object.hasOwn(payload, 'reaction_emoji')
  ) {
    delete payload.reaction_emoji
    result = await supabase
      .from('messages')
      .insert(payload)
      .select()
      .single()
  }

  if (result.error) throw result.error
  return result.data
}
