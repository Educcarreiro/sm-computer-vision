import { useState, useEffect } from 'react'
import { GitCompare, Play, Link, Users, Loader2 } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function Compare() {
  const [video1, setVideo1] = useState({ url: '', teamA: '', teamB: '' })
  const [video2, setVideo2] = useState({ url: '', teamA: '', teamB: '' })
  const [job1, setJob1] = useState(null)
  const [job2, setJob2] = useState(null)
  const [status1, setStatus1] = useState(null)
  const [status2, setStatus2] = useState(null)
  const [pick1, setPick1] = useState('')
  const [pick2, setPick2] = useState('')
  const [comparison, setComparison] = useState(null)

  // Poll job 1
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

  // Poll job 2
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

  const startBoth = async () => {
    if (!video1.url || !video2.url) return
    setComparison(null)
    setPick1('')
    setPick2('')

    const r1 = await fetch(`${API}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: video1.url, team_a: video1.teamA || 'Time A', team_b: video1.teamB || 'Time B' })
    }).then(r => r.json())

    const r2 = await fetch(`${API}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: video2.url, team_a: video2.teamA || 'Time A', team_b: video2.teamB || 'Time B' })
    }).then(r => r.json())

    setJob1(r1.job_id)
    setJob2(r2.job_id)
    setStatus1({ status: 'queued', progress: 0 })
    setStatus2({ status: 'queued', progress: 0 })
  }

  const bothDone = status1?.status === 'done' && status2?.status === 'done'

  const doCompare = () => {
    if (!pick1 || !pick2 || !status1?.report || !status2?.report) return
    const t1 = status1.report[pick1]
    const t2 = status2.report[pick2]
    if (!t1 || !t2) return

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

  const processing1 = status1 && !['done', 'error'].includes(status1.status)
  const processing2 = status2 && !['done', 'error'].includes(status2.status)

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: 24
    }}>
      <h3 style={{
        fontSize: 15, fontWeight: 600, marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <GitCompare size={18} color="var(--accent-purple)" />
        Comparar Times de Videos Diferentes
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <VideoBlock
          label="Video 1"
          color="var(--accent-cyan)"
          video={video1}
          onChange={setVideo1}
          status={status1}
          disabled={processing1 || processing2}
        />
        <VideoBlock
          label="Video 2"
          color="var(--accent-purple)"
          video={video2}
          onChange={setVideo2}
          status={status2}
          disabled={processing1 || processing2}
        />
      </div>

      {/* Botão processar ambos */}
      {!bothDone && (
        <button
          onClick={startBoth}
          disabled={!video1.url || !video2.url || processing1 || processing2}
          style={{
            width: '100%', padding: '12px',
            background: (!video1.url || !video2.url || processing1 || processing2) ? 'var(--text-muted)' : 'var(--accent-purple)',
            color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: (!video1.url || !video2.url) ? 0.4 : 1,
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {(processing1 || processing2) ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Processando... (V1: {status1?.progress || 0}% | V2: {status2?.progress || 0}%)
            </>
          ) : (
            <><Play size={16} /> Processar Ambos</>
          )}
        </button>
      )}

      {/* Seleção de times */}
      {bothDone && !comparison && (
        <div style={{
          padding: 16, background: 'var(--bg-secondary)',
          borderRadius: 10, marginTop: 8
        }}>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--text-secondary)' }}>
            Selecione qual time de cada video quer comparar:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={miniLabel}>Do Video 1:</label>
              <select value={pick1} onChange={e => setPick1(e.target.value)} style={selectStyle}>
                <option value="">Escolha...</option>
                <option value="team_a">{status1.report.team_a?.name}</option>
                <option value="team_b">{status1.report.team_b?.name}</option>
              </select>
            </div>
            <div>
              <label style={miniLabel}>Do Video 2:</label>
              <select value={pick2} onChange={e => setPick2(e.target.value)} style={selectStyle}>
                <option value="">Escolha...</option>
                <option value="team_a">{status2.report.team_a?.name}</option>
                <option value="team_b">{status2.report.team_b?.name}</option>
              </select>
            </div>
          </div>
          <button
            onClick={doCompare}
            disabled={!pick1 || !pick2}
            style={{
              width: '100%', padding: '10px',
              background: pick1 && pick2 ? 'var(--accent-purple)' : 'var(--text-muted)',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: pick1 && pick2 ? 1 : 0.4,
              fontFamily: 'Inter, sans-serif'
            }}
          >
            Comparar
          </button>
        </div>
      )}

      {/* Resultado */}
      {comparison && <ComparisonResult data={comparison} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function VideoBlock({ label, color, video, onChange, status, disabled }) {
  const isDone = status?.status === 'done'
  const isProcessing = status && !['done', 'error'].includes(status.status)

  return (
    <div style={{
      padding: 14, background: 'var(--bg-secondary)',
      borderRadius: 10, borderTop: `3px solid ${color}`
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color, marginBottom: 10 }}>{label}</div>

      <div style={{ marginBottom: 8 }}>
        <label style={miniLabel}><Link size={11} /> URL</label>
        <input
          type="text" placeholder="https://youtu.be/..."
          value={video.url}
          onChange={e => onChange({ ...video, url: e.target.value })}
          disabled={disabled}
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div>
          <label style={miniLabel}><Users size={11} /> Time A</label>
          <input
            type="text" placeholder="Ex: Brasil"
            value={video.teamA}
            onChange={e => onChange({ ...video, teamA: e.target.value })}
            disabled={disabled}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={miniLabel}><Users size={11} /> Time B</label>
          <input
            type="text" placeholder="Ex: Japao"
            value={video.teamB}
            onChange={e => onChange({ ...video, teamB: e.target.value })}
            disabled={disabled}
            style={inputStyle}
          />
        </div>
      </div>

      {isProcessing && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          {status.progress}%
        </div>
      )}
      {isDone && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent-green)', fontWeight: 600 }}>
          Concluido
        </div>
      )}
      {status?.status === 'error' && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent-red)' }}>
          Erro: {status.error}
        </div>
      )}
    </div>
  )
}

