import { useState, useEffect } from 'react'
import Loader from '../components/Loader'
import ScoreGauge from '../components/ScoreGauge'
import { getOpportunities } from '../services/api'

const SIG_CLS = {
  'STRONG BUY': 'badge-strong', 'BUY': 'badge-buy', 'WATCHLIST': 'badge-watch',
  'HOLD': 'badge-hold', 'AVOID': 'badge-avoid',
}
const SIG_C = {
  'STRONG BUY': '#00E5A0', 'BUY': '#4D9FFF', 'WATCHLIST': '#FFB020',
  'HOLD': '#F97316', 'AVOID': '#FF455A',
}

function ScoreBar({ label, value, max }) {
  const pct = Math.min(100, (value / max) * 100)
  const c = pct >= 75 ? '#00E5A0' : pct >= 55 ? '#4D9FFF' : pct >= 40 ? '#FFB020' : '#FF455A'
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 3 }}>
        <span style={{ color: '#4B5563', letterSpacing: 1 }}>{label}</span>
        <span style={{ color: c, fontWeight: 700 }} className="num">{value}/{max}</span>
      </div>
      <div style={{ background: '#0A0E14', borderRadius: 1, height: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: c, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

function OpCard({ op, index }) {
  const [expanded, setExpanded] = useState(false)
  const sc = SIG_C[op.signal] || '#4B5563'

  return (
    <div className="card-entrance" style={{
      animationDelay: `${index * 0.08}s`,
      background: '#10141C', border: `1px solid ${sc}20`,
      borderRadius: 4, padding: '14px', display: 'flex', flexDirection: 'column', gap: 12,
      borderTop: `2px solid ${sc}40`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#C8D0DC' }}>
            {op.symbol}
            {op.price_source === 'estimated' && (
              <span style={{
                marginLeft: 6, fontSize: 7, fontWeight: 700, letterSpacing: 0.5,
                color: '#FFB020', border: '1px solid rgba(255,176,32,0.3)',
                borderRadius: 2, padding: '1px 4px', verticalAlign: 'middle',
              }} title="yfinance unreachable for this symbol — levels based on synthetic fallback price">EST</span>
            )}
          </div>
          <div style={{ fontSize: 8, color: '#2A3040', marginTop: 3, letterSpacing: 1 }}>{op.sector}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`badge ${SIG_CLS[op.signal] || 'badge-hold'}`}>{op.signal}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid #0F1318', paddingTop: 10 }}>
        <ScoreGauge score={op.composite_score} size="md" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[
          { label: 'ENTRY ZONE', value: `₹${op.entry_zone_low}–${op.entry_zone_high}`, color: '#4D9FFF' },
          { label: 'STOP LOSS',  value: `₹${op.stop_loss}`,    color: '#FF455A' },
          { label: 'TARGET 1',   value: `₹${op.target_1}`,     color: '#00E5A0' },
          { label: 'TARGET 2',   value: `₹${op.target_2}`,     color: '#00E5A0' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: '#0A0E14', borderRadius: 3,
            padding: '8px 10px', border: '1px solid #0F1318',
          }}>
            <div style={{ fontSize: 8, color: '#2A3040', letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color }} className="num">{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
        {[
          { label: 'R:R',  value: `${op.risk_reward}:1`, color: (op.risk_reward || 0) >= 2 ? '#00E5A0' : '#FFB020' },
          { label: 'HOLD', value: op.hold_days || '7-15d', color: '#4B5563' },
          { label: 'SL%',  value: `${op.sl_pct}%`,  color: '#FF455A' },
          { label: 'T1%',  value: `+${op.t1_pct}%`, color: '#00E5A0' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center', background: '#0A0E14', borderRadius: 2, padding: '7px 4px', border: '1px solid #0F1318' }}>
            <div style={{ fontSize: 7, color: '#2A3040', letterSpacing: 1, fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 2 }} className="num">{value}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #0F1318', paddingTop: 8 }}>
        <ScoreBar label="TECHNICAL"   value={op.tech_score || 0}       max={40} />
        <ScoreBar label="FII / DII"   value={op.fii_dii_score || 0}    max={25} />
        <ScoreBar label="FUNDAMENTAL" value={op.fundamental_score || 0} max={20} />
        <ScoreBar label="SECTOR"      value={op.sector_score || 0}      max={15} />
      </div>

      <button onClick={() => setExpanded(!expanded)} style={{
        width: '100%', background: 'none', border: '1px solid #0F1318',
        color: '#2A3040', padding: '6px 0', borderRadius: 2,
        fontSize: 8, cursor: 'pointer', letterSpacing: 2, fontFamily: 'inherit',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1A1F2B'; e.currentTarget.style.color = '#4B5563' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#0F1318'; e.currentTarget.style.color = '#2A3040' }}
      >
        {expanded ? '▲ HIDE ANALYSIS' : '▼ WHY THIS STOCK'}
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #0F1318', paddingTop: 10 }}>
          {(op.reasons || []).length > 0 && (
            <>
              <div style={{ fontSize: 8, color: '#00E5A0', letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>BULLISH FACTORS</div>
              {(op.reasons || []).map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, fontSize: 10, color: '#4B5563', lineHeight: 1.5 }}>
                  <span style={{ color: '#00E5A0', flexShrink: 0 }}>✓</span>{r}
                </div>
              ))}
            </>
          )}
          {(op.risks || []).length > 0 && (
            <>
              <div style={{ fontSize: 8, color: '#FF455A', letterSpacing: 2, marginTop: 10, marginBottom: 6, fontWeight: 700 }}>KEY RISKS</div>
              {(op.risks || []).map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, fontSize: 10, color: '#4B5563', lineHeight: 1.5 }}>
                  <span style={{ color: '#FF455A', flexShrink: 0 }}>⚠</span>{r}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function SwingOpportunities() {
  const [opps, setOpps]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setOpps(await getOpportunities())
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <Loader isLoading={loading} />

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 8, color: '#00E5A0', letterSpacing: 3, fontWeight: 700, marginBottom: 2 }}>SWING SETUPS</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#C8D0DC' }}>Top Opportunities</div>
      </div>

      <div style={{
        padding: '10px 14px', borderRadius: 3, marginBottom: 20,
        background: 'rgba(255,176,32,0.06)', border: '1px solid rgba(255,176,32,0.15)',
        borderLeft: '3px solid #FFB020',
        fontSize: 10, color: '#FFB020',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 14 }}>⚠</span>
        <span>Max 3 positions simultaneously. Size based on your risk tolerance. Not financial advice.</span>
      </div>

      {opps.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 64, color: '#2A3040', fontSize: 11, letterSpacing: 2 }}>
          NO HIGH-SCORING SETUPS — REFRESH DATA
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {opps.map((op, i) => (
          <OpCard key={op.symbol} op={op} index={i} />
        ))}
      </div>
    </div>
  )
}
