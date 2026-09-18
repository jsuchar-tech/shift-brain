import dotenv from 'dotenv'
import { fetchWithTimeout } from './http.js'

dotenv.config()

export async function embedQuery(text, { signal } = {}) {
  const response = await fetchWithTimeout('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`
    },
    body: JSON.stringify({
      input: [text],
      model: 'voyage-4-large',
      input_type: 'query'
    }),
    signal
  }, 15_000)

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Voyage API error (${response.status}): ${err.slice(0, 300)}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}
