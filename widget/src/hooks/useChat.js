import { useState, useCallback } from 'react'
import { streamChat } from '../lib/api'

export function useChat(getToken) {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [citations, setCitations] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [error, setError] = useState(null)

  const sendMessage = useCallback(async (text, attachment = null) => {
    if (!text.trim() || isLoading) return

    setIsLoading(true)
    setError(null)
    setCitations([])

    const userId = Date.now()
    setMessages(prev => [...prev, {
      role: 'user',
      content: text,
      id: userId,
      attachments: attachment ? [{ file_name: attachment.file_name }] : []
    }])

    const assistantId = Date.now() + Math.random()
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId, streaming: true }])

    const newConvId = await streamChat({
      getToken,
      message: text,
      conversationId,
      attachment,
      onText: (chunk) => {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantId ? { ...msg, content: msg.content + chunk } : msg
        ))
      },
      onCitations: (cits) => {
        setCitations(cits)
        setMessages(prev => prev.map(msg =>
          msg.id === assistantId ? { ...msg, streaming: false, citations: cits } : msg
        ))
      },
      onDone: () => {
        setIsLoading(false)
        setMessages(prev => prev.map(msg =>
          msg.id === assistantId ? { ...msg, streaming: false } : msg
        ))
      },
      onError: (err) => {
        setIsLoading(false)
        setError(err.message || 'Something went wrong')
        setMessages(prev => prev.filter(msg => msg.id !== assistantId))
      }
    })

    if (newConvId && !conversationId) {
      setConversationId(newConvId)
    }
  }, [getToken, isLoading, conversationId])

  const clearChat = useCallback(() => {
    setMessages([])
    setCitations([])
    setConversationId(null)
    setError(null)
  }, [])

  const loadConversation = useCallback((conversation, msgs) => {
    setConversationId(conversation.id)
    setMessages(msgs.map(m => ({
      role: m.role,
      content: m.content,
      id: m.id,
      citations: m.chunks_used || [],
      attachments: m.attachments || []
    })))
    setCitations([])
  }, [])

  return { messages, isLoading, citations, conversationId, error, sendMessage, clearChat, loadConversation }
}