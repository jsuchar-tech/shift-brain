
import MessageBubble from './MessageBubble'

export default function MessageList({ messages, isLoading, fontSize }) {
  return (
    <div className="brain-message-list">
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
          position: relative;
          z-index: 2;
          top: auto;
          left: auto;
          right: auto;
          bottom: auto;
          min-height: 0;
          overflow: visible;
          overflow-x: hidden;
          padding: 20px 0 8px;
        }

        .brain-message-list__content {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        @media (max-width: 767px) {
          .brain-message-list { padding: 12px 0 8px; }
        }
      `}</style>
    </div>
  )
}
