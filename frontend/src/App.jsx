import { useState, useEffect } from 'react'
import Header from './components/Header'
import VideoInput from './components/VideoInput'
import ProcessingStatus from './components/ProcessingStatus'
import TacticalReport from './components/TacticalReport'
import VideoPlayer from './components/VideoPlayer'
import Gallery from './components/Gallery'
import Compare from './components/Compare'
import './App.css'

const API = import.meta.env.VITE_API_URL || '/api'

function App() {
  const [jobId, setJobId] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)

  useEffect(() => {
    if (!jobId) return
    const interval = setInterval(() => {
      fetch(`${API}/status/${jobId}`)
        .then(r => r.json())
        .then(data => {
          setJobStatus(data)
          if (data.status === 'done' || data.status === 'error') {
            clearInterval(interval)
          }
        })
        .catch(() => {})
    }, 2000)
    return () => clearInterval(interval)
  }, [jobId])

  const handleSubmit = async (url, teamA, teamB, calibration) => {
    const body = { url, team_a: teamA, team_b: teamB }
    if (calibration) body.calibration = calibration
    const res = await fetch(`${API}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    setJobId(data.job_id)
    setJobStatus({ status: 'queued', progress: 0 })
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

        <Compare />
        <Gallery />
      </main>
    </div>
  )
}

export default App
