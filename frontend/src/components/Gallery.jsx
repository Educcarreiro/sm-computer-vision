import { useState, useEffect } from 'react'
import { Film, Target, Maximize2, ArrowUpDown, Swords, ChevronDown, ChevronUp, Calendar } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

export default function Gallery() {
  const [items, setItems] = useState([])
  const [expanded, setExpanded] = useState(null)

  const fetchGallery = () => {
    fetch(`${API}/gallery`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setItems(data) })
      .catch(() => {})
  }

  useEffect(() => {
    fetchGallery()
    const interval = setInterval(fetchGallery, 10000)
    return () => clearInterval(interval)
  }, [])

  if (items.length === 0) return null

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <Film size={18} color="var(--accent-cyan)" />
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Galeria de Analises</h2>
        <span style={{
          marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)',
          background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: 4
        }}>
          {items.length} analise{items.length > 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => (
          <GalleryCard
            key={item.id}
            item={item}
            isExpanded={expanded === item.id}
            onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
          />
        ))}
      </div>
    </div>
  )
}

function GalleryCard({ item, isExpanded, onToggle }) {
  const { report } = item
  if (!report || report.error) return null

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden'
    }}>
      <button onClick={onToggle} style={{
        width: '100%', padding: '14px 18px', background: 'none',
        border: 'none', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge name={report.team_a?.name} color="var(--accent-cyan)" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>VS</span>
          <Badge name={report.team_b?.name} color="var(--accent-red)" />
          {item.created_at && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Calendar size={10} /> {item.created_at}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={18} color="var(--text-secondary)" /> : <ChevronDown size={18} color="var(--text-secondary)" />}
      </button>

      {isExpanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {item.video && (
            <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 16, background: '#000' }}>
              <video src={`${API}/video/${item.video}`} controls style={{ width: '100%', display: 'block' }} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TeamStats team={report.team_a} color="var(--accent-cyan)" />
            <TeamStats team={report.team_b} color="var(--accent-red)" />
          </div>
          {report.matchup && (
            <div style={{ marginTop: 12, padding: 14, background: 'var(--bg-card)', borderRadius: 10, borderLeft: '3px solid var(--accent-purple)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-purple)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Swords size={14} /> CONFRONTO
              </div>
              <StyleBadge pressing={report.matchup.pressing_avg} style_text={report.matchup.style} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                <Stat label="Gap" value={`${report.matchup.gap}m`} />
                <Stat label="Pressing" value={`${report.matchup.pressing_avg}m`} />
                <Stat label="Compacto" value={report.matchup.more_compact} />
                <Stat label="Largo" value={report.matchup.wider_play} />
                <Stat label="Agressivo" value={report.matchup.more_aggressive} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StyleBadge({ pressing, style_text }) {
  const color = pressing < 8 ? 'var(--accent-red)' : pressing < 14 ? 'var(--accent-yellow)' : 'var(--accent-green)'
  return (
    <div style={{ display: 'inline-block', padding: '4px 10px', background: color + '22', color, borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
      {style_text}
    </div>
  )
}

function Badge({ name, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 14, fontWeight: 600 }}>{name || '?'}</span>
    </div>
  )
}

function TeamStats({ team, color }) {
  if (!team) return null
  const topForm = team.formations?.[0]
  return (
    <div style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 10, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color }}>{team.name}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Stat icon={<Target size={12} />} label="Formacao" value={topForm?.formation || '?'} sub={`${topForm?.percent || 0}%`} />
        <Stat icon={<Maximize2 size={12} />} label="Compactacao" value={`${team.compactness}m2`} />
        <Stat icon={<ArrowUpDown size={12} />} label="Largura" value={`${team.width}m`} />
        <Stat icon={<ArrowUpDown size={12} />} label="Profundidade" value={`${team.depth}m`} />
        <Stat icon={<Swords size={12} />} label="Pressing" value={`${team.pressing}m`} />
      </div>
    </div>
  )
}

function Stat({ icon, label, value, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>{icon} {label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
        {value}{sub && <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 3 }}>({sub})</span>}
      </span>
    </div>
  )
}
