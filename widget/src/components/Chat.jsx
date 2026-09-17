import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import MessageList from './MessageList'
import InputBar from './InputBar'
import ConversationSidebar from './ConversationSidebar'
import { useChat } from '../hooks/useChat'
import { useTokenUsage } from '../hooks/useTokenUsage'
import { useConversations } from '../hooks/useConversations'
import { uploadFile, updateFontSize } from '../lib/api'

const ASSETS = {
  brain: 'https://www.figma.com/api/mcp/asset/09ee25a7-b3ca-4128-96ee-5d6f95faff76.png',
  plusBase: 'https://www.figma.com/api/mcp/asset/cd672794-278f-48fa-8271-52df6c45e0be.svg',
  plusIcon: 'https://www.figma.com/api/mcp/asset/e6a28874-40dc-460c-8577-b110cd8a85c4.svg',
  sendBase: 'https://www.figma.com/api/mcp/asset/df6caf01-4c0b-4404-b3b9-40ab16eaff91.svg',
  sendIcon: 'https://www.figma.com/api/mcp/asset/87d5cb37-4b71-4820-ad56-3e57816650b5.svg'
}

const FONT_SIZE_PRESETS = [14, 16, 18]

function nearestFontSizePreset(value) {
  const size = Number(value)
  if (!Number.isFinite(size)) return 16
  return FONT_SIZE_PRESETS.reduce((nearest, preset) =>
    Math.abs(preset - size) < Math.abs(nearest - size) ? preset : nearest
  )
}

