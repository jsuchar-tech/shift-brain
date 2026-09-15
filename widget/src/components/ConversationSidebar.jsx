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
  return (
    <aside className={`brain-sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="brain-sidebar__content">
        <div className="brain-sidebar__title">Your chat history</div>
        <button className="brain-sidebar__dots" onClick={onNew} aria-label="Start a new chat">
          <span>⋮</span>
        </button>

        <div className="brain-sidebar__list">
          {conversations.length === 0 && (
            <p className="brain-sidebar__empty">No conversations yet</p>
          )}
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`brain-sidebar__item ${currentId === conv.id ? 'is-active' : ''}`}
              title={conv.title || 'Untitled conversation'}
            >
              <span>{conv.title || 'Untitled conversation'}</span>
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
        <img src="https://www.figma.com/api/mcp/asset/688f4202-cb5b-46a2-9189-ab4c9ca9d134.svg" alt="" />
      </button>

      <button className="brain-sidebar__logout" type="button" onClick={onLogout}>Log out</button>

      <style>{`
        .brain-sidebar {
          position: relative;
          z-index: 10;
          flex: 0 0 clamp(270px, calc(146px + 16.1vw), 346px);
          width: clamp(270px, calc(146px + 16.1vw), 346px);
          height: 100%;
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
          margin-left: clamp(13px, calc(13px + (100vw - 768px) * .089), 55px);
          color: #b7b7b7;
          font-size: 12px;
          line-height: 34px;
        }

        .brain-sidebar__dots {
          position: absolute;
          top: 88px;
          right: 8px;
          width: 18px;
          height: 24px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--pink, #ff008f);
          font-size: 17px;
          line-height: 18px;
          cursor: pointer;
        }

        .brain-sidebar__collapse {
          position: absolute;
          top: 14px;
          right: -17px;
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

        .brain-sidebar__collapse img {
          width: 33px;
          height: 33px;
          object-fit: contain;
        }

        .brain-sidebar.is-collapsed .brain-sidebar__collapse img {
          transform: rotate(180deg);
        }

        .brain-sidebar__list {
          height: calc(100% - 74px);
          margin-top: 35px;
          padding: 0 13px;
          overflow: hidden;
          mask-image: linear-gradient(to bottom, #000 0, #000 86%, transparent 100%);
        }

        .brain-sidebar__item {
          display: block;
          width: 100%;
          height: 33px;
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: #0b0b2d;
          font: 13px/21px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: left;
          cursor: pointer;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .brain-sidebar__item::before {
          content: '•';
          display: inline-block;
          width: 19px;
          color: #0b0b2d;
        }

        .brain-sidebar__item.is-active { color: var(--pink, #ff008f); }
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
          .brain-sidebar__title { margin-left: 24px; }
          .brain-sidebar__collapse { display: none; }
        }
      `}</style>
    </aside>
  )
}
