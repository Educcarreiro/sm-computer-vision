import { useState, useEffect } from 'react'
import { GitCompare, ArrowRight } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function Compare() {
  const [gallery, setGallery] = useState([])
  const [sel1, setSel1] = useState({ id: '', team: '' })
  const [sel2, setSel2] = useState({ id: '', team: '' })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/gallery`).then(r => r.json()).catch(() => []),
      fetch(`${API}/jobs`).then(r => r.json()).catch(() => ({}))
    ]).then(([gal, jobs]) => {
      const items = Array.isArray(gal) ? [...gal] : []
      Object.entries(jobs).forEach(([id, job]) => {
        if (job.status === 'done' && !items.find(i => i.id === id)) {
          items.push({ id, report: job.report })
        }
      })
      setGallery(items)
    })
  }, [])

  const getTeams = (analysisId) => {
    const item = gallery.find(g => g.id === analysisId)
    if (!item?.report) return []
    return [
      { key: 'team_a', name: item.report.team_a?.name || 'Team A' },
      { key: 'team_b', name: item.report.team_b?.name || 'Team B' }
    ]
  }

  const handleCompare = async () => {
    if (!sel1.id || !sel1.team || !sel2.id || !sel2.team) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analyses: [
            { id: sel1.id, team: sel1.team },
            { id: sel2.id, team: sel2.team }
          ]
        })
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        setResult(data)
      }
    } catch {
      alert('Erro ao comparar')
    }
    setLoading(false)
  }

  if (gallery.length < 1) return null

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: 20
    }}>
      <h3 style={{
        fontSize: 15, fontWeight: 600, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <GitCompare size={18} color="var(--accent-purple)" />
        Comparar Times (entre videos diferentes)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'end', marginBottom: 16 }}>
        <SelectorBlock
          label="Time 1"
          gallery={gallery}
          selected={sel1}
          onChange={setSel1}
          getTeams={getTeams}
        />
        <ArrowRight size={20} color="var(--text-muted)" style={{ marginBottom: 8 }} />
        <SelectorBlock
          label="Time 2"
          gallery={gallery}
          selected={sel2}
          onChange={setSel2}
          getTeams={getTeams}
        />
      </div>

      <button
        onClick={handleCompare}
        disabled={!sel1.id || !sel1.team || !sel2.id || !sel2.team || loading}
        style={{
          width: '100%', padding: '10px',
          background: sel1.team && sel2.team ? 'var(--accent-purple)' : 'var(--text-muted)',
          color: '#fff', border: 'none', borderRadius: 8,
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          opacity: sel1.team && sel2.team ? 1 : 0.4,
          fontFamily: 'Inter, sans-serif'
        }}
      >
        {loading ? 'Comparando...' : 'Comparar'}
      </button>

      {result && <CompareResult data={result} />}
    </div>
  )
}

function SelectorBlock({ label, gallery, selected, onChange, getTeams }) {
  const teams = selected.id ? getTeams(selected.id) : []

  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
        {label}
      </label>
      <select
        value={selected.id}
        onChange={e => onChange({ id: e.target.value, team: '' })}
        style={selectStyle}
      >
        <option value="">Selecione analise...</option>
        {gallery.map(g => {
          const ta = g.report?.team_a?.name || '?'
          const tb = g.report?.team_b?.name || '?'
          return <option key={g.id} value={g.id}>{ta} vs {tb}</option>
        })}
      </select>
      {teams.length > 0 && (
        <select
          value={selected.team}
          onChange={e => onChange({ ...selected, team: e.target.value })}
          style={{ ...selectStyle, marginTop: 6 }}
        >
          <option value="">Qual time?</option>
          {teams.map(t => (
            <option key={t.key} value={t.key}>{t.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}

function CompareResult({ data }) {
  if (!data.teams || data.teams.length < 2) return null
  const [t1, t2] = data.teams
  const comp = data.comparison

  return (
    <div style={{
      marginTop: 16, padding: 16,
      background: 'var(--bg-secondary)',
      borderRadius: 10
    }}>
      <h4 style={{
        fontSize: 14, fontWeight: 700, marginBottom: 12,
        textAlign: 'center', color: 'var(--accent-purple)'
      }}>
        {t1.name} vs {t2.name}
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CompareRow label="Compactacao" v1={`${t1.compactness}m2`} v2={`${t2.compactness}m2`} winner={comp.compactness.winner} n1={t1.name} n2={t2.name} />
        <CompareRow label="Largura" v1={`${t1.width}m`} v2={`${t2.width}m`} winner={comp.width.winner} n1={t1.name} n2={t2.name} />
        <CompareRow label="Profundidade" v1={`${t1.depth}m`} v2={`${t2.depth}m`} winner={comp.depth.winner} n1={t1.name} n2={t2.name} />
        <CompareRow label="Pressing" v1={`${t1.pressing}m`} v2={`${t2.pressing}m`} winner={comp.pressing.winner} n1={t1.name} n2={t2.name} />
      </div>
    </div>
  )
}

function CompareRow({ label, v1, v2, winner, n1, n2 }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      gap: 8, alignItems: 'center', padding: '6px 0',
      borderBottom: '1px solid var(--border)'
    }}>
      <div style={{
        textAlign: 'right', fontSize: 13, fontWeight: winner === n1 ? 700 : 400,
        color: winner === n1 ? 'var(--accent-green)' : 'var(--text-secondary)'
      }}>
        {v1}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', minWidth: 80 }}>
        {label}
      </div>
      <div style={{
        textAlign: 'left', fontSize: 13, fontWeight: winner === n2 ? 700 : 400,
        color: winner === n2 ? 'var(--accent-green)' : 'var(--text-secondary)'
      }}>
        {v2}
      </div>
    </div>
  )
}

const selectStyle = {
  width: '100%', padding: '8px 10px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text-primary)',
  fontSize: 12, fontFamily: 'Inter, sans-serif',
  outline: 'none'
}
