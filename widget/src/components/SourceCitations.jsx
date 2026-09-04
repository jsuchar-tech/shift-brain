import React from 'react'

function CitationLink({ citation }) {
  var label = citation.file_name || 'Source'
  if (citation.page_number) label = label + ' - p.' + citation.page_number
  if (citation.slide_number) label = label + ' - slide ' + citation.slide_number

  var url = citation.source_url || '#'

  return React.createElement(
    'a',
    {
      href: url,
      target: '_blank',
      rel: 'noopener noreferrer',
      style: { display: 'block', fontSize: '12px', color: '#4a90d9', textDecoration: 'none', marginTop: '2px' }
    },
    label
  )
}

export default function SourceCitations({ citations }) {
  if (!citations || citations.length === 0) return null

  return React.createElement(
    'div',
    { style: { marginTop: '8px', padding: '8px 12px', background: '#f7f9fc', borderRadius: '6px', borderLeft: '3px solid #4a90d9' } },
    React.createElement('p', { style: { fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '4px' } }, 'Sources'),
    citations.map(function(c, i) { return React.createElement(CitationLink, { key: i, citation: c }) })
  )
}
