const API_URL = import.meta.env.VITE_API_URL || '/api'

async function getHeaders(getToken) {
  const token = await getToken()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
}

export async function fetchUsage(getToken) {
  const headers = await getHeaders(getToken)
  const res = await fetch(`${API_URL}/usage/me`, { headers })
  if (!res.ok) throw new Error('Failed to fetch usage')
  return res.json()
}

export async function fetchConversations(getToken) {
  const headers = await getHeaders(getToken)
  const res = await fetch(`${API_URL}/chat/conversations`, { headers })
  if (!res.ok) throw new Error('Failed to fetch conversations')
  return res.json()
}

export async function fetchConversation(getToken, id) {
  const headers = await getHeaders(getToken)
  const res = await fetch(`${API_URL}/chat/conversations/${id}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch conversation')
  return res.json()
}

export async function syncUser(getToken, userData) {
  const headers = await getHeaders(getToken)
  const res = await fetch(`${API_URL}/auth/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify(userData)
  })
  if (!res.ok) throw new Error('Failed to sync user')
  return res.json()
}

export async function updateLanguage(getToken, language) {
  const headers = await getHeaders(getToken)
  const res = await fetch(`${API_URL}/auth/me`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ language_preference: language })
  })
  if (!res.ok) throw new Error('Failed to update language')
  return res.json()
}

export async function streamChat({ getToken, message, conversationId, language, onText, onCitations, onDone, onError }) {
  const token = await getToken()

  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      language,
      attachment
    })
  })

  if (!res.ok) {
    const err = await res.json()
    onError(err)
    return null
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let conversationId_returned = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const data = JSON.parse(line.slice(6))

        if (data.type === 'conversation_id') {
          conversationId_returned = data.conversation_id
        } else if (data.type === 'text') {
          onText(data.text)
        } else if (data.type === 'citations') {
          onCitations(data.citations)
        } else if (data.type === 'done') {
          onDone(data)
        } else if (data.type === 'error') {
          onError(data)
        }
      } catch (e) {
        // Skip malformed chunks
      }
    }
  }

  return conversationId_returned
}
export async function uploadFile(getToken, file) {
  const token = await getToken()
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API_URL}/chat/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Upload failed')
  }
  return res.json()
}

export async function updateFontSize(getToken, fontSize) {
  const headers = await getHeaders(getToken)
  const res = await fetch(`${API_URL}/auth/me`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ font_size: fontSize })
  })
  if (!res.ok) throw new Error('Failed to update font size')
  return res.json()
}