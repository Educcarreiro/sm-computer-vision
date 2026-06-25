import { Loader2 } from 'lucide-react'

const statusLabels = {
  queued: 'Na fila...',
  downloading: 'Baixando vídeo do YouTube...',
  processing: 'Processando com IA (YOLO + OpenCV)...',
}

export default function ProcessingStatus({ status }) {
  const label = statusLabels[status.status] || 'Processando...'
  const progress = status.progress || 0

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: 28,
      textAlign: 'center'
    }}>
      <Loader2
        size={36}
        color="var(--accent-cyan)"
        style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{label}</p>
      <div style={{
        width: '100%',
        height: 6,
        background: 'var(--bg-secondary)',
        borderRadius: 3,
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'var(--gradient-main)',
          borderRadius: 3,
          transition: 'width 0.5s ease'
        }} />
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
        {progress}% concluído
      </p>
    </div>
  )
}
