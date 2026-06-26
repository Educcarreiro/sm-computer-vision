import { useState, useEffect } from 'react'
import { GitCompare, Play, Link, Users, Palette, Loader2 } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

const COLORS = [
  { value: 'amarelo', label: 'Amarelo', hex: '#f5c518' },
  { value: 'azul', label: 'Azul', hex: '#2563eb' },
  { value: 'vermelho', label: 'Vermelho', hex: '#dc2626' },
  { value: 'branco', label: 'Branco', hex: '#e5e5e5' },
  { value: 'preto', label: 'Preto', hex: '#333' },
  { value: 'verde', label: 'Verde', hex: '#16a34a' },
  { value: 'laranja', label: 'Laranja', hex: '#ea580c' },
  { value: 'roxo', label: 'Roxo', hex: '#7c3aed' },
  { value: 'cinza', label: 'Cinza', hex: '#6b7280' },
  { value: 'vinho', label: 'Vinho', hex: '#881337' },
]

export default function Compare() {
  const [side1, setSide1] = useState({ url: '', team: '', color: '', opponent: '' })
  const [side2, setSide2] = useState({ url: '', team: '', color: '', opponent: '' })
  const [job1, setJob1] = useState(null)
  const [job2, setJob2] = useState(null)
  const [status1, setStatus1] = useState(null)
  const [status2, setStatus2] = useState(null)
  const [comparison, setComparison] = useState(null)

  useEffect(() => {
    if (!job1) return
    const iv = setInterval(() => {
      fetch(`${API}/status/${job1}`).then(r => r.json()).then(d => {
        setStatus1(d)
        if (d.status === 'done' || d.status === 'error') clearInterval(iv)
      }).catch(() => {})
    }, 2000)
    return () => clearInterval(iv)
  }, [job1])

  useEffect(() => {
    if (!job2) return
    const iv = setInterval(() => {
      fetch(`${API}/status/${job2}`).then(r => r.json()).then(d => {
        setStatus2(d)
        if (d.status === 'done' || d.status === 'error') clearInterval(iv)
      }).catch(() => {})
    }, 2000)
    return () => clearInterval(iv)
  }, [job2])

  useEffect(() => {
    if (status1?.status === 'done' && status2?.status === 'done') {
      buildComparison()
    }
  }, [status1, status2])

  const [submitting, setSubmitting] = useState(false)

  const startBoth = async () => {
    if (!side1.url || !side2.url || !side1.team || !side2.team) return
    setComparison(null)
    setSubmitting(true)
    setStatus1(null)
    setStatus2(null)
    setJob1(null)
    setJob2(null)

    try {
      const makeRequest = async (side) => {
        const res = await fetch(`${API}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: side.url,
            team_a: side.team,
            team_b: side.opponent || 'Adversario',
            jersey_color: side.color || undefined
          })
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        try { return JSON.parse(text) }
        catch { throw new Error('Resposta invalida do servidor') }
      }

      const [r1, r2] = await Promise.all([makeRequest(side1), makeRequest(side2)])

      setJob1(r1.job_id)
      setJob2(r2.job_id)
      setStatus1({ status: 'queued', progress: 0 })
      setStatus2({ status: 'queued', progress: 0 })
    } catch (err) {
      console.error('Compare error:', err)
      setStatus1({ status: 'error', error: err.message || 'Erro ao conectar' })
      setStatus2({ status: 'error', error: err.message || 'Erro ao conectar' })
    }
    setSubmitting(false)
  }

  const buildComparison = () => {
    if (!status1?.report?.team_a || !status2?.report?.team_a) return
    const t1 = status1.report.team_a
    const t2 = status2.report.team_a

    setComparison({
      teams: [t1, t2],
      rows: [
        { label: 'Compactacao', v1: t1.compactness, v2: t2.compactness, unit: 'm2', better: 'lower' },
        { label: 'Largura', v1: t1.width, v2: t2.width, unit: 'm', better: 'higher' },
        { label: 'Profundidade', v1: t1.depth, v2: t2.depth, unit: 'm', better: 'higher' },
        { label: 'Pressing', v1: t1.pressing, v2: t2.pressing, unit: 'm', better: 'lower' },
        { label: 'Jogadores med.', v1: t1.players_avg, v2: t2.players_avg, unit: '', better: 'none' },
      ]
    })
  }

  const processing = submitting ||
                     (status1 && !['done', 'error'].includes(status1.status)) ||
                     (status2 && !['done', 'error'].includes(status2.status))
  const canStart = side1.url && side2.url && side1.team && side2.team && !processing

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16, padding: 24
    }}>
      <h3 style={{
        fontSize: 15, fontWeight: 600, marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <GitCompare size={18} color="var(--accent-purple)" />
        Comparar Times de Videos Diferentes
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <SideBlock
          label="Video 1"
          color="var(--accent-cyan)"
          side={side1}
          onChange={setSide1}
          status={status1}
          disabled={processing}
        />
        <SideBlock
          label="Video 2"
          color="var(--accent-purple)"
          side={side2}
          onChange={setSide2}
          status={status2}
          disabled={processing}
        />
      </div>

      <button
        onClick={startBoth}
        disabled={!canStart}
        style={{
          width: '100%', padding: '12px',
          background: canStart ? 'var(--accent-purple)' : 'var(--text-muted)',
          color: '#fff', border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 600, cursor: canStart ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: canStart ? 1 : 0.4,
          fontFamily: 'Inter, sans-serif'
        }}
      >
        {processing ? (
          <>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Processando... (V1: {status1?.progress || 0}% | V2: {status2?.progress || 0}%)
          </>
        ) : (
          <><Play size={16} /> Analisar e Comparar</>
        )}
      </button>

      {(status1?.status === 'error' || status2?.status === 'error') && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--accent-red)' }}>
          {status1?.status === 'error' && <p>Video 1: {status1.error}</p>}
          {status2?.status === 'error' && <p>Video 2: {status2.error}</p>}
        </div>
      )}

      {comparison && <ComparisonResult data={comparison} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function SideBlock({ label, color, side, onChange, status, disabled }) {
  const isDone = status?.status === 'done'
  const isProcessing = status && !['done', 'error'].includes(status.status)

  return (
    <div style={{
      padding: 14, background: 'var(--bg-secondary)',
      borderRadius: 10, borderTop: `3px solid ${color}`
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color, marginBottom: 10 }}>{label}</div>

      <div style={{ marginBottom: 8 }}>
        <label style={miniLabel}><Link size={11} /> URL do jogo</label>
        <input
          type="text" placeholder="https://youtu.be/..."
          value={side.url}
          onChange={e => onChange({ ...side, url: e.target.value })}
          disabled={disabled} style={inputStyle}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div>
          <label style={miniLabel}><Users size={11} /> Time que quero analisar</label>
          <input
            type="text" placeholder="Ex: Brasil"
            value={side.team}
            onChange={e => onChange({ ...side, team: e.target.value })}
            disabled={disabled} style={inputStyle}
          />
        </div>
        <div>
          <label style={miniLabel}><Users size={11} /> Adversario</label>
          <input
            type="text" placeholder="Ex: Escocia"
            value={side.opponent}
            onChange={e => onChange({ ...side, opponent: e.target.value })}
            disabled={disabled} style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={miniLabel}><Palette size={11} /> Cor da camisa do time analisado</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => onChange({ ...side, color: c.value })}
              disabled={disabled}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: side.color === c.value ? `2px solid ${color}` : '1px solid var(--border)',
                background: side.color === c.value ? color + '22' : 'var(--bg-card)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontFamily: 'Inter, sans-serif',
                color: 'var(--text-primary)'
              }}
            >
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: c.hex,
                border: c.value === 'branco' ? '1px solid var(--text-muted)' : 'none'
              }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {isProcessing && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          Processando... {status.progress}%
        </div>
      )}
      {isDone && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--accent-green)', fontWeight: 600 }}>
          Concluido - {status.report?.team_a?.name}
        </div>
      )}
    </div>
  )
}

function ComparisonResult({ data }) {
  const [t1, t2] = data.teams

  return (
    <div style={{
      marginTop: 20, padding: 20,
      background: 'var(--bg-secondary)',
      borderRadius: 12
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        gap: 12, marginBottom: 20, textAlign: 'center'
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-cyan)' }}>{t1.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, alignSelf: 'center' }}>VS</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-purple)' }}>{t2.name}</div>
      </div>

      {data.rows.map(row => (
        <CompareBar key={row.label} row={row} name1={t1.name} name2={t2.name} />
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: 6 }}>Formacoes {t1.name}</div>
          {t1.formations?.slice(0, 3).map((f, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>
              {f.formation} <span style={{ color: 'var(--text-muted)' }}>({f.percent}%)</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--accent-purple)', fontWeight: 600, marginBottom: 6 }}>Formacoes {t2.name}</div>
          {t2.formations?.slice(0, 3).map((f, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>
              {f.formation} <span style={{ color: 'var(--text-muted)' }}>({f.percent}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CompareBar({ row, name1, name2 }) {
  const { label, v1, v2, unit, better } = row
  const total = (v1 || 1) + (v2 || 1)
  const pct1 = ((v1 || 0) / total) * 100

  let win1 = false, win2 = false
  if (better === 'lower') { win1 = v1 < v2; win2 = v2 < v1 }
  else if (better === 'higher') { win1 = v1 > v2; win2 = v2 > v1 }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{
          fontSize: 13, fontWeight: win1 ? 700 : 400,
          color: win1 ? 'var(--accent-cyan)' : 'var(--text-secondary)'
        }}>
          {v1}{unit}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
        <span style={{
          fontSize: 13, fontWeight: win2 ? 700 : 400,
          color: win2 ? 'var(--accent-purple)' : 'var(--text-secondary)'
        }}>
          {v2}{unit}
        </span>
      </div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 }}>
        <div style={{ width: `${pct1}%`, background: win1 ? 'var(--accent-cyan)' : 'var(--border)', borderRadius: 3, transition: 'width 0.5s' }} />
        <div style={{ width: `${100 - pct1}%`, background: win2 ? 'var(--accent-purple)' : 'var(--border)', borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

const miniLabel = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3 }
const inputStyle = {
  width: '100%', padding: '7px 10px',
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text-primary)',
  fontSize: 12, outline: 'none', fontFamily: 'Inter, sans-serif'
}
