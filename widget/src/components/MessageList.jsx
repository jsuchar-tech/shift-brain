import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

export default function MessageList({ messages, isLoading, fontSize }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, isLoading])

  return (
    <div
      ref={containerRef}
      className="brain-message-list"
    >
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
          padding-top: 20px;
          padding-bottom: 8px;
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
            padding-top: 12px;
          }
        }
      `}</style>
    </div>
  )
}
