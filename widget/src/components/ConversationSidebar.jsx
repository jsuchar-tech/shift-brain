export default function ConversationSidebar({ conversations, onSelect, onNew, currentId, open = false }) {
  return (
    <aside className={`brain-sidebar ${open ? 'is-open' : ''}`}>
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

      <button className="brain-sidebar__logout" type="button">Log out</button>

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
        }

        .brain-sidebar__content {
          position: relative;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          padding: 16px 0 0;
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
          margin: 0 0 0;
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

        @media (max-width: 767px) {
          .brain-sidebar {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: min(82vw, 300px);
            transform: translateX(-102%);
            box-shadow: 8px 0 30px rgba(0,0,0,.08);
            transition: transform .2s ease;
          }
          .brain-sidebar.is-open { transform: translateX(0); }
          .brain-sidebar__title { margin-left: 24px; }
        }
      `}</style>
    </aside>
  )
}
