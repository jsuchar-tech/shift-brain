function citationLabel(citation) {
  if (citation.page_number) return `Page ${citation.page_number}`
  if (citation.slide_number) return `Slide ${citation.slide_number}`
  return 'Open source'
}

function Citation({ citation, index }) {
  const content = (
    <>
      <span className="brain-sources__number">{String(index + 1).padStart(2, '0')}</span>
      <span className="brain-sources__content">
        <strong>{citation.file_name || 'Source'}</strong>
        <small>{citationLabel(citation)}</small>
      </span>
      {citation.source_url && <span className="brain-sources__arrow" aria-hidden="true">↗</span>}
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
  if (!citations?.length) return null

  return (
    <section className="brain-sources" aria-label="Sources">
      <div className="brain-sources__heading">
        <span>SOURCES</span>
        <span>{citations.length}</span>
      </div>
      <div className="brain-sources__list">
        {citations.map((citation, index) => (
          <Citation key={`${citation.file_name || 'source'}-${index}`} citation={citation} index={index} />
        ))}
      </div>

      <style>{`
        .brain-sources { width: 100%; margin-top: 27px; padding-top: 15px; border-top: 1px solid #deddd5; }
        .brain-sources__heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          color: #ff008f;
          font: 700 10px/18px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .brain-sources__heading span:last-child {
          display: grid;
          width: 20px;
          height: 20px;
          place-items: center;
          border: 1px solid #ff008f;
          border-radius: 50%;
          font-size: 9px;
        }
        .brain-sources__list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .brain-sources__item {
          display: flex;
          align-items: center;
          min-width: 0;
          min-height: 54px;
          gap: 10px;
          padding: 9px 11px;
          border: 1px solid rgba(222,221,213,.85);
          border-radius: 10px;
          background: #fff;
          color: #0b0b2d;
          text-decoration: none;
          box-shadow: 3px 5px 10px -1px rgba(0,0,0,.035);
        }
        a.brain-sources__item:hover { border-color: #ff008f; }
        .brain-sources__number { flex: 0 0 auto; color: #ff008f; font: 600 10px/1 Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .brain-sources__content { min-width: 0; flex: 1; }
        .brain-sources__content strong,
        .brain-sources__content small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .brain-sources__content strong { font-size: 11px; font-weight: 500; line-height: 16px; }
        .brain-sources__content small { color: #9d9d9d; font-size: 9px; line-height: 14px; }
        .brain-sources__arrow { flex: 0 0 auto; color: #ff008f; font-size: 13px; }
        @media (max-width: 560px) { .brain-sources__list { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  )
}
