import test from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key'

const {
  citedChunksFromMessage,
  extractKeywords,
  fuseRankedLists,
  localRetrievalScore,
  packChunksForPrompt,
  selectAnchorKeywords
} = await import('../api/lib/retrieval.js')
const { buildRetrievalQueries } = await import('../api/lib/conversationHistory.js')

test('specific entities remain anchors beside generic campaign terms', () => {
  const keywords = extractKeywords('Do you have information about the Myanmar city campaign?')
  assert.ok(keywords.includes('myanmar'))
  assert.equal(selectAnchorKeywords(keywords)[0], 'myanmar')
})

test('entity-bearing evidence outranks generic campaign prose', () => {
  const query = 'information about the Myanmar city campaign'
  const specific = {
    content: 'Young people in Myanmar developed a city campaign with local partners.',
    source_file_name: 'Campaign case studies'
  }
  const generic = {
    content: 'Campaigns can help young people organize activities in their cities.',
    source_file_name: 'Campaign guide'
  }
  assert.ok(localRetrievalScore(query, specific) > localRetrievalScore(query, generic))
})

test('matching source titles receive a strong relevance signal', () => {
  const query = 'What are the SHIFT colour codes?'
  const titled = {
    content: 'Primary: #FDFBEF',
    source_file_name: 'SHIFT Brand Colour Codes'
  }
  const incidental = {
    content: 'The design uses colour codes such as #FDFBEF.',
    source_file_name: 'General design notes'
  }
  assert.ok(localRetrievalScore(query, titled) > localRetrievalScore(query, incidental))
})

test('reciprocal-rank fusion rewards agreement across retrieval channels', () => {
  const shared = { id: 1, content: 'Myanmar campaign evidence' }
  const fused = fuseRankedLists([
    { channel: 'vector', chunks: [shared, { id: 2, content: 'Other' }] },
    { channel: 'keyword', chunks: [shared] }
  ])
  assert.equal(fused[0].id, 1)
  assert.deepEqual(fused[0].retrieval_channels.sort(), ['keyword', 'vector'])
})

test('packed evidence becomes citable Claude document blocks', () => {
  const chunk = {
    id: 7,
    content: 'Verified knowledge.',
    source_file_name: 'Source A',
    section_header: 'Overview'
  }
  const packed = packChunksForPrompt([chunk])
  assert.equal(packed.documents[0].type, 'document')
  assert.equal(packed.documents[0].citations.enabled, true)
  assert.equal(packed.chunks[0].id, 7)
})

test('only source documents actually cited by Claude are exposed', () => {
  const chunks = [{ id: 1 }, { id: 2 }, { id: 3 }]
  const message = {
    content: [{
      type: 'text',
      text: 'Answer',
      citations: [{ document_index: 1 }]
    }]
  }
  assert.deepEqual(citedChunksFromMessage(message, chunks), [{ id: 2 }])
  assert.deepEqual(citedChunksFromMessage({ content: [] }, chunks), [])
})

test('follow-ups search both exact wording and resolved conversation context', () => {
  const history = [
    { role: 'user', content: 'Tell me about the Myanmar city campaign.' },
    { role: 'assistant', content: 'It focused on local change.' }
  ]
  const queries = buildRetrievalQueries(history, 'What impact did it have?')
  assert.equal(queries[0], 'What impact did it have?')
  assert.match(queries[1], /Myanmar city campaign/)
})

test('new topics do not inherit unrelated conversation terms', () => {
  const history = [{ role: 'user', content: 'Tell me about Myanmar.' }]
  assert.deepEqual(
    buildRetrievalQueries(history, 'List the SHIFT brand colour codes and their hex values.'),
    ['List the SHIFT brand colour codes and their hex values.']
  )
})
