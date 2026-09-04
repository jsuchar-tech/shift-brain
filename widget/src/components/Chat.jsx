import { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import MessageList from './MessageList'
import InputBar from './InputBar'
import StarterQuestions from './StarterQuestions'
import ConversationSidebar from './ConversationSidebar'
import TokenUsage from './TokenUsage'
import LanguageSelector from './LanguageSelector'
import { useChat } from '../hooks/useChat'
import { useTokenUsage } from '../hooks/useTokenUsage'
import { useConversations } from '../hooks/useConversations'
import { syncUser, updateLanguage } from '../lib/api'

export default function Chat({ onOpenDashboard }) {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [language, setLanguage] = useState('en')
  const [synced, setSynced] = useState(false)

  const { messages, isLoading, conversationId, error, sendMessage, clearChat, loadConversation } = useChat(getToken)
  const { usage, refresh: refreshUsage } = useTokenUsage(getToken)
  const { conversations, refresh: refreshConversations, loadThread } = useConversations(getToken)

  // Sync user to your DB on first load
  useEffect(() => {
    if (!user || synced) return
    const metadata = user.publicMetadata || {}
    syncUser(getToken, {
      full_name: user.fullName || user.firstName,
      work_email: user.primaryEmailAddress?.emailAddress,
      country_office: metadata.country_office || 'Unknown',
      shifter_year: metadata.shifter_year || 1
    }).then(() => setSynced(true)).catch(console.error)
  }, [user, synced, getToken])

  // Detect browser language on first load
  useEffect(() => {
    const browserLang = navigator.language?.slice(0, 2)
    const supported = ['en', 'es', 'fr', 'pt']
    if (supported.includes(browserLang)) setLanguage(browserLang)
  }, [])

  async function handleSend(text) {
    await sendMessage(text, language)
    refreshUsage()
    refreshConversations()
  }

  async function handleSelectConversation(id) {
    const data = await loadThread(id)
    loadConversation(data.conversation, data.messages)
  }

  async function handleLanguageChange(lang) {
    setLanguage(lang)
    await updateLanguage(getToken, lang)
  }

  const showStarters = messages.length === 0

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#f7f9fc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        onSelect={handleSelectConversation}
        onNew={clearChat}
        currentId={conversationId}
      />

      {/* Main chat area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f0f0f0',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
<h1 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a2e' }}>
  Lorem Ipsum 2.0
</h1>
<p style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
  Dolor sit amet consectetur
</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TokenUsage usage={usage} />
            <LanguageSelector language={language} onChange={handleLanguageChange} />
            {onOpenDashboard && (
              <button
                onClick={onOpenDashboard}
                style={{
                  padding: '6px 14px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  background: 'white',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                Dashboard
              </button>
            )}
          </div>
        </div>

        {/* Hero search prompt — shown when no messages */}
        {showStarters && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px'
          }}>
 <h2 style={{
  fontSize: '28px',
  fontWeight: '300',
  color: '#1a1a2e',
  marginBottom: '8px',
  textAlign: 'center'
}}>
  Lorem ipsum dolor sit amet.
</h2>
<p style={{
  fontSize: '14px',
  color: '#888',
  marginBottom: '32px',
  textAlign: 'center'
}}>
  Consectetur adipiscing elit sed do eiusmod
</p>
            <div style={{ width: '100%', maxWidth: '600px' }}>
              <StarterQuestions language={language} onSelect={text => handleSend(text)} />
            </div>
          </div>
        )}

        {/* Message thread */}
        {!showStarters && (
          <MessageList messages={messages} isLoading={isLoading} />
        )}

        {/* Error state */}
        {error && (
          <div style={{
            margin: '0 20px 8px',
            padding: '10px 14px',
            background: '#fff5f5',
            border: '1px solid #fed7d7',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#c53030'
          }}>
            {error}
          </div>
        )}

        {/* Input */}
        <InputBar
          onSend={handleSend}
          isLoading={isLoading}
          language={language}
        />
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}