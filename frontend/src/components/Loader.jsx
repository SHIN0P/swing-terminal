import { useState, useEffect } from 'react'

const STEPS = [
  'INITIALIZING MARKET DATA...',
  'FETCHING FII / DII FLOWS...',
  'COMPUTING INDICATORS...',
  'SCORING 500 STOCKS...',
  'GENERATING SETUPS...',
]

export default function Loader({ isLoading }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isLoading) { setProgress(0); setStepIndex(0); return }

    const stepTimer = setInterval(() => {
      setStepIndex(i => (i + 1) % STEPS.length)
    }, 1500)

    const progTimer = setInterval(() => {
      setProgress(p => {
        if (p >= 99) return 99
        return p + 1
      })
    }, 35)

    return () => { clearInterval(stepTimer); clearInterval(progTimer) }
  }, [isLoading])

  if (!isLoading) return null

  const filled = Math.floor(progress / 5)
  const empty = 20 - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(8,12,16,0.97)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ marginBottom: 32 }}>
        {[80, 55, 30].map(r => (
          <circle key={r} cx="100" cy="100" r={r}
            stroke="#21293A" strokeWidth="1" fill="none" />
        ))}
        <line x1="100" y1="20" x2="100" y2="180" stroke="#21293A" strokeWidth="0.5" />
        <line x1="20" y1="100" x2="180" y2="100" stroke="#21293A" strokeWidth="0.5" />
        <g style={{ transformOrigin: '100px 100px', animation: 'radarSweep 2s linear infinite' }}>
          <line x1="100" y1="100" x2="100" y2="22"
            stroke="#00E5A0" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M 100 100 L 100 22 A 78 78 0 0 1 140 135 Z"
            fill="url(#sweep)" opacity="0.15"
          />
          <defs>
            <radialGradient id="sweep" cx="50%" cy="100%" r="50%">
              <stop offset="0%" stopColor="#00E5A0" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#00E5A0" stopOpacity="0" />
            </radialGradient>
          </defs>
        </g>
        <circle cx="100" cy="100" r="80"
          stroke="#00E5A0" strokeWidth="1" fill="none" opacity="0.25" />
        <circle cx="100" cy="100" r="4"
          fill="#00E5A0"
          style={{ animation: 'pulse 1.5s infinite' }} />
      </svg>

      <div key={stepIndex} style={{
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        fontSize: 12,
        color: '#00E5A0',
        letterSpacing: 3,
        animation: 'typewriter 1.4s steps(40) forwards',
        marginBottom: 20,
      }}>
        {STEPS[stepIndex]}
      </div>

      <div style={{ fontSize: 11, color: '#8B949E', fontFamily: 'monospace' }}>
        [{bar}]{' '}
        <span style={{ color: '#00E5A0' }}>{progress}%</span>
        {' '}COMPLETE
      </div>
    </div>
  )
}
