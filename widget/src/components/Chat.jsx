import { useState, useEffect, useRef } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import MessageList from './MessageList'
import InputBar from './InputBar'
import ConversationSidebar from './ConversationSidebar'
import { useChat } from '../hooks/useChat'
import { useTokenUsage } from '../hooks/useTokenUsage'
import { useConversations } from '../hooks/useConversations'
import { syncUser, uploadFile, updateFontSize } from '../lib/api'

const ASSETS = {
  brain: 'https://www.figma.com/api/mcp/asset/09ee25a7-b3ca-4128-96ee-5d6f95faff76.png',
  plusBase: 'https://www.figma.com/api/mcp/asset/cd672794-278f-48fa-8271-52df6c45e0be.svg',
  plusIcon: 'https://www.figma.com/api/mcp/asset/e6a28874-40dc-460c-8577-b110cd8a85c4.svg',
  sendBase: 'https://www.figma.com/api/mcp/asset/df6caf01-4c0b-4404-b3b9-40ab16eaff91.svg',
  sendIcon: 'https://www.figma.com/api/mcp/asset/87d5cb37-4b71-4820-ad56-3e57816650b5.svg'
}

export default function Chat({ onOpenDashboard, settings }) {
  const { getToken, signOut } = useAuth()
  const { user } = useUser()
  const [synced, setSynced] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fontSize, setFontSize] = useState(16)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [historyScrollRequest, setHistoryScrollRequest] = useState(0)
  const chatRef = useRef(null)

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

  useEffect(() => {
    const chat = chatRef.current
    if (!chat) return

    const findSquarespaceHeader = () => [
      '.header-announcement-bar-wrapper',
      'header.Header',
      '#header',
      'header'
    ].map(selector => document.querySelector(selector)).find(Boolean)

    const header = findSquarespaceHeader()
    const updateHeight = () => {
      const configured = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--brain-header-height')
      )
      const measured = header?.getBoundingClientRect().height
        || Math.max(0, chat.getBoundingClientRect().top)
      const headerHeight = Number.isFinite(configured) && configured >= 0
        ? configured
        : measured

      chat.style.setProperty('--brain-page-header-height', `${Math.max(0, Math.round(headerHeight))}px`)
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    const observer = header && 'ResizeObserver' in window
      ? new ResizeObserver(updateHeight)
      : null
    observer?.observe(header)

    return () => {
      window.removeEventListener('resize', updateHeight)
      observer?.disconnect()
    }
  }, [])

  async function handleSend(text) {
    const attachment = uploadedFile?.file_name ? uploadedFile : null
    setUploadedFile(null)

    await sendMessage(text, attachment)
    await Promise.all([refreshUsage(), refreshConversations()])
  }

  async function handleSelectConversation(id) {
    const data = await loadThread(id)
    loadConversation(data.conversation, data.messages)
    setHistoryScrollRequest(request => request + 1)
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

  async function handleLogout() {
    try {
      await signOut()
    } finally {
      window.location.reload()
    }
  }

  async function handleFontSizeChange(delta) {
    const minFontSize = 12
    const maxFontSize = 24
    const nextSize = Math.min(maxFontSize, Math.max(minFontSize, fontSize + delta))

    if (nextSize === fontSize) return

    setFontSize(nextSize)
    try {
      await updateFontSize(getToken, nextSize)
    } catch (err) {
      console.error('Failed to save font size:', err)
    }
  }

  const showWelcome = messages.length === 0
  const welcomeCopy = settings?.chat_welcome || 'Let’s start building your movement today!'

  return (
    <div className="brain-chat" ref={chatRef}>
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
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(collapsed => !collapsed)}
        onLogout={handleLogout}
      />

      <main className={`brain-chat__main ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
        <div className="brain-chat__top-controls">
          <button
            className="brain-chat__sidebar-toggle brain-chat__mobile-sidebar-toggle"
            onClick={() => setSidebarOpen(open => !open)}
            aria-label={sidebarOpen ? 'Close chat history' : 'Open chat history'}
          >
            <span className="brain-chat__arrow" aria-hidden="true" />
          </button>

          <div className="brain-chat__controls">
            <div className="brain-chat__font-control" aria-label="Text size">
              <button
                type="button"
                className="brain-chat__font-button"
                onClick={() => handleFontSizeChange(-1)}
                disabled={fontSize <= 12}
                aria-label="Decrease text size"
              >A−</button>
              <span className="brain-chat__font-label" aria-hidden="true">A</span>
              <button
                type="button"
                className="brain-chat__font-button"
                onClick={() => handleFontSizeChange(1)}
                disabled={fontSize >= 24}
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
            <h1>{welcomeCopy}</h1>
          </section>
        ) : (
          <MessageList
            messages={messages}
            isLoading={isLoading}
            fontSize={fontSize}
            scrollToBottomRequest={historyScrollRequest}
          />
        )}

        {error && <div className="brain-chat__error">{error}</div>}

        <div className={`brain-chat__composer ${showWelcome ? 'is-welcome' : ''}`}>
          <InputBar
            onSend={handleSend}
            isLoading={isLoading || isUploading}
            onFileUpload={handleFileUpload}
            uploadedFile={uploadedFile}
            onClearFile={() => setUploadedFile(null)}
            assets={ASSETS}
            showWelcome={showWelcome}
            tokensRemaining={usage?.daily_remaining}
          />
        </div>
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
          height: calc(100dvh - var(--brain-page-header-height, 0px));
          max-height: calc(100dvh - var(--brain-page-header-height, 0px));
          min-height: 0;
          overflow: hidden;
          background: var(--cream);
          color: var(--ink);
          font-family: Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .brain-chat__main {
          position: relative;
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          min-width: 0;
          min-height: 0;
          height: 100%;
          overflow: hidden;
          border-top: 1px solid #deddd5;
        }

        .brain-chat__top-controls {
          position: absolute;
          z-index: 20;
          top: 14px;
          left: 14px;
          right: clamp(19px, calc(19px + (100vw - 768px) * .112), 72px);
          display: flex;
          align-items: center;
          justify-content: right;
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

        .brain-chat__arrow {
          width: 9px;
          height: 9px;
          border-left: 1.5px solid var(--pink);
          border-bottom: 1.5px solid var(--pink);
          transform: rotate(45deg);
          margin-left: 4px;
        }

        .brain-chat__controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brain-chat__font-control {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 84px;
          height: 30px;
          padding: 2px;
          border: 1px solid var(--pink);
          border-radius: 999px;
          color: var(--muted);
          font-size: 10px;
          font-weight: 600;
        }

        .brain-chat__font-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--muted);
          font: 600 10px/1 Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          cursor: pointer;
        }

        .brain-chat__font-label {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          color: var(--muted);
          font: 600 11px/1 Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          pointer-events: none;
        }

        .brain-chat__font-button:hover:not(:disabled) { color: var(--pink); }
        .brain-chat__font-button:disabled {
          opacity: .35;
          cursor: default;
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

        .brain-chat__mobile-sidebar-toggle { display: none; }

        .brain-chat__welcome {
          position: relative;
          flex: 1 1 auto;
          min-height: 0;
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
          position: fixed;
          z-index: 50;
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

        .brain-chat .brain-message-list {
          flex: 1 1 auto;
          min-height: 0;
          max-height: none;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
          padding-top: 58px;
          padding-bottom: 24px;
        }

        .brain-chat .brain-message-list__content {
          min-height: 0;
        }

        .brain-chat__composer {
          position: relative;
          z-index: 7;
          flex: 0 0 auto;
          display: flex;
          justify-content: center;
          width: 100%;
          padding: 16px 24px 18px;
          background: var(--cream);
          border-top: 1px solid rgba(222, 221, 213, .55);
        }

        .brain-chat__composer.is-welcome {
          border-top-color: transparent;
        }

        .brain-chat__main.is-sidebar-collapsed .brain-chat__brain {
          transform: translateX(0);
        }

        .brain-chat__main.is-sidebar-collapsed .brain-chat__welcome h1 {
          left: 50%;
        }

        @media (max-width: 767px) {
          .brain-chat__main { border-top: 0; min-height: 0; }
          .brain-chat .brain-message-list {
            padding-top: 52px;
            padding-bottom: 18px;
          }
          .brain-chat__composer { padding: 12px 30px 20px; }
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
          .brain-chat__mobile-sidebar-toggle {
            position: absolute;
            left: 0;
            top: 0;
            display: flex;
          }
          .brain-chat__sidebar-reopen { display: none; }
          .brain-chat__controls { gap: 8px; }
          .brain-chat__controls .brain-chat__dashboard { display: none; }
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
          .brain-chat__error { bottom: 120px; }
        }
      `}</style>
    </div>
  )
}
