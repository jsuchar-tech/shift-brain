import { useEffect, useMemo, useState } from 'react'

function relativeTime(value, now) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''

  const elapsed = Math.max(0, now - timestamp)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day
  const month = 30 * day

  if (elapsed < minute) return 'Just now'
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}m ago`
  if (elapsed < day) return `${Math.floor(elapsed / hour)}h ago`
  if (elapsed < week) return `${Math.floor(elapsed / day)}d ago`
  if (elapsed < month) return `${Math.floor(elapsed / week)}w ago`
  return `${Math.floor(elapsed / month)}mo ago`
}

export default function ConversationSidebar({
  conversations,
  onSelect,
  onNew,
  currentId,
  open = false,
  collapsed = false,
  onToggleCollapse,
  onLogout
}) {
  const [search, setSearch] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return conversations
    return conversations.filter(conversation =>
      (conversation.title || 'Untitled conversation').toLocaleLowerCase().includes(query)
    )
  }, [conversations, search])

  function startNewChat() {
    setSearch('')
    onNew()
  }

  return (
    <aside className={`brain-sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="brain-sidebar__content">
        <div className="brain-sidebar__title">Your chat history</div>
        <div className="brain-sidebar__tools">
          <label className="brain-sidebar__search">
            <span className="brain-sidebar__search-icon" aria-hidden="true" />
            <span className="brain-sidebar__search-label">Search past chats</span>
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search past chats"
              autoComplete="off"
            />
          </label>

          <button className="brain-sidebar__new" type="button" onClick={startNewChat}>
            <span aria-hidden="true">+</span>
            Start new chat
          </button>
        </div>

        <div className="brain-sidebar__list">
          {conversations.length === 0 && (
            <p className="brain-sidebar__empty">No conversations yet</p>
          )}
          {conversations.length > 0 && filteredConversations.length === 0 && (
            <p className="brain-sidebar__empty">No matching conversations</p>
          )}
          {filteredConversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`brain-sidebar__item ${currentId === conv.id ? 'is-active' : ''}`}
              title={conv.title || 'Untitled conversation'}
            >
              <span className="brain-sidebar__item-title">{conv.title || 'Untitled conversation'}</span>
              <time dateTime={conv.updated_at || conv.created_at}>
                {relativeTime(conv.updated_at || conv.created_at, now)}
              </time>
            </button>
          ))}
        </div>
      </div>

      <button
        className="brain-sidebar__collapse"
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Show chat history' : 'Hide chat history'}
        title={collapsed ? 'Show chat history' : 'Hide chat history'}
      >
        <span className="brain-sidebar__arrow" aria-hidden="true" />
      </button>

      <button className="brain-sidebar__logout" type="button" onClick={onLogout}>Log out</button>

      <style>{`
        .brain-sidebar {
          position: sticky;
          top: 0;
          z-index: 10;
          flex: 0 0 clamp(270px, calc(146px + 16.1vw), 346px);
          width: clamp(270px, calc(146px + 16.1vw), 346px);
          height: 100%;
          max-height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--cream, #fdfbef);
          border-right: 1px solid #deddd5;
          transition: flex-basis .22s ease, width .22s ease, transform .2s ease;
        }

        .brain-sidebar.is-collapsed {
          flex-basis: 0;
          width: 0;
          border-right: 0;
          overflow: visible;
        }

        .brain-sidebar__content {
          position: relative;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          padding: 16px 0 0;
          opacity: 1;
          transition: opacity .12s ease;
        }

        .brain-sidebar.is-collapsed .brain-sidebar__content,
        .brain-sidebar.is-collapsed .brain-sidebar__logout {
          opacity: 0;
          pointer-events: none;
        }

        .brain-sidebar__title {
          margin-left: clamp(18px, calc(18px + (100vw - 768px) * .076), 54px);
          color: #b7b7b7;
          font-size: 12px;
          line-height: 34px;
        }

        .brain-sidebar__tools {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 15px clamp(18px, calc(18px + (100vw - 768px) * .038), 36px) 7px;
        }

        .brain-sidebar__search {
          position: relative;
          display: flex;
          align-items: center;
          height: 38px;
          border: 1px solid #deddd5;
          border-radius: 999px;
          background: #fff;
          box-shadow: 3px 5px 10px -1px rgba(0,0,0,.035);
        }

        .brain-sidebar__search input {
          width: 100%;
          height: 100%;
          min-width: 0;
          padding: 0 14px 0 38px;
          border: 0;
          outline: 0;
          border-radius: inherit;
          background: transparent;
          color: #0b0b2d;
          font: 12px/1 Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .brain-sidebar__search input::placeholder { color: #b7b7b7; opacity: 1; }
        .brain-sidebar__search input::-webkit-search-cancel-button { cursor: pointer; }
        .brain-sidebar__search-label {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
        }

        .brain-sidebar__search-icon {
          position: absolute;
          left: 15px;
          z-index: 1;
          width: 11px;
          height: 11px;
          border: 1.5px solid var(--pink, #ff008f);
          border-radius: 50%;
          pointer-events: none;
        }

        .brain-sidebar__search-icon::after {
          content: '';
          position: absolute;
          right: -4px;
          bottom: -3px;
          width: 5px;
          height: 1.5px;
          border-radius: 2px;
          background: var(--pink, #ff008f);
          transform: rotate(45deg);
          transform-origin: left center;
        }

        .brain-sidebar__new {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 40px;
          padding: 0 16px;
          border: 1px solid #0b0b2d;
          border-radius: 999px;
          background: var(--pink, #ff008f);
          box-shadow: 3px 4px 0 #0b0b2d;
          color: #fff;
          font: 600 12px/1 Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          cursor: pointer;
        }

        .brain-sidebar__new span { font-size: 20px; font-weight: 300; line-height: 1; }
        .brain-sidebar__new:active { transform: translate(1px, 1px); box-shadow: 2px 3px 0 #0b0b2d; }

        .brain-sidebar__collapse {
          position: absolute;
          top: 14px;
          right: 13px;
          z-index: 25;
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

        .brain-sidebar__arrow {
          width: 9px;
          height: 9px;
          border-left: 1.5px solid var(--pink, #ff008f);
          border-bottom: 1.5px solid var(--pink, #ff008f);
          transform: rotate(45deg);
          margin-left: 4px;
        }

        .brain-sidebar.is-collapsed .brain-sidebar__arrow {
          transform: rotate(225deg);
          margin-left: -4px;
        }

        .brain-sidebar.is-collapsed .brain-sidebar__collapse {
          right: auto;
          left: clamp(50px, calc(50px + (100vw - 768px) * .2765), 180.5px);
        }

        .brain-sidebar__list {
          flex: 1 1 auto;
          min-height: 0;
          margin-top: 16px;
          padding: 0 clamp(14px, calc(14px + (100vw - 768px) * .025), 26px) 12px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(11,11,45,.16) transparent;
          mask-image: linear-gradient(to bottom, #000 0, #000 92%, transparent 100%);
        }

        .brain-sidebar__list::-webkit-scrollbar { width: 5px; }
        .brain-sidebar__list::-webkit-scrollbar-thumb {
          background: rgba(11,11,45,.16);
          border-radius: 999px;
        }

        .brain-sidebar__item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          min-height: 42px;
          margin: 0 0 3px;
          padding: 0 10px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #0b0b2d;
          font: 13px/21px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: left;
          cursor: pointer;
        }

        .brain-sidebar__item::before {
          content: '•';
          flex: 0 0 auto;
          color: #0b0b2d;
        }

        .brain-sidebar__item-title {
          min-width: 0;
          flex: 1 1 auto;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .brain-sidebar__item time {
          flex: 0 0 auto;
          color: #b7b7b7;
          font-size: 10px;
          white-space: nowrap;
        }

        .brain-sidebar__item:hover { background: rgba(255,255,255,.7); }
        .brain-sidebar__item.is-active { background: #fff; color: var(--pink, #ff008f); box-shadow: 3px 5px 10px -1px rgba(0,0,0,.04); }
        .brain-sidebar__item.is-active::before { color: var(--pink, #ff008f); }
        .brain-sidebar__empty { padding: 8px 6px; color: #aaa; font-size: 12px; }

        .brain-sidebar__logout {
          flex: 0 0 67px;
          width: 100%;
          padding: 0 0 0 clamp(24px, calc(24px + (100vw - 768px) * .07), 57px);
          border: 0;
          border-top: 1px solid #deddd5;
          background: transparent;
          color: var(--pink, #ff008f);
          font: 12px/30px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: left;
          cursor: pointer;
        }

        .brain-sidebar__reopen {
          position: absolute;
          top: 14px;
          left: 14px;
          z-index: 25;
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

        .brain-sidebar__reopen img {
          width: 33px;
          height: 33px;
          transform: rotate(180deg);
        }

        @media (max-width: 767px) {
          .brain-sidebar {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: min(82vw, 300px);
            flex-basis: min(82vw, 300px);
            transform: translateX(-102%);
            box-shadow: 8px 0 30px rgba(0,0,0,.08);
            transition: transform .2s ease;
            border-right: 1px solid #deddd5;
          }
          .brain-sidebar.is-open { transform: translateX(0); }
          .brain-sidebar.is-collapsed { width: min(82vw, 300px); flex-basis: min(82vw, 300px); }
          .brain-sidebar.is-collapsed .brain-sidebar__content,
          .brain-sidebar.is-collapsed .brain-sidebar__logout { opacity: 1; pointer-events: auto; }
          .brain-sidebar__title { margin-left: 24px; }
          .brain-sidebar__tools { padding-right: 24px; padding-left: 24px; }
          .brain-sidebar__list { padding-right: 18px; padding-left: 18px; }
          .brain-sidebar__collapse { display: none; }
        }
      `}</style>
    </aside>
  )
}
