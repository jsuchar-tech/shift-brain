import ReactMarkdown from 'react-markdown'
import SourceCitations from './SourceCitations'
import { memo, useState } from 'react'

function CopyButton({ content }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
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
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button className="brain-message__copy" type="button" onClick={handleCopy}>
      {copied ? 'COPIED' : 'COPY THIS TEXT'}
    </button>
  )
}

function MessageBubble({ message, fontSize = 16 }) {
  const isUser = message.role === 'user'

  return (
    <article className={`brain-message ${isUser ? 'is-user' : 'is-assistant'}`}>
      <div className="brain-message__body" style={{ '--message-font-size': `${fontSize}px` }}>
        {isUser ? (
          <>
            <p>{message.content}</p>
            {message.attachments?.length > 0 && (
              <div className="brain-message__attachments">
                {message.attachments.map(attachment => attachment.file_name).join(', ')}
              </div>
            )}
            {message.reactionEmoji && (
              <span
                className="brain-message__reaction"
                role="img"
                aria-label={`SHIFT Brain reacted with ${message.reactionEmoji}`}
              >
                {message.reactionEmoji}
              </span>
            )}
          </>
        ) : (
          <>
            <div className="brain-message__markdown">
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {message.streaming && <span className="brain-message__cursor" aria-hidden="true" />}
            </div>

            {!message.streaming && message.content && <CopyButton content={message.content} />}

            {!message.streaming && message.citations?.length > 0 && (
              <SourceCitations citations={message.citations} />
            )}
          </>
        )}
      </div>

      <style>{`
        .brain-message { display: flex; width: 100%; }
        .brain-message.is-user { justify-content: flex-end; margin-bottom: 31px; }
        .brain-message.is-assistant { justify-content: flex-start; margin-bottom: 34px; }

        .brain-message__body {
          color: #000;
          font-size: var(--message-font-size, 16px);
          line-height: 1.72;
        }

        .brain-message.is-user .brain-message__body {
          position: relative;
          width: fit-content;
          max-width: min(76%, 500px);
          min-height: 44px;
          padding: 9px 28px;
          border-radius: 10px;
          background: var(--yellow, #ffd000);
          line-height: 26px;
        }

        .brain-message.is-user p { margin: 0; }
        .brain-message.is-assistant .brain-message__body { width: 100%; padding: 0; background: transparent; }
        .brain-message__markdown > :first-child { margin-top: 0; }
        .brain-message__markdown > :last-child { margin-bottom: 0; }
        .brain-message__markdown p { margin: 0 0 24px; }
        .brain-message__markdown ul,
        .brain-message__markdown ol { margin: 0 0 24px; padding-left: 24px; }
        .brain-message__markdown li { margin-bottom: 6px; }
        .brain-message__markdown strong { font-weight: 600; }
        .brain-message__markdown a { color: var(--pink, #ff008f); text-underline-offset: 3px; }
        .brain-message__markdown code { padding: 2px 5px; border-radius: 4px; background: rgba(255,255,255,.8); font-size: .88em; }

        .brain-message__attachments { margin-top: 5px; color: rgba(0,0,0,.6); font-size: 11px; line-height: 16px; }
        .brain-message__attachments::before { content: '+ '; color: var(--pink, #ff008f); }

        .brain-message__reaction {
          position: absolute;
          right: 12px;
          bottom: -16px;
          display: grid;
          place-items: center;
          min-width: 32px;
          height: 27px;
          padding: 0 7px;
          border: 2px solid var(--cream, #fdfbef);
          border-radius: 999px;
          background: var(--yellow, #ffd000);
          box-shadow: 0 2px 6px rgba(11, 11, 45, .1);
          font-size: 16px;
          line-height: 1;
          transform-origin: 75% 100%;
          will-change: transform, opacity;
          animation: brain-reaction-pop 620ms cubic-bezier(.2, .9, .25, 1.25) both;
        }

        .brain-message__reaction::after {
          position: absolute;
          inset: -5px;
          border: 2px solid var(--pink, #ff008f);
          border-radius: inherit;
          content: '';
          pointer-events: none;
          animation: brain-reaction-ripple 680ms ease-out both;
        }

        .brain-message__cursor {
          display: inline-block;
          width: 2px;
          height: 1em;
          margin-left: 3px;
          background: var(--pink, #ff008f);
          animation: brain-message-blink 1s steps(2, start) infinite;
          vertical-align: -.12em;
        }

        .brain-message__copy {
          display: block;
          margin-top: 25px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--pink, #ff008f);
          font: 700 10px/18px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: .01em;
          text-align: left;
          cursor: pointer;
        }

        .brain-message__copy:hover { text-decoration: underline; text-underline-offset: 3px; }
        @keyframes brain-message-blink { 50% { opacity: 0; } }
        @keyframes brain-reaction-pop {
          0% { opacity: 0; transform: translateY(12px) scale(.18) rotate(-18deg); }
          42% { opacity: 1; transform: translateY(-5px) scale(1.3) rotate(8deg); }
          62% { transform: translateY(1px) scale(.88) rotate(-3deg); }
          80% { transform: translateY(-1px) scale(1.08) rotate(1deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
        }

        @keyframes brain-reaction-ripple {
          0% { opacity: .65; transform: scale(.65); }
          45% { opacity: .3; }
          100% { opacity: 0; transform: scale(1.45); }
        }

        @media (prefers-reduced-motion: reduce) {
          .brain-message__reaction,
          .brain-message__reaction::after { animation: none; }
          .brain-message__reaction::after { display: none; }
        }

        @media (max-width: 767px) {
          .brain-message.is-user { margin-bottom: 26px; }
          .brain-message.is-user .brain-message__body { max-width: 86%; padding: 8px 18px; }
          .brain-message__markdown p,
          .brain-message__markdown ul,
          .brain-message__markdown ol { margin-bottom: 19px; }
        }
      `}</style>
    </article>
  )
}

export default memo(MessageBubble)
