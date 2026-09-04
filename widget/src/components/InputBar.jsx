import { useState } from 'react'

export default function InputBar({ onSend, isLoading, language }) {
  const [value, setValue] = useState('')

const placeholders = {
  en: 'Lorem ipsum dolor sit amet...',
  es: 'Lorem ipsum dolor sit amet...',
  fr: 'Lorem ipsum dolor sit amet...',
  pt: 'Lorem ipsum dolor sit amet...'
}

  function handleSend() {
    if (!value.trim() || isLoading) return
    onSend(value.trim())
    setValue('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      padding: '12px 20px 20px',
      borderTop: '1px solid #f0f0f0',
      background: 'white'
    }}>
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end',
        background: '#f7f9fc',
        borderRadius: '12px',
        padding: '8px 12px',
        border: '1px solid #e2e8f0'
      }}>
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholders[language] || placeholders.en}
          disabled={isLoading}
          rows={1}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            resize: 'none',
            outline: 'none',
            fontSize: '14px',
            lineHeight: '1.5',
            maxHeight: '120px',
            overflowY: 'auto',
            fontFamily: 'inherit'
          }}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !value.trim()}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: 'none',
            background: isLoading || !value.trim() ? '#ccc' : '#4a90d9',
            color: 'white',
            cursor: isLoading || !value.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
            transition: 'background 0.15s'
          }}
        >
          ↑
        </button>
      </div>
    </div>
  )
}