import { useState, useEffect } from 'react'
import Loader from '../components/Loader'
import { getSectors } from '../services/api'

const PHASE_INFO = {
  Recovery:       { desc: 'Financials, REITs lead',       color: '#4D9FFF', sectors: ['Banking', 'Realty', 'Finance'] },
  Expansion:      { desc: 'IT, Auto, Infra outperform',   color: '#00E5A0', sectors: ['IT', 'Auto', 'Infra'] },
  'Late Expansion': { desc: 'Energy, Metal, Pharma peak', color: '#FFB020', sectors: ['Energy', 'Metal', 'Pharma'] },
  Slowdown:       { desc: 'FMCG, Telecom, defensives',    color: '#FF455A', sectors: ['FMCG', 'Telecom'] },
}

const CURRENT_PHASE = 'Late Expansion'

export default function SectorRotation() {
  const [sectors, setSectors]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [sortKey, setSortKey]   = useState('score')
  const [sortAsc, setSortAsc]   = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setSectors(await getSectors())
      setLoading(false)
    }
    load()
  }, [])

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = [...sectors].sort((a, b) => {
    const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
    return sortAsc ? av - bv : bv - av
  })

  const TH = ({ label, k }) => (
    <th onClick={() => toggleSort(k)} style={{
      padding: '7px 10px', textAlign: 'left', fontSize: 8,
      color: sortKey === k ? '#00E5A0' : '#2A3040',
      letterSpacing: 1, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 700,
    }}>
      {label} {sortKey === k ? (sortAsc ? '▲' : '▼') : ''}
    </th>
  )

  const signalBadge = (sig) => {
    const cls = sig === 'OVERWEIGHT' ? 'badge-strong' : sig === 'UNDERWEIGHT' ? 'badge-sell' : 'badge-hold'
    return <span className={`badge ${cls}`}>{sig}</span>
  }

  return (
    <div>
      <Loader isLoading={loading} />

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 8, color: '#00E5A0', letterSpacing: 3, fontWeight: 700, marginBottom: 2 }}>SECTOR INTELLIGENCE</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#C8D0DC' }}>Sector Rotation Clock</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 20, maxWidth: 480 }}>
        {Object.entries(PHASE_INFO).map(([phase, info]) => {
          const active = phase === CURRENT_PHASE
          return (
            <div key={phase} style={{
              padding: '14px 16px',
              background: active ? info.color + '10' : '#0A0E14',
              border: `1px solid ${active ? info.color + '40' : '#0F1318'}`,
              borderLeft: `3px solid ${active ? info.color : '#0F1318'}`,
              borderRadius: 3,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: active ? info.color : '#2A3040', letterSpacing: 1.5 }}>
                {active ? '◉ ' : '○ '}{phase.toUpperCase()}
              </div>
              <div style={{ fontSize: 9, color: '#4B5563', marginTop: 3 }}>{info.desc}</div>
              {active && (
                <div style={{ fontSize: 8, marginTop: 4, color: info.color, letterSpacing: 1 }}>CURRENT PHASE</div>
              )}
              <div style={{ marginTop: 6, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {info.sectors.map(s => (
                  <span key={s} style={{
                    fontSize: 8, padding: '2px 5px', borderRadius: 2,
                    background: active ? info.color + '15' : '#0F1318',
                    color: active ? info.color : '#2A3040',
                    letterSpacing: 0.5,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="hud-panel" style={{ padding: '14px' }}>
        <div className="section-header">
          <span className="section-header-label">Sector Rankings</span>
          <span className="section-header-accent" />
          <span style={{ fontSize: 8, color: '#2A3040', letterSpacing: 1 }}>{sorted.length} SECTORS</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: '7px 10px', fontSize: 8, color: '#2A3040', textAlign: 'left', fontWeight: 700 }}>#</th>
                <TH label="SECTOR" k="name" />
                <TH label="1D%" k="change_1d" />
                <TH label="5D%" k="change_5d" />
                <TH label="20D%" k="change_20d" />
                <TH label="vs NIFTY" k="vs_nifty" />
                <TH label="SCORE" k="score" />
                <th style={{ padding: '7px 10px', fontSize: 8, color: '#2A3040', textAlign: 'left', fontWeight: 700 }}>SIGNAL</th>
                <th style={{ padding: '7px 10px', fontSize: 8, color: '#2A3040', textAlign: 'left', fontWeight: 700 }}>FII BIAS</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const top = i < 3, bot = i >= sorted.length - 3
                const accent = top ? '#00E5A0' : bot ? '#FF455A' : 'transparent'
                return (
                  <tr key={s.name} className="data-row" style={{ borderLeft: `2px solid ${accent}` }}>
                    <td style={{ padding: '8px 10px', color: '#2A3040', fontSize: 10 }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px', color: '#C8D0DC', fontWeight: 600 }}>{s.name}</td>
                    {[s.change_1d, s.change_5d, s.change_20d, s.vs_nifty].map((v, j) => (
                      <td key={j} style={{ padding: '8px 10px', color: (v || 0) >= 0 ? '#00E5A0' : '#FF455A' }} className="num">
                        {(v || 0) >= 0 ? '+' : ''}{(v || 0).toFixed(2)}%
                      </td>
                    ))}
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ background: '#0A0E14', borderRadius: 2, height: 4, width: 60, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, s.score || 0)}%`,
                            background: top ? '#00E5A0' : bot ? '#FF455A' : '#4D9FFF',
                          }} />
                        </div>
                        <span style={{ fontSize: 10, color: '#4B5563' }} className="num">{(s.score || 0).toFixed(0)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>{signalBadge(s.signal)}</td>
                    <td style={{ padding: '8px 10px', fontSize: 10,
                      color: (s.fii_bias || '').includes('BUY') ? '#00E5A0'
                           : (s.fii_bias || '').includes('SELL') ? '#FF455A' : '#4B5563' }}>
                      {s.fii_bias}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
