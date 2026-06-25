import { MonitorPlay } from 'lucide-react'

export default function VideoPlayer({ src }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        fontWeight: 600
      }}>
        <MonitorPlay size={18} color="var(--accent-cyan)" />
        Vídeo Tático
      </div>
      <div style={{ padding: 12 }}>
        <video
          src={src}
          controls
          style={{
            width: '100%',
            borderRadius: 8,
            background: '#000'
          }}
        />
      </div>
    </div>
  )
}
