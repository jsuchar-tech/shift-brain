import { supabase } from './supabase.js'
import { fetchWithTimeout } from './http.js'
import { embedQueries } from './voyage.js'
import dotenv from 'dotenv'

dotenv.config()

const VECTOR_K = 30
const KEYWORD_K = 30
const METADATA_K = 24
const ANCHOR_K = 24
const RERANK_INPUT_K = 40
const RERANK_OUTPUT_K = 20
const FINAL_TOP_K = 10
const MAX_PER_SOURCE = 6
const MAX_CONTEXT_CHARS = 30_000
const MAX_CHUNK_CHARS = 5_000
const NEIGHBOR_PARENT_K = 5
const RETRIEVAL_CACHE_TTL_MS = 5 * 60 * 1000
const RETRIEVAL_CACHE_MAX = 100
const RRF_K = 60
const SELECTED_FIELDS = [
  'id', 'content', 'source_type', 'source_file_id', 'source_file_name',
  'source_url', 'page_number', 'slide_number', 'section_header',
  'last_ingested_at'
].join(', ')

const retrievalCache = new Map()

export function clearRetrievalCache() {
  retrievalCache.clear()
}

export async function retrieveRelevantChunks(queryInput, { signal } = {}) {
  const queries = normalizeQueries(queryInput)
  if (queries.length === 0) return []

  const cacheKey = queries.map(normalizeText).join('\n---\n')
  const cached = retrievalCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    retrievalCache.delete(cacheKey)
    retrievalCache.set(cacheKey, cached)
    return cached.chunks
  }
  if (cached) retrievalCache.delete(cacheKey)

  let embeddings = []
  try {
    embeddings = await embedQueries(queries, { signal })
  } catch (error) {
    if (signal?.aborted) throw error
    console.error('Embedding failed, using lexical retrieval:', error)
  }

  const chunks = await retrieveChunks(embeddings, queries, {
    signal,
    skipRerank: embeddings.length === 0
  })

  if (embeddings.length > 0 && cacheKey) {
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

export async function retrieveChunks(queryEmbeddings, queryInput, { signal, skipRerank = false } = {}) {
  const queries = normalizeQueries(queryInput)
  const primaryQuery = queries[0] || ''
  const searchText = queries.join(' ')
  const keywords = extractKeywords(searchText)
  const anchors = selectAnchorKeywords(keywords)

  const vectorRequests = (queryEmbeddings || []).map(queryEmbedding =>
    supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_count: VECTOR_K
    })
  )

  const keywordRequest = keywords.length > 0
    ? supabase.from('document_chunks').select(SELECTED_FIELDS)
        .or(buildSearchFilter(keywords.slice(0, 8))).limit(KEYWORD_K)
    : Promise.resolve({ data: [], error: null })

  const metadataRequest = keywords.length > 0
    ? supabase.from('document_chunks').select(SELECTED_FIELDS)
        .or(keywords.slice(0, 8).flatMap(keyword => [
          `source_file_name.ilike.%${keyword}%`,
          `section_header.ilike.%${keyword}%`
        ]).join(','))
        .order('last_ingested_at', { ascending: false }).limit(METADATA_K)
    : Promise.resolve({ data: [], error: null })

  const exactMetadataRequest = keywords.length > 0
    ? (() => {
        let request = supabase.from('document_chunks').select(SELECTED_FIELDS)
        for (const keyword of keywords.slice(0, 5)) {
          request = request.ilike('source_file_name', `%${keyword}%`)
        }
        return request.order('last_ingested_at', { ascending: false }).limit(METADATA_K)
      })()
    : Promise.resolve({ data: [], error: null })

  const anchorRequest = anchors.length > 0
    ? supabase.from('document_chunks').select(SELECTED_FIELDS)
        .or(buildSearchFilter(anchors))
        .order('last_ingested_at', { ascending: false }).limit(ANCHOR_K)
    : Promise.resolve({ data: [], error: null })

  const responses = await Promise.all([
    ...vectorRequests,
    keywordRequest,
    metadataRequest,
    exactMetadataRequest,
    anchorRequest
  ])
  const vectorResponses = responses.slice(0, vectorRequests.length)
  const [keywordResponse, metadataResponse, exactMetadataResponse, anchorResponse] = responses.slice(vectorRequests.length)
  const allResponses = [
    ...vectorResponses, keywordResponse, metadataResponse, exactMetadataResponse, anchorResponse
  ]

  if (allResponses.every(response => response.error)) {
    console.error('Retrieval error:', allResponses[0]?.error)
    throw allResponses[0]?.error
  }
  for (const response of allResponses) {
    if (response.error) console.error('A retrieval channel failed:', response.error)
  }

  const rankedLists = [
    ...vectorResponses.map((response, index) => ({
      channel: `vector_${index}`,
      weight: index === 0 ? 1.25 : 1,
      chunks: response.data || []
    })),
    { channel: 'keyword', weight: 1.1, chunks: rankByLocalScore(primaryQuery, keywordResponse.data || []) },
    { channel: 'metadata', weight: 1.35, chunks: rankByLocalScore(primaryQuery, metadataResponse.data || []) },
    { channel: 'exact_metadata', weight: 1.8, chunks: rankByLocalScore(primaryQuery, exactMetadataResponse.data || []) },
    { channel: 'entity', weight: 1.5, chunks: rankByLocalScore(primaryQuery, anchorResponse.data || []) }
  ]
  const merged = fuseRankedLists(rankedLists)

  if (process.env.DEBUG_RETRIEVAL === 'true') {
    console.log('Retrieval candidate counts:', {
      queries, keywords, anchors,
      vectors: vectorResponses.map(response => response.data?.length || 0),
      keyword: keywordResponse.data?.length || 0,
      metadata: metadataResponse.data?.length || 0,
      exactMetadata: exactMetadataResponse.data?.length || 0,
      entity: anchorResponse.data?.length || 0,
      fused: merged.length
    })
  }

  if (merged.length === 0) return []
  const pool = buildRerankCandidatePool(searchText, merged)
  const ranked = skipRerank
    ? rankByLocalScore(searchText, pool)
    : await rerankChunks(searchText, pool, signal)
  const selected = selectDiverseChunks(rankFinalCandidates(searchText, ranked))
  return expandWithNeighbors(selected)
}

