import { useState } from 'react'
import { Search, Brain, TrendingUp, Shield, Zap, Maximize2, ArrowUpDown, Target } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

const ICON_MAP = {
  formation: <Target size={16} />,
  shape: <Shield size={16} />,
  pressing: <Zap size={16} />,
  width: <Maximize2 size={16} />,
  depth: <ArrowUpDown size={16} />,
  style: <TrendingUp size={16} />,
}

const CONFIDENCE_COLORS = {
  alta: 'var(--accent-green)',
  media: 'var(--accent-yellow)',
  baixa: 'var(--accent-red)',
}

export default function Patterns() {
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const search = async () => {
    if (!teamName.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${API}/patterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: teamName })
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch {
      setError('Erro ao conectar com o backend')
    }
    setLoading(false)
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16, padding: 24
    }}>
      <h3 style={{
        fontSize: 15, fontWeight: 600, marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <Brain size={18} color="var(--accent-green)" />
        Detector de Padroes Taticos
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Analisa o mesmo time em partidas diferentes e identifica padroes recorrentes
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Nome do time (ex: Brasil)"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          style={{
            flex: 1, padding: '10px 14px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-primary)',
            fontSize: 13, outline: 'none',
            fontFamily: 'Inter, sans-serif'
          }}
        />
        <button
          onClick={search}
          disabled={loading || !teamName.trim()}
          style={{
            padding: '10px 20px',
            background: 'var(--accent-green)',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: loading || !teamName.trim() ? 0.5 : 1,
            fontFamily: 'Inter, sans-serif'
          }}
        >
          <Search size={14} />
          {loading ? 'Buscando...' : 'Buscar Padroes'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', background: '#2d1015',
          border: '1px solid var(--accent-red)', borderRadius: 8,
          color: 'var(--accent-red)', fontSize: 13
        }}>
          {error}
        </div>
      )}

      {result && <PatternResults data={result} />}
    </div>
  )
}

function PatternResults({ data }) {
  return (
    <div>
      {/* Header */}
      <div style={{
        padding: 14, background: 'var(--bg-secondary)',
        borderRadius: 10, marginBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)' }}>{data.team}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{data.matches_analyzed} partidas analisadas</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
          {data.patterns.length} padrao(oes) encontrado(s)
        </div>
      </div>

      {/* Partidas analisadas */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Partidas analisadas:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {data.per_match.map((m, i) => (
            <div key={i} style={{
              padding: '5px 10px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 6,
              fontSize: 11, color: 'var(--text-primary)'
            }}>
              vs {m.opponent}
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({m.formation})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Padrões encontrados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {data.patterns.map((p, i) => (
          <div key={i} style={{
            padding: 14, background: 'var(--bg-secondary)',
            borderRadius: 10,
            borderLeft: `3px solid ${CONFIDENCE_COLORS[p.confidence] || 'var(--border)'}`
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6
            }}>
              <span style={{ color: CONFIDENCE_COLORS[p.confidence] }}>
                {ICON_MAP[p.type] || <TrendingUp size={16} />}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {p.title}
              </span>
              <span style={{
                marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                padding: '2px 6px', borderRadius: 4,
                background: CONFIDENCE_COLORS[p.confidence] + '22',
                color: CONFIDENCE_COLORS[p.confidence]
              }}>
                {p.confidence}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {p.detail}
            </p>
          </div>
        ))}
      </div>

      {/* Stats por partida */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Evolucao por partida:
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 11,
          color: 'var(--text-primary)'
        }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={thStyle}>Adversario</th>
              <th style={thStyle}>Formacao</th>
              <th style={thStyle}>Compact.</th>
              <th style={thStyle}>Largura</th>
              <th style={thStyle}>Prof.</th>
              <th style={thStyle}>Pressing</th>
            </tr>
          </thead>
          <tbody>
            {data.per_match.map((m, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle}>{m.opponent}</td>
                <td style={tdStyle}>{m.formation}</td>
                <td style={tdStyle}>{m.compactness}m2</td>
                <td style={tdStyle}>{m.width}m</td>
                <td style={tdStyle}>{m.depth}m</td>
                <td style={tdStyle}>{m.pressing}m</td>
              </tr>
            ))}
            {/* Média */}
            <tr style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
              <td style={tdStyle}>MEDIA</td>
              <td style={tdStyle}>{data.top_formations?.[0]?.formation || '?'}</td>
              <td style={tdStyle}>{data.stats.compactness.avg}m2</td>
              <td style={tdStyle}>{data.stats.width.avg}m</td>
              <td style={tdStyle}>{data.stats.depth.avg}m</td>
              <td style={tdStyle}>{data.stats.pressing.avg}m</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Formações */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Formacoes mais usadas:
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {data.top_formations?.slice(0, 4).map((f, i) => (
            <div key={i} style={{
              flex: 1, padding: '8px 10px', background: 'var(--bg-secondary)',
              borderRadius: 8, textAlign: 'center'
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: i === 0 ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                {f.formation}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.percent}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const thStyle = { textAlign: 'left', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500 }
const tdStyle = { padding: '8px 6px' }
