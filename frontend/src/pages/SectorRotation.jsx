import { useState, useEffect } from 'react'
import Loader from '../components/Loader'
import { getSectors } from '../services/api'

const PHASE_INFO = {
  Recovery:       { desc: 'Financials, REITs begin to lead',       color: '#58A6FF', sectors: ['Banking', 'Realty', 'Finance'] },
  Expansion:      { desc: 'Broad rally: IT, Auto, Infra lead',     color: '#00E5A0', sectors: ['IT', 'Auto', 'Infra'] },
  'Late Expansion': { desc: 'Energy, Metal, Pharma outperform',    color: '#E3B341', sectors: ['Energy', 'Metal', 'Pharma'] },
  Slowdown:       { desc: 'FMCG, Telecom, defensive rotation',     color: '#F85149', sectors: ['FMCG', 'Telecom'] },
}

export default function SectorRotation() {
  const [sectors, setSectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState('score')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const s = await getSectors()
      setSectors(s)
      setLoading(false)
    }
    load()
  }, [])

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = [...sectors].sort((a, b) => {
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    return sortAsc ? av - bv : bv - av
  })

  const currentPhase = 'Late Expansion'

  const SortHeader = ({ label, key }) => (
    <th onClick={() => toggleSort(key)} style={{
      padding: '8px 12px', textAlign: 'left', fontSize: 10,
      color: sortKey === key ? '#00E5A0' : '#8B949E',
      letterSpacing: 1, cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      {label} {sortKey === key ? (sortAsc ? '▲' : '▼') : ''}
    </th>
  )

  const signalBadge = (signal) => {
    const cfg = signal === 'OVERWEIGHT'
      ? { bg: 'rgba(0,229,160,0.12)', color: '#00E5A0', border: '#00E5A040' }
      : signal === 'UNDERWEIGHT'
      ? { bg: 'rgba(248,81,73,0.12)', color: '#F85149', border: '#F8514940' }
      : { bg: 'rgba(88,166,255,0.12)', color: '#58A6FF', border: '#58A6FF40' }
    return (
      <span style={{
        padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      }}>{signal}</span>
    )
  }

  return (
    <div>
      <Loader isLoading={loading} />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#00E5A0', letterSpacing: 3, fontWeight: 700 }}>SECTOR INTELLIGENCE</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: '#E6EDF3' }}>Sector Rotation Clock</h1>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 3, marginBottom: 24, maxWidth: 520,
        border: '1px solid #21293A', borderRadius: 12, overflow: 'hidden',
      }}>
        {Object.entries(PHASE_INFO).map(([phase, info]) => {
          const isActive = phase === currentPhase
          return (
            <div key={phase} style={{
              padding: '18px 20px',
              background: isActive ? info.color + '18' : '#161B22',
              border: isActive ? `2px solid ${info.color}` : '1px solid #21293A',
              boxShadow: isActive ? `0 0 20px ${info.color}30` : 'none',
              borderRadius: 0,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? info.color : '#8B949E', letterSpacing: 1 }}>
                {isActive ? '◉ ' : '○ '}{phase.toUpperCase()}
              </div>
              <div style={{ fontSize: 10, color: '#8B949E', marginTop: 4 }}>{info.desc}</div>
              {isActive && (
                <div style={{ fontSize: 9, marginTop: 6, color: info.color }}>
                  CURRENT PHASE
                </div>
              )}
              <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {info.sectors.map(s => (
                  <span key={s} style={{
                    fontSize: 9, padding: '2px 6px',
                    borderRadius: 3,
                    background: isActive ? info.color + '20' : '#21293A',
                    color: isActive ? info.color : '#8B949E',
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ background: '#161B22', border: '1px solid #21293A', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 11, color: '#8B949E', letterSpacing: 2, marginBottom: 14 }}>SECTOR RANKINGS</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #21293A' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#8B949E' }}>#</th>
                <SortHeader label="Sector" key="name" />
                <SortHeader label="1D%" key="change_1d" />
                <SortHeader label="5D%" key="change_5d" />
                <SortHeader label="20D%" key="change_20d" />
                <SortHeader label="vs Nifty" key="vs_nifty" />
                <SortHeader label="Score" key="score" />
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#8B949E' }}>Signal</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#8B949E' }}>FII Bias</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const isTop = i < 3
                const isBot = i >= sorted.length - 3
                const rowColor = isTop ? '#00E5A0' : isBot ? '#F85149' : 'transparent'
                return (
                  <tr key={s.name} style={{
                    borderBottom: '1px solid #21293A15',
                    borderLeft: `3px solid ${rowColor}`,
                  }}>
                    <td style={{ padding: '10px 12px', color: '#8B949E' }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px', color: '#E6EDF3', fontWeight: 600 }}>{s.name}</td>
                    {[s.change_1d, s.change_5d, s.change_20d, s.vs_nifty].map((v, j) => (
                      <td key={j} style={{ padding: '10px 12px', color: (v || 0) >= 0 ? '#00E5A0' : '#F85149' }}>
                        {(v || 0) >= 0 ? '+' : ''}{(v || 0).toFixed(2)}%
                      </td>
                    ))}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{
                        background: '#21293A', borderRadius: 4, height: 6,
                        width: 80, overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 4,
                          width: `${Math.min(100, s.score || 0)}%`,
                          background: isTop ? '#00E5A0' : isBot ? '#F85149' : '#58A6FF',
                        }} />
                      </div>
                      <div style={{ fontSize: 10, color: '#8B949E', marginTop: 2 }}>{(s.score || 0).toFixed(0)}/100</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{signalBadge(s.signal)}</td>
                    <td style={{ padding: '10px 12px', color: (s.fii_bias || '').includes('BUYING') ? '#00E5A0' : (s.fii_bias || '').includes('SELLING') ? '#F85149' : '#8B949E', fontSize: 11 }}>
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
