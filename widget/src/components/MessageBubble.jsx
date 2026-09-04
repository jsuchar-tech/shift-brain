import ReactMarkdown from 'react-markdown'
import SourceCitations from './SourceCitations'
import { useState } from 'react'

function CopyButton({ content }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    // Strip markdown to plain text
    const plain = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/^[-•]\s/gm, '')
      .trim()

    navigator.clipboard.writeText(plain).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        marginTop: '8px',
        padding: '4px 10px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        background: 'white',
        color: copied ? '#2d7a3a' : '#888',
        fontSize: '12px',
        cursor: 'pointer',
        transition: 'all 0.15s'
      }}
    >
      {copied ? '✓ Copied' : '⎘ Copy'}
    </button>
  )
}

export default function MessageBubble({ message, fontSize = 16 }) {
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
        fontSize: `${fontSize}px`,
        lineHeight: '1.6'
      }}>
        {isUser ? (
          <div>
            <p>{message.content}</p>
            {message.attachments && message.attachments.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.8 }}>
                📎 {message.attachments.map(a => a.file_name).join(', ')}
              </div>
            )}
          </div>
        ) : (
          <>
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
              {message.content}
            </ReactMarkdown>
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
            {!message.streaming && message.content && (
              <CopyButton content={message.content} />
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