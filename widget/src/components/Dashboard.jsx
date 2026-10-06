import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { API_URL } from '../lib/api'
import { DEFAULT_SETTINGS } from '../config/settings'

async function adminFetch(path, getToken, options = {}) {
  const token = await getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  })
  const contentType = res.headers.get('content-type') || ''
  const text = await res.text()
  let data = null

  if (text && contentType.includes('application/json')) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`The server returned invalid JSON for ${path}`)
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`The API returned ${contentType || 'a non-JSON response'} for ${path}`)
  }

  return data
}

function languageLabel(code) {
  const value = String(code || '').trim()
  if (!value) return 'Unknown'
  if (value.toLowerCase() === 'und') return 'Unknown'

  try {
    const label = new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' }).of(value)
    if (label) return label
  } catch {}

  return value.toUpperCase()
}

function StatCard({ label, value, sub }) {
  return (
    <div className="brain-admin-stat">
      <p className="brain-admin-stat__label">{label}</p>
      <p className="brain-admin-stat__value">{value}</p>
      {sub && <p className="brain-admin-stat__sub">{sub}</p>}
    </div>
  )
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={`brain-admin-nav__item ${active ? 'is-active' : ''}`}
      onClick={onClick}
    >
      <span className="brain-admin-nav__dot" aria-hidden="true" />
      {label}
    </button>
  )
}

