import { useState, useCallback } from 'react'
import { streamChat } from '../lib/api'

export function useChat(getToken) {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [error, setError] = useState(null)

  const sendMessage = useCallback(
    async (text, attachment = null) => {
      if (!text.trim() || isLoading) return

      setIsLoading(true)
      setError(null)

      const userId = Date.now()

      setMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: text,
          id: userId,
          attachments:
            attachment && attachment.file_name
              ? [{ file_name: attachment.file_name }]
              : []
        }
      ])

      const assistantId = Date.now() + Math.random()
      let pendingText = ''
      let animationFrame = null

      const flushPendingText = () => {
        if (!pendingText) return
        const nextText = pendingText
        pendingText = ''
        setMessages(prev => prev.map(msg =>
          msg.id === assistantId ? { ...msg, content: msg.content + nextText } : msg
        ))
      }

      const cancelPendingFrame = () => {
        if (animationFrame !== null) cancelAnimationFrame(animationFrame)
        animationFrame = null
        flushPendingText()
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          id: assistantId,
          streaming: true
        }
      ])

      const newConvId = await streamChat({
        getToken,
        message: text,
        conversationId,
        attachment,

        onText: chunk => {
          pendingText += chunk
          if (animationFrame === null) {
            animationFrame = requestAnimationFrame(() => {
              animationFrame = null
              flushPendingText()
            })
          }
        },

        onReaction: ({ emoji }) => {
          if (!emoji) return
          setMessages(prev => prev.map(msg =>
            msg.id === userId ? { ...msg, reactionEmoji: emoji } : msg
          ))
        },

        onCitations: cits => {
          cancelPendingFrame()

          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId
                ? {
                    ...msg,
                    streaming: false,
                    citations: cits
                  }
                : msg
            )
          )
        },

        onDone: () => {
          cancelPendingFrame()
          setIsLoading(false)

          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId
                ? {
                    ...msg,
                    streaming: false
                  }
                : msg
            )
          )
        },

        onError: err => {
          if (animationFrame !== null) cancelAnimationFrame(animationFrame)
          animationFrame = null
          pendingText = ''
          setIsLoading(false)
          setError(err.message || 'Something went wrong')

          setMessages(prev =>
            prev.filter(msg => msg.id !== assistantId)
          )
        }
      })

      if (newConvId && !conversationId) {
        setConversationId(newConvId)
      }
    },
    [getToken, isLoading, conversationId]
  )

  const clearChat = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setError(null)
  }, [])

  const loadConversation = useCallback((conversation, msgs) => {
    setConversationId(conversation.id)

    setMessages(
      msgs.map(m => ({
        role: m.role,
        content: m.content,
        id: m.id,
        citations: m.chunks_used || [],
        attachments: m.attachments || [],
        reactionEmoji: m.reaction_emoji || null
      }))
    )
  }, [])

  return {
    messages,
    isLoading,
    conversationId,
    error,
    sendMessage,
    clearChat,
    loadConversation
  }
}