function normalizeQueries(queryInput) {
  const values = Array.isArray(queryInput) ? queryInput : [queryInput]
  return [...new Set(values
    .map(value => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean))].slice(0, 3)
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function buildSearchFilter(keywords) {
  return keywords.flatMap(keyword => [
    `content.ilike.%${keyword}%`,
    `source_file_name.ilike.%${keyword}%`,
    `section_header.ilike.%${keyword}%`
  ]).join(',')
}

function chunkKey(chunk) {
  if (chunk?.id !== undefined && chunk?.id !== null) return `id:${chunk.id}`
  return `content:${normalizeText(chunk?.content)}`
}

export function fuseRankedLists(lists) {
  const candidates = new Map()
  for (const { channel, weight = 1, chunks = [] } of lists) {
    chunks.forEach((chunk, index) => {
      if (!chunk?.content) return
      const key = chunkKey(chunk)
      const existing = candidates.get(key) || {
        ...chunk,
        similarity: Number(chunk.similarity || 0),
        retrieval_score: 0,
        retrieval_channels: []
      }
      existing.retrieval_score += weight / (RRF_K + index + 1)
      existing.similarity = Math.max(existing.similarity, Number(chunk.similarity || 0))
      if (!existing.retrieval_channels.includes(channel)) existing.retrieval_channels.push(channel)
      candidates.set(key, existing)
    })
  }
  return [...candidates.values()]
    .sort((a, b) => b.retrieval_score - a.retrieval_score)
}

function buildRerankCandidatePool(queryText, chunks) {
  const lexical = rankByLocalScore(queryText, chunks).slice(0, 28)
  const fused = [...chunks]
    .sort((a, b) => Number(b.retrieval_score || 0) - Number(a.retrieval_score || 0))
    .slice(0, 28)
  const semantic = [...chunks]
    .sort((a, b) => Number(b.similarity || 0) - Number(a.similarity || 0))
    .slice(0, 20)
  return deduplicateChunks([...lexical, ...fused, ...semantic]).slice(0, RERANK_INPUT_K)
}

function rankByLocalScore(queryText, chunks) {
  return [...chunks].sort((a, b) =>
    localRetrievalScore(queryText, b) - localRetrievalScore(queryText, a)
  )
}

export function localRetrievalScore(queryText, chunk) {
  const query = normalizeText(queryText)
  const keywords = extractKeywords(query)
  const anchors = selectAnchorKeywords(keywords)
  const content = normalizeText(chunk.content)
  const metadata = normalizeText([chunk.source_file_name, chunk.section_header].filter(Boolean).join(' '))
  const searchable = `${metadata} ${content}`
  const phrase = query.replace(/^(earlier question|follow-up|current question):?\s*/g, '').trim()
  const keywordMatches = keywords.filter(keyword => searchable.includes(keyword)).length
  const metadataMatches = keywords.filter(keyword => metadata.includes(keyword)).length
  const anchorMatches = anchors.filter(keyword => searchable.includes(keyword)).length
  const coverage = keywords.length > 0 ? keywordMatches / keywords.length : 0
  const phraseInContent = phrase.length >= 8 && content.includes(phrase) ? 1 : 0
  const phraseInMetadata = phrase.length >= 5 && metadata.includes(phrase) ? 1 : 0
  const channelBreadth = chunk.retrieval_channels?.length || 0

  return coverage * 8 + keywordMatches * 1.2 + metadataMatches * 2.4 +
    anchorMatches * 3.5 + phraseInContent * 5 + phraseInMetadata * 10 +
    Number(chunk.similarity || 0) * 4 + Number(chunk.retrieval_score || 0) * 120 +
    channelBreadth * 0.5
}

export function selectAnchorKeywords(keywords) {
  const lowSignalTerms = new Set([
    'activity', 'activities', 'campaign', 'campaigns', 'city', 'cities',
    'detail', 'details', 'document', 'documents', 'example', 'examples',
    'project', 'projects', 'resource', 'resources', 'programme', 'programmes',
    'information', 'question', 'answer'
  ])
  const specific = keywords.filter(keyword => !lowSignalTerms.has(keyword))
  return (specific.length > 0 ? specific : keywords)
    .sort((a, b) => b.length - a.length).slice(0, 3)
}

async function rerankChunks(query, chunks, signal) {
  try {
    const documents = chunks.map(chunk => [
      `Title: ${chunk.source_file_name || 'Untitled'}`,
      chunk.section_header ? `Section: ${chunk.section_header}` : null,
      chunk.page_number ? `Page: ${chunk.page_number}` : null,
      chunk.slide_number ? `Slide: ${chunk.slide_number}` : null,
      '', chunk.content
    ].filter(value => value !== null).join('\n'))
    const response = await fetchWithTimeout('https://api.voyageai.com/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`
      },
      body: JSON.stringify({
        query, documents, model: 'rerank-2.5',
        top_k: Math.min(RERANK_OUTPUT_K, documents.length),
        return_documents: false
      }),
      signal
    }, 20_000)
    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`Rerank API error (${response.status}):`, errorBody.slice(0, 300))
      return rankByLocalScore(query, chunks).slice(0, RERANK_OUTPUT_K)
    }
    const data = await response.json()
    return data.data.sort((a, b) => b.relevance_score - a.relevance_score)
      .map(result => ({ ...chunks[result.index], rerank_score: result.relevance_score }))
  } catch (error) {
    if (signal?.aborted) throw error
    console.error('Reranking failed, using local rank:', error)
    return rankByLocalScore(query, chunks).slice(0, RERANK_OUTPUT_K)
  }
}

