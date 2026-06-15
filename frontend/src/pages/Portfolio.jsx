import { useState, useEffect } from 'react'
import Loader from '../components/Loader'
import { getPortfolio, addPosition, deletePosition } from '../services/api'

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

function MetricCard({ label, value, prefix = '₹', color = '#C8D0DC', delay = 0 }) {
  return (
    <div className="card-entrance hud-panel" style={{ padding: '12px 14px', animationDelay: `${delay}s` }}>
      <div style={{ fontSize: 8, color: '#4B5563', letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }} className="num">
        {value < 0 ? '-' : ''}{prefix}{Math.abs(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </div>
    </div>
  )
}

const EMPTY = { symbol: '', entry_price: '', quantity: '', stop_loss: '', target: '' }

export default function Portfolio() {
  const [portfolio, setPortfolio] = useState({ positions: [], summary: {} })
  const [loading, setLoading]     = useState(true)
  const [form, setForm]           = useState(EMPTY)
  const [adding, setAdding]       = useState(false)
  const [error, setError]         = useState('')

  const load = async () => {
    setLoading(true)
    setPortfolio((await getPortfolio()) || { positions: [], summary: {} })
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
                  {['STOCK','ENTRY','CURRENT','QTY','P&L ₹','P&L%','STATUS',''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 8, color: '#2A3040', letterSpacing: 1, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((pos, i) => {
                  const pos_pnl = (pos.pnl || 0) >= 0
                  return (
                    <tr key={pos.id} className="data-row card-entrance" style={{ animationDelay: `${i * 0.04}s` }}>
                      <td style={{ padding: '9px 10px', color: '#C8D0DC', fontWeight: 700 }}>{pos.symbol}</td>
                      <td style={{ padding: '9px 10px', color: '#4B5563' }} className="num">₹{(pos.entry_price || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '9px 10px', color: pos_pnl ? '#00E5A0' : '#FF455A', fontWeight: 600 }} className="num">₹{(pos.current_price || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '9px 10px', color: '#4B5563' }} className="num">{pos.quantity}</td>
                      <td style={{ padding: '9px 10px', color: pos_pnl ? '#00E5A0' : '#FF455A', fontWeight: 700 }} className="num">
                        {pos_pnl ? '+' : '-'}₹{Math.abs(pos.pnl || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '9px 10px', color: pos_pnl ? '#00E5A0' : '#FF455A' }} className="num">
                        {pos_pnl ? '+' : ''}{(pos.pnl_pct || 0).toFixed(2)}%
                      </td>
                      <td style={{ padding: '9px 10px' }}>
                        <span className={`badge ${STATUS_CLS[pos.status] || 'badge-hold'}`}>{pos.status}</span>
                      </td>
                      <td style={{ padding: '9px 10px' }}>
                        <button onClick={() => handleDelete(pos.id, pos.symbol)} className="badge badge-sell" style={{
                          cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                        }}>
                          REMOVE
                        </button>
                      </td>
                    </tr>
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
