import { useState, useRef } from 'react'

const ACCEPTED_TYPES = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt'
const MAX_SIZE_MB = 10

function PaperclipIcon({ color = '#aaa' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  )
}

export default function InputBar({ onSend, isLoading, onFileUpload, uploadedFile, onClearFile }) {
  const [value, setValue] = useState('')
  const fileInputRef = useRef(null)

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
          display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
          marginBottom: '8px', background: '#f0f7ff', borderRadius: '8px',
          fontSize: '13px', color: '#4a90d9'
        }}>
          <PaperclipIcon color="#4a90d9" />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {uploadedFile.file_name}
          </span>
          <button onClick={onClearFile} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '18px', lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', background: '#f7f9fc', borderRadius: '12px', padding: '8px 12px', border: '1px solid #e2e8f0' }}>
        <input type="file" ref={fileInputRef} accept={ACCEPTED_TYPES} onChange={handleFileChange} style={{ display: 'none' }} />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="Attach file (images, PDF, Word, TXT — max 10MB)"
          style={{
            width: '32px', height: '32px', border: 'none', background: 'transparent',
            cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            opacity: isLoading ? 0.4 : 1, borderRadius: '6px', transition: 'background 0.15s'
          }}
          onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = '#e8f0fe' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <PaperclipIcon color={uploadedFile ? '#4a90d9' : '#999'} />
        </button>

        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask SHIFT Brain anything... (any language)"
          disabled={isLoading}
          rows={1}
          style={{
            flex: 1, border: 'none', background: 'transparent', resize: 'none',
            outline: 'none', fontSize: '14px', lineHeight: '1.5',
            maxHeight: '120px', overflowY: 'auto', fontFamily: 'inherit'
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
            width: '32px', height: '32px', borderRadius: '8px', border: 'none',
            background: isLoading || !value.trim() ? '#ccc' : '#4a90d9', color: 'white',
            cursor: isLoading || !value.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background 0.15s'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 19V5M5 12l7-7 7 7"/>
            <path d="M12 5l7 7M12 5l-7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          </svg>
        </button>
      </div>
    </div>
  )
}