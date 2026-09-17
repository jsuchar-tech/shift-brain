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
    <div className="brain-admin-tab">
      <div className="brain-admin-toolbar">
        <div><p className="brain-admin-eyebrow">Community</p><h2>Participants <span>{users.length}</span></h2></div>
        <button className="brain-admin-button brain-admin-button--primary" onClick={generateInvite}>
          + Generate invite link
        </button>
      </div>

      {inviteUrl && (
        <div className="brain-admin-notice">
          <strong>Invite link (48hrs):</strong><br />
          <span>{inviteUrl}</span>
          <button className="brain-admin-button brain-admin-button--small" onClick={() => { navigator.clipboard.writeText(inviteUrl); alert('Copied!') }}>Copy</button>
        </div>
      )}

      <div className="brain-admin-table-wrap">
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
  return <span style={{ display: 'inline-block', padding: '3px 9px', background: '#fff0f8', borderRadius: '999px', fontSize: '11px', color: '#ff008f' }}>📎 {attachment.file_name}</span>
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
    <div className="brain-admin-conversations">
      <div className="brain-admin-conversations__list">
        <div className="brain-admin-filters">
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
          <button type="button" key={conv.id} onClick={() => loadThread(conv.id)} className={`brain-admin-conversation ${selected?.id === conv.id ? 'is-active' : ''}`}>
            <p style={{ fontSize: '13px', fontWeight: '500', color: '#0b0b2d', marginBottom: '2px' }}>{conv.users?.full_name || 'Unknown'}</p>
            <p style={{ fontSize: '12px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title || 'Untitled'}</p>
            <p style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{new Date(conv.created_at).toLocaleDateString()} · {languageLabel(conv.language)}</p>
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

const DEFAULT_SETTINGS = {
  brain_icon_url: 'https://www.figma.com/api/mcp/asset/03794579-c631-4353-bbb8-fcce3e3805e9.png',
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
  return <label className="brain-admin-field">
    <span className="brain-admin-field__label">{label}</span>
    {multiline ? <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={4} /> : <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} />}
    {help && <span className="brain-admin-field__help">{help}</span>}
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
      .catch(err => {
        // The public /config response already supplied usable settings.
        // A failed admin refresh should not display a false form error.
        console.warn('Using already-loaded settings:', err)
      })
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

  return <div className="brain-admin-settings">
    <div className="brain-admin-toolbar">
      <div><p className="brain-admin-eyebrow">Appearance</p><h2>Branding & copy</h2><p className="brain-admin-toolbar__description">Used by the login screen, chat welcome screen and curator dashboard.</p></div>
      <button className="brain-admin-button brain-admin-button--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
    </div>

    <div className="brain-admin-settings__grid">
    <section className="brain-admin-settings__card">
      <h3>Brain icon</h3>
      <SettingsField label="Brain icon URL" value={form.brain_icon_url} onChange={v => update('brain_icon_url', v)} help="Use a public HTTPS image URL. It appears on the login, account and chat welcome screens." />
      {form.brain_icon_url && <img src={form.brain_icon_url} alt="Brain icon preview" style={{ width: '91px', height: '81px', objectFit: 'contain', display: 'block' }} onError={e => { e.currentTarget.style.opacity = '.25' }} />}
    </section>

    <section className="brain-admin-settings__card brain-admin-settings__card--wide">
      <h3>Login screen</h3>
      <SettingsField label="Heading" value={form.login_heading} onChange={v => update('login_heading', v)} />
      <SettingsField label="Intro" value={form.login_intro} onChange={v => update('login_intro', v)} multiline />
      <SettingsField label="Emphasis" value={form.login_emphasis} onChange={v => update('login_emphasis', v)} />
      <SettingsField label="Name placeholder" value={form.login_name_placeholder} onChange={v => update('login_name_placeholder', v)} />
      <SettingsField label="Password placeholder" value={form.login_password_placeholder} onChange={v => update('login_password_placeholder', v)} />
      <SettingsField label="Forgot password text" value={form.login_forgot_password} onChange={v => update('login_forgot_password', v)} />
      <SettingsField label="Create account text" value={form.login_create_account} onChange={v => update('login_create_account', v)} />
      <SettingsField label="Login button text" value={form.login_button} onChange={v => update('login_button', v)} />
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
    </section>
    </div>

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
  const activeLabel = tabs.find(tab => tab.id === activeTab)?.label || copy.dashboard_title

  return <div className="brain-dashboard">
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
        --cream: #fdfbef;
        --ink: #0b0b2d;
        --pink: #ff008f;
        --muted: #9d9d9d;
        --line: #deddd5;
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

      .brain-admin-nav__item:hover { background: rgba(255,255,255,.75); color: #302798; transform: translateX(3px); }
      .brain-admin-nav__item.is-active { background: #fff; color: var(--pink); box-shadow: 3px 5px 10px -1px rgba(0,0,0,.05); }
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
      .brain-dashboard__back:hover { border-color: var(--ink); background: #302798; color: #fff; box-shadow: 4px 4px var(--ink); transform: rotate(-2deg); }
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
        background: #fff;
        color: var(--ink);
        font-size: 12px;
        cursor: pointer;
        transition: color 300ms ease-in-out, background-color 300ms ease-in-out, border-color 300ms ease-in-out, box-shadow 300ms ease-in-out, transform 300ms ease-in-out;
      }
      .brain-admin-button--primary { min-height: 39px; padding: 0 18px; border-color: var(--ink); background: var(--pink); color: #fff; box-shadow: 3px 4px 0 var(--ink); }
      .brain-admin-button--small { min-height: 27px; margin-left: 10px; padding: 0 11px; }
      .brain-admin-button:disabled { opacity: .5; cursor: default; }
      .brain-admin-button:hover:not(:disabled) { border-color: var(--ink); background: #302798; color: #fff; box-shadow: 4px 4px var(--ink); transform: rotate(-1deg); }
      .brain-admin-button:active:not(:disabled) { box-shadow: 2px 2px var(--ink); transform: translate(2px, 2px); }

      .brain-admin-notice { margin-bottom: 18px; padding: 13px 15px; border: 1px solid #ffc5e4; border-radius: 9px; background: #fff3fa; font-size: 12px; line-height: 19px; }
      .brain-admin-notice span { color: var(--pink); word-break: break-all; }
      .brain-admin-table-wrap { overflow-x: auto; border: 1px solid #efeee7; border-radius: 10px; }
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
      .brain-admin-field { display: block; margin-bottom: 15px; }
      .brain-admin-field:last-child { margin-bottom: 0; }
      .brain-admin-field__label { display: block; margin-bottom: 6px; color: #62626d; font-size: 11px; font-weight: 600; }
      .brain-admin-field input, .brain-admin-field textarea {
        width: 100%;
        padding: 10px 11px;
        border: 1px solid #d9d8d1;
        border-radius: 8px;
        outline: 0;
        background: #fff;
        color: var(--ink);
        font: 13px/19px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .brain-admin-field textarea { resize: vertical; }
      .brain-admin-field input:focus, .brain-admin-field textarea:focus { border-color: var(--pink); box-shadow: 0 0 0 2px rgba(255,0,143,.08); }
      .brain-admin-field__help { display: block; margin-top: 5px; color: var(--muted); font-size: 10px; line-height: 15px; }

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
        .brain-admin-conversations { grid-template-columns: 1fr; height: auto; max-height: none; overflow: visible; }
        .brain-admin-conversations__list { max-height: 330px; padding: 0 0 15px; border-right: 0; border-bottom: 1px solid #ecebe4; }
        .brain-admin-conversations__thread { max-height: 560px; padding: 18px 0 0; }
        .brain-admin-stats-grid { grid-template-columns: 1fr 1fr; }
        .brain-admin-settings__grid { grid-template-columns: 1fr; }
        .brain-admin-settings__card--wide { grid-column: span 1; }
      }

      @media (max-width: 430px) {
        .brain-dashboard__sidebar h1 { max-width: 145px; }
        .brain-dashboard__back { max-width: 122px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .brain-admin-stats-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  </div>
}
