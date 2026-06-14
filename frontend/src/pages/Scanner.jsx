import { useState, useEffect, useMemo } from 'react'
import Loader from '../components/Loader'
import { getScanner } from '../services/api'

const SECTORS = ['all', 'Banking', 'IT', 'Pharma', 'Auto', 'FMCG', 'Metal', 'Realty', 'Energy', 'Telecom', 'Infra', 'Finance']
const SIGNALS = ['ALL', 'STRONG BUY', 'BUY', 'WATCHLIST']

const scoreColor = s => s >= 80 ? '#00E5A0' : s >= 65 ? '#58A6FF' : s >= 50 ? '#E3B341' : s >= 35 ? '#F97316' : '#F85149'
const signalColors = {
  'STRONG BUY': '#00E5A0', 'BUY': '#58A6FF', 'WATCHLIST': '#E3B341', 'HOLD': '#F97316', 'AVOID': '#F85149',
}

function ScoreBar({ label, value, max = 40 }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
        <span style={{ color: '#8B949E' }}>{label}</span>
        <span style={{ color: '#E6EDF3' }}>{value}/{max}</span>
      </div>
      <div style={{ background: '#21293A', borderRadius: 3, height: 5, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${(value / max) * 100}%`,
          background: scoreColor(value / max * 100),
        }} />
      </div>
    </div>
  )
}

export default function Scanner() {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [minScore, setMinScore] = useState(65)
  const [sector, setSector] = useState('all')
  const [signal, setSignal] = useState('ALL')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const data = await getScanner(minScore, sector, 80)
      setStocks(data)
      setLoading(false)
    }
    load()
  }, [minScore, sector])

  const filtered = useMemo(() => {
    if (signal === 'ALL') return stocks
    return stocks.filter(s => s.signal === signal)
  }, [stocks, signal])

  const exportCSV = () => {
    const headers = ['Symbol', 'Sector', 'Price', 'Chg%', 'Score', 'Signal', 'RSI', 'VolRatio', 'Entry', 'SL', 'T1', 'RR']
    const rows = filtered.map(s => [
      s.symbol, s.sector, s.price, s.change_pct, s.composite_score,
      s.signal, s.rsi, s.vol_ratio, s.entry_zone_low, s.stop_loss, s.target_1, s.risk_reward,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'swing-scanner.csv'
    a.click()
  }

  return (
    <div>
      <Loader isLoading={loading} />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#00E5A0', letterSpacing: 3, fontWeight: 700 }}>STOCK SCANNER</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: '#E6EDF3' }}>Swing Trade Scanner</h1>
      </div>

      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#080C10', paddingBottom: 16,
        borderBottom: '1px solid #21293A', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: '#8B949E', marginBottom: 4 }}>MIN SCORE: {minScore}</div>
            <input type="range" min={0} max={100} value={minScore}
              onChange={e => setMinScore(+e.target.value)}
              style={{ width: 140, accentColor: '#00E5A0' }} />
          </div>

          <div>
            <div style={{ fontSize: 10, color: '#8B949E', marginBottom: 4 }}>SECTOR</div>
            <select value={sector} onChange={e => setSector(e.target.value)} style={{
              background: '#161B22', border: '1px solid #21293A', color: '#E6EDF3',
              padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
            }}>
              {SECTORS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 10, color: '#8B949E', marginBottom: 4 }}>SIGNAL</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {SIGNALS.map(s => (
                <button key={s} onClick={() => setSignal(s)} style={{
                  padding: '4px 10px', borderRadius: 5, fontSize: 10, cursor: 'pointer',
                  background: signal === s ? (signalColors[s] || '#00E5A0') : 'transparent',
                  color: signal === s ? '#080C10' : '#8B949E',
                  border: `1px solid ${signal === s ? (signalColors[s] || '#00E5A0') : '#21293A'}`,
                  fontWeight: signal === s ? 700 : 400,
                }}>{s}</button>
              ))}
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 11, color: '#8B949E' }}>
              Showing <span style={{ color: '#00E5A0', fontWeight: 700 }}>{filtered.length}</span> stocks
            </div>
            <button onClick={exportCSV} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              background: 'rgba(0,229,160,0.1)', border: '1px solid #00E5A040',
              color: '#00E5A0', fontWeight: 700,
            }}>↓ EXPORT CSV</button>
          </div>
        </div>
      </div>

      <div style={{ background: '#161B22', border: '1px solid #21293A', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #21293A', background: '#0D1117' }}>
                {['Symbol', 'Sector', 'Price', 'Chg%', 'Score', 'Signal', 'RSI', 'Vol Ratio', 'Entry', 'SL', 'T1', 'R:R'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, color: '#8B949E', letterSpacing: 1, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <>
                  <tr key={s.symbol}
                    onClick={() => setExpanded(expanded === s.symbol ? null : s.symbol)}
                    style={{
                      borderBottom: '1px solid #21293A15',
                      cursor: 'pointer',
                      background: expanded === s.symbol ? '#1C2330' : 'transparent',
                      transition: 'background 0.2s',
                    }}
                    className="card-entrance"
                    {...{ style: { animationDelay: `${i * 0.03}s`, borderBottom: '1px solid #21293A15', cursor: 'pointer', background: expanded === s.symbol ? '#1C2330' : 'transparent' } }}
                  >
                    <td style={{ padding: '11px 14px', color: '#E6EDF3', fontWeight: 700 }}>{s.symbol}</td>
                    <td style={{ padding: '11px 14px', color: '#8B949E' }}>{s.sector}</td>
                    <td style={{ padding: '11px 14px', color: '#E6EDF3' }}>₹{(s.price || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '11px 14px', color: (s.change_pct || 0) >= 0 ? '#00E5A0' : '#F85149' }}>
                      {(s.change_pct || 0) >= 0 ? '+' : ''}{(s.change_pct || 0).toFixed(2)}%
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                        fontSize: 11, fontWeight: 700,
                        background: scoreColor(s.composite_score) + '20',
                        color: scoreColor(s.composite_score),
                        border: `1px solid ${scoreColor(s.composite_score)}40`,
                      }}>{s.composite_score}</span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: (signalColors[s.signal] || '#8B949E') + '20',
                        color: signalColors[s.signal] || '#8B949E',
                        border: `1px solid ${(signalColors[s.signal] || '#8B949E')}40`,
                      }}>{s.signal}</span>
                    </td>
                    <td style={{ padding: '11px 14px', color: s.rsi > 70 ? '#F85149' : s.rsi < 30 ? '#00E5A0' : '#E6EDF3' }}>
                      {(s.rsi || 0).toFixed(1)}
                    </td>
                    <td style={{ padding: '11px 14px', color: s.vol_ratio > 1.5 ? '#00E5A0' : '#E6EDF3' }}>
                      {(s.vol_ratio || 1).toFixed(1)}x
                    </td>
                    <td style={{ padding: '11px 14px', color: '#E6EDF3' }}>₹{s.entry_zone_low}</td>
                    <td style={{ padding: '11px 14px', color: '#F85149' }}>₹{s.stop_loss}</td>
                    <td style={{ padding: '11px 14px', color: '#00E5A0' }}>₹{s.target_1}</td>
                    <td style={{ padding: '11px 14px', color: (s.risk_reward || 0) >= 2 ? '#00E5A0' : '#E3B341', fontWeight: 700 }}>
                      {(s.risk_reward || 0).toFixed(1)}:1
                    </td>
                  </tr>
                  {expanded === s.symbol && (
                    <tr key={`${s.symbol}-exp`}>
                      <td colSpan={12} style={{ padding: '14px 20px', background: '#1C2330' }}>
                        <div style={{ fontSize: 11, color: '#8B949E', marginBottom: 10, letterSpacing: 1 }}>SCORE BREAKDOWN</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                          <ScoreBar label="Technical" value={s.tech_score || 0} max={40} />
                          <ScoreBar label="FII / DII" value={s.fii_dii_score || 0} max={25} />
                          <ScoreBar label="Fundamental" value={s.fundamental_score || 0} max={20} />
                          <ScoreBar label="Sector" value={s.sector_score || 0} max={15} />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 48, color: '#8B949E', fontSize: 13 }}>
            No stocks match current filters. Try lowering the min score.
          </div>
        )}
      </div>
    </div>
  )
}
