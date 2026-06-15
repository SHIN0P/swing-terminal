import { useState, useEffect } from 'react'

const getColor = s => s >= 80 ? '#00E5A0' : s >= 65 ? '#4D9FFF' : s >= 50 ? '#FFB020' : s >= 35 ? '#F97316' : '#FF455A'
const getLabel = s => s >= 80 ? 'STRONG BUY' : s >= 65 ? 'BUY' : s >= 50 ? 'WATCHLIST' : s >= 35 ? 'HOLD' : 'AVOID'

export default function ScoreGauge({ score = 0, size = 'md' }) {
  const dim = size === 'sm' ? 80 : size === 'lg' ? 160 : 120
  const [disp, setDisp] = useState(0)

  useEffect(() => {
    let cur = 0
    const tgt = score
    const timer = setInterval(() => {
      cur += tgt / 60
      if (cur >= tgt) { setDisp(tgt); clearInterval(timer) }
      else setDisp(Math.floor(cur))
    }, 16)
    return () => clearInterval(timer)
  }, [score])

  const color = getColor(score)
  const label = getLabel(score)
  const cx = dim / 2
  const cy = dim / 2
  const r = dim / 2 - 12
  const circ = Math.PI * r
  const offset = circ - (disp / 100) * circ

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={dim} height={dim / 2 + 24} viewBox={`0 0 ${dim} ${dim / 2 + 24}`}>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#1A1F2B" strokeWidth={size === 'sm' ? 6 : 8} strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={color} strokeWidth={size === 'sm' ? 6 : 8}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.05s linear', filter: `drop-shadow(0 0 5px ${color}80)` }}
        />
        <text x={cx} y={cy - 4}
          textAnchor="middle" dominantBaseline="middle"
          fill={color}
          fontSize={size === 'sm' ? 14 : size === 'lg' ? 28 : 22}
          fontWeight="700" fontFamily="JetBrains Mono, monospace">
          {disp}
        </text>
        <text x={cx} y={cy + (size === 'sm' ? 10 : 14)}
          textAnchor="middle" fill="#4B5563"
          fontSize={size === 'sm' ? 7 : 9}
          fontFamily="JetBrains Mono, monospace">
          /100
        </text>
      </svg>
      <div style={{
        fontSize: size === 'sm' ? 8 : 9, color, fontWeight: 700,
        letterSpacing: 1.5, marginTop: -6,
        padding: '2px 8px', borderRadius: 2,
        background: color + '15', border: `1px solid ${color}30`,
      }}>
        {label}
      </div>
    </div>
  )
}
