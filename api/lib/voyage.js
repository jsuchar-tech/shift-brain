import dotenv from 'dotenv'

dotenv.config()

export async function embedQuery(text) {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`
    },
body: JSON.stringify({
  input: [text],
  model: 'voyage-4-large',
  input_type: 'query'
})
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Voyage API error: ${err}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}