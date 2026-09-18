import { useState, useCallback, useEffect, useRef } from 'react'
import { streamChat } from '../lib/api'

export function useChat(getToken) {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [error, setError] = useState(null)
  const activeRequestRef = useRef(null)

  useEffect(() => () => activeRequestRef.current?.abort(), [])

  const sendMessage = useCallback(
    async (text, attachment = null) => {
      if (!text.trim() || isLoading) return

      setIsLoading(true)
      setError(null)
      const requestController = new AbortController()
      activeRequestRef.current = requestController

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

      let newConvId = null

      try {
        newConvId = await streamChat({
          getToken,
          message: text,
          conversationId,
          attachment,

          onConversationId: id => {
            if (id) setConversationId(id)
          },

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
            setError(err.message || err.error || 'Something went wrong')

            setMessages(prev =>
              prev.filter(msg => msg.id !== assistantId)
            )
          },
          signal: requestController.signal
        })
      } catch (err) {
        if (animationFrame !== null) cancelAnimationFrame(animationFrame)
        animationFrame = null
        pendingText = ''
        setError(err?.message || 'Unable to send your message. Please try again.')
        setMessages(prev => prev.filter(msg => msg.id !== assistantId))
      } finally {
        if (activeRequestRef.current === requestController) {
          activeRequestRef.current = null
          setIsLoading(false)
        }
      }

      if (newConvId && !conversationId) {
        setConversationId(newConvId)
      }
    },
    [getToken, isLoading, conversationId]
  )

  const clearChat = useCallback(() => {
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    setMessages([])
    setConversationId(null)
    setError(null)
    setIsLoading(false)
  }, [])

  const loadConversation = useCallback((conversation, msgs) => {
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    setIsLoading(false)
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
