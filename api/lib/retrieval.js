import { supabase } from './supabase.js'
import { fetchWithTimeout } from './http.js'
import { embedQuery } from './voyage.js'
import dotenv from 'dotenv'
dotenv.config()

const TOP_K = 20
const RERANK_POOL_K = 10
const FINAL_TOP_K = 6
const KEYWORD_K = 8
const MIN_RERANK_SCORE = 0.3
const MAX_PER_SOURCE = 4
const MAX_CONTEXT_CHARS = 16_000
const MAX_CHUNK_CHARS = 4_000
const RETRIEVAL_CACHE_TTL_MS = 5 * 60 * 1000
const RETRIEVAL_CACHE_MAX = 100
const retrievalCache = new Map()

export async function retrieveRelevantChunks(queryText, { signal } = {}) {
  const cacheKey = String(queryText || '').toLowerCase().replace(/\s+/g, ' ').trim()
  const cached = retrievalCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    // Refresh LRU order.
    retrievalCache.delete(cacheKey)
    retrievalCache.set(cacheKey, cached)
    return cached.chunks
  }
  if (cached) retrievalCache.delete(cacheKey)

  let queryEmbedding = null
  try {
    queryEmbedding = await embedQuery(queryText, { signal })
  } catch (error) {
    if (signal?.aborted) throw error
    console.error('Embedding failed, using keyword-only retrieval:', error)
  }

  const chunks = await retrieveChunks(queryEmbedding, queryText, {
    signal,
    skipRerank: !queryEmbedding
  })

  // Only cache fully ranked results. A temporary embedding outage should
  // recover immediately rather than pinning degraded results for five minutes.
  if (queryEmbedding && cacheKey) {
    retrievalCache.set(cacheKey, {
      chunks,
      expiresAt: Date.now() + RETRIEVAL_CACHE_TTL_MS
    })
    while (retrievalCache.size > RETRIEVAL_CACHE_MAX) {
      retrievalCache.delete(retrievalCache.keys().next().value)
    }
  }

  return chunks
}

export async function retrieveChunks(queryEmbedding, queryText, { signal, skipRerank = false } = {}) {
  const keywords = extractKeywords(queryText)
  const vectorRequest = queryEmbedding
    ? supabase.rpc('match_chunks', {
        query_embedding: queryEmbedding,
        match_count: TOP_K
      })
    : Promise.resolve({ data: [], error: null })

  const keywordRequest = keywords.length > 0
    ? (() => {
        const keywordFilter = keywords.map(k => `content.ilike.%${k}%`).join(',')
        return supabase
          .from('document_chunks')
          .select('id, content, source_type, source_file_name, source_url, page_number, slide_number, section_header')
          .or(keywordFilter)
          .limit(KEYWORD_K)
      })()
    : Promise.resolve({ data: [], error: null })

  // These searches are independent. Running them together removes one full
  // database round trip without adding any API calls.
  const [vectorResponse, keywordResponse] = await Promise.all([vectorRequest, keywordRequest])

  if (vectorResponse.error && keywordResponse.error) {
    console.error('Retrieval error:', vectorResponse.error)
    throw vectorResponse.error
  }
  if (vectorResponse.error) console.error('Vector retrieval failed, using keyword results:', vectorResponse.error)
  if (keywordResponse.error) console.error('Keyword retrieval failed, using vector results:', keywordResponse.error)

  const merged = deduplicateChunks([
    ...(vectorResponse.data || []),
    ...(keywordResponse.data || []).map(c => ({ ...c, similarity: 0.4 }))
  ])

  if (merged.length === 0) return []
  if (skipRerank) return selectDiverseChunks(rankByKeywordOverlap(queryText, merged))
  const ranked = await rerankChunks(queryText, merged, signal)
  return selectDiverseChunks(ranked)
}

