import ReactMarkdown from 'react-markdown'
import SourceCitations from './SourceCitations'
import { useState, useEffect } from 'react'

function SafeMarkdown({ content }) {
  try {
    return (
      <ReactMarkdown
        components={{
          p: ({ children }) => <p style={{ marginBottom: '8px' }}>{children}</p>,
          ul: ({ children }) => <ul style={{ paddingLeft: '20px', marginBottom: '8px' }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ paddingLeft: '20px', marginBottom: '8px' }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
          strong: ({ children }) => <strong style={{ fontWeight: '600' }}>{children}</strong>,
          code: ({ children }) => <code style={{ background: '#f0f0f0', padding: '2px 4px', borderRadius: '3px', fontSize: '13px' }}>{children}</code>
        }}
      >
        {content || ''}
      </ReactMarkdown>
    )
  } catch (e) {
    return <p>{content}</p>
  }
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '16px',
      padding: '0 20px'
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '12px 16px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser ? '#4a90d9' : 'white',
        color: isUser ? 'white' : '#333',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        fontSize: '14px',
        lineHeight: '1.6'
      }}>
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <>
            <SafeMarkdown content={message.content} />
            {message.streaming && (
              <span style={{
                display: 'inline-block',
                width: '6px',
                height: '14px',
                background: '#4a90d9',
                marginLeft: '2px',
                animation: 'blink 1s infinite',
                verticalAlign: 'middle'
              }} />
            )}
            {message.citations && message.citations.length > 0 && (
              <SourceCitations citations={message.citations} />
            )}
          </>
        )}
      </div>
    </div>
  )
}