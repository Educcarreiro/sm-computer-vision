import { useState } from 'react'
import { Film, BarChart3, Target, Maximize2, ArrowUpDown, Swords, ChevronDown, ChevronUp } from 'lucide-react'

const GALLERY_ITEMS = [
  {
    id: 'pal-cor-2024',
    title: 'Palmeiras x Corinthians',
    date: '2024',
    video: 'http://localhost:5000/api/video/palmeiras_corinthians_web.mp4',
    thumbnail: null,
    report: {
      frames_analyzed: 166,
      team_a: {
        name: 'Palmeiras',
        color: '#00a651',
        formations: [
          { formation: '3', percent: 13.3 },
          { formation: '4', percent: 9.0 },
          { formation: '2', percent: 5.4 },
          { formation: '5', percent: 5.4 }
        ],
        compactness: 458.4,
        width: 52.3,
        depth: 17.0,
        pressing: 17.5,
        players_avg: 5.2
      },
      team_b: {
        name: 'Corinthians',
        color: '#ffffff',
        formations: [
          { formation: '2', percent: 10.8 },
          { formation: '6', percent: 9.0 },
          { formation: '5', percent: 7.8 },
          { formation: '4', percent: 7.2 }
        ],
        compactness: 473.9,
        width: 51.9,
        depth: 16.3,
        pressing: 17.5,
        players_avg: 5.0
      },
      matchup: {
        gap: 21.2,
        pressing_avg: 17.5,
        style: 'BLOCO BAIXO (Reativo)',
        more_compact: 'Palmeiras',
        wider_play: 'Palmeiras',
        more_aggressive: 'Palmeiras'
      }
    }
  }
]

export default function Gallery() {
  const [expanded, setExpanded] = useState(null)

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
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <Film size={18} color="var(--accent-cyan)" />
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Galeria de Análises</h2>
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--bg-secondary)',
          padding: '3px 8px',
          borderRadius: 4
        }}>
          {GALLERY_ITEMS.length} análise{GALLERY_ITEMS.length > 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {GALLERY_ITEMS.map(item => (
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

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color 0.2s'
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '14px 18px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'var(--text-primary)',
          fontFamily: 'Inter, sans-serif'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <TeamBadge name={report.team_a.name} color={report.team_a.color || 'var(--accent-green)'} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>VS</span>
            <TeamBadge name={report.team_b.name} color={report.team_b.color || 'var(--text-secondary)'} />
          </div>
          <span style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'var(--bg-card)',
            padding: '2px 8px',
            borderRadius: 4
          }}>
            {report.frames_analyzed} frames
          </span>
        </div>
        {isExpanded ? <ChevronUp size={18} color="var(--text-secondary)" /> : <ChevronDown size={18} color="var(--text-secondary)" />}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Video */}
          <div style={{
            borderRadius: 10,
            overflow: 'hidden',
            marginBottom: 16,
            background: '#000'
          }}>
            <video
              src={item.video}
              controls
              style={{ width: '100%', display: 'block' }}
            />
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TeamStats team={report.team_a} color={report.team_a.color || 'var(--accent-green)'} />
            <TeamStats team={report.team_b} color={report.team_b.color || 'var(--text-secondary)'} />
          </div>

          {/* Matchup */}
          <div style={{
            marginTop: 12,
            padding: 14,
            background: 'var(--bg-card)',
            borderRadius: 10,
            borderLeft: '3px solid var(--accent-purple)'
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: 'var(--accent-purple)',
              marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <Swords size={14} /> CONFRONTO
            </div>

            <div style={{
              display: 'inline-block',
              padding: '4px 10px',
              background: 'var(--accent-green)22',
              color: 'var(--accent-green)',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 10
            }}>
              {report.matchup.style}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <MiniStat label="Gap Centróides" value={`${report.matchup.gap}m`} />
              <MiniStat label="Pressing Médio" value={`${report.matchup.pressing_avg}m`} />
              <MiniStat label="Mais Compacto" value={report.matchup.more_compact} />
              <MiniStat label="Mais Largo" value={report.matchup.wider_play} />
              <MiniStat label="Mais Agressivo" value={report.matchup.more_aggressive} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TeamBadge({ name, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 10, height: 10,
        borderRadius: '50%',
        background: color,
        border: color === '#ffffff' ? '1px solid var(--text-muted)' : 'none'
      }} />
      <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
    </div>
  )
}

function TeamStats({ team, color }) {
  const topForm = team.formations?.[0]

  return (
    <div style={{
      padding: 12,
      background: 'var(--bg-card)',
      borderRadius: 10,
      borderTop: `3px solid ${color}`
    }}>
      <div style={{
        fontSize: 13, fontWeight: 700, marginBottom: 10,
        color: color === '#ffffff' ? 'var(--text-primary)' : color
      }}>
        {team.name}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <MiniStat icon={<Target size={12} />} label="Formação" value={topForm?.formation || '?'} sub={`${topForm?.percent}%`} />
        <MiniStat icon={<Maximize2 size={12} />} label="Compactação" value={`${team.compactness}m²`} />
        <MiniStat icon={<ArrowUpDown size={12} />} label="Largura" value={`${team.width}m`} />
        <MiniStat icon={<ArrowUpDown size={12} />} label="Profundidade" value={`${team.depth}m`} />
        <MiniStat icon={<Swords size={12} />} label="Pressing" value={`${team.pressing}m`} />
      </div>
    </div>
  )
}

function MiniStat({ icon, label, value, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{
        fontSize: 11, color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 4
      }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
        {value}
        {sub && <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 3 }}>({sub})</span>}
      </span>
    </div>
  )
}