function ComparisonResult({ data }) {
  const [t1, t2] = data.teams

  return (
    <div style={{
      marginTop: 16, padding: 20,
      background: 'var(--bg-secondary)',
      borderRadius: 12
    }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        gap: 12, marginBottom: 16, textAlign: 'center'
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-cyan)' }}>{t1.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, alignSelf: 'center' }}>VS</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-purple)' }}>{t2.name}</div>
      </div>

      {/* Barras comparativas */}
      {data.rows.map(row => (
        <CompareBar key={row.label} row={row} name1={t1.name} name2={t2.name} />
      ))}

      {/* Formações */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Formacoes {t1.name}</div>
          {t1.formations?.slice(0, 3).map((f, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-primary)' }}>
              {f.formation} <span style={{ color: 'var(--text-muted)' }}>({f.percent}%)</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Formacoes {t2.name}</div>
          {t2.formations?.slice(0, 3).map((f, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-primary)' }}>
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
  const pct2 = ((v2 || 0) / total) * 100

  let win1 = false, win2 = false
  if (better === 'lower') { win1 = v1 < v2; win2 = v2 < v1 }
  else if (better === 'higher') { win1 = v1 > v2; win2 = v2 > v1 }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{
          fontSize: 12, fontWeight: win1 ? 700 : 400,
          color: win1 ? 'var(--accent-cyan)' : 'var(--text-secondary)'
        }}>
          {v1}{unit}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
        <span style={{
          fontSize: 12, fontWeight: win2 ? 700 : 400,
          color: win2 ? 'var(--accent-purple)' : 'var(--text-secondary)'
        }}>
          {v2}{unit}
        </span>
      </div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 }}>
        <div style={{ width: `${pct1}%`, background: win1 ? 'var(--accent-cyan)' : 'var(--border)', borderRadius: 3, transition: 'width 0.5s' }} />
        <div style={{ width: `${pct2}%`, background: win2 ? 'var(--accent-purple)' : 'var(--border)', borderRadius: 3, transition: 'width 0.5s' }} />
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
const selectStyle = {
  width: '100%', padding: '8px 10px',
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text-primary)',
  fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none'
}
