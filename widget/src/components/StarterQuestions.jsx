const QUESTIONS = [
  'Lorem ipsum dolor sit amet?',
  'Consectetur adipiscing elit sed do?',
  'Eiusmod tempor incididunt ut labore?',
  'Dolore magna aliqua ut enim ad?'
]

export default function StarterQuestions({ onSelect }) {
  return (
    <div style={{ padding: '0 20px 20px' }}>
      <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px', textAlign: 'center' }}>
        Try asking:
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {QUESTIONS.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            style={{
              padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px',
              background: 'white', fontSize: '13px', color: '#444', cursor: 'pointer',
              textAlign: 'left', lineHeight: '1.4', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.target.style.borderColor = '#4a90d9'}
            onMouseLeave={e => e.target.style.borderColor = '#e2e8f0'}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}