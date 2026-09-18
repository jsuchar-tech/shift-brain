import { supabase } from './supabase.js'
import { fetchWithTimeout } from './http.js'
import dotenv from 'dotenv'
dotenv.config()

const TOP_K = 20
const RERANK_TOP_K = 6
const KEYWORD_K = 8
const MIN_RERANK_SCORE = 0.3

export async function retrieveChunks(queryEmbedding, queryText, { signal } = {}) {
  const { data: vectorResults, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_count: TOP_K
  })

  if (error) {
    console.error('Retrieval error:', error)
    throw error
  }

  const keywords = extractKeywords(queryText)
  let keywordResults = []

  if (keywords.length > 0) {
    const keywordFilter = keywords.map(k => `content.ilike.%${k}%`).join(',')
    const { data: kwData, error: keywordError } = await supabase
      .from('document_chunks')
      .select('id, content, source_type, source_file_name, source_url, page_number, slide_number, section_header')
      .or(keywordFilter)
      .limit(KEYWORD_K)

    if (keywordError) throw keywordError
    keywordResults = kwData || []
  }

  const seen = new Set((vectorResults || []).map(c => c.id))
  const merged = [
    ...(vectorResults || []),
    ...keywordResults.filter(c => !seen.has(c.id)).map(c => ({ ...c, similarity: 0.4 }))
  ]

  if (merged.length === 0) return []
  return rerankChunks(queryText, merged, signal)
}

async function rerankChunks(query, chunks, signal) {
  try {
    const documents = chunks.map(c => c.content)
    const response = await fetchWithTimeout('https://api.voyageai.com/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`
      },
      body: JSON.stringify({
        query,
        documents,
        model: 'rerank-2.5',
        top_k: RERANK_TOP_K,
        return_documents: false
      }),
      signal
    }, 20_000)

    if (!response.ok) {
      const err = await response.text()
      console.error(`Rerank API error (${response.status}):`, err.slice(0, 300))
      return chunks.slice(0, RERANK_TOP_K)
    }

    const data = await response.json()
    return data.data
      .filter(result => result.relevance_score >= MIN_RERANK_SCORE)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .map(result => ({ ...chunks[result.index], rerank_score: result.relevance_score }))
  } catch (err) {
    if (signal?.aborted) throw err
    console.error('Reranking failed, falling back to vector results:', err)
    return chunks.slice(0, RERANK_TOP_K)
  }
}

function extractKeywords(text) {
  const stopWords = new Set([
    'how', 'many', 'what', 'is', 'are', 'the', 'a', 'an', 'in', 'of',
    'to', 'and', 'or', 'for', 'with', 'on', 'at', 'this', 'that',
    'can', 'does', 'do', 'tell', 'me', 'about', 'where', 'when',
    'who', 'which', 'there', 'their', 'they', 'have', 'has', 'been',
    'from', 'into', 'than', 'more', 'some', 'any', 'all', 'but', 'not'
  ])

  return [...new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
  )].slice(0, 6)
}

export function formatChunksForPrompt(chunks) {
  const byFile = {}
  chunks.forEach(chunk => {
    const key = chunk.source_file_name
    if (!byFile[key]) {
      byFile[key] = {
        file_name: chunk.source_file_name,
        source_url: chunk.source_url,
        chunks: []
      }
    }
    byFile[key].chunks.push(chunk)
  })

  return Object.values(byFile).map(file => {
    const header = `[Document: ${file.file_name}]`
    const content = file.chunks.map(c => {
      let meta = ''
      if (c.page_number) meta += ` (page ${c.page_number})`
      if (c.slide_number) meta += ` (slide ${c.slide_number})`
      if (c.section_header) meta += ` — ${c.section_header}`
      return meta ? `${meta}:\n${c.content}` : c.content
    }).join('\n\n')
    return `${header}\n${content}`
  }).join('\n\n===\n\n')
}

export function formatChunksForCitation(chunks) {
  return chunks.map(chunk => ({
    chunk_id: chunk.id,
    file_name: chunk.source_file_name,
    source_url: chunk.source_url,
    page_number: chunk.page_number,
    slide_number: chunk.slide_number,
    section_header: chunk.section_header
  }))
}
