import { useState, useEffect } from 'react'
import Loader from '../components/Loader'
import { getPortfolio, addPosition, deletePosition, getSettings, updateSettings } from '../services/api'

const STATUS_CLS = {
  'ON TRACK':   'badge-hold',
  'TRAIL STOP': 'badge-strong',
  'REVIEW':     'badge-watch',
  'EXIT':       'badge-sell',
  'TARGET HIT': 'badge-strong',
}

const FIELDS = [
  { key: 'symbol',      label: 'SYMBOL',      ph: 'RELIANCE', type: 'text' },
  { key: 'entry_price', label: 'ENTRY ₹',     ph: '2450.00',  type: 'number' },
  { key: 'quantity',    label: 'QUANTITY',    ph: '10',       type: 'number' },
  { key: 'stop_loss',   label: 'STOP LOSS ₹', ph: '2350.00',  type: 'number' },
  { key: 'target',      label: 'TARGET ₹',    ph: '2650.00',  type: 'number' },
]

const INR = (v, d = 0) => Math.abs(v || 0).toLocaleString('en-IN', { maximumFractionDigits: d })

function MetricCard({ label, value, prefix = '₹', color = '#C8D0DC', delay = 0 }) {
  return (
    <div className="card-entrance hud-panel" style={{ padding: '12px 14px', animationDelay: `${delay}s` }}>
      <div style={{ fontSize: 8, color: '#4B5563', letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }} className="num">
        {value < 0 ? '-' : ''}{prefix}{INR(value)}
      </div>
    </div>
  )
}

const EMPTY = { symbol: '', entry_price: '', quantity: '', stop_loss: '', target: '' }

