import { useState, useEffect, useCallback } from 'react'
import { fetchUsage } from '../lib/api'

export function useTokenUsage(getToken) {
  const [usage, setUsage] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchUsage(getToken)
      setUsage(data)
    } catch (err) {
      console.error('Failed to fetch usage:', err)
    }
  }, [getToken])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { usage, refresh }
}