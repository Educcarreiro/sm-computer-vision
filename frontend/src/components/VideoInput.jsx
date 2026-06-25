import { useState } from 'react'
import { Play, Link, Users } from 'lucide-react'

export default function VideoInput({ onSubmit, disabled }) {
  const [url, setUrl] = useState('')
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!url.trim()) return
    onSubmit(url, teamA || 'Team A', teamB || 'Team B')
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: 28,
    }}>
      <h2 style={{
        fontSize: 16, fontWeight: 600, marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <Link size={18} color="var(--accent-cyan)" />
        Análise Tática por Vídeo
      </h2>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>URL do YouTube</label>
        <input
          type="text"
          placeholder="https://youtu.be/..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={disabled}
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>
            <Users size={14} style={{ marginRight: 4 }} /> Time A
          </label>
          <input
            type="text"
            placeholder="Ex: Palmeiras"
            value={teamA}
            onChange={e => setTeamA(e.target.value)}
            disabled={disabled}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>
            <Users size={14} style={{ marginRight: 4 }} /> Time B
          </label>
          <input
            type="text"
            placeholder="Ex: Corinthians"
            value={teamB}
            onChange={e => setTeamB(e.target.value)}
            disabled={disabled}
            style={inputStyle}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={disabled || !url.trim()}
        style={{
          width: '100%',
          padding: '12px 24px',
          background: disabled ? 'var(--text-muted)' : 'var(--gradient-main)',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'opacity 0.2s',
          opacity: disabled ? 0.5 : 1
        }}
      >
        <Play size={18} />
        Analisar Vídeo
      </button>
    </form>
  )
}

const labelStyle = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  display: 'flex',
  alignItems: 'center'
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  marginTop: 4,
  transition: 'border-color 0.2s',
  fontFamily: 'Inter, sans-serif'
}
