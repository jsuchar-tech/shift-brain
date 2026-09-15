import { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import MessageList from './MessageList'
import InputBar from './InputBar'
import ConversationSidebar from './ConversationSidebar'
import TokenUsage from './TokenUsage'
import { useChat } from '../hooks/useChat'
import { useTokenUsage } from '../hooks/useTokenUsage'
import { useConversations } from '../hooks/useConversations'
import { syncUser, uploadFile, updateFontSize } from '../lib/api'

const ASSETS = {
  brain: 'https://www.figma.com/api/mcp/asset/09ee25a7-b3ca-4128-96ee-5d6f95faff76.png',
  back: 'https://www.figma.com/api/mcp/asset/688f4202-cb5b-46a2-9189-ab4c9ca9d134.svg',
  dots: 'https://www.figma.com/api/mcp/asset/3f814210-e300-45cd-8290-ee32990bf890.svg',
  plusBase: 'https://www.figma.com/api/mcp/asset/cd672794-278f-48fa-8271-52df6c45e0be.svg',
  plusIcon: 'https://www.figma.com/api/mcp/asset/e6a28874-40dc-460c-8577-b110cd8a85c4.svg',
  sendBase: 'https://www.figma.com/api/mcp/asset/df6caf01-4c0b-4404-b3b9-40ab16eaff91.svg',
  sendIcon: 'https://www.figma.com/api/mcp/asset/87d5cb37-4b71-4820-ad56-3e57816650b5.svg'
}

export default function Chat({ onOpenDashboard }) {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [synced, setSynced] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fontSize, setFontSize] = useState(16)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const {
    messages,
    isLoading,
    conversationId,
    error,
    sendMessage,
    clearChat,
    loadConversation
  } = useChat(getToken)

  const { usage, refresh: refreshUsage } = useTokenUsage(getToken)
  const {
    conversations,
    refresh: refreshConversations,
    loadThread
  } = useConversations(getToken)

  useEffect(() => {
    if (!user || synced) return

    const metadata = user.publicMetadata || {}

    syncUser(getToken, {
      full_name: user.fullName || user.firstName,
      work_email: user.primaryEmailAddress?.emailAddress,
      country_office: metadata.country_office || 'Unknown',
      shifter_year: metadata.shifter_year || 1
    })
      .then(data => {
        setSynced(true)
        if (data?.user?.font_size) setFontSize(data.user.font_size)
      })
      .catch(console.error)
  }, [user, synced, getToken])

  async function handleSend(text) {
    const attachment = uploadedFile?.file_name ? uploadedFile : null
    setUploadedFile(null)

    await sendMessage(text, attachment)
    await Promise.all([refreshUsage(), refreshConversations()])
  }

  async function handleSelectConversation(id) {
    const data = await loadThread(id)
    loadConversation(data.conversation, data.messages)
    setSidebarOpen(false)
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

  const showWelcome = messages.length === 0

  return (
    <div className="brain-chat">
      <div
        className={`brain-chat__sidebar-backdrop ${sidebarOpen ? 'is-open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <ConversationSidebar
        conversations={conversations}
        onSelect={handleSelectConversation}
        onNew={() => {
          clearChat()
          setSidebarOpen(false)
        }}
        currentId={conversationId}
        open={sidebarOpen}
      />

      <main className="brain-chat__main">
        <div className="brain-chat__top-controls">
          <button
            className="brain-chat__sidebar-toggle"
            onClick={() => setSidebarOpen(open => !open)}
            aria-label={sidebarOpen ? 'Close chat history' : 'Open chat history'}
          >
            <img src={ASSETS.back} alt="" />
          </button>

          <div className="brain-chat__controls">
            <TokenUsage usage={usage} compact />
            <div className="brain-chat__font-control" aria-label="Text size">
              <span>A-</span>
              <button
                type="button"
                className="brain-chat__font-button"
                onClick={() => handleFontSizeChange(Math.max(12, fontSize - 1))}
                aria-label="Decrease text size"
              >A-</button>
              <span className="brain-chat__font-current">A</span>
              <button
                type="button"
                className="brain-chat__font-button"
                onClick={() => handleFontSizeChange(Math.min(22, fontSize + 1))}
                aria-label="Increase text size"
              >A+</button>
            </div>
            {onOpenDashboard && (
              <button className="brain-chat__dashboard" onClick={onOpenDashboard}>
                Dashboard
              </button>
            )}
          </div>
        </div>

        {showWelcome ? (
          <section className="brain-chat__welcome">
            <img className="brain-chat__brain" src={ASSETS.brain} alt="" />
            <h1>Let’s start building your movement today!</h1>
          </section>
        ) : (
          <MessageList
            messages={messages}
            isLoading={isLoading}
            fontSize={fontSize}
          />
        )}

        {error && <div className="brain-chat__error">{error}</div>}

        <InputBar
          onSend={handleSend}
          isLoading={isLoading || isUploading}
          onFileUpload={handleFileUpload}
          uploadedFile={uploadedFile}
          onClearFile={() => setUploadedFile(null)}
          assets={ASSETS}
          showWelcome={showWelcome}
        />
      </main>

      <style>{`
        .brain-chat {
          --cream: #fdfbef;
          --ink: #0b0b2d;
          --pink: #ff008f;
          --muted: #b7b7b7;
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

        .brain-chat__main {
          position: relative;
          flex: 1 1 auto;
          min-width: 0;
          height: 100%;
          overflow: hidden;
          border-top: 1px solid #deddd5;
        }

        .brain-chat__top-controls {
          position: absolute;
          z-index: 20;
          top: 14px;
          left: -46px;
          right: clamp(19px, calc(19px + (100vw - 768px) * .112), 72px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          pointer-events: none;
        }

        .brain-chat__top-controls > * { pointer-events: auto; }

        .brain-chat__sidebar-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 33px;
          height: 33px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: #fff;
          box-shadow: 3px 5px 10px -1px rgba(0,0,0,.05);
          cursor: pointer;
        }

        .brain-chat__sidebar-toggle img {
          width: 33px;
          height: 33px;
          object-fit: contain;
        }

        .brain-chat__controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brain-chat__font-control {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 84px;
          height: 30px;
          padding: 0 10px;
          border: 1px solid var(--pink);
          border-radius: 999px;
          color: var(--muted);
          font-size: 10px;
          font-weight: 600;
        }

        .brain-chat__font-control > span:first-child,
        .brain-chat__font-button:first-of-type { color: var(--muted); }

        .brain-chat__font-button {
          border: 0;
          padding: 0;
          background: transparent;
          color: var(--muted);
          font: inherit;
          cursor: pointer;
        }

        .brain-chat__font-current {
          position: absolute;
          top: 0;
          left: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          transform: translateX(-50%);
          border-radius: 50%;
          background: var(--pink);
          color: #fff;
        }

        .brain-chat__dashboard {
          border: 1px solid var(--pink);
          border-radius: 999px;
          padding: 6px 12px;
          background: transparent;
          color: var(--pink);
          font-size: 11px;
          cursor: pointer;
        }

        .brain-chat__welcome {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          pointer-events: none;
        }

        .brain-chat__brain {
          position: absolute;
          top: 151px;
          width: 91px;
          height: 81px;
          object-fit: cover;
          transform: translateX(calc(8.5px - (100vw - 768px) * .0805));
        }

        .brain-chat__welcome h1 {
          position: absolute;
          top: 267px;
          left: calc(50% + 12px - (100vw - 768px) * .0805);
          right: auto;
          width: clamp(330px, calc(330px + (100vw - 768px)), 802px);
          transform: translateX(-50%);
          margin: 0;
          color: #000;
          font-size: 22px;
          font-weight: 500;
          line-height: 34px;
          text-align: center;
        }

        .brain-chat__error {
          position: absolute;
          z-index: 8;
          left: 20px;
          right: 20px;
          bottom: 160px;
          padding: 10px 14px;
          background: #fff5f5;
          border: 1px solid #fed7d7;
          border-radius: 8px;
          color: #c53030;
          font-size: 13px;
        }

        .brain-chat__sidebar-backdrop { display: none; }

        @media (max-width: 767px) {
          .brain-chat__main { border-top: 0; }
          .brain-chat__sidebar-backdrop {
            position: absolute;
            z-index: 9;
            inset: 0;
            background: rgba(11,11,45,.12);
            display: none;
          }
          .brain-chat__sidebar-backdrop.is-open { display: block; }
          .brain-chat__top-controls {
            top: 14px;
            left: 30px;
            right: 98px;
          }
          .brain-chat__controls { gap: 8px; }
          .brain-chat__controls .brain-chat__dashboard,
          .brain-chat__controls > div:first-child { display: none; }
          .brain-chat__brain { transform: translateX(0); }
          .brain-chat__welcome h1 {
            left: 50%;
            right: auto;
            width: calc(100% - 60px);
            transform: translateX(-50%);
            top: 309px;
            font-size: 22px;
            line-height: 34px;
            font-weight: 500;
          }
          .brain-chat__brain { top: 193px; }
          .brain-chat__error { bottom: 125px; }
        }
      `}</style>
    </div>
  )
}
