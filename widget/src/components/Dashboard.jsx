import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { API_URL } from '../lib/api'

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
    <div style={{ background: 'white', borderRadius: '12px', padding: '20px 24px', border: '1px solid #f0f0f0' }}>
      <p style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '28px', fontWeight: '500', color: '#1a1a2e' }}>{value}</p>
      {sub && <p style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>{sub}</p>}
    </div>
  )
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        border: 'none',
        borderBottom: active ? '2px solid #4a90d9' : '2px solid transparent',
        background: 'transparent',
        color: active ? '#4a90d9' : '#666',
        fontSize: '14px',
        fontWeight: active ? '500' : '400',
        cursor: 'pointer'
      }}
    >
      {label}
    </button>
  )
}

function ParticipantsTab({ getToken }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteUrl, setInviteUrl] = useState(null)

  useEffect(() => {
    adminFetch('/admin/users', getToken)
      .then(d => setUsers(d.users || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [getToken])

  async function generateInvite() {
    try {
      const data = await adminFetch('/admin/invite', getToken, { method: 'POST' })
      setInviteUrl(data.invite_url)
    } catch {
      alert('Failed to generate invite')
    }
  }

  async function toggleUser(id, is_active) {
    await adminFetch(`/admin/users/${id}`, getToken, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !is_active })
    })
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !is_active } : u))
  }

  if (loading) return <p style={{ padding: '20px', color: '#888' }}>Loading...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '500' }}>Participants ({users.length})</h3>
        <button onClick={generateInvite} style={{ padding: '8px 16px', background: '#4a90d9', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
          + Generate invite link
        </button>
      </div>

      {inviteUrl && (
        <div style={{ padding: '12px 16px', background: '#eaf3fe', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
          <strong>Invite link (48hrs):</strong><br />
          <span style={{ wordBreak: 'break-all', color: '#4a90d9' }}>{inviteUrl}</span>
          <button onClick={() => { navigator.clipboard.writeText(inviteUrl); alert('Copied!') }} style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}>Copy</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
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
                <td style={{ padding: '10px 8px' }}><span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: u.is_active ? '#e6f4ea' : '#fce8e8', color: u.is_active ? '#2d7a3a' : '#c53030' }}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                <td style={{ padding: '10px 8px' }}>
                  {u.role !== 'admin' && <button onClick={() => toggleUser(u.id, u.is_active)} style={{ padding: '4px 10px', border: '1px solid #ddd', borderRadius: '6px', background: 'white', fontSize: '12px', cursor: 'pointer', color: u.is_active ? '#c53030' : '#2d7a3a' }}>{u.is_active ? 'Disable' : 'Enable'}</button>}
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
  return <span style={{ display: 'inline-block', padding: '2px 8px', background: '#f0f7ff', borderRadius: '4px', fontSize: '11px', color: '#4a90d9' }}>📎 {attachment.file_name}</span>
}

function ConversationsTab({ getToken }) {
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ flagged: false, language: '' })

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter.flagged) params.set('flagged', 'true')
    if (filter.language.trim()) params.set('language', filter.language.trim())
    adminFetch(`/admin/conversations?${params}`, getToken)
      .then(d => setConversations(d.conversations || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [getToken, filter])

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
    <div style={{ display: 'flex', gap: '16px', height: '600px', minHeight: '600px' }}>
      <div style={{ width: '300px', flexShrink: 0, overflowY: 'auto', borderRight: '1px solid #f0f0f0', paddingRight: '16px' }}>
        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={filter.flagged} onChange={e => setFilter(f => ({ ...f, flagged: e.target.checked }))} />
            Flagged only
          </label>
          <input
            value={filter.language}
            onChange={e => setFilter(f => ({ ...f, language: e.target.value }))}
            placeholder="Language code"
            aria-label="Filter by language code"
            style={{ width: '120px', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>
        {conversations.map(conv => (
          <div key={conv.id} onClick={() => loadThread(conv.id)} style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', background: selected?.id === conv.id ? '#eaf3fe' : 'transparent', border: '1px solid', borderColor: selected?.id === conv.id ? '#4a90d9' : 'transparent' }}>
            <p style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a2e', marginBottom: '2px' }}>{conv.users?.full_name || 'Unknown'}</p>
            <p style={{ fontSize: '12px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title || 'Untitled'}</p>
            <p style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{new Date(conv.created_at).toLocaleDateString()} · {languageLabel(conv.language)}</p>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!selected ? <p style={{ color: '#888', fontSize: '14px', padding: '20px' }}>Select a conversation to view the thread</p> : <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div><p style={{ fontWeight: '500', fontSize: '14px' }}>{selected.users?.full_name}</p><p style={{ fontSize: '12px', color: '#888' }}>{selected.title}</p></div>
            <button onClick={() => exportConversation(selected.id)} style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', fontSize: '13px', cursor: 'pointer' }}>Export .txt</button>
          </div>
          {messages.map(msg => (
            <div key={msg.id} style={{ marginBottom: '12px', padding: '12px 16px', borderRadius: '8px', background: msg.role === 'user' ? '#f7f9fc' : 'white', border: '1px solid #f0f0f0' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: msg.role === 'user' ? '#4a90d9' : '#666', marginBottom: '6px', textTransform: 'uppercase' }}>
                {msg.role === 'user' ? 'Participant' : 'SHIFT Brain'}
                {msg.safety_triggered && <span style={{ marginLeft: '8px', color: '#e53e3e' }}>⚠ Safety</span>}
              </p>
              <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#333', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
              {msg.attachments?.length > 0 && <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{msg.attachments.map((a, i) => <AttachmentThumb key={i} attachment={a} />)}</div>}
              {msg.chunks_used?.length > 0 && <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}><p style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Sources used:</p>{msg.chunks_used.map((c, i) => <p key={i} style={{ fontSize: '11px', color: '#4a90d9' }}>📄 {c.file_name}{c.page_number ? ` p.${c.page_number}` : ''}</p>)}</div>}
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
  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: '500' }}>Knowledge base — {data?.files?.length || 0} files</h3>
      <button onClick={triggerIngest} disabled={ingesting} style={{ padding: '8px 16px', background: ingesting ? '#ccc' : '#4a90d9', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: ingesting ? 'not-allowed' : 'pointer' }}>{ingesting ? 'Ingesting...' : 'Trigger re-ingestion'}</button>
    </div>
    {data?.top_files?.length > 0 && <div style={{ marginBottom: '24px' }}><p style={{ fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Most retrieved (top 10)</p>{data.top_files.map((f, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f9f9f9', fontSize: '13px' }}><span style={{ color: '#333' }}>{f.name}</span><span style={{ color: '#4a90d9', fontWeight: '500' }}>{f.retrieval_count} retrievals</span></div>)}</div>}
    {data?.never_retrieved?.length > 0 && <div style={{ marginBottom: '24px' }}><p style={{ fontSize: '12px', fontWeight: '600', color: '#e53e3e', marginBottom: '8px', textTransform: 'uppercase' }}>Never retrieved ({data.never_retrieved.length} files)</p>{data.never_retrieved.map((name, i) => <p key={i} style={{ fontSize: '13px', color: '#666', padding: '4px 0' }}>— {name}</p>)}</div>}
    <div><p style={{ fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>All ingested files</p><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}><thead><tr style={{ borderBottom: '1px solid #f0f0f0' }}>{['File', 'Type', 'Chunks', 'Last ingested'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px', color: '#888', fontWeight: '500' }}>{h}</th>)}</tr></thead><tbody>{data?.files?.map((f, i) => <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}><td style={{ padding: '8px' }}><a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4a90d9', textDecoration: 'none' }}>{f.name}</a></td><td style={{ padding: '8px', color: '#888' }}>{f.type}</td><td style={{ padding: '8px', color: '#888' }}>{f.chunk_count}</td><td style={{ padding: '8px', color: '#888' }}>{new Date(f.last_ingested).toLocaleDateString()}</td></tr>)}</tbody></table></div></div>
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

  return <div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
      <StatCard label="Total queries (30d)" value={stats?.total_queries?.toLocaleString() || '0'} />
      <StatCard label="Total tokens (30d)" value={stats?.total_tokens?.toLocaleString() || '0'} />
      <StatCard label="Avg response time" value={stats?.avg_latency_ms ? `${stats.avg_latency_ms}ms` : '—'} />
      <StatCard label="Safety events (30d)" value={stats?.safety_events_count || '0'} />
    </div>

    <div style={{ marginBottom: '24px' }}>
      <p style={{ fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Language breakdown ({breakdown.length})</p>
      {breakdown.length === 0 ? <p style={{ color: '#aaa', fontSize: '13px' }}>No language data yet.</p> : breakdown.map(([lang, count]) => (
        <div key={lang} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f9f9f9', fontSize: '13px' }}>
          <span>{languageLabel(lang)} <span style={{ color: '#aaa', marginLeft: '5px' }}>{lang}</span></span>
          <span style={{ color: '#4a90d9', fontWeight: '500' }}>{count} queries</span>
        </div>
      ))}
    </div>

    {stats?.safety_events?.length > 0 && <div><p style={{ fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Recent safety events</p>{stats.safety_events.map((e, i) => <div key={i} style={{ padding: '10px 12px', marginBottom: '6px', background: '#fff5f5', borderRadius: '8px', border: '1px solid #fed7d7' }}><p style={{ fontSize: '12px', fontWeight: '600', color: '#c53030', marginBottom: '4px' }}>{e.trigger_category} · {e.users?.full_name} · {new Date(e.created_at).toLocaleString()}</p><p style={{ fontSize: '13px', color: '#666' }}>{e.message_content}</p></div>)}</div>}
  </div>
}

const DEFAULT_SETTINGS = {
  logo_url: 'https://www.figma.com/api/mcp/asset/44867e92-d100-4ce0-825a-f3eb32f0a8d0.png',
  login_heading: 'Hello there!',
  login_intro: 'I’m SHIFT Brain (BETA), a Fun (AI)dult that’s been trained on all the resources, tools and knowledge gathered over the last 6 years.',
  login_emphasis: 'Ask me anything related to SHIFT!',
  login_name_placeholder: 'Name',
  login_password_placeholder: 'Password',
  login_forgot_password: 'Forgot password?',
  login_create_account: 'Create an account',
  login_button: 'LOG IN',
  dashboard_title: 'Curator Dashboard',
  dashboard_back_to_chat: '← Back to chat',
  dashboard_participants: 'Participants',
  dashboard_conversations: 'Conversations',
  dashboard_knowledge: 'Knowledge base',
  dashboard_usage: 'Usage stats',
  dashboard_settings: 'Settings',
  chat_welcome: 'Let’s start building your movement today!'
}

function SettingsField({ label, value, onChange, multiline = false, type = 'text', help }) {
  const style = { width: '100%', padding: '9px 10px', border: '1px solid #ddd', borderRadius: '7px', font: 'inherit', fontSize: '13px', color: '#1a1a2e', background: 'white' }
  return <label style={{ display: 'block', marginBottom: '14px' }}>
    <span style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '5px' }}>{label}</span>
    {multiline ? <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={4} style={{ ...style, resize: 'vertical' }} /> : <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} style={style} />}
    {help && <span style={{ display: 'block', marginTop: '4px', color: '#999', fontSize: '11px' }}>{help}</span>}
  </label>
}

function SettingsTab({ getToken, settings, onSettingsChange }) {
  const [form, setForm] = useState({ ...DEFAULT_SETTINGS, ...(settings || {}) })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    adminFetch('/admin/settings', getToken)
      .then(data => {
        if (data?.settings) {
          const next = { ...DEFAULT_SETTINGS, ...data.settings }
          setForm(next)
          onSettingsChange?.(next)
        }
      })
      .catch(err => setStatus(err.message || 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [getToken])

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    setStatus('')
  }

  async function save() {
    setSaving(true)
    setStatus('')
    try {
      const data = await adminFetch('/admin/settings', getToken, { method: 'PATCH', body: JSON.stringify(form) })
      const next = { ...DEFAULT_SETTINGS, ...(data.settings || form) }
      setForm(next)
      onSettingsChange?.(next)
      setStatus('Saved.')
    } catch (err) {
      setStatus(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p style={{ padding: '20px', color: '#888' }}>Loading settings...</p>

  return <div style={{ maxWidth: '820px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <div><h3 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '3px' }}>Branding & copy</h3><p style={{ fontSize: '12px', color: '#999' }}>These values are used by the login screen, chat welcome screen and admin dashboard.</p></div>
      <button onClick={save} disabled={saving} style={{ padding: '8px 18px', background: saving ? '#ccc' : '#4a90d9', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save changes'}</button>
    </div>

    <section style={{ padding: '18px', border: '1px solid #eee', borderRadius: '10px', marginBottom: '14px' }}>
      <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '14px' }}>Logo</h4>
      <SettingsField label="Logo URL" value={form.logo_url} onChange={v => update('logo_url', v)} help="Use a public HTTPS image URL. Leave empty to use the default SHIFT logo." />
      {form.logo_url && <img src={form.logo_url} alt="Logo preview" style={{ width: '48px', height: '39px', objectFit: 'contain', display: 'block' }} onError={e => { e.currentTarget.style.opacity = '.25' }} />}
    </section>

    <section style={{ padding: '18px', border: '1px solid #eee', borderRadius: '10px', marginBottom: '14px' }}>
      <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '14px' }}>Login screen</h4>
      <SettingsField label="Heading" value={form.login_heading} onChange={v => update('login_heading', v)} />
      <SettingsField label="Intro" value={form.login_intro} onChange={v => update('login_intro', v)} multiline />
      <SettingsField label="Emphasis" value={form.login_emphasis} onChange={v => update('login_emphasis', v)} />
      <SettingsField label="Name placeholder" value={form.login_name_placeholder} onChange={v => update('login_name_placeholder', v)} />
      <SettingsField label="Password placeholder" value={form.login_password_placeholder} onChange={v => update('login_password_placeholder', v)} />
      <SettingsField label="Forgot password text" value={form.login_forgot_password} onChange={v => update('login_forgot_password', v)} />
      <SettingsField label="Create account text" value={form.login_create_account} onChange={v => update('login_create_account', v)} />
      <SettingsField label="Login button text" value={form.login_button} onChange={v => update('login_button', v)} />
    </section>

    <section style={{ padding: '18px', border: '1px solid #eee', borderRadius: '10px', marginBottom: '14px' }}>
      <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '14px' }}>Chat</h4>
      <SettingsField label="Welcome copy" value={form.chat_welcome} onChange={v => update('chat_welcome', v)} />
    </section>

    <section style={{ padding: '18px', border: '1px solid #eee', borderRadius: '10px' }}>
      <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '14px' }}>Dashboard</h4>
      <SettingsField label="Dashboard title" value={form.dashboard_title} onChange={v => update('dashboard_title', v)} />
      <SettingsField label="Back to chat text" value={form.dashboard_back_to_chat} onChange={v => update('dashboard_back_to_chat', v)} />
      <SettingsField label="Participants tab" value={form.dashboard_participants} onChange={v => update('dashboard_participants', v)} />
      <SettingsField label="Conversations tab" value={form.dashboard_conversations} onChange={v => update('dashboard_conversations', v)} />
      <SettingsField label="Knowledge base tab" value={form.dashboard_knowledge} onChange={v => update('dashboard_knowledge', v)} />
      <SettingsField label="Usage stats tab" value={form.dashboard_usage} onChange={v => update('dashboard_usage', v)} />
    </section>

    {status && <p style={{ marginTop: '12px', color: status === 'Saved.' ? '#2d7a3a' : '#c53030', fontSize: '12px' }}>{status}</p>}
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

  return <div style={{ height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f7f9fc', fontFamily: 'Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
    <div style={{ flex: '0 0 auto', background: 'white', borderBottom: '1px solid #f0f0f0', padding: '0 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#4a90d9', cursor: 'pointer', fontSize: '13px' }}>{copy.dashboard_back_to_chat}</button>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a2e' }}>{copy.dashboard_title}</h1>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '8px', overflowX: 'auto' }}>
        {tabs.map(t => <TabButton key={t.id} label={t.label} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />)}
      </div>
    </div>

    <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '24px 32px 40px' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #f0f0f0' }}>
        {activeTab === 'participants' && <ParticipantsTab getToken={getToken} />}
        {activeTab === 'conversations' && <ConversationsTab getToken={getToken} />}
        {activeTab === 'knowledge' && <KnowledgeTab getToken={getToken} />}
        {activeTab === 'stats' && <StatsTab getToken={getToken} />}
        {activeTab === 'settings' && <SettingsTab getToken={getToken} settings={copy} onSettingsChange={onSettingsChange} />}
      </div>
    </div>
  </div>
}
