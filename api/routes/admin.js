import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import crypto from 'crypto'

const router = Router()

router.use(requireAuth, requireAdmin)

// GET /admin/users
router.get('/users', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const { data: usage } = await supabase
      .from('user_token_usage')
      .select('*')

    const { data: logins } = await supabase
      .from('login_history')
      .select('user_id, logged_in_at')
      .order('logged_in_at', { ascending: false })

    const usageMap = {}
    usage?.forEach(u => { usageMap[u.user_id] = u })

    const lastLoginMap = {}
    logins?.forEach(l => {
      if (!lastLoginMap[l.user_id]) {
        lastLoginMap[l.user_id] = l.logged_in_at
      }
    })

    const enriched = users.map(u => ({
      ...u,
      tokens_used_today: usageMap[u.id]?.tokens_used_today || 0,
      tokens_used_this_month: usageMap[u.id]?.tokens_used_this_month || 0,
      daily_limit: usageMap[u.id]?.daily_limit || 30000,
      monthly_limit: usageMap[u.id]?.monthly_limit || 500000,
      last_login: lastLoginMap[u.id] || null
    }))

    res.json({ users: enriched })
  } catch (err) {
    console.error('Admin users error:', err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// PATCH /admin/users/:id
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { is_active, role, daily_limit, monthly_limit } = req.body

    const updates = {}
    if (is_active !== undefined) updates.is_active = is_active
    if (role !== undefined) updates.role = role

    if (Object.keys(updates).length > 0) {
      await supabase.from('users').update(updates).eq('id', id)
    }

    if (daily_limit !== undefined || monthly_limit !== undefined) {
      const limitUpdates = {}
      if (daily_limit !== undefined) limitUpdates.daily_override = daily_limit
      if (monthly_limit !== undefined) limitUpdates.monthly_override = monthly_limit
      limitUpdates.updated_at = new Date().toISOString()

      await supabase
        .from('token_limits')
        .upsert({ user_id: parseInt(id), ...limitUpdates })
    }

    res.json({ message: 'User updated' })
  } catch (err) {
    console.error('Admin update user error:', err)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

// DELETE /admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    await supabase.from('users').update({ is_active: false }).eq('id', id)
    res.json({ message: 'User deactivated' })
  } catch (err) {
    console.error('Admin delete user error:', err)
    res.status(500).json({ error: 'Failed to deactivate user' })
  }
})

// POST /admin/invite
router.post('/invite', async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    const { data: invite, error } = await supabase
      .from('invite_links')
      .insert({
        token,
        created_by: req.user.id,
        expires_at: expiresAt
      })
      .select()
      .single()

    if (error) throw error

    const inviteUrl = `${process.env.FRONTEND_URL}/register?token=${token}`
    res.json({ invite_url: inviteUrl, expires_at: expiresAt })
  } catch (err) {
    console.error('Admin invite error:', err)
    res.status(500).json({ error: 'Failed to generate invite' })
  }
})

// GET /admin/conversations
router.get('/conversations', async (req, res) => {
  try {
    const { user_id, flagged, language, limit = 50, offset = 0 } = req.query

    let query = supabase
      .from('conversations')
      .select(`
        *,
        users (full_name, country_office, shifter_year)
      `)
      .order('updated_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (user_id) query = query.eq('user_id', user_id)
    if (language) query = query.eq('language', language)

    const { data: conversations, error } = await query
    if (error) throw error

    if (flagged === 'true') {
      const { data: flaggedMsgs } = await supabase
        .from('messages')
        .select('conversation_id')
        .eq('flagged', true)

      const flaggedIds = new Set(flaggedMsgs?.map(m => m.conversation_id))
      const filtered = conversations.filter(c => flaggedIds.has(c.id))
      return res.json({ conversations: filtered })
    }

    res.json({ conversations })
  } catch (err) {
    console.error('Admin conversations error:', err)
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
})

// GET /admin/conversations/:id
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`*, users (full_name, country_office)`)
      .eq('id', id)
      .single()

    if (convError) throw convError

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (msgError) throw msgError

    // Fetch attachments for all messages in this conversation
    const messageIds = messages.map(m => m.id)
    const { data: attachments } = await supabase
      .from('message_attachments')
      .select('*')
      .in('message_id', messageIds)

    // Map attachments onto their messages
    const attachmentsByMessage = {}
    attachments?.forEach(a => {
      if (!attachmentsByMessage[a.message_id]) {
        attachmentsByMessage[a.message_id] = []
      }
      attachmentsByMessage[a.message_id].push(a)
    })

    const messagesWithAttachments = messages.map(m => ({
      ...m,
      attachments: attachmentsByMessage[m.id] || []
    }))

    res.json({ conversation, messages: messagesWithAttachments })
  } catch (err) {
    console.error('Admin conversation thread error:', err)
    res.status(500).json({ error: 'Failed to fetch conversation' })
  }
})

