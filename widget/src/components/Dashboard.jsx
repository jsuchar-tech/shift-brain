import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'

const API_URL = import.meta.env.VITE_API_URL || '/api'

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
  if (!res.ok) throw new Error(`Failed: ${path}`)
  return res.json()
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px 24px',
      border: '1px solid #f0f0f0'
    }}>
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
    } catch (err) {
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
        <button
          onClick={generateInvite}
          style={{
            padding: '8px 16px',
            background: '#4a90d9',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          + Generate invite link
        </button>
      </div>

      {inviteUrl && (
        <div style={{
          padding: '12px 16px',
          background: '#eaf3fe',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '13px'
        }}>
          <strong>Invite link (48hrs):</strong>
          <br />
          <span style={{ wordBreak: 'break-all', color: '#4a90d9' }}>{inviteUrl}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(inviteUrl); alert('Copied!') }}
            style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}
          >
            Copy
          </button>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
            {['Name', 'Email', 'Country', 'Year', 'Tokens today', 'Last active', 'Status', ''].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px', color: '#888', fontWeight: '500' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
              <td style={{ padding: '10px 8px', fontWeight: '500' }}>{u.full_name}</td>
              <td style={{ padding: '10px 8px', color: '#666' }}>{u.work_email}</td>
              <td style={{ padding: '10px 8px', color: '#666' }}>{u.country_office}</td>
              <td style={{ padding: '10px 8px', color: '#666' }}>{u.shifter_year}</td>
              <td style={{ padding: '10px 8px', color: '#666' }}>
                {u.tokens_used_today?.toLocaleString()} / {u.daily_limit?.toLocaleString()}
              </td>
              <td style={{ padding: '10px 8px', color: '#666' }}>
                {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : '—'}
              </td>
              <td style={{ padding: '10px 8px' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  background: u.is_active ? '#e6f4ea' : '#fce8e8',
                  color: u.is_active ? '#2d7a3a' : '#c53030'
                }}>
                  {u.is_active ? 'Active' : 'Disabled'}
                </span>
              </td>
              <td style={{ padding: '10px 8px' }}>
                {u.role !== 'admin' && (
                  <button
                    onClick={() => toggleUser(u.id, u.is_active)}
                    style={{
                      padding: '4px 10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      background: 'white',
                      fontSize: '12px',
                      cursor: 'pointer',
                      color: u.is_active ? '#c53030' : '#2d7a3a'
                    }}
                  >
                    {u.is_active ? 'Disable' : 'Enable'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
    if (filter.language) params.set('language', filter.language)

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
    const res = await fetch(`${API_URL}/admin/conversations/${id}/export`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shift-brain-conversation-${id}.txt`
    a.click()
  }

  if (loading) return <p style={{ padding: '20px', color: '#888' }}>Loading...</p>

  return (
    <div style={{ display: 'flex', gap: '16px', height: '600px' }}>
      {/* Conversation list */}
      <div style={{
        width: '300px',
        flexShrink: 0,
        overflowY: 'auto',
        borderRight: '1px solid #f0f0f0',
        paddingRight: '16px'
      }}>
        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filter.flagged}
              onChange={e => setFilter(f => ({ ...f, flagged: e.target.checked }))}
            />
            Flagged only
          </label>
          <select
            value={filter.language}
            onChange={e => setFilter(f => ({ ...f, language: e.target.value }))}
            style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">All languages</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="pt">Portuguese</option>
          </select>
        </div>

        {conversations.map(conv => (
          <div
            key={conv.id}
            onClick={() => loadThread(conv.id)}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '4px',
              background: selected?.id === conv.id ? '#eaf3fe' : 'transparent',
              border: '1px solid',
              borderColor: selected?.id === conv.id ? '#4a90d9' : 'transparent'
            }}
          >
            <p style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a2e', marginBottom: '2px' }}>
              {conv.users?.full_name || 'Unknown'}
            </p>
            <p style={{ fontSize: '12px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {conv.title || 'Untitled'}
            </p>
            <p style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
              {new Date(conv.created_at).toLocaleDateString()} · {conv.language?.toUpperCase()}
            </p>
          </div>
        ))}
      </div>

      {/* Thread view */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!selected ? (
          <p style={{ color: '#888', fontSize: '14px', padding: '20px' }}>
            Select a conversation to view the thread
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <p style={{ fontWeight: '500', fontSize: '14px' }}>{selected.users?.full_name}</p>
                <p style={{ fontSize: '12px', color: '#888' }}>{selected.title}</p>
              </div>
              <button
                onClick={() => exportConversation(selected.id)}
                style={{
                  padding: '6px 14px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  background: 'white',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Export .txt
              </button>
            </div>

            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  marginBottom: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: msg.role === 'user' ? '#f7f9fc' : 'white',
                  border: '1px solid #f0f0f0'
                }}
              >
                <p style={{ fontSize: '11px', fontWeight: '600', color: msg.role === 'user' ? '#4a90d9' : '#666', marginBottom: '6px', textTransform: 'uppercase' }}>
                  {msg.role === 'user' ? 'Participant' : 'SHIFT Brain'}
                  {msg.safety_triggered && (
                    <span style={{ marginLeft: '8px', color: '#e53e3e' }}>⚠ Safety</span>
                  )}
                </p>
                <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#333' }}>{msg.content}</p>
                {msg.chunks_used && msg.chunks_used.length > 0 && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
                    <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Sources used:</p>
                    {msg.chunks_used.map((c, i) => (
                      <p key={i} style={{ fontSize: '11px', color: '#4a90d9' }}>
                        📄 {c.file_name}{c.page_number ? ` p.${c.page_number}` : ''}
                      </p>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: '11px', color: '#ccc', marginTop: '6px' }}>
                  {new Date(msg.created_at).toLocaleTimeString()}
                  {msg.tokens_in ? ` · ${msg.tokens_in + msg.tokens_out} tokens` : ''}
                  {msg.latency_ms ? ` · ${msg.latency_ms}ms` : ''}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function KnowledgeTab({ getToken }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ingesting, setIngesting] = useState(false)

  useEffect(() => {
    adminFetch('/admin/knowledge', getToken)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [getToken])

  async function triggerIngest() {
    setIngesting(true)
    try {
      await adminFetch('/admin/ingest', getToken, { method: 'POST' })
      alert('Ingestion started — check server logs for progress')
    } catch {
      alert('Failed to trigger ingestion')
    } finally {
      setIngesting(false)
    }
  }

  if (loading) return <p style={{ padding: '20px', color: '#888' }}>Loading...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '500' }}>Knowledge base — {data?.files?.length || 0} files</h3>
        <button
          onClick={triggerIngest}
          disabled={ingesting}
          style={{
            padding: '8px 16px',
            background: ingesting ? '#ccc' : '#4a90d9',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            cursor: ingesting ? 'not-allowed' : 'pointer'
          }}
        >
          {ingesting ? 'Ingesting...' : 'Trigger re-ingestion'}
        </button>
      </div>

      {data?.top_files?.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>
            Most retrieved (top 10)
          </p>
          {data.top_files.map((f, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f9f9f9', fontSize: '13px' }}>
              <span style={{ color: '#333' }}>{f.name}</span>
              <span style={{ color: '#4a90d9', fontWeight: '500' }}>{f.retrieval_count} retrievals</span>
            </div>
          ))}
        </div>
      )}

      {data?.never_retrieved?.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#e53e3e', marginBottom: '8px', textTransform: 'uppercase' }}>
            Never retrieved ({data.never_retrieved.length} files)
          </p>
          {data.never_retrieved.map((name, i) => (
            <p key={i} style={{ fontSize: '13px', color: '#666', padding: '4px 0' }}>— {name}</p>
          ))}
        </div>
      )}

      <div>
        <p style={{ fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>
          All ingested files
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              {['File', 'Type', 'Chunks', 'Last ingested'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px', color: '#888', fontWeight: '500' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.files?.map((f, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                <td style={{ padding: '8px' }}>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4a90d9', textDecoration: 'none' }}>
                    {f.name}
                  </a>
                </td>
                <td style={{ padding: '8px', color: '#888' }}>{f.type}</td>
                <td style={{ padding: '8px', color: '#888' }}>{f.chunk_count}</td>
                <td style={{ padding: '8px', color: '#888' }}>
                  {new Date(f.last_ingested).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatsTab({ getToken }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminFetch('/admin/stats', getToken)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [getToken])

  if (loading) return <p style={{ padding: '20px', color: '#888' }}>Loading...</p>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Total queries (30d)" value={stats?.total_queries?.toLocaleString() || '0'} />
        <StatCard label="Total tokens (30d)" value={stats?.total_tokens?.toLocaleString() || '0'} />
        <StatCard label="Avg response time" value={stats?.avg_latency_ms ? `${stats.avg_latency_ms}ms` : '—'} />
        <StatCard label="Safety events (30d)" value={stats?.safety_events_count || '0'} />
      </div>

      {stats?.language_breakdown && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>
            Language breakdown
          </p>
          {Object.entries(stats.language_breakdown).map(([lang, count]) => (
            <div key={lang} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f9f9f9', fontSize: '13px' }}>
              <span>{{ en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese' }[lang] || lang}</span>
              <span style={{ color: '#4a90d9', fontWeight: '500' }}>{count} queries</span>
            </div>
          ))}
        </div>
      )}

      {stats?.safety_events?.length > 0 && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>
            Recent safety events
          </p>
          {stats.safety_events.map((e, i) => (
            <div key={i} style={{ padding: '10px 12px', marginBottom: '6px', background: '#fff5f5', borderRadius: '8px', border: '1px solid #fed7d7' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#c53030', marginBottom: '4px' }}>
                {e.trigger_category} · {e.users?.full_name} · {new Date(e.created_at).toLocaleString()}
              </p>
              <p style={{ fontSize: '13px', color: '#666' }}>{e.message_content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ onBack }) {
  const { getToken } = useAuth()
  const [activeTab, setActiveTab] = useState('participants')

  const tabs = [
    { id: 'participants', label: 'Participants' },
    { id: 'conversations', label: 'Conversations' },
    { id: 'knowledge', label: 'Knowledge base' },
    { id: 'stats', label: 'Usage stats' }
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f7f9fc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #f0f0f0',
        padding: '0 32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', paddingBottom: '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', color: '#4a90d9', cursor: 'pointer', fontSize: '13px' }}
            >
              ← Back to chat
            </button>
            <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a2e' }}>
              Curator Dashboard
            </h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
          {tabs.map(t => (
            <TabButton
              key={t.id}
              label={t.label}
              active={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 32px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #f0f0f0' }}>
          {activeTab === 'participants' && <ParticipantsTab getToken={getToken} />}
          {activeTab === 'conversations' && <ConversationsTab getToken={getToken} />}
          {activeTab === 'knowledge' && <KnowledgeTab getToken={getToken} />}
          {activeTab === 'stats' && <StatsTab getToken={getToken} />}
        </div>
      </div>
    </div>
  )
}