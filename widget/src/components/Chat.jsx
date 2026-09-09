import { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import MessageList from './MessageList'
import InputBar from './InputBar'
import StarterQuestions from './StarterQuestions'
import ConversationSidebar from './ConversationSidebar'
import TokenUsage from './TokenUsage'
import { useChat } from '../hooks/useChat'
import { useTokenUsage } from '../hooks/useTokenUsage'
import { useConversations } from '../hooks/useConversations'
import { syncUser, uploadFile, updateFontSize } from '../lib/api'

const UI_LANGUAGE = 'en' // Interface is always English; Claude replies in whatever language the question is asked in.

export default function Chat({ onOpenDashboard }) {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [synced, setSynced] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fontSize, setFontSize] = useState(16)

  const { messages, isLoading, conversationId, error, sendMessage, clearChat, loadConversation } = useChat(getToken)
  const { usage, refresh: refreshUsage } = useTokenUsage(getToken)
  const { conversations, refresh: refreshConversations, loadThread } = useConversations(getToken)

  // Sync user to DB on first load
  useEffect(() => {
    if (!user || synced) return
    const metadata = user.publicMetadata || {}
    syncUser(getToken, {
      full_name: user.fullName || user.firstName,
      work_email: user.primaryEmailAddress?.emailAddress,
      country_office: metadata.country_office || 'Unknown',
      shifter_year: metadata.shifter_year || 1
    }).then(data => {
      setSynced(true)
      if (data?.user?.font_size) setFontSize(data.user.font_size)
    }).catch(console.error)
  }, [user, synced, getToken])

  async function handleSend(text) {
    const attachment = uploadedFile || null
    setUploadedFile(null)
    await sendMessage(text, UI_LANGUAGE, attachment)
    refreshUsage()
    refreshConversations()
  }

  async function handleSelectConversation(id) {
    const data = await loadThread(id)
    loadConversation(data.conversation, data.messages)
  }

  async function handleFileUpload(file) {
    setIsUploading(true)
    try {
      const result = await uploadFile(getToken, file)
      setUploadedFile(result)
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Failed to upload file. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleFontSizeChange(size) {
    setFontSize(size)
    try {
      await updateFontSize(getToken, size)
    } catch (err) {
      console.error('Failed to save font size:', err)
    }
  }

  const showStarters = messages.length === 0

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#f7f9fc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <ConversationSidebar
        conversations={conversations}
        onSelect={handleSelectConversation}
        onNew={clearChat}
        currentId={conversationId}
      />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0 // prevents this flex-grow column from squeezing the sidebar
      }}>
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
              SHIFT Brain 2.0
            </h1>
            <p style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
              Ask anything about SHIFT — in any language
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <TokenUsage usage={usage} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#888', userSelect: 'none' }}>A</span>
              <input
                type="range"
                min="12"
                max="22"
                step="1"
                value={fontSize}
                onChange={e => handleFontSizeChange(parseInt(e.target.value))}
                style={{ width: '60px', cursor: 'pointer', accentColor: '#4a90d9' }}
                title={`Text size: ${fontSize}px`}
              />
              <span style={{ fontSize: '16px', color: '#888', userSelect: 'none' }}>A</span>
            </div>

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
              Ask SHIFT Brain anything.
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#888',
              marginBottom: '32px',
              textAlign: 'center'
            }}>
              Answers grounded in SHIFT's documents and resources. Ask in any language — SHIFT Brain replies in that language.
            </p>
            <div style={{ width: '100%', maxWidth: '600px' }}>
              <StarterQuestions onSelect={text => handleSend(text)} />
            </div>
          </div>
        )}

        {!showStarters && (
          <MessageList
            messages={messages}
            isLoading={isLoading}
            fontSize={fontSize}
          />
        )}

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

        <InputBar
          onSend={handleSend}
          isLoading={isLoading || isUploading}
          onFileUpload={handleFileUpload}
          uploadedFile={uploadedFile}
          onClearFile={() => setUploadedFile(null)}
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