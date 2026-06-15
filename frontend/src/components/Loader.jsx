import { useState, useEffect } from 'react'

const STEPS = [
  'INITIALIZING MARKET FEED...',
  'FETCHING LIVE INDEX DATA...',
  'COMPUTING SIGNALS...',
  'SCORING OPPORTUNITY SET...',
  'BUILDING DASHBOARD...',
]

export default function Loader({ isLoading }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isLoading) { setProgress(0); setStepIndex(0); return }
    const st = setInterval(() => setStepIndex(i => (i + 1) % STEPS.length), 1500)
    const pt = setInterval(() => setProgress(p => p >= 99 ? 99 : p + 1), 35)
    return () => { clearInterval(st); clearInterval(pt) }
  }, [isLoading])

  if (!isLoading) return null

  const filled = Math.floor(progress / 5)
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled)

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(7,9,13,0.97)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    }}>
      <svg width="180" height="180" viewBox="0 0 200 200" style={{ marginBottom: 36 }}>
        {[80, 55, 30].map(r => (
          <circle key={r} cx="100" cy="100" r={r} stroke="#1A1F2B" strokeWidth="1" fill="none" />
        ))}
        <line x1="100" y1="20" x2="100" y2="180" stroke="#1A1F2B" strokeWidth="0.5" />
        <line x1="20" y1="100" x2="180" y2="100" stroke="#1A1F2B" strokeWidth="0.5" />
        <g style={{ transformOrigin: '100px 100px', animation: 'radarSweep 2s linear infinite' }}>
          <line x1="100" y1="100" x2="100" y2="22" stroke="#00E5A0" strokeWidth="2" strokeLinecap="round" />
          <path d="M 100 100 L 100 22 A 78 78 0 0 1 140 135 Z" fill="url(#rsweep)" opacity="0.12" />
          <defs>
            <radialGradient id="rsweep" cx="50%" cy="100%" r="50%">
              <stop offset="0%" stopColor="#00E5A0" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#00E5A0" stopOpacity="0" />
            </radialGradient>
          </defs>
        </g>
        <circle cx="100" cy="100" r="80" stroke="#00E5A0" strokeWidth="1" fill="none" opacity="0.15" />
        <circle cx="100" cy="100" r="4" fill="#00E5A0" style={{ animation: 'pulse 1.5s infinite' }} />
      </svg>

      <div key={stepIndex} style={{
        fontSize: 11, color: '#00E5A0',
        letterSpacing: 3, marginBottom: 20,
        overflow: 'hidden', whiteSpace: 'nowrap',
        animation: 'typewriter 1.4s steps(40) forwards',
      }}>
        {STEPS[stepIndex]}
      </div>

      <div style={{ fontSize: 11, color: '#4B5563', letterSpacing: 1 }}>
        [{bar}]{' '}
        <span style={{ color: '#00E5A0' }}>{progress}%</span>
        {' '}COMPLETE
      </div>

      <div style={{ marginTop: 24, fontSize: 9, color: '#1A1F2B', letterSpacing: 2 }}>
        SWING INTELLIGENCE TERMINAL v2.0
      </div>
    </div>
  )
}