function rankByKeywordOverlap(queryText, chunks) {
  const keywords = extractKeywords(queryText)
  return [...chunks].sort((a, b) => {
    const aText = String(a.content || '').toLowerCase()
    const bText = String(b.content || '').toLowerCase()
    const aScore = keywords.reduce((score, keyword) => score + (aText.includes(keyword) ? 1 : 0), 0)
    const bScore = keywords.reduce((score, keyword) => score + (bText.includes(keyword) ? 1 : 0), 0)
    return bScore - aScore
  })
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
        top_k: Math.min(RERANK_POOL_K, documents.length),
        return_documents: false
      }),
      signal
    }, 20_000)

    if (!response.ok) {
      const err = await response.text()
      console.error(`Rerank API error (${response.status}):`, err.slice(0, 300))
      return chunks.slice(0, RERANK_POOL_K)
    }

    const data = await response.json()
    return data.data
      .filter(result => result.relevance_score >= MIN_RERANK_SCORE)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .map(result => ({ ...chunks[result.index], rerank_score: result.relevance_score }))
  } catch (err) {
    if (signal?.aborted) throw err
    console.error('Reranking failed, falling back to vector results:', err)
    return chunks.slice(0, RERANK_POOL_K)
  }
}

function deduplicateChunks(chunks) {
  const ids = new Set()
  const contents = new Set()

  return chunks.filter(chunk => {
    if (!chunk?.content) return false
    if (chunk.id !== undefined && chunk.id !== null) {
      if (ids.has(chunk.id)) return false
      ids.add(chunk.id)
    }

    const fingerprint = chunk.content.toLowerCase().replace(/\s+/g, ' ').trim()
    if (contents.has(fingerprint)) return false
    contents.add(fingerprint)
    return true
  })
}

function selectDiverseChunks(chunks) {
  const selected = []
  const overflow = []
  const sourceCounts = new Map()

  for (const chunk of chunks) {
    const source = chunk.source_file_name || chunk.source_url || 'unknown'
    const count = sourceCounts.get(source) || 0
    if (count < MAX_PER_SOURCE) {
      selected.push(chunk)
      sourceCounts.set(source, count + 1)
    } else {
      overflow.push(chunk)
    }
  }

  return [...selected, ...overflow].slice(0, FINAL_TOP_K)
}

export function extractKeywords(text) {
  const stopWords = new Set([
    'how', 'many', 'what', 'is', 'are', 'the', 'a', 'an', 'in', 'of',
    'to', 'and', 'or', 'for', 'with', 'on', 'at', 'this', 'that',
    'can', 'does', 'do', 'tell', 'me', 'about', 'where', 'when',
    'who', 'which', 'there', 'their', 'they', 'have', 'has', 'been',
    'from', 'into', 'than', 'more', 'some', 'any', 'all', 'but', 'not'
  ])

  return [...new Set(
    text.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
  )].slice(0, 6)
}

export function packChunksForPrompt(chunks, maxChars = MAX_CONTEXT_CHARS) {
  const blocks = []
  const usedChunks = []
  let remaining = maxChars

  for (const chunk of chunks) {
    const location = [
      chunk.page_number ? `page ${chunk.page_number}` : null,
      chunk.slide_number ? `slide ${chunk.slide_number}` : null,
      chunk.section_header || null
    ].filter(Boolean).join(' · ')
    const header = `[Source: ${chunk.source_file_name || 'Untitled'}${location ? ` · ${location}` : ''}]`
    const separatorCost = blocks.length > 0 ? 7 : 0
    const available = Math.min(MAX_CHUNK_CHARS, remaining - header.length - separatorCost - 2)
    if (available < 120) continue

    const rawContent = String(chunk.content || '').trim()
    const content = rawContent.length > available
      ? `${rawContent.slice(0, Math.max(0, available - 1)).trimEnd()}…`
      : rawContent
    if (!content) continue

    const block = `${header}\n${content}`
    blocks.push(block)
    usedChunks.push(chunk)
    remaining -= block.length + separatorCost
    if (remaining < 120) break
  }

  return {
    text: blocks.join('\n\n===\n\n'),
    chunks: usedChunks
  }
}

export function formatChunksForPrompt(chunks) {
  return packChunksForPrompt(chunks).text
}

export function formatChunksForCitation(chunks) {
  const seen = new Set()
  return chunks.filter(chunk => {
    const key = chunk.id ?? `${chunk.source_file_name}:${chunk.page_number}:${chunk.slide_number}:${chunk.section_header}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map(chunk => ({
    chunk_id: chunk.id,
    file_name: chunk.source_file_name,
    source_url: chunk.source_url,
    page_number: chunk.page_number,
    slide_number: chunk.slide_number,
    section_header: chunk.section_header
  }))
}
