import { Clock } from 'lucide-react'

export default function History({ items, onLoad }) {
  const entries = Object.entries(items).filter(([_, v]) => v.status === 'done')
  if (entries.length === 0) return null

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: 20
    }}>
      <h3 style={{
        fontSize: 14, fontWeight: 600, marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <Clock size={16} color="var(--text-secondary)" />
        Análises Anteriores
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map(([id, data]) => (
          <button
            key={id}
            onClick={() => onLoad(id, data)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              transition: 'border-color 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-cyan)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <span style={{ fontWeight: 500 }}>
              {data.report?.team_a?.name || 'Team A'} vs {data.report?.team_b?.name || 'Team B'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {data.report?.frames_analyzed} frames
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