export default function Chat({ onOpenDashboard, settings, currentUser }) {
  const { getToken, signOut } = useAuth()
  const [uploadedFile, setUploadedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fontSize, setFontSize] = useState(16)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [historyScrollRequest, setHistoryScrollRequest] = useState(0)

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
    if (currentUser?.font_size) setFontSize(nearestFontSizePreset(currentUser.font_size))
  }, [currentUser])

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

  async function handleFontSizeChange(nextSize) {
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
  const assets = {
    brain: settings?.brain_icon_url || ASSETS.brain,
    plusBase: settings?.plus_base_icon_url || ASSETS.plusBase,
    plusIcon: settings?.plus_glyph_icon_url || ASSETS.plusIcon,
    sendBase: settings?.send_base_icon_url || ASSETS.sendBase,
    sendIcon: settings?.send_glyph_icon_url || ASSETS.sendIcon,
    sidebarOpen: settings?.sidebar_open_icon_url || '',
    sidebarClose: settings?.sidebar_close_icon_url || '',
    search: settings?.search_icon_url || '',
    uploadFile: settings?.upload_file_icon_url || '',
    sendMessage: settings?.send_message_icon_url || ''
  }
  const theme = {
    '--cream': settings?.color_cream || '#fdfbef',
    '--ink': settings?.color_ink || '#0b0b2d',
    '--pink': settings?.color_pink || '#ff008f',
    '--purple': settings?.color_purple || '#302798',
    '--muted': settings?.color_muted || '#b7b7b7',
    '--yellow': settings?.color_yellow || '#ffd000',
    '--white': settings?.color_white || '#ffffff',
    '--line': settings?.color_line || '#deddd5',
    '--soft-pink': settings?.color_soft_pink || '#ffc2df',
    '--success': settings?.color_success || '#2d7a3a',
    '--danger': settings?.color_danger || '#c53030'
  }

  return (
    <div className="brain-chat" style={theme}>
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
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
        icons={assets}
      />

      <main className={`brain-chat__main ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
        <div className="brain-chat__top-controls">
          <button
            className={`brain-chat__sidebar-toggle brain-chat__mobile-sidebar-toggle ${sidebarOpen ? 'is-open' : ''}`}
            onClick={() => setSidebarOpen(open => !open)}
            aria-label={sidebarOpen ? 'Close chat history' : 'Open chat history'}
          >
            {sidebarOpen && assets.sidebarClose
              ? <img className="brain-chat__toggle-icon" src={assets.sidebarClose} alt="" />
              : !sidebarOpen && assets.sidebarOpen
                ? <img className="brain-chat__toggle-icon" src={assets.sidebarOpen} alt="" />
                : <span className="brain-chat__arrow" aria-hidden="true" />}
          </button>

          <div className="brain-chat__controls">
            <div className="brain-chat__font-control" role="group" aria-label="Text size">
              <button
                type="button"
                className={`brain-chat__font-button ${fontSize === 14 ? 'is-active' : ''}`}
                onClick={() => handleFontSizeChange(14)}
                aria-label="Small text"
                aria-pressed={fontSize === 14}
              >A−</button>
              <button
                type="button"
                className={`brain-chat__font-button ${fontSize === 16 ? 'is-active' : ''}`}
                onClick={() => handleFontSizeChange(16)}
                aria-label="Medium text"
                aria-pressed={fontSize === 16}
              >A</button>
              <button
                type="button"
                className={`brain-chat__font-button ${fontSize === 18 ? 'is-active' : ''}`}
                onClick={() => handleFontSizeChange(18)}
                aria-label="Large text"
                aria-pressed={fontSize === 18}
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
            <img className="brain-chat__brain" src={assets.brain} alt="" />
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
            assets={assets}
            showWelcome={showWelcome}
            tokensRemaining={usage?.daily_remaining}
          />
        </div>
      </main>

      <style>{`
        .brain-chat {
          position: relative;
          display: flex;
          width: 100%;
          height: 100%;
          max-height: 100%;
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
          border-top: 1px solid var(--line);
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
          background: var(--cream);
          box-shadow: none;
          cursor: pointer;
        }

        .brain-chat__arrow {
          width: 9px;
          height: 9px;
          border-left: 2px solid var(--pink);
          border-bottom: 2px solid var(--pink);
          transform: rotate(45deg);
          margin-left: 4px;
        }

        .brain-chat__toggle-icon { width: 18px; height: 18px; object-fit: contain; }

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
          background: var(--cream);
          box-shadow: 3px 5px 10px -1px rgba(0,0,0,.05);
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

        .brain-chat__font-button:nth-child(2) {
          flex: 0 0 29px;
          width: 29px;
          height: 29px;
          margin: -2px 0;
          font-size: 11px;
        }

        .brain-chat__font-button.is-active {
          background: var(--pink);
          color: var(--white);
        }

        .brain-chat__font-button:hover:not(.is-active) { color: var(--pink); }

        .brain-chat__dashboard {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 30px;
          border: 1px solid var(--pink);
          border-radius: 999px;
          padding: 0 12px;
          background: var(--cream);
          box-shadow: 3px 5px 10px -1px rgba(0,0,0,.05);
          color: var(--pink);
          font-size: 11px;
          cursor: pointer;
        }

        .brain-chat__dashboard:hover {
          border-color: var(--ink);
          background: var(--purple);
          color: var(--white);
          box-shadow: 4px 4px var(--ink);
          transform: rotate(-2deg);
        }

        .brain-chat__dashboard:active { transform: translate(2px, 2px) rotate(0deg); box-shadow: 2px 2px var(--ink); }

        .brain-chat__mobile-sidebar-toggle { display: none; }

        .brain-chat__welcome {
          position: relative;
          z-index: 2;
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 34px;
          padding: 70px 30px 24px;
          pointer-events: none;
        }

        .brain-chat__brain {
          position: static;
          width: 91px;
          height: 81px;
          object-fit: cover;
          transform: none;
        }

        .brain-chat__welcome h1 {
          position: static;
          width: min(802px, 100%);
          margin: 0;
          transform: none;
          color: var(--ink);
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
          color: var(--danger);
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
          padding-bottom: 48px;
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
          padding: 16px 24px 40px;
          background: var(--cream);
          border-top: 1px solid rgba(222, 221, 213, .72);
          box-shadow: 0 -18px 28px var(--cream);
        }

        .brain-chat__composer.is-welcome {
          position: relative;
          bottom: auto;
          left: auto;
          flex: 0 0 auto;
          padding-top: 0;
          padding-bottom: clamp(36px, 9vh, 88px);
          border-top-color: transparent;
          box-shadow: none;
        }

        .brain-chat__main:not(.is-sidebar-collapsed) .brain-chat__composer.is-welcome .brain-input {
          width: min(396px, calc(100% - 48px));
        }

        .brain-chat__main.is-sidebar-collapsed .brain-chat__welcome h1 {
          width: min(450px, calc(100% - 60px));
        }

        .brain-chat button:not(:disabled) {
          transition: color 300ms ease-in-out, background-color 300ms ease-in-out, border-color 300ms ease-in-out, box-shadow 300ms ease-in-out, transform 300ms ease-in-out, opacity 300ms ease-in-out;
        }

        .brain-chat button:not(:disabled):active { scale: .97; }
        .brain-chat__font-button:hover:not(.is-active) { background: rgba(255, 0, 143, .12); color: var(--pink); }
        .brain-chat__font-button.is-active:hover { background: var(--purple); }
        .brain-chat__sidebar-toggle:hover,
        .brain-sidebar__collapse:hover,
        .brain-sidebar__mobile-close:hover { background: var(--purple); transform: rotate(-3deg); box-shadow: none; }
        .brain-chat__sidebar-toggle:hover .brain-chat__arrow,
        .brain-sidebar__collapse:hover .brain-sidebar__arrow,
        .brain-sidebar__mobile-close:hover .brain-sidebar__arrow { border-color: var(--white); }
        .brain-sidebar__search:hover { background: var(--purple); transform: rotate(-3deg); box-shadow: 4px 4px var(--ink); }
        .brain-sidebar__search:hover .brain-sidebar__search-icon { border-color: var(--white); }
        .brain-sidebar__search:hover .brain-sidebar__search-icon::after { background: var(--white); }
        .brain-sidebar__new:hover { border-color: var(--ink); background: var(--purple); color: var(--white); box-shadow: 4px 4px var(--ink); transform: rotate(-2deg); }
        .brain-sidebar__logout:hover { color: var(--purple); }
        .brain-sidebar__item:hover { transform: translateX(3px); }
        .brain-input__icon:hover:not(:disabled) { transform: scale(1.08) rotate(-3deg); filter: saturate(1.15); }

        @media (min-width: 1024px) {
          .brain-chat .brain-message-list { padding-top: 97px; }
          .brain-chat__main.is-sidebar-collapsed .brain-chat__top-controls {
            left: 60px;
            right: clamp(50px, calc(50px + (100vw - 768px) * .2765), 180.5px);
          }
        }

        @media (max-width: 1023px) {
          .brain-chat__main { min-height: 0; }
          .brain-chat__sidebar-backdrop {
            position: absolute;
            z-index: 9;
            inset: 0;
            background: transparent;
            display: none;
          }
          .brain-chat__sidebar-backdrop.is-open { display: block; }
          .brain-chat__top-controls {
            top: 14px;
            left: 30px;
            right: 30px;
          }
          .brain-chat__mobile-sidebar-toggle {
            position: absolute;
            left: 0;
            top: 0;
            display: flex;
          }
          .brain-chat__mobile-sidebar-toggle .brain-chat__arrow { transform: rotate(225deg); margin-left: -4px; }
          .brain-chat__mobile-sidebar-toggle.is-open .brain-chat__arrow { transform: rotate(45deg); margin-left: 4px; }
          .brain-chat__sidebar-reopen { display: none; }
          .brain-chat__controls { gap: 8px; }
        }

        @media (max-width: 767px) {
          .brain-chat__main { border-top: 0; }
          .brain-chat .brain-message-list {
            padding-top: 52px;
            padding-bottom: 32px;
          }
          .brain-chat__composer { padding: 12px 30px 38px; }
          .brain-chat__dashboard { padding-right: 10px; padding-left: 10px; font-size: 10px; }
          .brain-chat__welcome h1 {
            width: 100%;
            font-size: 22px;
            line-height: 34px;
            font-weight: 500;
          }
          .brain-chat__error { bottom: 120px; }
          .brain-chat__welcome {
            flex: 1 1 auto;
            padding: 92px 30px 24px;
          }
          .brain-chat__composer.is-welcome {
            flex: 0 0 185px;
            height: 185px;
            padding: 12px 30px 38px;
          }
        }
      `}</style>
    </div>
  )
}
