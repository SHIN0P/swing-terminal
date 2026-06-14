import { useState, useEffect } from 'react'

const getColor = score => {
  if (score >= 80) return '#00E5A0'
  if (score >= 65) return '#58A6FF'
  if (score >= 50) return '#E3B341'
  if (score >= 35) return '#F97316'
  return '#F85149'
}

const getLabel = score => {
  if (score >= 80) return 'STRONG BUY'
  if (score >= 65) return 'BUY'
  if (score >= 50) return 'WATCHLIST'
  if (score >= 35) return 'HOLD'
  return 'AVOID'
}

export default function ScoreGauge({ score = 0, size = 'md' }) {
  const dim = size === 'sm' ? 80 : size === 'lg' ? 160 : 120
  const [displayScore, setDisplayScore] = useState(0)

  useEffect(() => {
    let current = 0
    const target = score
    const timer = setInterval(() => {
      current += target / 75
      if (current >= target) {
        setDisplayScore(target)
        clearInterval(timer)
      } else {
        setDisplayScore(Math.floor(current))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [score])

  const color = getColor(score)
  const label = getLabel(score)
  const cx = dim / 2
  const cy = dim / 2
  const r = dim / 2 - 10
  const circumference = Math.PI * r
  const offset = circumference - (displayScore / 100) * circumference

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={dim} height={dim / 2 + 20} viewBox={`0 0 ${dim} ${dim / 2 + 20}`}>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#21293A" strokeWidth="8" strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.05s linear',
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
        <text x={cx} y={cy - 4}
          textAnchor="middle" dominantBaseline="middle"
          fill={color}
          fontSize={size === 'sm' ? 14 : size === 'lg' ? 28 : 20}
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace">
          {displayScore}
        </text>
        <text x={cx} y={cy + (size === 'sm' ? 10 : 14)}
          textAnchor="middle"
          fill="#8B949E"
          fontSize={size === 'sm' ? 7 : 9}
          fontFamily="JetBrains Mono, monospace">
          /100
        </text>
      </svg>
      <div style={{
        fontSize: size === 'sm' ? 8 : 10,
        color, fontWeight: 700,
        letterSpacing: 1.5,
        marginTop: -8,
      }}>
        {label}
      </div>
    </div>
  )
}
