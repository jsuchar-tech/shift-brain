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
  onClose,
  onLogout,
  icons = {}
}) {
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
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
    setSearchOpen(false)
    onNew()
  }

  function closeSidebar() {
    setSearchOpen(false)
    onClose?.()
  }

  return (
    <aside className={`brain-sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      <button
        className="brain-sidebar__mobile-close"
        type="button"
        onClick={closeSidebar}
        aria-label="Close chat history"
      >
        {icons.sidebarClose ? <img className="brain-sidebar__custom-icon" src={icons.sidebarClose} alt="" /> : <span className="brain-sidebar__arrow" aria-hidden="true" />}
      </button>
      <div className="brain-sidebar__content">
        <div className="brain-sidebar__title">Your chat history</div>
        <div className="brain-sidebar__tools">
          <button
            className={`brain-sidebar__search ${searchOpen ? 'is-open' : ''}`}
            type="button"
            onClick={() => setSearchOpen(value => !value)}
            aria-label={searchOpen ? 'Close conversation search' : 'Search past chats'}
            aria-expanded={searchOpen}
          >
            {icons.search ? <img className="brain-sidebar__custom-icon" src={icons.search} alt="" /> : <span className="brain-sidebar__search-icon" aria-hidden="true" />}
          </button>

          {searchOpen && (
            <input
              className="brain-sidebar__search-input"
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search past chats"
              autoComplete="off"
              autoFocus
            />
          )}

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
              onClick={() => {
                setSearchOpen(false)
                onSelect(conv.id)
              }}
              className={`brain-sidebar__item ${currentId === conv.id ? 'is-active' : ''}`}
              title={conv.title || 'Untitled conversation'}
            >
              <span className="brain-sidebar__item-title">{conv.title || 'Untitled conversation'}</span>
              <time className="brain-sidebar__time" dateTime={conv.updated_at || conv.created_at}>
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
        {collapsed && icons.sidebarOpen
          ? <img className="brain-sidebar__custom-icon" src={icons.sidebarOpen} alt="" />
          : !collapsed && icons.sidebarClose
            ? <img className="brain-sidebar__custom-icon" src={icons.sidebarClose} alt="" />
            : <span className="brain-sidebar__arrow" aria-hidden="true" />}
      </button>

      <button className="brain-sidebar__logout" type="button" onClick={onLogout}>Log out</button>

      <style>{`
        .brain-sidebar {
          --sidebar-width: clamp(270px, calc(146px + 16.1vw), 346px);
          position: sticky;
          top: 0;
          z-index: 10;
          flex: 0 0 var(--sidebar-width);
          width: var(--sidebar-width);
          height: 100%;
          max-height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--cream, #fdfbef);
          border-top: 1px solid var(--line, #deddd5);
          border-right: 1px solid var(--line, #deddd5);
          transition: flex-basis .38s cubic-bezier(.22, 1, .36, 1), width .38s cubic-bezier(.22, 1, .36, 1), transform .38s cubic-bezier(.22, 1, .36, 1);
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
          width: var(--sidebar-width);
          min-width: var(--sidebar-width);
          transform: translate3d(0, 0, 0);
          transition: opacity .2s ease, transform .38s cubic-bezier(.22, 1, .36, 1);
        }

        .brain-sidebar.is-collapsed .brain-sidebar__content,
        .brain-sidebar.is-collapsed .brain-sidebar__logout {
          opacity: 0;
          transform: translate3d(-100%, 0, 0);
          pointer-events: none;
        }

        .brain-sidebar__title {
          margin-left: clamp(18px, calc(18px + (100vw - 768px) * .076), 54px);
          color: var(--muted, #b7b7b7);
          font-size: 12px;
          line-height: 34px;
        }

        .brain-sidebar__tools {
          display: none;
          flex-direction: column;
          gap: 10px;
          padding: 15px clamp(18px, calc(18px + (100vw - 768px) * .038), 36px) 7px;
        }

        .brain-sidebar__search {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 38px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: var(--soft-pink, #ffc2df);
          cursor: pointer;
        }

        .brain-sidebar__search-input {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 54px;
          width: 100%;
          height: 42px;
          padding: 0 16px;
          border: 1px solid var(--pink, #ff008f);
          outline: 0;
          border-radius: 999px;
          background: var(--white, #fff);
          color: var(--ink, #0b0b2d);
          font: 13px/1 Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-shadow: 3px 5px 10px -1px rgba(0,0,0,.05);
        }

        .brain-sidebar__search-input::placeholder { color: var(--muted, #b7b7b7); opacity: 1; }
        .brain-sidebar__search-input::-webkit-search-cancel-button { cursor: pointer; }

        .brain-sidebar__search-icon {
          position: relative;
          width: 14px;
          height: 14px;
          border: 1.5px solid var(--pink, #ff008f);
          border-radius: 50%;
          pointer-events: none;
        }

        .brain-sidebar__search-icon::after {
          content: '';
          position: absolute;
          right: -5px;
          bottom: -4px;
          width: 6px;
          height: 1.5px;
          border-radius: 2px;
          background: var(--pink, #ff008f);
          transform: rotate(45deg);
          transform-origin: left center;
        }

        .brain-sidebar__custom-icon { width: 18px; height: 18px; object-fit: contain; pointer-events: none; }

        .brain-sidebar__new {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 40px;
          padding: 0 16px;
          border: 1px solid var(--ink, #0b0b2d);
          border-radius: 999px;
          background: var(--pink, #ff008f);
          box-shadow: 3px 4px 0 var(--ink, #0b0b2d);
          color: var(--white, #fff);
          font: 600 12px/1 Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          cursor: pointer;
        }

        .brain-sidebar__new span { font-size: 20px; font-weight: 300; line-height: 1; }
        .brain-sidebar__new:active { transform: translate(1px, 1px); box-shadow: 2px 3px 0 var(--ink, #0b0b2d); }

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
          background: var(--white, #fff);
          box-shadow: none;
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
          left: 14px;
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
          color: var(--ink, #0b0b2d);
          font: 13px/21px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: left;
          cursor: pointer;
        }

        .brain-sidebar__item::before {
          content: '•';
          flex: 0 0 auto;
          color: var(--ink, #0b0b2d);
        }

        .brain-sidebar__item-title {
          min-width: 0;
          flex: 1 1 auto;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .brain-sidebar__item time {
          display: none;
          flex: 0 0 auto;
          color: var(--muted, #b7b7b7);
          font-size: 10px;
          white-space: nowrap;
        }

        .brain-sidebar__item:hover { background: color-mix(in srgb, var(--white, #fff) 70%, transparent); }
        .brain-sidebar__item.is-active { background: var(--white, #fff); color: var(--pink, #ff008f); box-shadow: 3px 5px 10px -1px rgba(0,0,0,.04); }
        .brain-sidebar__item.is-active::before { color: var(--pink, #ff008f); }
        .brain-sidebar__empty { padding: 8px 6px; color: #aaa; font-size: 12px; }

        .brain-sidebar__logout {
          flex: 0 0 67px;
          width: var(--sidebar-width);
          min-width: var(--sidebar-width);
          padding: 0 0 0 clamp(24px, calc(24px + (100vw - 768px) * .07), 57px);
          border: 0;
          border-top: 1px solid var(--line, #deddd5);
          background: transparent;
          color: var(--pink, #ff008f);
          font: 12px/30px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: left;
          cursor: pointer;
          opacity: 1;
          transform: translate3d(0, 0, 0);
          transition: opacity .2s ease, transform .38s cubic-bezier(.22, 1, .36, 1), color .3s ease;
        }

        .brain-sidebar__mobile-close { display: none; }

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
          background: var(--white, #fff);
          box-shadow: none;
          cursor: pointer;
        }

        .brain-sidebar__reopen img {
          width: 33px;
          height: 33px;
          transform: rotate(180deg);
        }

        @media (max-width: 1023px) {
          .brain-sidebar {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            bottom: 0;
            width: 100%;
            max-width: none;
            flex-basis: 100%;
            transform: translate3d(-100%, 0, 0);
            box-shadow: none;
            transition: transform .38s cubic-bezier(.22, 1, .36, 1), visibility 0s linear .38s;
            border-right: 0;
            visibility: hidden;
            z-index: 30;
          }
          .brain-sidebar.is-open { transform: translate3d(0, 0, 0); visibility: visible; transition-delay: 0s; }
          .brain-sidebar.is-collapsed { width: 100%; flex-basis: 100%; }
          .brain-sidebar.is-collapsed .brain-sidebar__content,
          .brain-sidebar.is-collapsed .brain-sidebar__logout { opacity: 1; transform: translate3d(0, 0, 0); pointer-events: auto; }
          .brain-sidebar__content,
          .brain-sidebar__logout { width: 100%; min-width: 100%; }
          .brain-sidebar__title { margin-left: 30px; }
          .brain-sidebar__list { padding-right: 30px; padding-left: 30px; }
          .brain-sidebar__collapse { display: none; }
          .brain-sidebar__mobile-close {
            position: absolute;
            z-index: 30;
            top: 14px;
            right: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 33px;
            height: 33px;
            padding: 0;
            border: 0;
            border-radius: 50%;
            background: var(--white, #fff);
            box-shadow: none;
            cursor: pointer;
          }
          .brain-sidebar__mobile-close .brain-sidebar__arrow { margin-left: 4px; }
        }

        @media (max-width: 767px) {
          .brain-sidebar__content { padding-top: 84px; }
          .brain-sidebar__title { display: none; }
          .brain-sidebar__mobile-close { top: 19px; right: auto; left: 30px; }
          .brain-sidebar.is-collapsed .brain-sidebar__mobile-close .brain-sidebar__arrow {
            transform: rotate(45deg);
            margin-left: 4px;
          }
          .brain-sidebar__tools {
            position: absolute;
            z-index: 35;
            right: 0;
            bottom: 0;
            left: 0;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-end;
            gap: 17px;
            padding: 45px 30px 50px;
            background: var(--cream, #fdfbef);
          }
          .brain-sidebar__tools::before {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: 100%;
            height: 84px;
            background: linear-gradient(to bottom, transparent, var(--cream, #fdfbef));
            pointer-events: none;
          }
          .brain-sidebar__tools > * { position: relative; z-index: 1; }
          .brain-sidebar__search-input { position: absolute; z-index: 2; right: 30px; bottom: 102px; left: 30px; width: auto; }
          .brain-sidebar__search { flex: 0 0 40px; width: 40px; height: 40px; }
          .brain-sidebar__new {
            flex: 0 0 134px;
            width: 134px;
            min-width: 0;
            min-height: 38px;
            padding: 0 14px;
            border-color: var(--pink, #ff008f);
            background: var(--cream, #fdfbef);
            box-shadow: none;
            color: var(--pink, #ff008f);
            font-size: 12px;
          }
          .brain-sidebar__new span { display: none; }
          .brain-sidebar__new:active { transform: none; box-shadow: none; background: rgba(255,0,143,.06); }
          .brain-sidebar__list {
            margin-top: 0;
            padding: 0 30px 190px;
            scrollbar-width: none;
            mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 126px), transparent calc(100% - 42px));
          }
          .brain-sidebar__list::-webkit-scrollbar { display: none; }
          .brain-sidebar__item {
            display: block;
            min-height: 78px;
            margin: 0;
            padding: 18px 0 11px;
            border-radius: 0;
            font-size: 14px;
            line-height: 20px;
          }
          .brain-sidebar__item::before { display: none; }
          .brain-sidebar__item:hover,
          .brain-sidebar__item.is-active { background: transparent; box-shadow: none; color: var(--ink, #0b0b2d); }
          .brain-sidebar__item-title { display: block; width: 100%; }
          .brain-sidebar__item time {
            display: block;
            margin-top: 8px;
            color: var(--pink, #c53b8d);
            font-size: 10px;
            line-height: 14px;
          }
          .brain-sidebar__logout { display: none; }
        }
      `}</style>
    </aside>
  )
}
