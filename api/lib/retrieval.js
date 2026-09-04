import { supabase } from './supabase.js'
import dotenv from 'dotenv'
dotenv.config()

const TOP_K = 20        // candidates from vector search
const RERANK_TOP_K = 6  // final chunks sent to Claude after reranking
const KEYWORD_K = 8
const MIN_RERANK_SCORE = 0.3  // drop chunks the reranker doesn't consider relevant

export async function retrieveChunks(queryEmbedding, queryText) {
  // Step 1 — vector similarity search
  const { data: vectorResults, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_count: TOP_K
  })

  if (error) {
    console.error('Retrieval error:', error)
    throw error
  }

  // Step 2 — keyword fallback
  const keywords = extractKeywords(queryText)
  let keywordResults = []

  if (keywords.length > 0) {
    const keywordFilter = keywords.map(k => `content.ilike.%${k}%`).join(',')
    const { data: kwData } = await supabase
      .from('document_chunks')
      .select('id, content, source_type, source_file_name, source_url, page_number, slide_number, section_header')
      .or(keywordFilter)
      .limit(KEYWORD_K)

    keywordResults = kwData || []
  }

  // Step 3 — merge and deduplicate
  const seen = new Set((vectorResults || []).map(c => c.id))
  const merged = [
    ...(vectorResults || []),
    ...keywordResults.filter(c => !seen.has(c.id)).map(c => ({ ...c, similarity: 0.4 }))
  ]

  if (merged.length === 0) return []

  // Step 4 — rerank and filter out weak matches.
  // The result may legitimately contain fewer than RERANK_TOP_K chunks,
  // or be empty — that's correct behaviour when nothing is truly relevant,
  // and lets the system prompt's "missing information" rule kick in cleanly
  // instead of the model straining to synthesize an answer from noise.
  const reranked = await rerankChunks(queryText, merged)
  return reranked
}

async function rerankChunks(query, chunks) {
  try {
    const documents = chunks.map(c => c.content)

    const response = await fetch('https://api.voyageai.com/v1/rerank', {
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
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Rerank API error:', err)
      // Fall back to vector results if reranking fails
      return chunks.slice(0, RERANK_TOP_K)
    }

    const data = await response.json()

    // Map reranked indices back to original chunks, dropping anything
    // below the relevance floor so weak matches don't dilute the context
    return data.data
      .filter(result => result.relevance_score >= MIN_RERANK_SCORE)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .map(result => ({
        ...chunks[result.index],
        rerank_score: result.relevance_score
      }))

  } catch (err) {
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