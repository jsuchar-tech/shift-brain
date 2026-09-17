import { useState, useEffect, useCallback } from 'react'
import { fetchConversations, fetchConversation } from '../lib/api'

export function useConversations(getToken) {
  const [conversations, setConversations] = useState([])

  const refresh = useCallback(async () => {
    try {
      const data = await fetchConversations(getToken)
      setConversations(data.conversations || [])
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    }
  }, [getToken])

  useEffect(() => {
    refresh()
  }, [refresh])

  const loadThread = useCallback(async (id) => {
    const data = await fetchConversation(getToken, id)
    return data
  }, [getToken])

  return { conversations, refresh, loadThread }
}