function ParticipantsTab({ getToken }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function loadUsers({ sync = false, silent = false } = {}) {
    if (!silent) {
      setError('')
      if (sync) setRefreshing(true)
      else setLoading(true)
    }

    try {
      if (sync) {
        try {
          const syncResult = await adminFetch('/admin/users/sync', getToken, { method: 'POST' })
          const result = syncResult.result || {}
          const changed = (result.created || 0) + (result.updated || 0) + (result.linked || 0)
          setNotice(changed
            ? `Clerk sync complete: ${result.created || 0} new, ${result.linked || 0} linked, ${result.updated || 0} updated.`
            : 'Clerk users are already up to date.')
          if (result.failed) setNotice(current => `${current} ${result.failed} account${result.failed === 1 ? '' : 's'} could not be synchronized.`)
        } catch (syncError) {
          console.error(syncError)
          setError(`${syncError.message || 'Unable to refresh Clerk signups.'} Stored participants are shown below.`)
        }
      }

      const data = await adminFetch('/admin/users', getToken)
      setUsers((data.users || []).sort((a, b) => Number(a.is_active) - Number(b.is_active)))
    } catch (loadError) {
      console.error(loadError)
      setError(loadError.message || 'Unable to load participants.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadUsers({ sync: true })
    const timer = window.setInterval(() => loadUsers({ silent: true }), 30000)
    return () => window.clearInterval(timer)
  }, [getToken])

  async function toggleUser(id, is_active) {
    setUpdatingId(id)
    setError('')
    try {
      const data = await adminFetch(`/admin/users/${id}`, getToken, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !is_active })
      })
      setUsers(previous => previous.map(user => user.id === id
        ? { ...user, ...(data.user || {}), is_active: !is_active }
        : user))
      setNotice(is_active ? 'Access revoked.' : 'Access granted. The participant can now open SHIFT Brain.')
    } catch (updateError) {
      console.error(updateError)
      setError(updateError.message || 'Unable to update participant access.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) return <p style={{ padding: '20px', color: '#888' }}>Loading...</p>

  const pendingUsers = users.filter(user => !user.is_active && user.role !== 'admin')
  const pendingCount = pendingUsers.length

  return (
    <div className="brain-admin-tab">
      <div className="brain-admin-toolbar">
        <div>
          <p className="brain-admin-eyebrow">Community</p>
          <h2>Participants <span>{users.length}</span></h2>
          <p className="brain-admin-toolbar__description">{pendingCount ? `${pendingCount} signup${pendingCount === 1 ? '' : 's'} waiting for approval` : 'No signups waiting for approval'}</p>
        </div>
        <button type="button" className="brain-admin-button" onClick={() => loadUsers({ sync: true })} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh signups'}
        </button>
      </div>

      {error && <p className="brain-admin-feedback is-error" role="alert">{error}</p>}
      {notice && !error && <p className="brain-admin-feedback" aria-live="polite">{notice}</p>}

      {pendingUsers.length > 0 && (
        <section className="brain-admin-approvals" aria-labelledby="pending-approvals-title">
          <div className="brain-admin-approvals__heading">
            <div>
              <p className="brain-admin-eyebrow">Action required</p>
              <h3 id="pending-approvals-title">Pending approvals <span>{pendingUsers.length}</span></h3>
            </div>
            <p>Grant access after confirming the participant.</p>
          </div>

          <div className="brain-admin-approvals__list">
            {pendingUsers.map(user => (
              <article className="brain-admin-approval" key={user.id}>
                <div className="brain-admin-approval__identity">
                  <strong>{user.full_name || 'New participant'}</strong>
                  <span>{user.work_email}</span>
                  {(user.country_office || user.shifter_year) && (
                    <small>{[user.country_office, user.shifter_year].filter(Boolean).join(' · ')}</small>
                  )}
                </div>
                <button
                  type="button"
                  className="brain-admin-button brain-admin-button--primary brain-admin-approval__button"
                  onClick={() => toggleUser(user.id, false)}
                  disabled={updatingId === user.id}
                  aria-busy={updatingId === user.id}
                >
                  {updatingId === user.id ? 'Granting…' : 'Grant access'}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="brain-admin-table-wrap brain-admin-users-table-wrap">
        <table className="brain-admin-users-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead><tr style={{ borderBottom: '1px solid #f0f0f0' }}>
            {['Name', 'Email', 'Country', 'Year', 'Tokens today', 'Last active', 'Status', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px', color: '#888', fontWeight: '500' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                <td style={{ padding: '10px 8px', fontWeight: '500' }}>{u.full_name}</td>
                <td style={{ padding: '10px 8px', color: '#666' }}>{u.work_email}</td>
                <td style={{ padding: '10px 8px', color: '#666' }}>{u.country_office}</td>
                <td style={{ padding: '10px 8px', color: '#666' }}>{u.shifter_year}</td>
                <td style={{ padding: '10px 8px', color: '#666' }}>{u.tokens_used_today?.toLocaleString()} / {u.daily_limit?.toLocaleString()}</td>
                <td style={{ padding: '10px 8px', color: '#666' }}>{u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}</td>
                <td style={{ padding: '10px 8px' }}><span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: u.is_active ? '#e6f4ea' : '#fff0f8', color: u.is_active ? '#2d7a3a' : '#ff008f' }}>{u.is_active ? 'Approved' : 'Pending approval'}</span></td>
                <td style={{ padding: '10px 8px' }}>
                  {u.role !== 'admin' && (
                    <button
                      className={`brain-admin-button ${u.is_active ? '' : 'brain-admin-button--primary'}`}
                      onClick={() => toggleUser(u.id, u.is_active)}
                      disabled={updatingId === u.id}
                    >
                      {updatingId === u.id ? 'Saving…' : u.is_active ? 'Revoke access' : 'Grant access'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AttachmentThumb({ attachment }) {
  const isImage = attachment.file_type && attachment.file_type.startsWith('image/') && attachment.signed_url
  if (isImage) {
    return <a href={attachment.signed_url} target="_blank" rel="noopener noreferrer" title={attachment.file_name}>
      <img src={attachment.signed_url} alt={attachment.file_name} style={{ maxWidth: '160px', maxHeight: '160px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'block', objectFit: 'cover' }} />
    </a>
  }
  return <span style={{ display: 'inline-block', padding: '3px 9px', background: '#fff0f8', borderRadius: '999px', fontSize: '11px', color: '#ff008f' }}>📎 {attachment.file_name}</span>
}

function ConversationsTab({ getToken }) {
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState('')
  const [availableLanguages, setAvailableLanguages] = useState([])

  useEffect(() => {
    const params = new URLSearchParams()
    if (language) params.set('language', language)
    adminFetch(`/admin/conversations?${params}`, getToken)
      .then(d => {
        setConversations(d.conversations || [])
        setAvailableLanguages(d.languages || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [getToken, language])

  async function loadThread(id) {
    const data = await adminFetch(`/admin/conversations/${id}`, getToken)
    setSelected(data.conversation)
    setMessages(data.messages || [])
  }

  async function exportConversation(id) {
    const token = await getToken()
    const res = await fetch(`${API_URL}/admin/conversations/${id}/export`, { headers: { 'Authorization': `Bearer ${token}` } })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shift-brain-conversation-${id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <p style={{ padding: '20px', color: '#888' }}>Loading...</p>

  return (
    <div className="brain-admin-conversations">
      <div className="brain-admin-conversations__list">
        <div className="brain-admin-filters">
          <select
            value={language}
            onChange={event => setLanguage(event.target.value)}
            aria-label="Filter conversations by language"
            className="brain-admin-language-filter"
          >
            <option value="">All languages</option>
            {availableLanguages.map(code => <option key={code} value={code}>{languageLabel(code)}</option>)}
          </select>
        </div>
        {conversations.map(conv => (
          <button type="button" key={conv.id} onClick={() => loadThread(conv.id)} className={`brain-admin-conversation ${selected?.id === conv.id ? 'is-active' : ''}`}>
            <p style={{ fontSize: '13px', fontWeight: '500', color: '#0b0b2d', marginBottom: '2px' }}>{conv.users?.full_name || 'Unknown'}</p>
            <p style={{ fontSize: '12px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title || 'Untitled'}</p>
            <p style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{new Date(conv.created_at).toLocaleDateString()} · {languageLabel(conv.detected_language)}</p>
          </button>
        ))}
      </div>

      <div className="brain-admin-conversations__thread">
        {!selected ? <p style={{ color: '#888', fontSize: '14px', padding: '20px' }}>Select a conversation to view the thread</p> : <>
          <div className="brain-admin-thread-header">
            <div><p style={{ fontWeight: '500', fontSize: '14px' }}>{selected.users?.full_name}</p><p style={{ fontSize: '12px', color: '#888' }}>{selected.title}</p></div>
            <button className="brain-admin-button" onClick={() => exportConversation(selected.id)}>Export .txt</button>
          </div>
          {messages.map(msg => (
            <div key={msg.id} style={{ marginBottom: '12px', padding: '12px 16px', borderRadius: '8px', background: msg.role === 'user' ? '#fdfbef' : 'white', border: '1px solid #efeee7' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: msg.role === 'user' ? '#ff008f' : '#666', marginBottom: '6px', textTransform: 'uppercase' }}>
                {msg.role === 'user' ? 'Participant' : 'SHIFT Brain'}
                {msg.safety_triggered && <span style={{ marginLeft: '8px', color: '#e53e3e' }}>⚠ Safety</span>}
              </p>
              <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#333', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
              {msg.role === 'user' && msg.reaction_emoji && <span role="img" aria-label={`SHIFT Brain reacted with ${msg.reaction_emoji}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '30px', height: '25px', marginTop: '7px', padding: '0 6px', border: '1px solid #efeee7', borderRadius: '999px', background: '#fff', fontSize: '15px' }}>{msg.reaction_emoji}</span>}
              {msg.attachments?.length > 0 && <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{msg.attachments.map((a, i) => <AttachmentThumb key={i} attachment={a} />)}</div>}
              {msg.chunks_used?.length > 0 && <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}><p style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Sources used:</p>{msg.chunks_used.map((c, i) => <p key={i} style={{ fontSize: '11px', color: '#ff008f' }}>📄 {c.file_name}{c.page_number ? ` p.${c.page_number}` : ''}</p>)}</div>}
              <p style={{ fontSize: '11px', color: '#ccc', marginTop: '6px' }}>{new Date(msg.created_at).toLocaleTimeString()}{msg.tokens_in ? ` · ${msg.tokens_in + msg.tokens_out} tokens` : ''}{msg.latency_ms ? ` · ${msg.latency_ms}ms` : ''}</p>
            </div>
          ))}
        </>}
      </div>
    </div>
  )
}

function KnowledgeTab({ getToken }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ingesting, setIngesting] = useState(false)

  useEffect(() => {
    adminFetch('/admin/knowledge', getToken).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [getToken])

  async function triggerIngest() {
    setIngesting(true)
    try { await adminFetch('/admin/ingest', getToken, { method: 'POST' }); alert('Ingestion started — check server logs for progress') }
    catch { alert('Failed to trigger ingestion') }
    finally { setIngesting(false) }
  }

  if (loading) return <p style={{ padding: '20px', color: '#888' }}>Loading...</p>
  return <div className="brain-admin-tab">
    <div className="brain-admin-toolbar">
      <div><p className="brain-admin-eyebrow">Resources</p><h2>Knowledge base <span>{data?.files?.length || 0} files</span></h2></div>
      <button className="brain-admin-button brain-admin-button--primary" onClick={triggerIngest} disabled={ingesting}>{ingesting ? 'Ingesting...' : 'Trigger re-ingestion'}</button>
    </div>
    {data?.top_files?.length > 0 && <div style={{ marginBottom: '24px' }}><p style={{ fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Most retrieved (top 10)</p>{data.top_files.map((f, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f9f9f9', fontSize: '13px' }}><span style={{ color: '#333' }}>{f.name}</span><span style={{ color: '#ff008f', fontWeight: '500' }}>{f.retrieval_count} retrievals</span></div>)}</div>}
    {data?.never_retrieved?.length > 0 && <div style={{ marginBottom: '24px' }}><p style={{ fontSize: '12px', fontWeight: '600', color: '#e53e3e', marginBottom: '8px', textTransform: 'uppercase' }}>Never retrieved ({data.never_retrieved.length} files)</p>{data.never_retrieved.map((name, i) => <p key={i} style={{ fontSize: '13px', color: '#666', padding: '4px 0' }}>— {name}</p>)}</div>}
    <div><p style={{ fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>All ingested files</p><div className="brain-admin-table-wrap"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}><thead><tr style={{ borderBottom: '1px solid #f0f0f0' }}>{['File', 'Type', 'Chunks', 'Last ingested'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px', color: '#888', fontWeight: '500' }}>{h}</th>)}</tr></thead><tbody>{data?.files?.map((f, i) => <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}><td style={{ padding: '8px' }}><a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: '#ff008f', textDecoration: 'none' }}>{f.name}</a></td><td style={{ padding: '8px', color: '#888' }}>{f.type}</td><td style={{ padding: '8px', color: '#888' }}>{f.chunk_count}</td><td style={{ padding: '8px', color: '#888' }}>{new Date(f.last_ingested).toLocaleDateString()}</td></tr>)}</tbody></table></div></div>
  </div>
}

function StatsTab({ getToken }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminFetch('/admin/stats', getToken).then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [getToken])

  if (loading) return <p style={{ padding: '20px', color: '#888' }}>Loading...</p>

  const breakdown = Object.entries(stats?.language_breakdown || {}).sort((a, b) => b[1] - a[1])

  return <div className="brain-admin-tab">
    <div className="brain-admin-toolbar brain-admin-toolbar--simple"><div><p className="brain-admin-eyebrow">Last 30 days</p><h2>Usage overview</h2></div></div>
    <div className="brain-admin-stats-grid">
      <StatCard label="Total queries (30d)" value={stats?.total_queries?.toLocaleString() || '0'} />
      <StatCard label="Total tokens (30d)" value={stats?.total_tokens?.toLocaleString() || '0'} />
      <StatCard label="Avg response time" value={stats?.avg_latency_ms ? `${stats.avg_latency_ms}ms` : '—'} />
      <StatCard label="Safety events (30d)" value={stats?.safety_events_count || '0'} />
    </div>

    <div className="brain-admin-subpanel">
      <p className="brain-admin-subpanel__title">Chat language breakdown <span>{breakdown.length}</span></p>
      {breakdown.length === 0 ? <p style={{ color: '#aaa', fontSize: '13px' }}>No language data yet.</p> : breakdown.map(([lang, count]) => (
        <div key={lang} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f9f9f9', fontSize: '13px' }}>
          <span>{languageLabel(lang)} <span style={{ color: '#aaa', marginLeft: '5px' }}>{lang}</span></span>
          <span style={{ color: '#ff008f', fontWeight: '500' }}>{count} chats</span>
        </div>
      ))}
    </div>

    {stats?.safety_events?.length > 0 && <div><p style={{ fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Recent safety events</p>{stats.safety_events.map((e, i) => <div key={i} style={{ padding: '10px 12px', marginBottom: '6px', background: '#fff5f5', borderRadius: '8px', border: '1px solid #fed7d7' }}><p style={{ fontSize: '12px', fontWeight: '600', color: '#c53030', marginBottom: '4px' }}>{e.trigger_category} · {e.users?.full_name} · {new Date(e.created_at).toLocaleString()}</p><p style={{ fontSize: '13px', color: '#666' }}>{e.message_content}</p></div>)}</div>}
  </div>
}

function SettingsField({ label, value, onChange, multiline = false, type = 'text', help }) {
  return <label className="brain-admin-field">
    <span className="brain-admin-field__label">{label}</span>
    {multiline ? <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={4} /> : <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} />}
    {help && <span className="brain-admin-field__help">{help}</span>}
  </label>
}

function ColorField({ label, value, onChange }) {
  return <label className="brain-admin-field">
    <span className="brain-admin-field__label">{label}</span>
    <span className="brain-admin-color-field">
      <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} aria-label={`${label} picker`} />
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="#000000" maxLength={7} />
    </span>
  </label>
}

function SettingsTab({ getToken, settings, onSettingsChange }) {
  const [form, setForm] = useState({ ...DEFAULT_SETTINGS, ...(settings || {}) })
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const saveTimerRef = useRef(null)
  const saveSequenceRef = useRef(0)
  const pendingSaveRef = useRef(null)

  useEffect(() => {
    adminFetch('/admin/settings', getToken)
      .then(data => {
        if (data?.settings) {
          const next = { ...DEFAULT_SETTINGS, ...data.settings }
          setForm(next)
          onSettingsChange?.(next)
        }
      })
      .catch(err => {
        // The public /config response already supplied usable settings.
        // A failed admin refresh should not display a false form error.
        console.warn('Using already-loaded settings:', err)
      })
      .finally(() => setLoading(false))
  }, [getToken])

  useEffect(() => () => {
    window.clearTimeout(saveTimerRef.current)
    saveSequenceRef.current += 1
    if (pendingSaveRef.current) {
      adminFetch('/admin/settings', getToken, {
        method: 'PATCH',
        body: JSON.stringify(pendingSaveRef.current)
      }).catch(() => {})
    }
  }, [getToken])

  function scheduleSave(next) {
    window.clearTimeout(saveTimerRef.current)
    const sequence = ++saveSequenceRef.current
    pendingSaveRef.current = next
    setStatus('Saving…')

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const data = await adminFetch('/admin/settings', getToken, {
          method: 'PATCH',
          body: JSON.stringify(next)
        })
        if (sequence !== saveSequenceRef.current) return

        const saved = { ...DEFAULT_SETTINGS, ...(data.settings || next) }
        pendingSaveRef.current = null
        setForm(saved)
        onSettingsChange?.(saved)
        setStatus('Saved')
      } catch (err) {
        if (sequence !== saveSequenceRef.current) return
        setStatus(err.message || 'Failed to save settings')
      }
    }, 450)
  }

  function update(key, value) {
    const next = { ...form, [key]: value }
    setForm(next)
    onSettingsChange?.(next)
    scheduleSave(next)
  }

  if (loading) return <p style={{ padding: '20px', color: '#888' }}>Loading settings...</p>

  return <div className="brain-admin-settings">
    <div className="brain-admin-toolbar">
      <div><p className="brain-admin-eyebrow">Appearance</p><h2>Branding & copy</h2><p className="brain-admin-toolbar__description">Changes are saved automatically and used by the login screen, chat welcome screen and curator dashboard.</p></div>
    </div>

    <div className="brain-admin-settings__grid">
    <section className="brain-admin-settings__card brain-admin-settings__card--wide">
      <h3>Icons</h3>
      <SettingsField label="Brain icon URL" value={form.brain_icon_url} onChange={v => update('brain_icon_url', v)} help="Use a public HTTPS image URL. It appears on the login, account and chat welcome screens." />
      {form.brain_icon_url && <img src={form.brain_icon_url} alt="Brain icon preview" style={{ width: '91px', height: '81px', objectFit: 'contain', display: 'block' }} onError={e => { e.currentTarget.style.opacity = '.25' }} />}
      <div className="brain-admin-settings__icon-grid">
        <SettingsField label="Open sidebar arrow URL" value={form.sidebar_open_icon_url} onChange={v => update('sidebar_open_icon_url', v)} help="Optional. Leave blank to use the built-in right arrow." />
        <SettingsField label="Close sidebar arrow URL" value={form.sidebar_close_icon_url} onChange={v => update('sidebar_close_icon_url', v)} help="Optional. Leave blank to use the built-in left arrow." />
        <SettingsField label="Search icon URL" value={form.search_icon_url} onChange={v => update('search_icon_url', v)} help="Optional. Leave blank to use the built-in search icon." />
        <SettingsField label="Upload file icon URL" value={form.upload_file_icon_url} onChange={v => update('upload_file_icon_url', v)} help="Optional complete icon. Overrides the layered attachment assets below." />
        <SettingsField label="Send message icon URL" value={form.send_message_icon_url} onChange={v => update('send_message_icon_url', v)} help="Optional complete icon. Overrides the layered send assets below." />
        <SettingsField label="Attachment button base URL" value={form.plus_base_icon_url} onChange={v => update('plus_base_icon_url', v)} />
        <SettingsField label="Attachment glyph URL" value={form.plus_glyph_icon_url} onChange={v => update('plus_glyph_icon_url', v)} />
        <SettingsField label="Send button base URL" value={form.send_base_icon_url} onChange={v => update('send_base_icon_url', v)} />
        <SettingsField label="Send glyph URL" value={form.send_glyph_icon_url} onChange={v => update('send_glyph_icon_url', v)} />
      </div>
    </section>

    <section className="brain-admin-settings__card brain-admin-settings__card--wide">
      <h3>Color palette</h3>
      <div className="brain-admin-settings__color-grid">
        <ColorField label="Cream background" value={form.color_cream} onChange={v => update('color_cream', v)} />
        <ColorField label="Ink" value={form.color_ink} onChange={v => update('color_ink', v)} />
        <ColorField label="Pink" value={form.color_pink} onChange={v => update('color_pink', v)} />
        <ColorField label="Purple hover" value={form.color_purple} onChange={v => update('color_purple', v)} />
        <ColorField label="Muted text" value={form.color_muted} onChange={v => update('color_muted', v)} />
        <ColorField label="User bubble yellow" value={form.color_yellow} onChange={v => update('color_yellow', v)} />
        <ColorField label="White surfaces" value={form.color_white} onChange={v => update('color_white', v)} />
        <ColorField label="Divider line" value={form.color_line} onChange={v => update('color_line', v)} />
        <ColorField label="Search button pink" value={form.color_soft_pink} onChange={v => update('color_soft_pink', v)} />
        <ColorField label="Success" value={form.color_success} onChange={v => update('color_success', v)} />
        <ColorField label="Danger" value={form.color_danger} onChange={v => update('color_danger', v)} />
      </div>
    </section>

    <section className="brain-admin-settings__card brain-admin-settings__card--wide">
      <h3>Login screen</h3>
      <SettingsField label="Heading" value={form.login_heading} onChange={v => update('login_heading', v)} />
      <SettingsField label="Intro" value={form.login_intro} onChange={v => update('login_intro', v)} multiline />
      <SettingsField label="Emphasis" value={form.login_emphasis} onChange={v => update('login_emphasis', v)} />
      <SettingsField label="Login email placeholder" value={form.login_email_placeholder} onChange={v => update('login_email_placeholder', v)} />
      <SettingsField label="Password placeholder" value={form.login_password_placeholder} onChange={v => update('login_password_placeholder', v)} />
      <SettingsField label="Forgot password text" value={form.login_forgot_password} onChange={v => update('login_forgot_password', v)} />
      <SettingsField label="Create account text" value={form.login_create_account} onChange={v => update('login_create_account', v)} />
      <SettingsField label="Login button text" value={form.login_button} onChange={v => update('login_button', v)} />
      <SettingsField label="Approval pending heading" value={form.signup_pending_heading} onChange={v => update('signup_pending_heading', v)} />
      <SettingsField label="Approval pending message" value={form.signup_pending_message} onChange={v => update('signup_pending_message', v)} multiline />
    </section>

    <section className="brain-admin-settings__card">
      <h3>Chat</h3>
      <SettingsField label="Welcome copy" value={form.chat_welcome} onChange={v => update('chat_welcome', v)} />
    </section>

    <section className="brain-admin-settings__card brain-admin-settings__card--wide">
      <h3>Dashboard</h3>
      <SettingsField label="Dashboard title" value={form.dashboard_title} onChange={v => update('dashboard_title', v)} />
      <SettingsField label="Back to chat text" value={form.dashboard_back_to_chat} onChange={v => update('dashboard_back_to_chat', v)} />
      <SettingsField label="Participants tab" value={form.dashboard_participants} onChange={v => update('dashboard_participants', v)} />
      <SettingsField label="Conversations tab" value={form.dashboard_conversations} onChange={v => update('dashboard_conversations', v)} />
      <SettingsField label="Knowledge base tab" value={form.dashboard_knowledge} onChange={v => update('dashboard_knowledge', v)} />
      <SettingsField label="Usage stats tab" value={form.dashboard_usage} onChange={v => update('dashboard_usage', v)} />
      <SettingsField label="Settings tab" value={form.dashboard_settings} onChange={v => update('dashboard_settings', v)} />
    </section>
    </div>

    {status && <p aria-live="polite" style={{ marginTop: '12px', color: status === 'Saved' ? 'var(--success)' : status === 'Saving…' ? 'var(--muted)' : 'var(--danger)', fontSize: '12px' }}>{status}</p>}
  </div>
}

export default function Dashboard({ onBack, settings, onSettingsChange }) {
  const { getToken } = useAuth()
  const [activeTab, setActiveTab] = useState('participants')
  const copy = { ...DEFAULT_SETTINGS, ...(settings || {}) }

  const tabs = [
    { id: 'participants', label: copy.dashboard_participants },
    { id: 'conversations', label: copy.dashboard_conversations },
    { id: 'knowledge', label: copy.dashboard_knowledge },
    { id: 'stats', label: copy.dashboard_usage },
    { id: 'settings', label: copy.dashboard_settings }
  ]
  const activeLabel = tabs.find(tab => tab.id === activeTab)?.label || copy.dashboard_title

  return <div className="brain-dashboard" style={{
    '--cream': copy.color_cream,
    '--ink': copy.color_ink,
    '--pink': copy.color_pink,
    '--purple': copy.color_purple,
    '--muted': copy.color_muted,
    '--yellow': copy.color_yellow,
    '--white': copy.color_white,
    '--line': copy.color_line,
    '--soft-pink': copy.color_soft_pink,
    '--success': copy.color_success,
    '--danger': copy.color_danger
  }}>
    <aside className="brain-dashboard__sidebar">
      <div>
        <p className="brain-dashboard__brand">SHIFT BRAIN</p>
        <h1>{copy.dashboard_title}</h1>
      </div>
      <nav className="brain-admin-nav" aria-label="Curator dashboard">
        {tabs.map(t => <TabButton key={t.id} label={t.label} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />)}
      </nav>
      <button className="brain-dashboard__back" type="button" onClick={onBack}>{copy.dashboard_back_to_chat}</button>
    </aside>

    <main className="brain-dashboard__main">
      <header className="brain-dashboard__topbar">
        <div><span>Curator workspace</span><h2>{activeLabel}</h2></div>
        <div className="brain-dashboard__status"><span /> Admin access</div>
      </header>

      <div className="brain-dashboard__scroll">
        <section className="brain-dashboard__panel">
        {activeTab === 'participants' && <ParticipantsTab getToken={getToken} />}
        {activeTab === 'conversations' && <ConversationsTab getToken={getToken} />}
        {activeTab === 'knowledge' && <KnowledgeTab getToken={getToken} />}
        {activeTab === 'stats' && <StatsTab getToken={getToken} />}
        {activeTab === 'settings' && <SettingsTab getToken={getToken} settings={copy} onSettingsChange={onSettingsChange} />}
        </section>
      </div>
    </main>

    <style>{`
      .brain-dashboard {
        position: relative;
        display: flex;
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        background: var(--cream);
        color: var(--ink);
        font-family: Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .brain-dashboard__sidebar {
        flex: 0 0 264px;
        display: flex;
        flex-direction: column;
        min-width: 0;
        padding: 31px 25px 24px;
        border-right: 1px solid var(--line);
        background: var(--cream);
      }

      .brain-dashboard__brand,
      .brain-admin-eyebrow {
        margin: 0 0 8px;
        color: var(--pink);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .14em;
        text-transform: uppercase;
      }

      .brain-dashboard__sidebar h1 {
        margin: 0;
        color: var(--ink);
        font-size: 24px;
        font-weight: 500;
        line-height: 30px;
      }

      .brain-admin-nav {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 47px;
      }

      .brain-admin-nav__item {
        display: flex;
        align-items: center;
        gap: 11px;
        width: 100%;
        min-height: 44px;
        padding: 0 13px;
        border: 0;
        border-radius: 9px;
        background: transparent;
        color: #696975;
        font-size: 13px;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
        transition: color 300ms ease-in-out, background-color 300ms ease-in-out, box-shadow 300ms ease-in-out, transform 300ms ease-in-out;
      }

      .brain-admin-nav__item:hover { background: rgba(255,255,255,.75); color: var(--purple); transform: translateX(3px); }
      .brain-admin-nav__item.is-active { background: var(--white); color: var(--pink); box-shadow: 3px 5px 10px -1px rgba(0,0,0,.05); }
      .brain-admin-nav__dot { width: 7px; height: 7px; border: 1px solid currentColor; border-radius: 50%; }
      .brain-admin-nav__item.is-active .brain-admin-nav__dot { background: var(--pink); }

      .brain-dashboard__back {
        margin-top: auto;
        min-height: 38px;
        padding: 0 15px;
        border: 1px solid var(--pink);
        border-radius: 999px;
        background: transparent;
        color: var(--pink);
        font-size: 12px;
        cursor: pointer;
        transition: color 300ms ease-in-out, background-color 300ms ease-in-out, border-color 300ms ease-in-out, box-shadow 300ms ease-in-out, transform 300ms ease-in-out;
      }
      .brain-dashboard__back:hover { border-color: var(--ink); background: var(--purple); color: var(--white); box-shadow: 4px 4px var(--ink); transform: rotate(-2deg); }
      .brain-dashboard__back:active { box-shadow: 2px 2px var(--ink); transform: translate(2px, 2px); }

      .brain-dashboard__main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
      .brain-dashboard__topbar {
        flex: 0 0 75px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 clamp(24px, 4vw, 54px);
        border-bottom: 1px solid var(--line);
        background: var(--cream);
      }
      .brain-dashboard__topbar span { color: var(--muted); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
      .brain-dashboard__topbar h2 { margin: 4px 0 0; font-size: 18px; font-weight: 500; }
      .brain-dashboard__status { display: flex; align-items: center; gap: 7px; color: var(--muted); font-size: 11px; }
      .brain-dashboard__status span { width: 7px; height: 7px; border-radius: 50%; background: var(--pink); }

      .brain-dashboard__scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: clamp(20px, 3.2vw, 42px) clamp(20px, 4vw, 54px) 48px;
        background: var(--cream);
      }
      .brain-dashboard__panel {
        width: 100%;
        max-width: 1240px;
        min-height: 100%;
        margin: 0 auto;
        padding: clamp(20px, 2.6vw, 34px);
        border: 1px solid rgba(222,221,213,.8);
        border-radius: 14px;
        background: var(--cream);
        box-shadow: 3px 5px 18px -6px rgba(11,11,45,.08);
      }

      .brain-admin-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
      .brain-admin-toolbar--simple { margin-bottom: 20px; }
      .brain-admin-toolbar h2 { margin: 0; color: var(--ink); font-size: 22px; font-weight: 500; }
      .brain-admin-toolbar h2 span { margin-left: 8px; color: var(--muted); font-size: 12px; font-weight: 400; }
      .brain-admin-toolbar__description { margin: 5px 0 0; color: var(--muted); font-size: 12px; line-height: 18px; }

      .brain-admin-button {
        min-height: 34px;
        padding: 0 14px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--white);
        color: var(--ink);
        font-size: 12px;
        cursor: pointer;
        transition: color 300ms ease-in-out, background-color 300ms ease-in-out, border-color 300ms ease-in-out, box-shadow 300ms ease-in-out, transform 300ms ease-in-out;
      }
      .brain-admin-button--primary { min-height: 39px; padding: 0 18px; border-color: var(--ink); background: var(--pink); color: var(--white); box-shadow: 3px 4px 0 var(--ink); }
      .brain-admin-button--small { min-height: 27px; margin-left: 10px; padding: 0 11px; }
      .brain-admin-button:disabled { opacity: .5; cursor: default; }
      .brain-admin-button:hover:not(:disabled) { border-color: var(--ink); background: var(--purple); color: var(--white); box-shadow: 4px 4px var(--ink); transform: rotate(-1deg); }
      .brain-admin-button:active:not(:disabled) { box-shadow: 2px 2px var(--ink); transform: translate(2px, 2px); }

      .brain-admin-notice { margin-bottom: 18px; padding: 13px 15px; border: 1px solid #ffc5e4; border-radius: 9px; background: #fff3fa; font-size: 12px; line-height: 19px; }
      .brain-admin-notice span { color: var(--pink); word-break: break-all; }
      .brain-admin-feedback { margin: -10px 0 18px; padding: 10px 12px; border: 1px solid #cfe8d4; border-radius: 8px; background: #f2fbf4; color: var(--success); font-size: 12px; line-height: 18px; }
      .brain-admin-feedback.is-error { border-color: #fed7d7; background: #fff5f5; color: var(--danger); }
      .brain-admin-approvals { margin: 0 0 24px; overflow: hidden; border: 1px solid #ffc3e3; border-radius: 12px; background: #fff5fa; }
      .brain-admin-approvals__heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; padding: 17px 18px 14px; border-bottom: 1px solid #ffd7eb; }
      .brain-admin-approvals__heading h3 { margin: 2px 0 0; color: var(--ink); font-size: 17px; font-weight: 500; }
      .brain-admin-approvals__heading h3 span { display: inline-flex; align-items: center; justify-content: center; min-width: 21px; height: 21px; margin-left: 7px; padding: 0 6px; border-radius: 999px; background: var(--pink); color: var(--white); font-size: 10px; }
      .brain-admin-approvals__heading > p { margin: 0; color: var(--muted); font-size: 11px; }
      .brain-admin-approvals__list { display: grid; gap: 1px; background: #ffd7eb; }
      .brain-admin-approval { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 14px 18px; background: var(--cream); }
      .brain-admin-approval__identity { display: grid; min-width: 0; gap: 2px; }
      .brain-admin-approval__identity strong { overflow: hidden; color: var(--ink); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
      .brain-admin-approval__identity span { overflow: hidden; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
      .brain-admin-approval__identity small { color: var(--muted); font-size: 10px; }
      .brain-admin-approval__button { flex: 0 0 auto; min-width: 112px; }
      .brain-admin-table-wrap { overflow-x: auto; border: 1px solid #efeee7; border-radius: 10px; }
      .brain-admin-users-table { min-width: 940px; }
      .brain-admin-users-table th:last-child,
      .brain-admin-users-table td:last-child { position: sticky; right: 0; z-index: 1; min-width: 132px; background: var(--cream); box-shadow: -12px 0 18px -18px rgba(11,11,45,.5); }
      .brain-admin-users-table th:last-child { z-index: 2; background: #faf9f3; }
      .brain-admin-users-table tbody tr:hover td:last-child { background: #fdfcf7; }
      .brain-dashboard table { width: 100%; border-collapse: collapse; }
      .brain-dashboard thead { background: #faf9f3; }
      .brain-dashboard th { color: #85858d !important; font-size: 10px !important; font-weight: 600 !important; letter-spacing: .05em; text-transform: uppercase; }
      .brain-dashboard th, .brain-dashboard td { padding: 12px 13px !important; border-bottom: 1px solid #efeee7; }
      .brain-dashboard tbody tr:last-child td { border-bottom: 0; }
      .brain-dashboard tbody tr:hover { background: #fdfcf7; }

      .brain-admin-conversations { display: grid; grid-template-columns: minmax(230px, 310px) minmax(0, 1fr); height: max(560px, calc(100dvh - 235px)); max-height: 760px; overflow: hidden; }
      .brain-admin-conversations__list { min-width: 0; overflow-y: auto; padding-right: 18px; border-right: 1px solid #ecebe4; }
      .brain-admin-conversations__thread { min-width: 0; overflow-y: auto; padding-left: 24px; }
      .brain-admin-filters { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; margin-bottom: 15px; }
      .brain-admin-filters input[type="text"] { border-color: var(--line) !important; border-radius: 999px !important; padding: 6px 10px !important; }
      .brain-admin-language-filter { min-height: 34px; padding: 0 34px 0 12px; border: 1px solid var(--line); border-radius: 999px; outline: 0; background: var(--white); color: var(--ink); font-size: 12px; cursor: pointer; }
      .brain-admin-language-filter:focus { border-color: var(--pink); box-shadow: 0 0 0 2px rgba(255,0,143,.08); }
      .brain-admin-conversation { display: block; width: 100%; margin: 0 0 5px; padding: 11px 13px; border: 1px solid transparent; border-radius: 9px; background: transparent; text-align: left; cursor: pointer; }
      .brain-admin-conversation:hover { background: #faf9f3; }
      .brain-admin-conversation.is-active { border-color: #ffc3e3; background: #fff2f9; }
      .brain-admin-thread-header { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; align-items: center; margin: 0 0 16px; padding: 0 0 14px; border-bottom: 1px solid #ecebe4; background: var(--cream); }

      .brain-admin-stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; margin-bottom: 25px; }
      .brain-admin-stat { min-width: 0; padding: 19px 20px; border: 1px solid #ecebe4; border-radius: 11px; background: #fdfcf7; }
      .brain-admin-stat__label { margin: 0 0 10px; color: var(--muted); font-size: 11px; }
      .brain-admin-stat__value { margin: 0; color: var(--ink); font-size: 27px; font-weight: 500; }
      .brain-admin-stat__sub { margin: 4px 0 0; color: var(--muted); font-size: 11px; }
      .brain-admin-subpanel { margin-bottom: 20px; padding: 20px; border: 1px solid #ecebe4; border-radius: 11px; }
      .brain-admin-subpanel__title { margin: 0 0 11px; color: var(--ink); font-size: 12px; font-weight: 600; text-transform: uppercase; }
      .brain-admin-subpanel__title span { margin-left: 5px; color: var(--muted); font-weight: 400; }

      .brain-admin-settings { width: 100%; }
      .brain-admin-settings__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 15px; }
      .brain-admin-settings__card { padding: 20px; border: 1px solid #ecebe4; border-radius: 11px; background: #fdfcf7; }
      .brain-admin-settings__card--wide { grid-column: span 2; }
      .brain-admin-settings__card h3 { margin: 0 0 17px; color: var(--ink); font-size: 14px; font-weight: 600; }
      .brain-admin-settings__icon-grid, .brain-admin-settings__color-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; margin-top: 17px; }
      .brain-admin-settings__color-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .brain-admin-field { display: block; margin-bottom: 15px; }
      .brain-admin-field:last-child { margin-bottom: 0; }
      .brain-admin-field__label { display: block; margin-bottom: 6px; color: #62626d; font-size: 11px; font-weight: 600; }
      .brain-admin-field input, .brain-admin-field textarea {
        width: 100%;
        padding: 10px 11px;
        border: 1px solid #d9d8d1;
        border-radius: 8px;
        outline: 0;
        background: var(--white);
        color: var(--ink);
        font: 13px/19px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .brain-admin-field textarea { resize: vertical; }
      .brain-admin-field input:focus, .brain-admin-field textarea:focus { border-color: var(--pink); box-shadow: 0 0 0 2px rgba(255,0,143,.08); }
      .brain-admin-field__help { display: block; margin-top: 5px; color: var(--muted); font-size: 10px; line-height: 15px; }
      .brain-admin-color-field { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 8px; }
      .brain-admin-color-field input[type="color"] { width: 42px; height: 41px; padding: 3px; cursor: pointer; }

      .brain-dashboard a { color: var(--pink) !important; }

      @media (max-width: 1020px) {
        .brain-dashboard__sidebar { flex-basis: 218px; padding-left: 18px; padding-right: 18px; }
        .brain-admin-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media (max-width: 767px) {
        .brain-dashboard { flex-direction: column; }
        .brain-dashboard__sidebar { flex: 0 0 auto; width: 100%; padding: 17px 20px 12px; border-right: 0; border-bottom: 1px solid var(--line); }
        .brain-dashboard__sidebar > div { display: flex; align-items: baseline; gap: 12px; }
        .brain-dashboard__brand { margin: 0; }
        .brain-dashboard__sidebar h1 { font-size: 18px; line-height: 24px; }
        .brain-admin-nav { flex-direction: row; gap: 3px; margin-top: 13px; overflow-x: auto; padding-bottom: 3px; }
        .brain-admin-nav__item { flex: 0 0 auto; width: auto; min-height: 34px; padding: 0 11px; font-size: 11px; }
        .brain-admin-nav__dot { display: none; }
        .brain-dashboard__back { position: absolute; top: 13px; right: 20px; min-height: 30px; margin: 0; font-size: 10px; }
        .brain-dashboard__topbar { display: none; }
        .brain-dashboard__scroll { padding: 15px 14px 28px; }
        .brain-dashboard__panel { padding: 17px 15px; border-radius: 11px; }
        .brain-admin-toolbar { align-items: flex-start; flex-direction: column; }
        .brain-admin-button--primary { align-self: stretch; }
        .brain-admin-approvals__heading { align-items: flex-start; flex-direction: column; gap: 6px; }
        .brain-admin-approval { align-items: stretch; flex-direction: column; gap: 12px; }
        .brain-admin-approval__button { width: 100%; }
        .brain-admin-conversations { grid-template-columns: 1fr; height: auto; max-height: none; overflow: visible; }
        .brain-admin-conversations__list { max-height: 330px; padding: 0 0 15px; border-right: 0; border-bottom: 1px solid #ecebe4; }
        .brain-admin-conversations__thread { max-height: 560px; padding: 18px 0 0; }
        .brain-admin-stats-grid { grid-template-columns: 1fr 1fr; }
        .brain-admin-settings__grid { grid-template-columns: 1fr; }
        .brain-admin-settings__card--wide { grid-column: span 1; }
        .brain-admin-settings__color-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media (max-width: 430px) {
        .brain-dashboard__sidebar h1 { max-width: 145px; }
        .brain-dashboard__back { max-width: 122px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .brain-admin-stats-grid { grid-template-columns: 1fr; }
        .brain-admin-settings__icon-grid, .brain-admin-settings__color-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  </div>
}
