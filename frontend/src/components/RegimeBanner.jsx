import { useState, useEffect } from 'react'
import { getRegime } from '../services/api'

const FMT = v => v == null ? '—' : v.toLocaleString('en-IN', { maximumFractionDigits: 0 })

export default function RegimeBanner() {
  const [regime, setRegime] = useState(null)

  useEffect(() => {
    const load = async () => setRegime(await getRegime())
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (!regime) return null
  const color = regime.color || '#4D9FFF'

  return (
    <div className="card-entrance" style={{
      padding: '12px 16px', borderRadius: 4, marginBottom: 16,
      background: color + '0F', border: `1px solid ${color}35`,
      borderLeft: `3px solid ${color}`,
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{ position: 'relative', width: 9, height: 9, flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%', background: color,
          boxShadow: `0 0 8px ${color}`,
        }} />
        {regime.regime === 'RISK-ON' && (
          <div className="spin-icon" style={{
            position: 'absolute', inset: -4, borderRadius: '50%',
            border: `1px solid ${color}`, opacity: 0.5, animation: 'pulse-ring 2s ease-out infinite',
          }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 1.5 }}>
          MARKET REGIME: {regime.regime}
          <span style={{ color: '#4B5563', fontWeight: 600, marginLeft: 8 }}>● {regime.label}</span>
        </div>
        <div style={{ fontSize: 9, color: '#4B5563', marginTop: 3, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {regime.nifty_price != null && regime.dma_50 != null && (
            <span className="num">
              NIFTY {FMT(regime.nifty_price)} {regime.above_dma ? '▲' : '▼'} 50DMA {FMT(regime.dma_50)}
              {regime.dma_rising != null && ` (DMA ${regime.dma_rising ? 'rising' : 'falling'})`}
            </span>
          )}
          {regime.breadth_pct != null && (
            <span className="num">
              BREADTH {regime.breadth_pct}% of universe &gt; own 50DMA
              {regime.breadth_downgrade && <span style={{ color: '#FFB020' }}> — downgraded</span>}
            </span>
          )}
          {regime.data_quality === 'estimated' && (
            <span style={{ color: '#FFB020' }}>EST — {regime.reason}</span>
          )}
        </div>
      </div>
    </div>
  )
}
