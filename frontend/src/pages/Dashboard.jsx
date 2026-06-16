import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Loader from '../components/Loader'
import SectorHeatmap from '../components/SectorHeatmap'
import ScoreGauge from '../components/ScoreGauge'
import RegimeBanner from '../components/RegimeBanner'
import { getMarketPulse, getSectors, getOpportunities } from '../services/api'

const FMT  = (v, d = 2) => (v || 0).toLocaleString('en-IN', { maximumFractionDigits: d })
const CHG  = v => (v || 0) >= 0
const SIGN = v => (v || 0) >= 0 ? '+' : ''

function IndexCard({ label, value, change, extra, delay = 0 }) {
  const pos = CHG(change)
  return (
    <div className="card-entrance hud-panel" style={{ padding: '12px 14px', animationDelay: `${delay}s` }}>
      <div style={{ fontSize: 8, color: '#4B5563', letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: '#C8D0DC', letterSpacing: -0.5 }} className="num">
        {FMT(value)}
      </div>
      {change !== undefined && (
        <div style={{ fontSize: 10, color: pos ? '#00E5A0' : '#FF455A', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
          <span>{pos ? '▲' : '▼'}</span>
          <span className="num">{Math.abs(change || 0).toFixed(2)}%</span>
        </div>
      )}
      {extra}
    </div>
  )
}

function FlowCard({ label, net, delay = 0 }) {
  const pos = (net || 0) >= 0
  return (
    <div className="card-entrance" style={{
      animationDelay: `${delay}s`,
      background: '#10141C', border: `1px solid ${pos ? 'rgba(0,229,160,0.12)' : 'rgba(255,69,90,0.12)'}`,
      borderRadius: 4, padding: '12px 14px',
    }}>
      <div style={{ fontSize: 8, color: '#4B5563', letterSpacing: 2, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: pos ? '#00E5A0' : '#FF455A' }} className="num">
        {pos ? '+' : ''}₹{FMT(Math.abs(net || 0), 0)} Cr
      </div>
      <div style={{ fontSize: 9, color: '#2A3040', marginTop: 4, letterSpacing: 1 }}>
        {pos ? '▲ NET BUYING' : '▼ NET SELLING'} TODAY
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [pulse, setPulse]   = useState(null)
  const [sectors, setSectors] = useState([])
  const [opps, setOpps]     = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [p, s, o] = await Promise.all([getMarketPulse(), getSectors(), getOpportunities()])
      setPulse(p); setSectors(s); setOpps(o)
      setLoading(false)
    }
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const vixColor = (v) => (v || 0) > 20 ? '#FF455A' : (v || 0) > 15 ? '#FFB020' : '#00E5A0'
  const sigColor = pulse?.signal_color || '#4B5563'

  const SECONDARY_INDICES = [
    { label: 'NIFTY IT',     val: pulse?.nifty_it,     chg: pulse?.nifty_it_change },
    { label: 'NIFTY AUTO',   val: pulse?.nifty_auto,   chg: pulse?.nifty_auto_change },
    { label: 'NIFTY PHARMA', val: pulse?.nifty_pharma, chg: pulse?.nifty_pharma_change },
    { label: 'NIFTY FMCG',   val: pulse?.nifty_fmcg,  chg: pulse?.nifty_fmcg_change },
    { label: 'NIFTY METAL',  val: pulse?.nifty_metal,  chg: pulse?.nifty_metal_change },
  ]

  return (
    <div>
      <Loader isLoading={loading} />

      <RegimeBanner />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 8, color: '#00E5A0', letterSpacing: 3, fontWeight: 700, marginBottom: 2 }}>
            MARKET DASHBOARD
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#C8D0DC' }}>
            Indian Market Overview
          </div>
        </div>
        <div style={{ fontSize: 9, color: '#2A3040', textAlign: 'right', letterSpacing: 1 }}>
          <div>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div style={{ marginTop: 2 }}>
            {pulse?.data_source && <span>SRC: {pulse.data_source?.toUpperCase()}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
        <IndexCard label="NIFTY 50"   value={pulse?.nifty50}   change={pulse?.nifty50_change}   delay={0} />
        <IndexCard label="SENSEX"     value={pulse?.sensex}    change={pulse?.sensex_change}    delay={0.04} />
        <IndexCard label="BANK NIFTY" value={pulse?.nifty_bank} change={pulse?.nifty_bank_change} delay={0.08} />
        <IndexCard label="INDIA VIX"  value={pulse?.india_vix} change={pulse?.india_vix_change} delay={0.12}
          extra={
            <div style={{ fontSize: 8, color: vixColor(pulse?.india_vix), marginTop: 4, letterSpacing: 1 }}>
              {(pulse?.india_vix || 0) > 20 ? '● PANIC ZONE' : (pulse?.india_vix || 0) > 15 ? '● CAUTION' : '● STABLE'}
            </div>
          }
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 16 }}>
        {SECONDARY_INDICES.map((idx, i) => {
          const pos = CHG(idx.chg)
          return (
            <div key={idx.label} className="card-entrance" style={{
              animationDelay: `${0.15 + i * 0.04}s`,
              background: '#0A0E14', border: '1px solid #0F1318',
              borderRadius: 3, padding: '8px 10px',
            }}>
              <div style={{ fontSize: 8, color: '#2A3040', letterSpacing: 1, marginBottom: 4 }}>{idx.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8B99A8' }} className="num">
                {FMT(idx.val)}
              </div>
              <div style={{ fontSize: 9, color: pos ? '#00E5A0' : '#FF455A', marginTop: 2 }} className="num">
                {pos ? '▲' : '▼'} {Math.abs(idx.chg || 0).toFixed(2)}%
              </div>
            </div>
          )
        })}
      </div>

      {pulse?.market_signal && (
        <div style={{
          padding: '10px 14px', borderRadius: 3, marginBottom: 16,
          background: sigColor + '12',
          border: `1px solid ${sigColor}30`,
          borderLeft: `3px solid ${sigColor}`,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: sigColor, letterSpacing: 1 }}>
              {pulse.market_signal}
            </div>
            <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>{pulse.market_signal_text}</div>
          </div>
          {pulse.last_updated && (
            <div style={{ marginLeft: 'auto', fontSize: 8, color: '#1A1F2B', letterSpacing: 1 }}>
              UPDATED {pulse.last_updated}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        <FlowCard label="FII — FOREIGN INSTITUTIONS" net={pulse?.fii_today} delay={0.2} />
        <FlowCard label="DII — DOMESTIC INSTITUTIONS" net={pulse?.dii_today} delay={0.24} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        <div className="hud-panel" style={{ padding: '14px' }}>
          <div className="section-header">
            <span className="section-header-label">Sector Heatmap</span>
            <span className="section-header-accent" />
            <span style={{ fontSize: 8, color: '#1A1F2B', letterSpacing: 1 }}>1D CHANGE</span>
          </div>
          <SectorHeatmap sectors={sectors} />
        </div>

        <div className="hud-panel" style={{ padding: '14px' }}>
          <div className="section-header">
            <span className="section-header-label">Top Setups</span>
            <span className="section-header-accent" />
            <button onClick={() => navigate('/opportunities')} style={{
              background: 'none', border: 'none', color: '#00E5A0',
              fontSize: 8, cursor: 'pointer', letterSpacing: 1, fontFamily: 'inherit',
            }}>ALL →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {opps.slice(0, 6).map((op, i) => {
              const sc = op.composite_score || 0
              const c = sc >= 80 ? '#00E5A0' : sc >= 65 ? '#4D9FFF' : '#FFB020'
              return (
                <div key={op.symbol} className="card-entrance data-row" style={{
                  animationDelay: `${i * 0.06}s`,
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 6px', position: 'relative',
                  background: 'transparent',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#C8D0DC' }}>{op.symbol}</div>
                    <div style={{ fontSize: 8, color: '#2A3040', marginTop: 1 }}>{op.sector}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c }} className="num">{sc}</div>
                    <div style={{ fontSize: 8, color: '#2A3040' }}>/ 100</div>
                  </div>
                  <div style={{ width: 2, height: 28, background: c + '60', borderRadius: 1 }} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
