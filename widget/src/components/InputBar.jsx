import { useState, useRef } from 'react'

const ACCEPTED_TYPES = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt'
const MAX_SIZE_MB = 10

export default function InputBar({ onSend, isLoading, onFileUpload, uploadedFile, onClearFile, assets, showWelcome, tokensRemaining }) {
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
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`)
      return
    }
    onFileUpload(file)
    e.target.value = ''
  }

  return (
    <div className={`brain-input ${showWelcome ? 'is-welcome' : 'is-active'}`}>
      {uploadedFile && (
        <div className="brain-input__attachment">
          <span>{uploadedFile.file_name}</span>
          <button onClick={onClearFile} type="button">×</button>
        </div>
      )}

      <div className="brain-input__box">
        <input
          type="file"
          ref={fileInputRef}
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          hidden
        />

        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Chat with Brain"
          disabled={isLoading}
          rows={1}
          aria-label="Chat with Brain"
        />

        <div className="brain-input__footer">
          <button
            className="brain-input__icon brain-input__icon--plus"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            type="button"
            aria-label="Attach file"
          >
            <span className="brain-input__asset-icon"><img src={assets.plusBase} alt="" /><img className="brain-input__asset-glyph" src={assets.plusIcon} alt="" /></span>
          </button>

          <div className="brain-input__tokens">You have {Number.isFinite(tokensRemaining) ? tokensRemaining.toLocaleString() : '—'} token left</div>

          <button
            className={`brain-input__icon brain-input__icon--send ${(!value.trim() || isLoading) ? 'is-disabled' : ''}`}
            onClick={handleSend}
            disabled={isLoading || !value.trim()}
            type="button"
            aria-label="Send message"
          >
            <span className="brain-input__asset-icon"><img src={assets.sendBase} alt="" /><img className="brain-input__asset-glyph" src={assets.sendIcon} alt="" /></span>
          </button>
        </div>
      </div>

      <style>{`
        .brain-input {
          position: relative;
          z-index: 6;
          width: min(450px, calc(100% - 48px));
          max-width: 100%;
          height: 140px;
        }

        .brain-input__box {
          position: relative;
          width: 100%;
          height: 100%;
          padding: 17px 14px 12px;
          background: #fff;
          border-radius: 10px;
          box-shadow: 3px 5px 10px -1px rgba(0,0,0,.05);
        }

        .brain-input textarea {
          display: block;
          width: 100%;
          height: 62px;
          padding: 0;
          border: 0;
          outline: 0;
          resize: none;
          overflow: hidden;
          background: transparent;
          color: #0b0b2d;
          font: 17px/31px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .brain-input textarea::placeholder { color: #b7b7b7; opacity: 1; }

        .brain-input__footer {
          position: absolute;
          left: 4.55%;
          right: 5.45%;
          bottom: 0;
          display: grid;
          grid-template-columns: 33px minmax(0, 1fr) 33px;
          align-items: center;
          gap: 52px;
          padding: 12px 0;
        }

        .brain-input__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 33px;
          height: 33px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: transparent;
          cursor: pointer;
        }

        .brain-input__asset-icon { position: relative; display: block; width: 33px; height: 33px; }
        .brain-input__asset-icon > img { position: absolute; inset: 0; width: 33px; height: 33px; object-fit: contain; }
        .brain-input__asset-icon > .brain-input__asset-glyph { inset: 8px; width: 17px; height: 17px; }
        .brain-input__icon--send { justify-self: end; }
        .brain-input__icon--send.is-disabled { opacity: .45; cursor: default; }
        .brain-input__tokens {
          justify-self: center;
          width: 127px;
          color: #0b0b2d;
          font: 11px/28px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: center;
          white-space: nowrap;
        }

        .brain-input__attachment {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,.06);
          color: #666;
          font-size: 12px;
        }
        .brain-input__attachment span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .brain-input__attachment button { border: 0; background: none; color: #aaa; cursor: pointer; font-size: 18px; }

        @media (max-width: 767px) {
          .brain-input {
            width: 100%;
            max-width: 330px;
            height: 106px;
          }
          .brain-input__box { padding: 17px 14px 8px; }
          .brain-input textarea { height: 42px; font-size: 14px; line-height: 28px; }
          .brain-input__footer { gap: 22px; padding: 7px 0; }
          .brain-input__tokens { width: 127px; font-size: 10px; }
        }

      `}</style>
    </div>
  )
}
