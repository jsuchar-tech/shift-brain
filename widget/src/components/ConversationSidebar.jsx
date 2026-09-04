export default function ConversationSidebar({ conversations, onSelect, onNew, currentId }) {
  return (
    <div style={{
      width: '240px',
      borderRight: '1px solid #f0f0f0',
      display: 'flex',
      flexDirection: 'column',
      background: '#fafafa'
    }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #f0f0f0'
      }}>
        <button
          onClick={onNew}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #4a90d9',
            borderRadius: '8px',
            background: 'white',
            color: '#4a90d9',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          + New conversation
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {conversations.length === 0 && (
          <p style={{ fontSize: '12px', color: '#aaa', padding: '8px', textAlign: 'center' }}>
            No conversations yet
          </p>
        )}
        {conversations.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderRadius: '8px',
              background: currentId === conv.id ? '#e8f0fb' : 'transparent',
              color: currentId === conv.id ? '#4a90d9' : '#444',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '13px',
              marginBottom: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block'
            }}
          >
            {conv.title || 'Untitled conversation'}
          </button>
        ))}
      </div>
    </div>
  )
}