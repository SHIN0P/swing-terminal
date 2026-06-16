import { useState, useEffect, useMemo } from 'react'
import Loader from '../components/Loader'
import PositionSizeBox from '../components/PositionSizeBox'
import RiskOffWarning from '../components/RiskOffWarning'
import { getScanner } from '../services/api'

const SECTORS = ['all', 'Banking', 'IT', 'Pharma', 'Auto', 'FMCG', 'Metal', 'Realty', 'Energy', 'Telecom', 'Infra', 'Finance']
const SIGNALS = ['ALL', 'STRONG BUY', 'BUY', 'WATCHLIST']

const scoreColor = s => s >= 80 ? '#00E5A0' : s >= 65 ? '#4D9FFF' : s >= 50 ? '#FFB020' : s >= 35 ? '#F97316' : '#FF455A'
const SIG_CLS = {
  'STRONG BUY': 'badge-strong', 'BUY': 'badge-buy', 'WATCHLIST': 'badge-watch',
  'HOLD': 'badge-hold', 'AVOID': 'badge-avoid',
}

function ScoreBar({ label, value, max = 40 }) {
  const pct = Math.min(100, (value / max) * 100)
  const c = pct >= 75 ? '#00E5A0' : pct >= 55 ? '#4D9FFF' : pct >= 40 ? '#FFB020' : '#FF455A'
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2 }}>
        <span style={{ color: '#4B5563', letterSpacing: 1 }}>{label}</span>
        <span style={{ color: c }} className="num">{value}/{max}</span>
      </div>
      <div style={{ background: '#0A0E14', borderRadius: 1, height: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: c }} />
      </div>
    </div>
  )
}

