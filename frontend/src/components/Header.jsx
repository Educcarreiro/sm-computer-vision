import { Activity } from 'lucide-react'

export default function Header() {
  return (
    <header style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: 10,
          background: 'var(--gradient-main)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Activity size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{
            fontSize: 20, fontWeight: 700,
            background: 'var(--gradient-main)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Soccer Mind
          </h1>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--accent-cyan)',
            letterSpacing: 2, textTransform: 'uppercase'
          }}>
            AI PLATFORM
          </span>
        </div>
      </div>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '6px 14px',
        fontSize: 13,
        color: 'var(--text-secondary)'
      }}>
        <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>BR</span>
        {' '}
        <span style={{ color: 'var(--text-muted)' }}>PT</span>
      </div>
    </header>
  )
}
