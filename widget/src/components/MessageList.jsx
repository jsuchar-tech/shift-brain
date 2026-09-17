
import { useLayoutEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

export default function MessageList({ messages, isLoading, fontSize, scrollToBottomRequest = 0 }) {
  const listRef = useRef(null)

  useLayoutEffect(() => {
    if (!scrollToBottomRequest || !listRef.current) return

    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'auto' })
    })

    return () => cancelAnimationFrame(frame)
  }, [scrollToBottomRequest])

  return (
    <div className="brain-message-list" ref={listRef}>
      <div className="brain-message-list__content">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} fontSize={fontSize} />
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="brain-message-list__loading" aria-label="Brain is responding">
            <div>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#ff008f',
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .brain-message-list {
          position: relative;
          z-index: 2;
          top: auto;
          left: auto;
          right: auto;
          bottom: auto;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 20px 0 8px;
        }

        .brain-message-list__content {
          width: min(802px, calc(100% - clamp(40px, 14.0625vw, 108px)));
          min-height: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }

        .brain-message-list__loading { width: 100%; padding: 4px 0 20px; }
        .brain-message-list__loading > div {
          display: inline-flex;
          gap: 5px;
          padding: 8px 0;
          background: transparent;
        }

        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: .45; }
          30% { transform: translateY(-4px); opacity: 1; }
        }

        @media (max-width: 767px) {
          .brain-message-list { padding: 12px 0 8px; }
          .brain-message-list__content { width: calc(100% - 60px); }
        }
      `}</style>
    </div>
  )
}
