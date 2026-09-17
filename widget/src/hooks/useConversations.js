import { useState, useEffect, useCallback } from 'react'
import { fetchConversations, fetchConversation } from '../lib/api'

export function useConversations(getToken) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchConversations(getToken)
      setConversations(data.conversations || [])
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    refresh()
  }, [refresh])

  const loadThread = useCallback(async (id) => {
    const data = await fetchConversation(getToken, id)
    return data
  }, [getToken])

  return { conversations, loading, refresh, loadThread }
}
