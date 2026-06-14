import { useState, useEffect } from 'react'
import Loader from '../components/Loader'
import useCountUp from '../hooks/useCountUp'
import { getPortfolio, addPosition, deletePosition } from '../services/api'

const STATUS_STYLE = {
  'ON TRACK':   { bg: 'rgba(88,166,255,0.12)',  color: '#58A6FF',  border: '#58A6FF40' },
  'TRAIL STOP': { bg: 'rgba(0,229,160,0.12)',   color: '#00E5A0',  border: '#00E5A040' },
  'REVIEW':     { bg: 'rgba(227,179,65,0.12)',  color: '#E3B341',  border: '#E3B34140' },
  'EXIT':       { bg: 'rgba(248,81,73,0.12)',   color: '#F85149',  border: '#F8514940' },
  'TARGET HIT': { bg: 'rgba(0,229,160,0.2)',    color: '#00FF88',  border: '#00FF8840' },
}

const INPUT_STYLE = {
  background: '#0D1117', border: '1px solid #21293A',
  borderRadius: 6, color: '#E6EDF3', padding: '9px 12px',
  fontSize: 12, outline: 'none', width: '100%',
}

function SummaryCard({ label, value, prefix = '₹', color = '#E6EDF3' }) {
  const animated = useCountUp(Math.abs(value || 0))
  return (
    <div style={{ background: '#161B22', border: '1px solid #21293A', borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, color: '#8B949E', letterSpacing: 2, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>
        {value < 0 ? '-' : ''}{prefix}{animated.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </div>
    </div>
  )
}

const EMPTY_FORM = { symbol: '', entry_price: '', quantity: '', stop_loss: '', target: '' }

export default function Portfolio() {
  const [portfolio, setPortfolio] = useState({ positions: [], summary: {} })
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const data = await getPortfolio()
    setPortfolio(data || { positions: [], summary: {} })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    const { symbol, entry_price, quantity, stop_loss, target } = form
    if (!symbol || !entry_price || !quantity || !stop_loss || !target) {
      setError('All fields are required.')
      return
    }
    if (isNaN(entry_price) || isNaN(quantity) || isNaN(stop_loss) || isNaN(target)) {
      setError('Price/Qty fields must be numbers.')
      return
    }
    if (+stop_loss >= +entry_price) { setError('Stop loss must be below entry price.'); return }
    if (+target <= +entry_price) { setError('Target must be above entry price.'); return }

    setAdding(true)
    setError('')
    await addPosition({
      symbol: symbol.toUpperCase(),
      entry_price: +entry_price,
      quantity: +quantity,
      stop_loss: +stop_loss,
      target: +target,
    })
    setForm(EMPTY_FORM)
    await load()
    setAdding(false)
  }

  const handleDelete = async (id, sym) => {
    if (!window.confirm(`Remove ${sym} from portfolio?`)) return
    await deletePosition(id)
    await load()
  }

  const s = portfolio.summary || {}
  const pnlPositive = (s.total_pnl || 0) >= 0

  return (
    <div>
      <Loader isLoading={loading} />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#00E5A0', letterSpacing: 3, fontWeight: 700 }}>PORTFOLIO TRACKER</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: '#E6EDF3' }}>My Positions</h1>
      </div>

      <div style={{ background: '#161B22', border: '1px solid #21293A', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#8B949E', letterSpacing: 2, marginBottom: 16 }}>ADD POSITION</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 12 }}>
          {[
            { key: 'symbol',      label: 'SYMBOL',      placeholder: 'RELIANCE' },
            { key: 'entry_price', label: 'ENTRY PRICE', placeholder: '1293.00' },
            { key: 'quantity',    label: 'QUANTITY',    placeholder: '10' },
            { key: 'stop_loss',   label: 'STOP LOSS',   placeholder: '1240.00' },
            { key: 'target',      label: 'TARGET',      placeholder: '1400.00' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <div style={{ fontSize: 9, color: '#8B949E', letterSpacing: 1, marginBottom: 5 }}>{label}</div>
              <input
                value={form[key]}
                onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setError('') }}
                placeholder={placeholder}
                style={{
                  ...INPUT_STYLE,
                  borderColor: '#21293A',
                }}
                onFocus={e => e.target.style.borderColor = '#00E5A0'}
                onBlur={e => e.target.style.borderColor = '#21293A'}
              />
            </div>
          ))}
        </div>

        {error && (
          <div style={{ fontSize: 11, color: '#F85149', marginBottom: 10 }}>⚠ {error}</div>
        )}

        <button onClick={handleAdd} disabled={adding} style={{
          padding: '10px 28px', borderRadius: 8,
          background: adding ? '#21293A' : '#00E5A0',
          color: adding ? '#8B949E' : '#080C10',
          border: 'none', fontSize: 12, fontWeight: 700,
          cursor: adding ? 'default' : 'pointer',
          letterSpacing: 1,
        }}>
          {adding ? 'ADDING...' : '+ ADD POSITION'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <SummaryCard label="TOTAL INVESTED" value={s.total_invested || 0} />
        <SummaryCard label="CURRENT VALUE" value={s.total_current || 0} color={pnlPositive ? '#00E5A0' : '#F85149'} />
        <SummaryCard label="TOTAL P&L" value={s.total_pnl || 0} color={pnlPositive ? '#00E5A0' : '#F85149'} />
        <div style={{ background: '#161B22', border: '1px solid #21293A', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, color: '#8B949E', letterSpacing: 2, marginBottom: 6 }}>P&L %</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: pnlPositive ? '#00E5A0' : '#F85149' }}>
            {pnlPositive ? '+' : ''}{(s.total_pnl_pct || 0).toFixed(2)}%
          </div>
        </div>
      </div>

      <div style={{ background: '#161B22', border: '1px solid #21293A', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #21293A', fontSize: 11, color: '#8B949E', letterSpacing: 2, fontWeight: 700 }}>
          OPEN POSITIONS
        </div>

        {(portfolio.positions || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: '#8B949E', fontSize: 13 }}>
            No open positions. Add your first trade above.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #21293A', background: '#0D1117' }}>
                  {['Stock', 'Entry', 'Current', 'Qty', 'P&L ₹', 'P&L%', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, color: '#8B949E', letterSpacing: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((pos, i) => {
                  const pnlPos = (pos.pnl || 0) >= 0
                  const st = STATUS_STYLE[pos.status] || STATUS_STYLE['ON TRACK']
                  return (
                    <tr key={pos.id} className="card-entrance" style={{ animationDelay: `${i * 0.05}s`, borderBottom: '1px solid #21293A15' }}>
                      <td style={{ padding: '12px 14px', color: '#E6EDF3', fontWeight: 700 }}>{pos.symbol}</td>
                      <td style={{ padding: '12px 14px', color: '#8B949E' }}>₹{(pos.entry_price || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 14px', color: pnlPos ? '#00E5A0' : '#F85149', fontWeight: 600 }}>₹{(pos.current_price || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 14px', color: '#8B949E' }}>{pos.quantity}</td>
                      <td style={{ padding: '12px 14px', color: pnlPos ? '#00E5A0' : '#F85149', fontWeight: 700 }}>
                        {pnlPos ? '+' : ''}₹{Math.abs(pos.pnl || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '12px 14px', color: pnlPos ? '#00E5A0' : '#F85149' }}>
                        {pnlPos ? '+' : ''}{(pos.pnl_pct || 0).toFixed(2)}%
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                        }}>{pos.status}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button onClick={() => handleDelete(pos.id, pos.symbol)} style={{
                          background: 'rgba(248,81,73,0.1)', border: '1px solid #F8514940',
                          color: '#F85149', padding: '4px 10px', borderRadius: 4,
                          fontSize: 10, cursor: 'pointer',
                        }}>REMOVE</button>
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
