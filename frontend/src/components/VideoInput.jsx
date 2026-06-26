import { useState } from 'react'
import { Play, Link, Users, Crosshair, Loader2 } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

export default function VideoInput({ onSubmit, disabled }) {
  const [url, setUrl] = useState('')
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [calibrating, setCalibrating] = useState(false)
  const [calibData, setCalibData] = useState(null)
  const [selectedCluster, setSelectedCluster] = useState({})

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!url.trim()) return
    const calibration = selectedCluster.team_a_cluster !== undefined ? selectedCluster : null
    onSubmit(url, teamA || 'Team A', teamB || 'Team B', calibration)
    setCalibData(null)
    setSelectedCluster({})
  }

  const handleCalibrate = async () => {
    if (!url.trim()) return
    setCalibrating(true)
    try {
      const res = await fetch(`${API}/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        setCalibData(data)
      }
    } catch {
      alert('Erro ao conectar com o backend')
    }
    setCalibrating(false)
  }

  const assignCluster = (cluster, team) => {
    if (team === 'a') {
      setSelectedCluster({ team_a_cluster: cluster, team_b_cluster: 1 - cluster })
    } else {
      setSelectedCluster({ team_a_cluster: 1 - cluster, team_b_cluster: cluster })
    }
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
        Analise Tatica por Video
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
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

      {/* Botão de calibração */}
      {!calibData && (
        <button
          type="button"
          onClick={handleCalibrate}
          disabled={disabled || calibrating || !url.trim()}
          style={{
            width: '100%',
            padding: '10px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--accent-cyan)',
            fontSize: 13,
            fontWeight: 500,
            cursor: disabled || calibrating ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginBottom: 12,
            fontFamily: 'Inter, sans-serif',
            opacity: disabled || calibrating ? 0.5 : 1
          }}
        >
          {calibrating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Crosshair size={16} />}
          {calibrating ? 'Detectando jogadores...' : 'Calibrar times (opcional)'}
        </button>
      )}

      {/* Calibração visual */}
      {calibData && (
        <div style={{
          marginBottom: 16,
          padding: 14,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 10
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Clique em um jogador para identificar qual time ele pertence:
          </p>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <img
              src={`data:image/jpeg;base64,${calibData.frame}`}
              style={{ width: '100%', borderRadius: 8 }}
              alt="Calibration frame"
            />
            {calibData.players.map(p => (
              <div
                key={p.id}
                onClick={() => assignCluster(p.cluster, 'a')}
                style={{
                  position: 'absolute',
                  left: `${(p.x / calibData.width) * 100}%`,
                  top: `${(p.y / calibData.height) * 100}%`,
                  width: 20, height: 20,
                  borderRadius: '50%',
                  border: `2px solid ${p.cluster === 0 ? '#FFc832' : '#3232FF'}`,
                  background: selectedCluster.team_a_cluster === p.cluster ? 'var(--accent-cyan)44' : 'transparent',
                  cursor: 'pointer',
                  transform: 'translate(-50%, -50%)',
                  transition: 'background 0.2s'
                }}
                title={`Jogador ${p.id} - Cluster ${p.cluster}`}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => assignCluster(0, 'a')}
              style={{
                flex: 1, padding: '8px',
                background: selectedCluster.team_a_cluster === 0 ? '#FFc83233' : 'var(--bg-card)',
                border: `2px solid ${selectedCluster.team_a_cluster === 0 ? '#FFc832' : 'var(--border)'}`,
                borderRadius: 8, cursor: 'pointer',
                color: 'var(--text-primary)', fontSize: 12, fontFamily: 'Inter',
                fontWeight: selectedCluster.team_a_cluster === 0 ? 600 : 400
              }}
            >
              Amarelo = {teamA || 'Time A'}
            </button>
            <button
              type="button"
              onClick={() => assignCluster(1, 'a')}
              style={{
                flex: 1, padding: '8px',
                background: selectedCluster.team_a_cluster === 1 ? '#3232FF33' : 'var(--bg-card)',
                border: `2px solid ${selectedCluster.team_a_cluster === 1 ? '#3232FF' : 'var(--border)'}`,
                borderRadius: 8, cursor: 'pointer',
                color: 'var(--text-primary)', fontSize: 12, fontFamily: 'Inter',
                fontWeight: selectedCluster.team_a_cluster === 1 ? 600 : 400
              }}
            >
              Azul = {teamA || 'Time A'}
            </button>
          </div>

          {selectedCluster.team_a_cluster !== undefined && (
            <p style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 8, textAlign: 'center' }}>
              {teamA || 'Time A'} = Cluster {selectedCluster.team_a_cluster} | {teamB || 'Time B'} = Cluster {selectedCluster.team_b_cluster}
            </p>
          )}

          <button
            type="button"
            onClick={() => { setCalibData(null); setSelectedCluster({}) }}
            style={{
              marginTop: 8, padding: '4px 10px',
              background: 'none', border: 'none',
              color: 'var(--text-muted)', fontSize: 11,
              cursor: 'pointer', fontFamily: 'Inter'
            }}
          >
            Cancelar calibracao
          </button>
        </div>
      )}

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
          opacity: disabled ? 0.5 : 1,
          fontFamily: 'Inter, sans-serif'
        }}
      >
        <Play size={18} />
        Analisar Video
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </form>
  )
}

const labelStyle = {
  fontSize: 12, fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 6, display: 'flex', alignItems: 'center'
}

const inputStyle = {
  width: '100%', padding: '10px 14px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text-primary)',
  fontSize: 14, outline: 'none', marginTop: 4,
  fontFamily: 'Inter, sans-serif'
}
