import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

const SCROLL_THRESHOLD_PX = 80

export default function MessageList({ messages, isLoading, fontSize }) {
  const containerRef = useRef(null)
  const bottomRef = useRef(null)
  const shouldAutoScrollRef = useRef(true)

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < SCROLL_THRESHOLD_PX
  }

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return
    // Instant scroll while a response is streaming (avoids stacking
    // smooth-scroll animations on every token); smooth once it settles.
    bottomRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' })
  }, [messages, isLoading])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflowY: 'auto',
        paddingTop: '20px',
        paddingBottom: '8px'
      }}
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
      <div ref={bottomRef} />
    </div>
  )
}