import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { detectLanguage } from '../lib/detectLanguage.js'
import { clerkClient } from '../lib/clerk.js'
import { clerkProfile, verifiedPrimaryEmail } from '../lib/clerkProfile.js'
import { acquireGlobalGuard, releaseGuard } from '../middleware/rateLimit.js'
import { clearRetrievalCache } from '../lib/retrieval.js'
import { spawn } from 'node:child_process'

const router = Router()
const CLERK_PAGE_SIZE = 100
const MAX_CLERK_PAGES = 100

router.use(requireAuth, requireAdmin)

function clerkUserUpdates(clerkUser) {
  const profile = clerkProfile(clerkUser)
  const metadata = clerkUser?.publicMetadata || {}
  const signupMetadata = clerkUser?.unsafeMetadata || {}
  const clerkName = [clerkUser?.firstName, clerkUser?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || clerkUser?.username
  const countryOffice = metadata.country_office || signupMetadata.country_office
  const shifterYear = Number.parseInt(metadata.shifter_year ?? signupMetadata.shifter_year, 10)
  const updates = {
    work_email: profile.work_email
  }

  // Do not replace a curator-edited name with the generic profile fallback.
  if (clerkName) updates.full_name = clerkName
  if (countryOffice) updates.country_office = countryOffice
  if (Number.isFinite(shifterYear) && shifterYear > 0) updates.shifter_year = shifterYear
  if (profile.role) updates.role = profile.role
  return updates
}

async function listAllClerkUsers() {
  const users = []

  for (let page = 0; page < MAX_CLERK_PAGES; page += 1) {
    const offset = page * CLERK_PAGE_SIZE
    const response = await clerkClient.users.getUserList({
      limit: CLERK_PAGE_SIZE,
      offset
    })
    const pageUsers = Array.isArray(response) ? response : (response?.data || [])
    users.push(...pageUsers)

    const totalCount = Number(response?.totalCount)
    if (pageUsers.length < CLERK_PAGE_SIZE) break
    if (Number.isFinite(totalCount) && users.length >= totalCount) break
  }

  return users
}

async function ensureTokenLimits(userId) {
  const { error } = await supabase
    .from('token_limits')
    .upsert({
      user_id: userId,
      daily_limit: Number.parseInt(process.env.DAILY_TOKEN_LIMIT, 10) || 30000,
      monthly_limit: Number.parseInt(process.env.MONTHLY_TOKEN_LIMIT, 10) || 500000
    }, { onConflict: 'user_id', ignoreDuplicates: true })

  if (error) throw error
}

async function syncUsersFromClerk() {
  const { data: storedUsers, error: storedError } = await supabase
    .from('users')
    .select('*')

  if (storedError) throw storedError

  const localUsers = storedUsers || []
  const usersByClerkId = new Map(localUsers
    .filter(user => user.clerk_user_id)
    .map(user => [user.clerk_user_id, user]))
  const usersByEmail = new Map(localUsers
    .filter(user => user.work_email)
    .map(user => [String(user.work_email).toLowerCase(), user]))
  const clerkUsers = await listAllClerkUsers()
  const result = { created: 0, updated: 0, linked: 0, skipped: 0, failed: 0 }

  for (const clerkUser of clerkUsers) {
    try {
      const verifiedEmail = verifiedPrimaryEmail(clerkUser)
      if (!verifiedEmail) {
        result.skipped += 1
        continue
      }

      const profileUpdates = clerkUserUpdates(clerkUser)
      const existingById = usersByClerkId.get(clerkUser.id)

      if (existingById) {
        const { data: updated, error: updateError } = await supabase
          .from('users')
          .update(profileUpdates)
          .eq('id', existingById.id)
          .select()
          .single()
        if (updateError) throw updateError

        usersByClerkId.set(clerkUser.id, updated)
        usersByEmail.set(verifiedEmail.toLowerCase(), updated)
        result.updated += 1
        continue
      }

      const emailKey = verifiedEmail.toLowerCase()
      const existingByEmail = usersByEmail.get(emailKey)
      if (existingByEmail) {
        // A legacy account may predate Clerk linking. Preserve its existing
        // access unless Clerk explicitly identifies this as a new signup.
        const requiresApproval = clerkUser?.unsafeMetadata?.approval_required === true
        const { data: linked, error: linkError } = await supabase.rpc(
          'link_verified_clerk_user',
          {
            p_clerk_user_id: clerkUser.id,
            p_verified_email: verifiedEmail,
            p_require_approval: requiresApproval
          }
        )
        if (linkError) throw linkError
        if (!linked) {
          result.skipped += 1
          continue
        }

        const { data: updated, error: updateError } = await supabase
          .from('users')
          .update(profileUpdates)
          .eq('id', linked.id)
          .select()
          .single()
        if (updateError) throw updateError

        usersByClerkId.set(clerkUser.id, updated)
        usersByEmail.set(emailKey, updated)
        await ensureTokenLimits(updated.id)
        result.linked += 1
        continue
      }

      const profile = clerkProfile(clerkUser)
      const { data: created, error: createError } = await supabase
        .from('users')
        .insert({
          clerk_user_id: clerkUser.id,
          ...profile,
          role: profile.role || 'participant',
          is_active: false
        })
        .select()
        .single()
      if (createError) throw createError

      usersByClerkId.set(clerkUser.id, created)
      usersByEmail.set(emailKey, created)
      await ensureTokenLimits(created.id)
      result.created += 1
    } catch (error) {
      result.failed += 1
      console.error(`Failed to synchronize Clerk user ${clerkUser.id}:`, error)
    }
  }

  return result
}

// POST /admin/users/sync
router.post('/users/sync', async (req, res) => {
  try {
    const result = await syncUsersFromClerk()
    res.json({ message: 'Clerk users synchronized', result })
  } catch (error) {
    console.error('Admin Clerk sync error:', error)
    res.status(502).json({ error: 'Failed to synchronize users from Clerk' })
  }
})

// GET /admin/users
router.get('/users', async (req, res) => {
  try {
    const { data: storedUsers, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const users = storedUsers || []

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
    const id = Number.parseInt(req.params.id, 10)
    const { is_active, role, daily_limit, monthly_limit } = req.body
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' })
    }
    if (role !== undefined && !['admin', 'participant'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    const updates = {}
    if (is_active !== undefined) updates.is_active = is_active
    if (role !== undefined) updates.role = role

    let updatedUser = null
    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      updatedUser = data
    }

    if (daily_limit !== undefined || monthly_limit !== undefined) {
      const limitUpdates = {}
      if (daily_limit !== undefined) limitUpdates.daily_override = daily_limit
      if (monthly_limit !== undefined) limitUpdates.monthly_override = monthly_limit
      limitUpdates.updated_at = new Date().toISOString()

      const { error } = await supabase
        .from('token_limits')
        .upsert({ user_id: id, ...limitUpdates }, { onConflict: 'user_id' })
      if (error) throw error
    }

    if (!updatedUser) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      updatedUser = data
    }

    res.json({ message: 'User updated', user: updatedUser })
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

// GET /admin/conversations
router.get('/conversations', async (req, res) => {
  try {
    const { user_id, language, limit = 50, offset = 0 } = req.query

    let query = supabase
      .from('conversations')
      .select(`
        *,
        users (full_name, country_office, shifter_year)
      `)
      .order('updated_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (user_id) query = query.eq('user_id', user_id)
    const { data: conversations, error } = await query
    if (error) throw error

    const conversationIds = conversations.map(conversation => conversation.id)
    let firstQuestions = []
    if (conversationIds.length > 0) {
      const { data: userMessages, error: messagesError } = await supabase
        .from('messages')
        .select('conversation_id, content, created_at')
        .eq('role', 'user')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true })

      if (messagesError) throw messagesError
      const seen = new Set()
      firstQuestions = (userMessages || []).filter(message => {
        if (seen.has(message.conversation_id)) return false
        seen.add(message.conversation_id)
        return true
      })
    }

    const languageByConversation = new Map(
      firstQuestions.map(message => [message.conversation_id, detectLanguage(message.content, 'en').toLowerCase()])
    )
    const enriched = conversations.map(conversation => ({
      ...conversation,
      detected_language: languageByConversation.get(conversation.id) || 'en'
    }))
    const filtered = language
      ? enriched.filter(conversation => conversation.detected_language === String(language).toLowerCase())
      : enriched
    const languages = [...new Set(enriched.map(conversation => conversation.detected_language))].sort()

    res.json({ conversations: filtered, languages })
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

    const messageIds = messages.map(m => m.id)
    const { data: attachments } = await supabase
      .from('message_attachments')
      .select('*')
      .in('message_id', messageIds)

    // Attachments are stored privately in Supabase Storage — generate a
    // short-lived signed URL per attachment so images can render inline
    // in the dashboard instead of just showing a filename.
    const attachmentsWithUrls = await Promise.all(
      (attachments || []).map(async (a) => {
        try {
          const { data: signed, error: signError } = await supabase.storage
            .from('attachments')
            .createSignedUrl(a.storage_path, 5 * 60) // 5 minutes

          return { ...a, signed_url: signError ? null : (signed?.signedUrl || null) }
        } catch {
          return { ...a, signed_url: null }
        }
      })
    )

    const attachmentsByMessage = {}
    attachmentsWithUrls.forEach(a => {
      if (!attachmentsByMessage[a.message_id]) {
        attachmentsByMessage[a.message_id] = []
      }
      attachmentsByMessage[a.message_id].push(a)
    })

    const messagesWithAttachments = messages.map(m => ({
      ...m,
      attachments: attachmentsByMessage[m.id] || []
    }))

    const firstQuestion = messages.find(message => message.role === 'user')
    const detectedLanguage = detectLanguage(firstQuestion?.content || '', 'en').toLowerCase()

    res.json({
      conversation: { ...conversation, detected_language: detectedLanguage },
      messages: messagesWithAttachments
    })
  } catch (err) {
    console.error('Admin conversation thread error:', err)
    res.status(500).json({ error: 'Failed to fetch conversation' })
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

    const firstQuestion = messages?.find(message => message.role === 'user')
    const detectedLanguage = detectLanguage(firstQuestion?.content || '', 'en').toLowerCase()

    const lines = [
      `SHIFT Brain 2.0 — Conversation Export`,
      `User: ${conversation.users?.full_name || 'Unknown'}`,
      `Date: ${new Date(conversation.created_at).toLocaleString()}`,
      `Language: ${detectedLanguage}`,
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
      if (msg.role === 'user' && msg.reaction_emoji) {
        lines.push(`SHIFT Brain reaction: ${msg.reaction_emoji}`)
      }
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
// GET /admin/attachments/:id/url
// Returns a short-lived signed URL so admins can view/download a
// user-uploaded attachment from the private storage bucket.
router.get('/attachments/:id/url', async (req, res) => {
  try {
    const { id } = req.params

    const { data: attachment, error } = await supabase
      .from('message_attachments')
      .select('storage_path, file_name, file_type')
      .eq('id', id)
      .single()

    if (error || !attachment) {
      return res.status(404).json({ error: 'Attachment not found' })
    }

    const { data: signed, error: signError } = await supabase.storage
      .from('attachments')
      .createSignedUrl(attachment.storage_path, 300) // 5 minutes

    if (signError) throw signError

    res.json({
      url: signed.signedUrl,
      file_name: attachment.file_name,
      file_type: attachment.file_type
    })
  } catch (err) {
    console.error('Attachment URL error:', err)
    res.status(500).json({ error: 'Failed to generate attachment URL' })
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

    const { data: assistantMessages, error: assistantError } = await supabase
      .from('messages')
      .select('created_at, tokens_in, tokens_out, latency_ms, language, safety_triggered')
      .eq('role', 'assistant')
      .gte('created_at', thirtyDaysAgo)

    if (assistantError) throw assistantError

    const { data: userMessages, error: userError } = await supabase
      .from('messages')
      .select('conversation_id, content, language, created_at')
      .eq('role', 'user')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true })

    if (userError) throw userError

    const totalQueries = userMessages?.length || 0
    const totalTokens = assistantMessages?.reduce((sum, m) => sum + (m.tokens_in || 0) + (m.tokens_out || 0), 0) || 0
    const avgLatency = assistantMessages?.length
      ? Math.round(assistantMessages.reduce((sum, m) => sum + (m.latency_ms || 0), 0) / assistantMessages.length)
      : 0
    const safetyEvents = assistantMessages?.filter(m => m.safety_triggered).length || 0

    const firstQuestionByConversation = new Map()
    userMessages?.forEach((message, index) => {
      const conversationKey = message.conversation_id || `message-${index}`
      if (!firstQuestionByConversation.has(conversationKey)) {
        firstQuestionByConversation.set(conversationKey, message)
      }
    })

    const langCount = {}
    firstQuestionByConversation.forEach(m => {
      // Re-detect from the first question rather than trusting the legacy
      // per-message value, which may contain an earlier false Dutch match.
      const language = detectLanguage(m.content, 'en').toLowerCase()
      langCount[language] = (langCount[language] || 0) + 1
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
  let guardAcquired = false
  let guardReleased = false

  const releaseIngestionGuard = async () => {
    if (!guardAcquired || guardReleased) return
    guardReleased = true
    await releaseGuard('knowledge-ingestion', 'global')
  }

  try {
    const guard = await acquireGlobalGuard('knowledge-ingestion', 60 * 60)
    if (!guard?.allowed) {
      if (guard?.reason === 'active') {
        return res.status(202).json({
          status: 'already_running',
          message: 'A knowledge-base re-ingestion is already running.',
          retry_after_seconds: guard?.retry_after_seconds || 60
        })
      }

      const retrySeconds = guard?.retry_after_seconds || 60
      const retryMinutes = Math.max(1, Math.ceil(retrySeconds / 60))
      return res.status(429).json({
        status: 'recently_requested',
        error: `Re-ingestion was requested recently. Try again in about ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'}.`,
        retry_after_seconds: guard?.retry_after_seconds || 60
      })
    }
    guardAcquired = true

    const workerArgs = ['-m', 'ingestion.main']
    if (req.body?.force === true) workerArgs.push('--force')

    const child = spawn(process.env.PYTHON_BIN || 'python3', workerArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let ingestionTimeout
    let workerClosed = false

    const workerStarted = new Promise((resolve, reject) => {
      child.once('spawn', resolve)
      child.once('error', reject)
    })

    child.stdout.on('data', chunk => console.log(`Ingestion: ${String(chunk).trimEnd()}`))
    child.stderr.on('data', chunk => console.error(`Ingestion: ${String(chunk).trimEnd()}`))
    child.once('error', async error => {
      console.error('Ingestion process error:', error)
      await releaseIngestionGuard()
    })
    child.once('close', async code => {
      workerClosed = true
      if (ingestionTimeout) clearTimeout(ingestionTimeout)
      console.log(`Ingestion process exited with code ${code}`)
      if (code === 0) clearRetrievalCache()
      await releaseIngestionGuard()
    })

    // Do not tell the dashboard the job started until the operating system has
    // actually launched the Python worker. A missing binary or invalid working
    // directory now produces a real API error instead of a false success.
    await workerStarted

    ingestionTimeout = setTimeout(() => {
      console.error('Ingestion exceeded 55 minutes; terminating the worker')
      child.kill('SIGTERM')
      setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL')
      }, 5_000).unref()
    }, 55 * 60 * 1000)
    ingestionTimeout.unref()

    // An extremely short-lived worker may close between the spawn event and
    // timeout creation. Avoid leaving a live timer behind in that case.
    if (workerClosed) clearTimeout(ingestionTimeout)

    res.status(202).json({
      status: 'started',
      message: req.body?.force === true
        ? 'Full knowledge-base rebuild started. Check Railway logs for progress.'
        : 'Knowledge-base ingestion started. Check Railway logs for progress.'
    })
  } catch (err) {
    await releaseIngestionGuard()
    console.error('Ingest trigger error:', err)
    res.status(500).json({
      error: 'The ingestion worker could not be started. Check the Railway logs for the underlying process error.'
    })
  }
})

export default router
