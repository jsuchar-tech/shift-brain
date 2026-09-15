import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

export default function MessageList({ messages, isLoading, fontSize }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Keep the composer fixed in place and open existing conversations at the latest message.
    // Wait one frame so the newly rendered messages have their final height before scrolling.
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [messages, isLoading])

  return (
    <div ref={containerRef} className="brain-message-list">
      <div className="brain-message-list__content">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} fontSize={fontSize} />
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{
              display: 'inline-flex',
              gap: '4px',
              padding: '12px 16px',
              background: 'white',
              borderRadius: '18px 18px 18px 4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#4a90d9',
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .brain-message-list {
          position: absolute;
          z-index: 2;
          top: 58px;
          left: 0;
          right: 0;
          bottom: 176px;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 20px 0 8px;
        }

        .brain-message-list__content {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .brain-message-list::-webkit-scrollbar { width: 5px; }
        .brain-message-list::-webkit-scrollbar-thumb {
          background: rgba(11,11,45,.16);
          border-radius: 999px;
        }

        @media (max-width: 767px) {
          .brain-message-list {
            top: 52px;
            bottom: 142px;
            padding: 12px 0 8px;
          }
        }
      `}</style>
    </div>
  )
}