// PATCH /admin/conversations/:id/flag
router.patch('/conversations/:id/flag', async (req, res) => {
  try {
    const { id } = req.params
    const { flagged } = req.body

    await supabase
      .from('messages')
      .update({ flagged })
      .eq('conversation_id', id)

    res.json({ message: 'Conversation flagged' })
  } catch (err) {
    console.error('Flag error:', err)
    res.status(500).json({ error: 'Failed to flag conversation' })
  }
})

// GET /admin/conversations/:id/export
router.get('/conversations/:id/export', async (req, res) => {
  try {
    const { id } = req.params

    const { data: conversation } = await supabase
      .from('conversations')
      .select(`*, users (full_name)`)
      .eq('id', id)
      .single()

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    const lines = [
      `SHIFT Brain 2.0 — Conversation Export`,
      `User: ${conversation.users?.full_name || 'Unknown'}`,
      `Date: ${new Date(conversation.created_at).toLocaleString()}`,
      `Language: ${conversation.language}`,
      `Title: ${conversation.title || 'Untitled'}`,
      ``,
      `---`,
      ``
    ]

    messages.forEach(msg => {
      const role = msg.role === 'user' ? 'PARTICIPANT' : 'SHIFT BRAIN'
      const time = new Date(msg.created_at).toLocaleTimeString()
      lines.push(`[${time}] ${role}:`)
      lines.push(msg.content)
      lines.push('')

      if (msg.chunks_used && msg.chunks_used.length > 0) {
        lines.push('Sources:')
        msg.chunks_used.forEach(c => {
          lines.push(`  - ${c.file_name}${c.page_number ? ` p.${c.page_number}` : ''}`)
        })
        lines.push('')
      }
    })

    const text = lines.join('\n')
    const filename = `shift-brain-conversation-${id}.txt`

    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(text)
  } catch (err) {
    console.error('Export error:', err)
    res.status(500).json({ error: 'Failed to export conversation' })
  }
})

// GET /admin/knowledge
router.get('/knowledge', async (req, res) => {
  try {
    const { data: files, error: filesError } = await supabase
      .rpc('get_knowledge_base_summary')

    if (filesError) throw filesError

    const { data: topChunks } = await supabase
      .from('messages')
      .select('chunks_used')
      .not('chunks_used', 'eq', '[]')
      .limit(500)

    const retrievalCount = {}
    topChunks?.forEach(msg => {
      const chunks = msg.chunks_used || []
      chunks.forEach(c => {
        const key = c.file_name
        retrievalCount[key] = (retrievalCount[key] || 0) + 1
      })
    })

    const topFiles = Object.entries(retrievalCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, retrieval_count: count }))

    const retrievedNames = new Set(Object.keys(retrievalCount))
    const neverRetrieved = files
      .filter(f => !retrievedNames.has(f.source_file_name))
      .map(f => f.source_file_name)

    res.json({
      files: files.map(f => ({
        id: f.source_file_id,
        name: f.source_file_name,
        type: f.source_type,
        url: f.source_url,
        last_ingested: f.last_ingested_at,
        chunk_count: parseInt(f.chunk_count)
      })),
      top_files: topFiles,
      never_retrieved: neverRetrieved
    })
  } catch (err) {
    console.error('Knowledge error:', err)
    res.status(500).json({ error: 'Failed to fetch knowledge base health' })
  }
})

// GET /admin/stats
router.get('/stats', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: messages, error } = await supabase
      .from('messages')
      .select('created_at, tokens_in, tokens_out, latency_ms, language, safety_triggered')
      .eq('role', 'assistant')
      .gte('created_at', thirtyDaysAgo)

    if (error) throw error

    const totalQueries = messages?.length || 0
    const totalTokens = messages?.reduce((sum, m) => sum + (m.tokens_in || 0) + (m.tokens_out || 0), 0) || 0
    const avgLatency = messages?.length
      ? Math.round(messages.reduce((sum, m) => sum + (m.latency_ms || 0), 0) / messages.length)
      : 0
    const safetyEvents = messages?.filter(m => m.safety_triggered).length || 0

    const langCount = {}
    messages?.forEach(m => {
      langCount[m.language || 'en'] = (langCount[m.language || 'en'] || 0) + 1
    })

    const { data: safety } = await supabase
      .from('safety_events')
      .select(`*, users (full_name)`)
      .order('created_at', { ascending: false })
      .limit(20)

    res.json({
      total_queries: totalQueries,
      total_tokens: totalTokens,
      avg_latency_ms: avgLatency,
      safety_events_count: safetyEvents,
      language_breakdown: langCount,
      safety_events: safety || []
    })
  } catch (err) {
    console.error('Stats error:', err)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// POST /admin/ingest
router.post('/ingest', async (req, res) => {
  try {
    const { exec } = await import('child_process')
    res.json({ message: 'Ingestion started — check server logs for progress' })
    exec('python -m ingestion.main', (error, stdout, stderr) => {
      if (error) {
        console.error('Ingestion error:', error)
        return
      }
      console.log('Ingestion output:', stdout)
    })
  } catch (err) {
    console.error('Ingest trigger error:', err)
    res.status(500).json({ error: 'Failed to trigger ingestion' })
  }
})

export default router