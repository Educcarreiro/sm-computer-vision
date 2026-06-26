import { useState } from 'react'
import { Search, Brain, Zap, Shield, Target, TrendingUp, ArrowUpDown, Maximize2 } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

const ICONS = {
  brain: <Brain size={16} />,
  zap: <Zap size={16} />,
  shield: <Shield size={16} />,
  target: <Target size={16} />,
  trend: <TrendingUp size={16} />,
}

const CONFIDENCE = {
  alta: { color: 'var(--accent-green)', label: 'ALTA' },
  media: { color: 'var(--accent-yellow)', label: 'MEDIA' },
  baixa: { color: 'var(--accent-red)', label: 'BAIXA' },
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
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { throw new Error('Resposta invalida') }
      if (data.error) setError(data.error)
      else setResult(data)
    } catch (e) {
      setError(e.message || 'Erro ao conectar')
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
        Analise Tatica Profunda
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Cruza dados do mesmo time em partidas diferentes para identificar padroes de jogo, jogadas ensaiadas e tendencias taticas
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Nome do time (ex: Brasil, Japao)"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          style={{
            flex: 1, padding: '10px 14px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-primary)',
            fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif'
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
          {loading ? 'Analisando...' : 'Analisar Padroes'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', background: '#2d1015',
          border: '1px solid var(--accent-red)', borderRadius: 8,
          color: 'var(--accent-red)', fontSize: 13
        }}>{error}</div>
      )}

      {result && <FullReport data={result} />}
    </div>
  )
}

function FullReport({ data }) {
  return (
    <div>
      {/* Header */}
      <div style={{
        padding: 16, background: 'var(--bg-secondary)',
        borderRadius: 12, marginBottom: 20,
        borderLeft: '4px solid var(--accent-green)'
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-green)' }}>{data.team}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          {data.matches_analyzed} partidas analisadas
          <span style={{ margin: '0 8px', color: 'var(--border)' }}>|</span>
          {data.per_match.map(m => `vs ${m.opponent}`).join(', ')}
        </div>
      </div>

      {/* Insights por categoria */}
      {data.insights?.map((section, si) => (
        <div key={si} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--accent-cyan)',
            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
            textTransform: 'uppercase', letterSpacing: 1
          }}>
            {ICONS[section.icon] || <TrendingUp size={16} />}
            {section.category}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {section.items.map((item, ii) => {
              const conf = CONFIDENCE[item.confidence] || CONFIDENCE.media
              return (
                <div key={ii} style={{
                  padding: 16, background: 'var(--bg-secondary)',
                  borderRadius: 10,
                  borderLeft: `3px solid ${conf.color}`
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', marginBottom: 8
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                      {item.title}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 6px',
                      borderRadius: 4, marginLeft: 8, flexShrink: 0,
                      background: conf.color + '22', color: conf.color
                    }}>
                      {conf.label}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 13, color: 'var(--text-secondary)',
                    lineHeight: 1.7, margin: 0
                  }}>
                    {item.detail}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Evolução por partida */}
      <div style={{ marginTop: 10, marginBottom: 20 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'var(--accent-cyan)',
          marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1
        }}>
          EVOLUCAO POR PARTIDA
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Adversario', 'Formacao', 'Compact.', 'Largura', 'Prof.', 'Pressing'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.per_match.map((m, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td}>{m.opponent}</td>
                  <td style={td}><span style={{ background: 'var(--accent-cyan)22', color: 'var(--accent-cyan)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{m.formation}</span></td>
                  <td style={td}>{m.compactness}m2</td>
                  <td style={td}>{m.width}m</td>
                  <td style={td}>{m.depth}m</td>
                  <td style={td}>{m.pressing}m</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td style={{ ...td, color: 'var(--accent-green)' }}>MEDIA</td>
                <td style={{ ...td, color: 'var(--accent-green)' }}>{data.top_formations?.[0]?.formation || '?'}</td>
                <td style={{ ...td, color: 'var(--accent-green)' }}>{data.stats?.compact?.avg}m2</td>
                <td style={{ ...td, color: 'var(--accent-green)' }}>{data.stats?.width?.avg}m</td>
                <td style={{ ...td, color: 'var(--accent-green)' }}>{data.stats?.depth?.avg}m</td>
                <td style={{ ...td, color: 'var(--accent-green)' }}>{data.stats?.pressing?.avg}m</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Formações */}
      <div>
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'var(--accent-cyan)',
          marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1
        }}>
          FORMACOES MAIS USADAS
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {data.top_formations?.slice(0, 5).map((f, i) => (
            <div key={i} style={{
              flex: 1, padding: '10px', background: 'var(--bg-secondary)',
              borderRadius: 8, textAlign: 'center',
              border: i === 0 ? '1px solid var(--accent-green)' : '1px solid var(--border)'
            }}>
              <div style={{
                fontSize: 18, fontWeight: 800,
                color: i === 0 ? 'var(--accent-green)' : 'var(--text-primary)'
              }}>{f.formation}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{f.percent}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const td = { padding: '10px 8px', color: 'var(--text-primary)' }