function rankFinalCandidates(queryText, chunks) {
  return [...chunks].map(chunk => ({
    ...chunk,
    final_score: Number(chunk.rerank_score || 0) * 12 +
      localRetrievalScore(queryText, chunk) * 0.22
  })).sort((a, b) => b.final_score - a.final_score)
}

function deduplicateChunks(chunks) {
  const seen = new Set()
  return chunks.filter(chunk => {
    if (!chunk?.content) return false
    const key = chunkKey(chunk)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function selectDiverseChunks(chunks) {
  const selected = []
  const overflow = []
  const sourceCounts = new Map()
  for (const chunk of chunks) {
    const source = chunk.source_file_id || chunk.source_file_name || chunk.source_url || 'unknown'
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

async function expandWithNeighbors(chunks) {
  const parents = chunks
    .filter(chunk => chunk.id !== undefined && chunk.id !== null && chunk.source_file_id)
    .slice(0, NEIGHBOR_PARENT_K)
  if (parents.length === 0) return chunks

  try {
    const { data: indexRows, error: indexError } = await supabase
      .from('document_chunks').select('id, chunk_index')
      .in('id', parents.map(chunk => chunk.id))
    if (indexError || !indexRows?.length) return chunks

    const indexById = new Map(indexRows.map(row => [String(row.id), row.chunk_index]))
    const indexedParents = parents.filter(parent => Number.isInteger(indexById.get(String(parent.id))))
    const responses = await Promise.all(indexedParents.map(parent => {
      const index = indexById.get(String(parent.id))
      let request = supabase.from('document_chunks').select(`${SELECTED_FIELDS}, chunk_index`)
        .eq('source_file_id', parent.source_file_id)
        .gte('chunk_index', Math.max(0, index - 1)).lte('chunk_index', index + 1)
      request = parent.page_number === null || parent.page_number === undefined
        ? request.is('page_number', null)
        : request.eq('page_number', parent.page_number)
      request = parent.slide_number === null || parent.slide_number === undefined
        ? request.is('slide_number', null)
        : request.eq('slide_number', parent.slide_number)
      request = parent.section_header
        ? request.eq('section_header', parent.section_header)
        : request.is('section_header', null)
      return request.order('chunk_index', { ascending: true })
    }))

    const expanded = []
    indexedParents.forEach((parent, index) => {
      const response = responses[index]
      if (!response || response.error) {
        expanded.push(parent)
        return
      }
      expanded.push(...(response.data || []).map(neighbor => ({
        ...neighbor,
        is_neighbor: String(neighbor.id) !== String(parent.id),
        neighbor_of: parent.id,
        final_score: parent.final_score
      })))
    })
    const expandedParentKeys = new Set(indexedParents.map(chunkKey))
    return deduplicateChunks([
      ...expanded,
      ...chunks.filter(chunk => !expandedParentKeys.has(chunkKey(chunk)))
    ])
  } catch (error) {
    console.error('Neighbor expansion unavailable:', error)
    return chunks
  }
}

export function extractKeywords(text) {
  const stopWords = new Set([
    'how', 'many', 'what', 'when', 'where', 'which', 'who', 'why', 'whose',
    'is', 'are', 'was', 'were', 'the', 'a', 'an', 'in', 'of', 'to', 'and',
    'or', 'for', 'with', 'on', 'at', 'this', 'that', 'these', 'those', 'can',
    'could', 'would', 'should', 'does', 'do', 'did', 'tell', 'show', 'give',
    'me', 'about', 'there', 'their', 'they', 'have', 'has', 'had', 'been',
    'from', 'into', 'than', 'more', 'some', 'any', 'all', 'but', 'not',
    'information', 'specific', 'please', 'earlier', 'question', 'follow', 'shift'
  ])
  return [...new Set(normalizeText(text)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/)
    .map(word => word.replace(/^-|-$/g, ''))
    .filter(word => word.length > 2 && !stopWords.has(word)))]
    .slice(0, 12)
}

function createPromptBlock(chunk, index, available) {
  const location = [
    chunk.page_number ? `page ${chunk.page_number}` : null,
    chunk.slide_number ? `slide ${chunk.slide_number}` : null,
    chunk.section_header || null
  ].filter(Boolean).join(' · ')
  const rawContent = String(chunk.content || '').trim()
  const content = rawContent.length > available
    ? `${rawContent.slice(0, Math.max(0, available - 1)).trimEnd()}…`
    : rawContent
  return {
    text: `[S${index + 1}] ${chunk.source_file_name || 'Untitled'}${location ? ` · ${location}` : ''}\n${content}`,
    content,
    location
  }
}

export function packChunksForPrompt(chunks, maxChars = MAX_CONTEXT_CHARS) {
  const blocks = []
  const usedChunks = []
  const documents = []
  let remaining = maxChars
  for (const chunk of deduplicateChunks(chunks)) {
    const title = String(chunk.source_file_name || 'Untitled').slice(0, 500)
    const available = Math.min(MAX_CHUNK_CHARS, remaining - title.length - 80)
    if (available < 160) continue
    const block = createPromptBlock(chunk, usedChunks.length, available)
    if (!block.content) continue
    blocks.push(block.text)
    usedChunks.push(chunk)
    documents.push({
      type: 'document',
      source: { type: 'text', media_type: 'text/plain', data: block.content },
      title,
      context: block.location || undefined,
      citations: { enabled: true }
    })
    remaining -= block.text.length + 7
    if (remaining < 160) break
  }
  return { text: blocks.join('\n\n===\n\n'), chunks: usedChunks, documents }
}

export function formatChunksForPrompt(chunks) {
  return packChunksForPrompt(chunks).text
}

export function citedChunksFromMessage(message, chunks) {
  const citedIndexes = new Set()
  for (const block of message?.content || []) {
    for (const citation of block?.citations || []) {
      if (Number.isInteger(citation.document_index) && citation.document_index < chunks.length) {
        citedIndexes.add(citation.document_index)
      }
    }
  }
  if (citedIndexes.size === 0) return []
  return [...citedIndexes].sort((a, b) => a - b)
    .map(index => chunks[index]).filter(Boolean)
}

export function formatChunksForCitation(chunks) {
  const seen = new Set()
  return chunks.filter(chunk => {
    const key = [chunk.source_file_name, chunk.source_url, chunk.page_number,
      chunk.slide_number, chunk.section_header].join(':')
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
