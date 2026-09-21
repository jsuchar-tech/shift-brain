import { useState } from 'react'
import { API_URL } from '../lib/api'

const SOURCE_ARROW_URL = `${API_URL}/assets/source-arrow.svg`

function citationLabel(citation) {
  if (citation.page_number) return `Page ${citation.page_number}`
  if (citation.slide_number) return `Slide ${citation.slide_number}`
  return 'Open source'
}

function Citation({ citation }) {
  const content = (
    <>
      <span
        className="brain-sources__arrow"
        style={{ '--source-arrow-url': `url("${SOURCE_ARROW_URL}")` }}
        aria-hidden="true"
      />
      <span className="brain-sources__content">
        <strong>{citation.file_name || 'Source'}</strong>
      </span>
      <small className="brain-sources__location">{citationLabel(citation)}</small>
    </>
  )

  if (!citation.source_url) return <div className="brain-sources__item">{content}</div>

  return (
    <a className="brain-sources__item" href={citation.source_url} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  )
}

export default function SourceCitations({ citations }) {
  const [expanded, setExpanded] = useState(false)
  if (!citations?.length) return null

  const visibleCitations = expanded ? citations : citations.slice(0, 3)
  const hasMore = citations.length > 3

  return (
    <section className="brain-sources" aria-label="Sources">
      <div className="brain-sources__list">
        {visibleCitations.map((citation, index) => (
          <Citation key={`${citation.file_name || 'source'}-${index}`} citation={citation} />
        ))}
      </div>
      {hasMore && (
        <button
          className="brain-sources__view-all"
          type="button"
          onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded}
        >
          {expanded ? 'VIEW LESS' : 'VIEW ALL'}
        </button>
      )}

      <style>{`
        .brain-sources { width: 100%; margin-top: 34px; padding-top: 16px; border-top: 1px solid var(--line, #deddd5); }
        .brain-sources__list { display: flex; flex-direction: column; }
        .brain-sources__item {
          display: flex;
          align-items: center;
          min-width: 0;
          min-height: 27px;
          gap: 8px;
          padding: 3px 0;
          border: 0;
          background: transparent;
          color: var(--ink, #0b0b2d);
          text-decoration: none;
        }
        a.brain-sources__item:hover .brain-sources__content strong,
        a.brain-sources__item:hover .brain-sources__location { color: var(--pink, #ff008f); }
        .brain-sources__content { min-width: 0; flex: 1; }
        .brain-sources__content strong { display: block; overflow: hidden; color: var(--ink, #0b0b2d); font-size: 11px; font-weight: 400; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
        .brain-sources__location { flex: 0 0 auto; color: var(--muted, #b7b7b7); font-size: 9px; line-height: 18px; white-space: nowrap; }
        .brain-sources__arrow {
          display: block;
          flex: 0 0 13px;
          width: 13px;
          height: 13px;
          background: var(--pink, #ff008f);
          -webkit-mask: var(--source-arrow-url) center / contain no-repeat;
          mask: var(--source-arrow-url) center / contain no-repeat;
        }
        .brain-sources__view-all {
          margin: 10px 0 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--pink, #ff008f);
          font: 700 10px/18px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: left;
          cursor: pointer;
        }
        .brain-sources__view-all:hover { color: var(--purple, #302798); }
        @media (max-width: 767px) {
          .brain-sources { margin-top: 29px; padding-top: 15px; }
          .brain-sources__item { min-height: 32px; gap: 12px; padding: 4px 0; }
          .brain-sources__content strong { font-size: 11px; line-height: 20px; }
          .brain-sources__location { display: none; }
          .brain-sources__view-all { margin-top: 8px; }
        }
      `}</style>
    </section>
  )
}
