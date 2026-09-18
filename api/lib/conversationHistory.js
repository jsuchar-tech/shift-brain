import { supabase } from './supabase.js'

const MAX_HISTORY_TURNS = 6

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
    .limit(MAX_HISTORY_TURNS)

  if (error) throw error
  return (data || []).reverse().map(msg => ({ role: msg.role, content: msg.content }))
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
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      chunks_used: extras.chunks_used || [],
      tokens_in: extras.tokens_in || 0,
      tokens_out: extras.tokens_out || 0,
      latency_ms: extras.latency_ms || 0,
      language: extras.language,
      safety_triggered: extras.safety_triggered || false,
      reaction_emoji: extras.reaction_emoji || null
    })
    .select()
    .single()

  if (error) throw error
  return data
}