export default function Scanner() {
  const [stocks, setStocks]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [minScore, setMinScore] = useState(65)
  const [sector, setSector]     = useState('all')
  const [signal, setSignal]     = useState('ALL')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setStocks(await getScanner(minScore, sector, 80))
      setLoading(false)
    }
    load()
  }, [minScore, sector])

  const filtered = useMemo(() => {
    if (signal === 'ALL') return stocks
    return stocks.filter(s => s.signal === signal)
  }, [stocks, signal])

  const exportCSV = () => {
    const hdr = ['Symbol','Sector','Price','Chg%','Score','Signal','RSI','VolRatio','Entry','SL','T1','RR']
    const rows = filtered.map(s => [s.symbol,s.sector,s.price,s.change_pct,s.composite_score,s.signal,s.rsi,s.vol_ratio,s.entry_zone_low,s.stop_loss,s.target_1,s.risk_reward])
    const csv = [hdr, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'swing-scanner.csv'; a.click()
  }

  return (
    <div>
      <Loader isLoading={loading} />

      <RiskOffWarning />

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 8, color: '#00E5A0', letterSpacing: 3, fontWeight: 700, marginBottom: 2 }}>STOCK SCANNER</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#C8D0DC' }}>Swing Trade Scanner</div>
      </div>

      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#07090D', paddingBottom: 12,
        borderBottom: '1px solid #0F1318', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 8, color: '#2A3040', marginBottom: 5, letterSpacing: 1 }}>MIN SCORE: <span style={{ color: '#00E5A0' }}>{minScore}</span></div>
            <input type="range" min={0} max={100} value={minScore}
              onChange={e => setMinScore(+e.target.value)} style={{ width: 120 }} />
          </div>

          <div>
            <div style={{ fontSize: 8, color: '#2A3040', marginBottom: 5, letterSpacing: 1 }}>SECTOR</div>
            <select value={sector} onChange={e => setSector(e.target.value)} className="terminal-input" style={{ padding: '5px 8px' }}>
              {SECTORS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 8, color: '#2A3040', marginBottom: 5, letterSpacing: 1 }}>SIGNAL FILTER</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {SIGNALS.map(s => (
                <button key={s} onClick={() => setSignal(s)}
                  className={signal === s ? 'terminal-btn active' : 'terminal-btn-ghost'}
                  style={{ fontSize: 9 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 9, color: '#2A3040' }}>
              <span style={{ color: '#00E5A0', fontWeight: 700 }} className="num">{filtered.length}</span> RESULTS
            </div>
            <button onClick={exportCSV} className="terminal-btn" style={{ fontSize: 9 }}>↓ CSV</button>
          </div>
        </div>
      </div>

      <div className="hud-panel" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#0A0E14', borderBottom: '1px solid #0F1318' }}>
                {['SYMBOL','SECTOR','PRICE','CHG%','SCORE','SIGNAL','RSI','VOL×','ENTRY','SL','T1','R:R'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 8, color: '#2A3040', letterSpacing: 1, whiteSpace: 'nowrap', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <>
                  <tr key={s.symbol}
                    onClick={() => setExpanded(expanded === s.symbol ? null : s.symbol)}
                    className="data-row card-entrance"
                    style={{
                      animationDelay: `${i * 0.025}s`,
                      cursor: 'pointer',
                      background: expanded === s.symbol ? 'rgba(0,229,160,0.04)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '9px 10px', color: '#C8D0DC', fontWeight: 700 }}>{s.symbol}</td>
                    <td style={{ padding: '9px 10px', color: '#4B5563', fontSize: 10 }}>{s.sector}</td>
                    <td style={{ padding: '9px 10px', color: '#8B99A8' }} className="num">
                      ₹{(s.price || 0).toLocaleString('en-IN')}
                      {s.price_source === 'estimated' && (
                        <span style={{
                          marginLeft: 5, fontSize: 7, fontWeight: 700, letterSpacing: 0.5,
                          color: '#FFB020', border: '1px solid rgba(255,176,32,0.3)',
                          borderRadius: 2, padding: '1px 3px', verticalAlign: 'middle',
                        }} title="yfinance unreachable for this symbol — showing synthetic fallback price">EST</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 10px', color: (s.change_pct || 0) >= 0 ? '#00E5A0' : '#FF455A' }} className="num">
                      {(s.change_pct || 0) >= 0 ? '+' : ''}{(s.change_pct || 0).toFixed(2)}%
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 7px', borderRadius: 2,
                        fontSize: 10, fontWeight: 700,
                        background: scoreColor(s.composite_score) + '18',
                        color: scoreColor(s.composite_score),
                        border: `1px solid ${scoreColor(s.composite_score)}30`,
                      }} className="num">{s.composite_score}</span>
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <span className={`badge ${SIG_CLS[s.signal] || 'badge-hold'}`}>{s.signal}</span>
                    </td>
                    <td style={{ padding: '9px 10px', color: s.rsi > 70 ? '#FF455A' : s.rsi < 30 ? '#00E5A0' : '#8B99A8' }} className="num">
                      {(s.rsi || 0).toFixed(1)}
                    </td>
                    <td style={{ padding: '9px 10px', color: s.vol_ratio > 1.5 ? '#00E5A0' : '#8B99A8' }} className="num">
                      {(s.vol_ratio || 1).toFixed(1)}×
                    </td>
                    <td style={{ padding: '9px 10px', color: '#8B99A8' }} className="num">₹{s.entry_zone_low}</td>
                    <td style={{ padding: '9px 10px', color: '#FF455A' }} className="num">₹{s.stop_loss}</td>
                    <td style={{ padding: '9px 10px', color: '#00E5A0' }} className="num">₹{s.target_1}</td>
                    <td style={{ padding: '9px 10px', color: (s.risk_reward || 0) >= 2 ? '#00E5A0' : '#FFB020', fontWeight: 700 }} className="num">
                      {(s.risk_reward || 0).toFixed(1)}:1
                    </td>
                  </tr>
                  {expanded === s.symbol && (
                    <tr key={`${s.symbol}-exp`}>
                      <td colSpan={12} style={{ padding: '12px 16px', background: 'rgba(0,229,160,0.03)', borderBottom: '1px solid #0F1318' }}>
                        <div style={{ fontSize: 8, color: '#2A3040', marginBottom: 8, letterSpacing: 2, fontWeight: 700 }}>SCORE BREAKDOWN</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 14 }}>
                          <ScoreBar label="TECHNICAL"          value={s.indicator_score || 0}         max={20} />
                          <ScoreBar label="RELATIVE STRENGTH"  value={s.relative_strength_score || 0} max={20} />
                          <ScoreBar label="FII / DII"          value={s.fii_dii_score || 0}            max={25} />
                          <ScoreBar label="FUNDAMENTAL"        value={s.fundamental_score || 0}        max={20} />
                          <ScoreBar label="SECTOR"             value={s.sector_score || 0}             max={15} />
                        </div>
                        {s.stock_return_50d != null && (
                          <div style={{ fontSize: 9, color: '#4B5563', marginBottom: 12 }}>
                            50D return: <span className="num" style={{ color: s.stock_return_50d >= (s.nifty_return_50d ?? 0) ? '#00E5A0' : '#FF455A' }}>
                              {s.stock_return_50d >= 0 ? '+' : ''}{s.stock_return_50d.toFixed(1)}%
                            </span> vs Nifty <span className="num">{s.nifty_return_50d != null ? `${s.nifty_return_50d >= 0 ? '+' : ''}${s.nifty_return_50d.toFixed(1)}%` : '—'}</span>
                          </div>
                        )}
                        <PositionSizeBox ps={s.position_size} net={s.net_profit_target1} target1={s.target_1} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 48, color: '#2A3040', fontSize: 11 }}>
            NO RESULTS — LOWER THE MIN SCORE OR CHANGE FILTERS
          </div>
        )}
      </div>
    </div>
  )
}
