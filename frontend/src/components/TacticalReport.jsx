import { BarChart3, Target, ArrowUpDown, Maximize2, Swords } from 'lucide-react'

export default function TacticalReport({ report }) {
  if (!report) return null

  const { team_a, team_b, matchup } = report

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
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
        <BarChart3 size={18} color="var(--accent-cyan)" />
        Relatório Tático
      </div>

      <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
        <TeamSection team={team_a} color="var(--accent-cyan)" />
        <TeamSection team={team_b} color="var(--accent-red)" />
        <MatchupSection matchup={matchup} />
      </div>
    </div>
  )
}

function TeamSection({ team, color }) {
  const topForm = team.formations?.[0]

  return (
    <div style={{
      marginBottom: 16,
      padding: 14,
      background: 'var(--bg-secondary)',
      borderRadius: 10,
      borderLeft: `3px solid ${color}`
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 10 }}>
        {team.name}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat icon={<Target size={13} />} label="Formação" value={topForm?.formation || '?'} sub={`${topForm?.percent || 0}%`} />
        <Stat icon={<Maximize2 size={13} />} label="Compactação" value={`${team.compactness} m²`} />
        <Stat icon={<ArrowUpDown size={13} />} label="Largura" value={`${team.width} m`} />
        <Stat icon={<ArrowUpDown size={13} />} label="Profundidade" value={`${team.depth} m`} />
        <Stat icon={<Swords size={13} />} label="Pressing" value={`${team.pressing} m`} />
        <Stat label="Jogadores" value={team.players_avg} />
      </div>
    </div>
  )
}

function MatchupSection({ matchup }) {
  const styleColor = matchup.pressing_avg < 8
    ? 'var(--accent-red)'
    : matchup.pressing_avg < 14
      ? 'var(--accent-yellow)'
      : 'var(--accent-green)'

  return (
    <div style={{
      padding: 14,
      background: 'var(--bg-secondary)',
      borderRadius: 10,
      borderLeft: '3px solid var(--accent-purple)'
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-purple)', marginBottom: 10 }}>
        Confronto
      </h3>
      <div style={{
        display: 'inline-block',
        padding: '4px 10px',
        background: styleColor + '22',
        color: styleColor,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        marginBottom: 10
      }}>
        {matchup.style}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat label="Gap Centróides" value={`${matchup.gap} m`} />
        <Stat label="Pressing Médio" value={`${matchup.pressing_avg} m`} />
        <Stat label="Mais Compacto" value={matchup.more_compact} />
        <Stat label="Mais Largo" value={matchup.wider_play} />
        <Stat label="Mais Agressivo" value={matchup.more_aggressive} />
      </div>
    </div>
  )
}

function Stat({ icon, label, value, sub }) {
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{
        fontSize: 11, color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2
      }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        {value}
        {sub && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>({sub})</span>}
      </div>
    </div>
  )
}
