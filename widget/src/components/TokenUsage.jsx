export default function TokenUsage({ usage }) {
  if (!usage) return null

  const { tokens_used_today, daily_limit, daily_remaining } = usage
  const percent = Math.round((tokens_used_today / daily_limit) * 100)
  const isLow = daily_remaining < 5000

  return (
    <div style={{
      fontSize: '12px',
      color: isLow ? '#e53e3e' : '#666',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }}>
      <div style={{
        width: '60px',
        height: '4px',
        background: '#eee',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${Math.min(percent, 100)}%`,
          height: '100%',
          background: isLow ? '#e53e3e' : '#4a90d9',
          borderRadius: '2px'
        }} />
      </div>
      <span>{daily_remaining.toLocaleString()} tokens remaining today</span>
    </div>
  )
}