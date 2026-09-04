import { useState, useRef } from 'react'

const ACCEPTED_TYPES = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt'
const MAX_SIZE_MB = 10

export default function InputBar({ onSend, isLoading, language, onFileUpload, uploadedFile, onClearFile }) {
  const [value, setValue] = useState('')
  const fileInputRef = useRef(null)

  const placeholders = {
    en: 'Ask SHIFT Brain anything...',
    es: 'Pregunta lo que quieras...',
    fr: 'Posez votre question...',
    pt: 'Faça sua pergunta...'
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

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`)
      return
    }

    onFileUpload(file)
    e.target.value = ''
  }

  return (
    <div style={{ padding: '12px 20px 20px', borderTop: '1px solid #f0f0f0', background: 'white' }}>
      {uploadedFile && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          marginBottom: '8px',
          background: '#f0f7ff',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#4a90d9'
        }}>
          <span>📎 {uploadedFile.file_name}</span>
          <button
            onClick={onClearFile}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#aaa',
              fontSize: '16px',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end',
        background: '#f7f9fc',
        borderRadius: '12px',
        padding: '8px 12px',
        border: '1px solid #e2e8f0'
      }}>
        <input
          type="file"
          ref={fileInputRef}
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="Attach file"
          style={{
            width: '32px',
            height: '32px',
            border: 'none',
            background: 'transparent',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            color: uploadedFile ? '#4a90d9' : '#aaa',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          📎
        </button>

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