const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' }
]

export default function LanguageSelector({ language, onChange }) {
  return (
    <select
      value={language}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '4px 8px',
        borderRadius: '6px',
        border: '1px solid #ddd',
        fontSize: '13px',
        cursor: 'pointer',
        background: 'white'
      }}
    >
      {LANGUAGES.map(l => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  )
}