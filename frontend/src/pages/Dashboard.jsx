import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Loader from '../components/Loader'
import SectorHeatmap from '../components/SectorHeatmap'
import ScoreGauge from '../components/ScoreGauge'
import useCountUp from '../hooks/useCountUp'
import { getMarketPulse, getSectors, getOpportunities } from '../services/api'

export default function Dashboard() {
  const [pulse, setPulse] = useState(null)
  const [sectors, setSectors] = useState([])
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [p, s, o] = await Promise.all([getMarketPulse(), getSectors(), getOpportunities()])
      setPulse(p)
      setSectors(s)
      setOpportunities(o)
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const n50 = useCountUp(pulse?.nifty50 || 0)
  const sx  = useCountUp(pulse?.sensex || 0)
  const vix = useCountUp(pulse?.india_vix || 0, 800)
  const nb  = useCountUp(pulse?.nifty_bank || 0)

  const card = (label, value, change, extra) => (
    <div className="card-entrance" style={{
      background: '#161B22', border: '1px solid #21293A',
      borderRadius: 10, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 10, color: '#8B949E', letterSpacing: 2, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#E6EDF3' }}>
        {value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </div>
      {change !== undefined && (
        <div style={{ fontSize: 12, color: change >= 0 ? '#00E5A0' : '#F85149', marginTop: 3 }}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </div>
      )}
      {extra}
    </div>
  )

  return (
    <div>
      <Loader isLoading={loading} />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#00E5A0', letterSpacing: 3, fontWeight: 700 }}>
          SWING INTELLIGENCE TERMINAL
        </div>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: '#E6EDF3' }}>
          Market Dashboard
        </h1>
        <div style={{ fontSize: 11, color: '#8B949E', marginTop: 3 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {card('NIFTY 50', n50, pulse?.nifty50_change)}
        {card('SENSEX', sx, pulse?.sensex_change)}
        {card('INDIA VIX', parseFloat((vix || 0).toFixed(1)), undefined,
          <div style={{ fontSize: 10, marginTop: 3,
            color: (pulse?.india_vix || 0) > 18 ? '#F85149' : (pulse?.india_vix || 0) > 14 ? '#E3B341' : '#00E5A0' }}>
            {(pulse?.india_vix || 0) > 18 ? '⚠ HIGH ALERT' : (pulse?.india_vix || 0) > 14 ? '● ELEVATED' : '● CALM'}
          </div>
        )}
        {card('NIFTY BANK', nb, pulse?.nifty_bank_change)}
      </div>

      {pulse && (
        <div style={{
          padding: '14px 18px', borderRadius: 8, marginBottom: 24,
          background: (pulse.signal_color || '#8B949E') + '20',
          borderLeft: `4px solid ${pulse.signal_color || '#8B949E'}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: pulse.signal_color || '#8B949E' }}>
            {pulse.market_signal === 'BULLISH' ? '📈' :
             pulse.market_signal === 'RANGE-BOUND' ? '↔️' :
             pulse.market_signal === 'BEARISH' ? '📉' : '⚠️'} {pulse.market_signal}
          </div>
          <div style={{ fontSize: 11, color: '#8B949E', marginTop: 3 }}>
            {pulse.market_signal_text}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'FOREIGN INSTITUTIONS (FII)', net: pulse?.fii_today },
          { label: 'DOMESTIC INSTITUTIONS (DII)', net: pulse?.dii_today },
        ].map(({ label, net }) => (
          <div key={label} style={{
            background: '#161B22', border: '1px solid #21293A',
            borderRadius: 10, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 9, color: '#8B949E', letterSpacing: 2, marginBottom: 8 }}>
              {label} — TODAY
            </div>
            <div style={{
              fontSize: 20, fontWeight: 700,
              color: (net || 0) >= 0 ? '#00E5A0' : '#F85149',
            }}>
              {(net || 0) >= 0 ? '+' : ''}₹{Math.abs(net || 0).toLocaleString('en-IN')} Cr
            </div>
            <div style={{ fontSize: 10, color: '#8B949E', marginTop: 2 }}>
              {(net || 0) >= 0 ? 'Net Buying' : 'Net Selling'}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#8B949E', letterSpacing: 2, marginBottom: 12, fontWeight: 700 }}>
          SECTOR PERFORMANCE TODAY
        </div>
        <SectorHeatmap sectors={sectors} />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#8B949E', letterSpacing: 2, fontWeight: 700 }}>
            TODAY'S TOP SETUPS
          </div>
          <button onClick={() => navigate('/opportunities')} style={{
            background: 'none', border: '1px solid #21293A',
            color: '#00E5A0', fontSize: 10, padding: '4px 10px',
            borderRadius: 4, cursor: 'pointer', letterSpacing: 1,
          }}>
            VIEW ALL →
          </button>
        </div>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {opportunities.slice(0, 5).map((op, i) => (
            <div key={op.symbol} className="card-entrance"
              style={{ animationDelay: `${i * 0.1}s`, flexShrink: 0 }}>
              <div style={{
                background: '#161B22', border: '1px solid #21293A',
                borderRadius: 10, padding: '14px 16px', minWidth: 150,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', marginBottom: 4 }}>
                  {op.symbol}
                </div>
                <div style={{ fontSize: 9, color: '#8B949E', marginBottom: 10 }}>
                  {op.sector}
                </div>
                <ScoreGauge score={op.composite_score} size="sm" />
                <div style={{ fontSize: 10, color: '#8B949E', marginTop: 8 }}>
                  Entry ₹{op.entry_zone_low}+
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