// ── Layer 4: Risk Settings panel ─────────────────────────────────────────────
function RiskSettingsPanel({ settings, onSaved }) {
  const [capital, setCapital]   = useState(settings.capital)
  const [riskPct, setRiskPct]   = useState(settings.risk_pct)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => { setCapital(settings.capital); setRiskPct(settings.risk_pct) }, [settings.capital, settings.risk_pct])

  const handleSave = async () => {
    setSaving(true); setSaved(false)
    await updateSettings({ capital: +capital, risk_pct: +riskPct })
    await onSaved()
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="hud-panel" style={{ padding: '14px', marginBottom: 16 }}>
      <div className="section-header">
        <span className="section-header-label">Risk Settings</span>
        <span className="section-header-accent" />
        <span style={{ fontSize: 8, color: '#2A3040', letterSpacing: 1 }}>DRIVES POSITION SIZING ACROSS THE APP</span>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 8, color: '#2A3040', letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>TOTAL CAPITAL ₹</div>
          <input value={capital} onChange={e => setCapital(e.target.value)} className="terminal-input" style={{ width: 160 }} />
        </div>
        <div>
          <div style={{ fontSize: 8, color: '#2A3040', letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>RISK PER TRADE %</div>
          <input value={riskPct} onChange={e => setRiskPct(e.target.value)} className="terminal-input" style={{ width: 120 }} />
        </div>
        <button onClick={handleSave} disabled={saving} className="terminal-btn" style={{ opacity: saving ? 0.5 : 1 }}>
          {saving ? '...' : saved ? '✓ SAVED' : 'SAVE'}
        </button>
        <div style={{ fontSize: 9, color: '#4B5563' }}>
          Risk amount per trade: <span className="num" style={{ color: '#00E5A0', fontWeight: 700 }}>₹{INR(capital * riskPct / 100)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Layer 7: Portfolio health summary ────────────────────────────────────────
function HealthPanel({ health }) {
  if (!health) return null
  const { open_positions, max_positions, sector_breakdown, total_risk_exposure, risk_pct_of_capital, warnings } = health
  const overLimit = open_positions > max_positions

  return (
    <div className="hud-panel" style={{ padding: '14px', marginBottom: 16 }}>
      <div className="section-header">
        <span className="section-header-label">Portfolio Health</span>
        <span className="section-header-accent" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 8, color: '#2A3040', letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>OPEN POSITIONS</div>
          <div className="num" style={{ fontSize: 14, fontWeight: 700, color: overLimit ? '#FF455A' : '#C8D0DC' }}>
            {open_positions} / {max_positions}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: '#2A3040', letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>TOTAL RISK EXPOSURE</div>
          <div className="num" style={{ fontSize: 14, fontWeight: 700, color: '#C8D0DC' }}>
            ₹{INR(total_risk_exposure)} <span style={{ fontSize: 10, color: '#4B5563' }}>({risk_pct_of_capital}% of capital)</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: '#2A3040', letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>LARGEST SECTOR</div>
          <div className="num" style={{ fontSize: 14, fontWeight: 700, color: (health.largest_sector_pct || 0) > 30 ? '#FF455A' : '#C8D0DC' }}>
            {health.largest_sector || '—'} {health.largest_sector_pct ? `(${health.largest_sector_pct}%)` : ''}
          </div>
        </div>
      </div>

      {sector_breakdown?.length > 0 && (
        <div style={{ marginBottom: warnings?.length ? 12 : 0 }}>
          {sector_breakdown.map(s => (
            <div key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{ width: 90, fontSize: 9, color: '#4B5563' }}>{s.sector}</div>
              <div style={{ flex: 1, background: '#0A0E14', borderRadius: 1, height: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, s.pct)}%`, background: s.pct > 30 ? '#FF455A' : '#00E5A0' }} />
              </div>
              <div style={{ width: 40, fontSize: 9, color: '#8B99A8', textAlign: 'right' }} className="num">{s.pct}%</div>
            </div>
          ))}
        </div>
      )}

      {warnings?.map((w, i) => (
        <div key={i} style={{
          fontSize: 10, color: '#FF455A', display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', background: 'rgba(255,69,90,0.06)', border: '1px solid rgba(255,69,90,0.2)',
          borderRadius: 3, marginTop: i === 0 ? 0 : 6,
        }}>
          <span>⚠</span>{w}
        </div>
      ))}
    </div>
  )
}

export default function Portfolio() {
  const [portfolio, setPortfolio] = useState({ positions: [], summary: {}, health: {} })
  const [settings, setSettings]   = useState({ capital: 100000, risk_pct: 0.75 })
  const [loading, setLoading]     = useState(true)
  const [form, setForm]           = useState(EMPTY)
  const [adding, setAdding]       = useState(false)
  const [error, setError]         = useState('')
  const [expanded, setExpanded]   = useState(null)

  const load = async () => {
    setLoading(true)
    const [p, st] = await Promise.all([getPortfolio(), getSettings()])
    setPortfolio(p || { positions: [], summary: {}, health: {} })
    setSettings(st || { capital: 100000, risk_pct: 0.75 })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    const { symbol, entry_price, quantity, stop_loss, target } = form
    if (!symbol || !entry_price || !quantity || !stop_loss || !target) { setError('All fields required.'); return }
    if (isNaN(entry_price) || isNaN(quantity) || isNaN(stop_loss) || isNaN(target)) { setError('Numeric fields must be numbers.'); return }
    if (+stop_loss >= +entry_price) { setError('Stop loss must be below entry.'); return }
    if (+target <= +entry_price)    { setError('Target must be above entry.'); return }
    setAdding(true); setError('')
    await addPosition({ symbol: symbol.toUpperCase(), entry_price: +entry_price, quantity: +quantity, stop_loss: +stop_loss, target: +target })
    setForm(EMPTY)
    await load()
    setAdding(false)
  }

  const handleDelete = async (id, sym) => {
    if (!window.confirm(`Remove ${sym} from portfolio?`)) return
    await deletePosition(id)
    await load()
  }

  const s = portfolio.summary || {}
  const pnlPos = (s.total_pnl || 0) >= 0

  return (
    <div>
      <Loader isLoading={loading} />

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 8, color: '#00E5A0', letterSpacing: 3, fontWeight: 700, marginBottom: 2 }}>PORTFOLIO TRACKER</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#C8D0DC' }}>Open Positions</div>
      </div>

      <RiskSettingsPanel settings={settings} onSaved={load} />

      <div className="hud-panel" style={{ padding: '14px', marginBottom: 16 }}>
        <div className="section-header">
          <span className="section-header-label">Add Position</span>
          <span className="section-header-accent" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 10 }}>
          {FIELDS.map(({ key, label, ph }) => (
            <div key={key}>
              <div style={{ fontSize: 8, color: '#2A3040', letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>{label}</div>
              <input
                value={form[key]} placeholder={ph}
                onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setError('') }}
                className="terminal-input" style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>

        {error && (
          <div style={{ fontSize: 10, color: '#FF455A', marginBottom: 8 }}>⚠ {error}</div>
        )}

        <button onClick={handleAdd} disabled={adding} className="terminal-btn" style={{
          background: adding ? 'transparent' : 'rgba(0,229,160,0.1)',
          opacity: adding ? 0.5 : 1,
        }}>
          {adding ? '...' : '+ ADD POSITION'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <MetricCard label="TOTAL INVESTED" value={s.total_invested || 0} delay={0} />
        <MetricCard label="CURRENT VALUE"  value={s.total_current  || 0} color={pnlPos ? '#00E5A0' : '#FF455A'} delay={0.04} />
        <MetricCard label="TOTAL P&L"      value={s.total_pnl      || 0} color={pnlPos ? '#00E5A0' : '#FF455A'} delay={0.08} />
        <div className="card-entrance hud-panel" style={{ padding: '12px 14px', animationDelay: '0.12s' }}>
          <div style={{ fontSize: 8, color: '#4B5563', letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>P&L %</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: pnlPos ? '#00E5A0' : '#FF455A' }} className="num">
            {pnlPos ? '+' : ''}{(s.total_pnl_pct || 0).toFixed(2)}%
          </div>
        </div>
      </div>

      <HealthPanel health={portfolio.health} />

      <div className="hud-panel" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid #0F1318',
          fontSize: 8, color: '#2A3040', letterSpacing: 2, fontWeight: 700,
        }}>
          OPEN POSITIONS — {(portfolio.positions || []).length}
        </div>

        {(portfolio.positions || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#2A3040', fontSize: 10, letterSpacing: 2 }}>
            NO OPEN POSITIONS — ADD YOUR FIRST TRADE
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#0A0E14', borderBottom: '1px solid #0F1318' }}>
                  {['STOCK','SECTOR','ENTRY','CURRENT','QTY','DAYS','P&L ₹','P&L%','STATUS',''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 8, color: '#2A3040', letterSpacing: 1, fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((pos, i) => {
                  const pos_pnl = (pos.pnl || 0) >= 0
                  const isExpanded = expanded === pos.id
                  return (
                    <>
                      <tr key={pos.id} className="data-row card-entrance" style={{ animationDelay: `${i * 0.04}s`, cursor: 'pointer' }}
                        onClick={() => setExpanded(isExpanded ? null : pos.id)}>
                        <td style={{ padding: '9px 10px', color: '#C8D0DC', fontWeight: 700 }}>{pos.symbol}</td>
                        <td style={{ padding: '9px 10px', color: '#4B5563', fontSize: 10 }}>{pos.sector}</td>
                        <td style={{ padding: '9px 10px', color: '#4B5563' }} className="num">₹{INR(pos.entry_price)}</td>
                        <td style={{ padding: '9px 10px', color: pos_pnl ? '#00E5A0' : '#FF455A', fontWeight: 600 }} className="num">₹{INR(pos.current_price)}</td>
                        <td style={{ padding: '9px 10px', color: '#4B5563' }} className="num">{pos.quantity}</td>
                        <td style={{ padding: '9px 10px', color: '#4B5563' }} className="num">{pos.days_held}d</td>
                        <td style={{ padding: '9px 10px', color: pos_pnl ? '#00E5A0' : '#FF455A', fontWeight: 700 }} className="num">
                          {pos_pnl ? '+' : '-'}₹{INR(pos.pnl)}
                        </td>
                        <td style={{ padding: '9px 10px', color: pos_pnl ? '#00E5A0' : '#FF455A' }} className="num">
                          {pos_pnl ? '+' : ''}{(pos.pnl_pct || 0).toFixed(2)}%
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <span className={`badge ${STATUS_CLS[pos.status] || 'badge-hold'}`}>{pos.status}</span>
                            {pos.time_stop && <span className="badge badge-watch">⏰ TIME STOP</span>}
                          </div>
                        </td>
                        <td style={{ padding: '9px 10px' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleDelete(pos.id, pos.symbol)} className="badge badge-sell" style={{
                            cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                          }}>
                            REMOVE
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} style={{ padding: '12px 16px', background: 'rgba(0,229,160,0.03)', borderBottom: '1px solid #0F1318' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                              <div>
                                <div style={{ fontSize: 8, color: '#2A3040', letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>EXIT PLAN</div>
                                <div style={{ fontSize: 10, color: '#4B5563', lineHeight: 1.8 }}>
                                  <div>Initial stop: <span className="num" style={{ color: '#FF455A' }}>₹{INR(pos.stop_loss)}</span></div>
                                  <div>Target: <span className="num" style={{ color: '#00E5A0' }}>₹{INR(pos.target)}</span></div>
                                  <div>Breakeven trigger (+1R): <span className="num" style={{ color: '#4D9FFF' }}>₹{INR(pos.breakeven_trigger)}</span> {pos.at_breakeven && <span style={{ color: '#00E5A0' }}>✓ reached</span>}</div>
                                  <div style={{ marginTop: 4, color: '#2A3040' }}>{pos.trail_note}</div>
                                  {pos.time_stop && (
                                    <div style={{ marginTop: 6, color: '#FFB020', fontWeight: 700 }}>
                                      ⏰ {pos.days_held} trading days held with no profit — thesis stale, consider exit
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 8, color: '#2A3040', letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>REAL PROFIT IF EXITED NOW</div>
                                <div style={{ fontSize: 10, color: '#4B5563', lineHeight: 1.8 }}>
                                  <div>Gross P&L: <span className="num" style={{ color: pos_pnl ? '#00E5A0' : '#FF455A' }}>₹{INR(pos.net_pnl_breakdown?.gross_pnl)}</span></div>
                                  <div>Round-trip costs (~0.1%): <span className="num" style={{ color: '#FF455A' }}>-₹{INR(pos.net_pnl_breakdown?.cost)}</span></div>
                                  <div>STCG tax (20% + 4% cess): <span className="num" style={{ color: '#FF455A' }}>-₹{INR(pos.net_pnl_breakdown?.tax)}</span></div>
                                  <div style={{ marginTop: 4, fontWeight: 700 }}>Net take-home: <span className="num" style={{ color: pos.net_pnl >= 0 ? '#00E5A0' : '#FF455A' }}>₹{INR(pos.net_pnl)}</span></div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
