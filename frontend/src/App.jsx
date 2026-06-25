import { useState, useEffect } from 'react'
import Header from './components/Header'
import VideoInput from './components/VideoInput'
import ProcessingStatus from './components/ProcessingStatus'
import TacticalReport from './components/TacticalReport'
import VideoPlayer from './components/VideoPlayer'
import History from './components/History'
import Gallery from './components/Gallery'
import './App.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function App() {
  const [jobId, setJobId] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)
  const [history, setHistory] = useState({})

  useEffect(() => {
    fetch(`${API}/jobs`)
      .then(r => r.json())
      .then(setHistory)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!jobId) return
    const interval = setInterval(() => {
      fetch(`${API}/status/${jobId}`)
        .then(r => r.json())
        .then(data => {
          setJobStatus(data)
          if (data.status === 'done' || data.status === 'error') {
            clearInterval(interval)
            if (data.status === 'done') {
              setHistory(prev => ({ ...prev, [jobId]: data }))
            }
          }
        })
        .catch(() => {})
    }, 2000)
    return () => clearInterval(interval)
  }, [jobId])

  const handleSubmit = async (url, teamA, teamB) => {
    const res = await fetch(`${API}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, team_a: teamA, team_b: teamB })
    })
    const data = await res.json()
    setJobId(data.job_id)
    setJobStatus({ status: 'queued', progress: 0 })
  }

  const loadFromHistory = (id, data) => {
    setJobId(id)
    setJobStatus(data)
  }

  const isProcessing = jobStatus && !['done', 'error'].includes(jobStatus.status)
  const isDone = jobStatus?.status === 'done'

  return (
    <div className="app">
      <Header />
      <main className="main">
        <VideoInput onSubmit={handleSubmit} disabled={isProcessing} />

        {isProcessing && <ProcessingStatus status={jobStatus} />}

        {jobStatus?.status === 'error' && (
          <div className="error-card">
            <p>Erro: {jobStatus.error}</p>
          </div>
        )}

        {isDone && (
          <div className="results">
            <div className="results-grid">
              <VideoPlayer src={`${API}/video/${jobStatus.video}`} />
              <TacticalReport report={jobStatus.report} />
            </div>
          </div>
        )}

        <Gallery />

        {Object.keys(history).length > 0 && (
          <History items={history} onLoad={loadFromHistory} apiBase={API} />
        )}
      </main>
    </div>
  )
}

export default App
