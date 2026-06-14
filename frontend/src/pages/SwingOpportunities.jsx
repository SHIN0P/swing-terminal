import { useState, useEffect } from 'react'
import Loader from '../components/Loader'
import ScoreGauge from '../components/ScoreGauge'
import { getOpportunities } from '../services/api'

const signalColors = {
  'STRONG BUY': '#00E5A0', 'BUY': '#58A6FF', 'WATCHLIST': '#E3B341',
  'HOLD': '#F97316', 'AVOID': '#F85149',
}

function ScoreBar({ label, value, max }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct >= 75 ? '#00E5A0' : pct >= 55 ? '#58A6FF' : pct >= 40 ? '#E3B341' : '#F85149'
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
        <span style={{ color: '#8B949E' }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{value}/{max}</span>
      </div>
      <div style={{ background: '#21293A', borderRadius: 3, height: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

function OpportunityCard({ op, index }) {
  const [expanded, setExpanded] = useState(false)
  const sc = signalColors[op.signal] || '#8B949E'

  return (
    <div className="card-entrance" style={{
      animationDelay: `${index * 0.1}s`,
      background: '#161B22',
      border: `1px solid ${sc}30`,
      borderRadius: 12,
      padding: '20px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#E6EDF3' }}>{op.symbol}</div>
          <div style={{ fontSize: 10, marginTop: 3 }}>
            <span style={{
              padding: '2px 8px', borderRadius: 10, fontSize: 9,
              background: '#21293A', color: '#8B949E',
            }}>{op.sector}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: sc }}>{op.composite_score}</div>
          <div style={{ fontSize: 9, color: '#8B949E' }}>/100</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <ScoreGauge score={op.composite_score} size="md" />
      </div>

      <div style={{
        width: '100%', textAlign: 'center', padding: '8px 0',
        background: sc + '18', border: `1px solid ${sc}40`,
        borderRadius: 6, fontSize: 12, fontWeight: 700, color: sc,
        letterSpacing: 2,
      }}>
        {op.signal}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'ENTRY ZONE', value: `₹${op.entry_zone_low} – ₹${op.entry_zone_high}`, color: '#58A6FF' },
          { label: 'STOP LOSS', value: `₹${op.stop_loss}`, color: '#F85149' },
          { label: 'TARGET 1', value: `₹${op.target_1}`, color: '#00E5A0' },
          { label: 'TARGET 2', value: `₹${op.target_2}`, color: '#00E5A0' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: '#0D1117', borderRadius: 8,
            padding: '10px 12px', border: '1px solid #21293A',
          }}>
            <div style={{ fontSize: 9, color: '#8B949E', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'R:R', value: `${op.risk_reward}:1`, color: (op.risk_reward || 0) >= 2 ? '#00E5A0' : '#E3B341' },
          { label: 'HOLD', value: op.hold_days || '7-15d', color: '#8B949E' },
          { label: 'SL%', value: `${op.sl_pct}%`, color: '#F85149' },
          { label: 'T1%', value: `+${op.t1_pct}%`, color: '#00E5A0' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center', background: '#0D1117', borderRadius: 6, padding: '8px 4px' }}>
            <div style={{ fontSize: 8, color: '#8B949E', letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      <div>
        <ScoreBar label="Technical" value={op.tech_score || 0} max={40} />
        <ScoreBar label="FII / DII" value={op.fii_dii_score || 0} max={25} />
        <ScoreBar label="Fundamental" value={op.fundamental_score || 0} max={20} />
        <ScoreBar label="Sector" value={op.sector_score || 0} max={15} />
      </div>

      <button onClick={() => setExpanded(!expanded)} style={{
        width: '100%', background: 'none', border: '1px solid #21293A',
        color: '#8B949E', padding: '8px 0', borderRadius: 6,
        fontSize: 11, cursor: 'pointer', letterSpacing: 1,
      }}>
        {expanded ? '▲ HIDE DETAILS' : '▼ WHY THIS STOCK'}
      </button>

      {expanded && (
        <div style={{ animation: 'slideUp 0.3s ease' }}>
          <div style={{ fontSize: 11, color: '#00E5A0', letterSpacing: 1, marginBottom: 8 }}>WHY THIS STOCK</div>
          {(op.reasons || []).map((r, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, marginBottom: 6,
              fontSize: 11, color: '#8B949E', lineHeight: 1.5,
            }}>
              <span style={{ color: '#00E5A0', flexShrink: 0 }}>✓</span>
              {r}
            </div>
          ))}

          <div style={{ fontSize: 11, color: '#F85149', letterSpacing: 1, marginTop: 14, marginBottom: 8 }}>KEY RISKS</div>
          {(op.risks || []).map((r, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, marginBottom: 6,
              fontSize: 11, color: '#8B949E', lineHeight: 1.5,
            }}>
              <span style={{ color: '#F85149', flexShrink: 0 }}>⚠</span>
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SwingOpportunities() {
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const data = await getOpportunities()
      setOpportunities(data)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <Loader isLoading={loading} />

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#00E5A0', letterSpacing: 3, fontWeight: 700 }}>SWING SETUPS</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: '#E6EDF3' }}>Swing Opportunities</h1>
      </div>

      <div style={{
        padding: '12px 16px', borderRadius: 8, marginBottom: 24,
        background: 'rgba(227,179,65,0.1)',
        border: '1px solid #E3B34140',
        fontSize: 12, color: '#E3B341',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>⚠</span>
        <span>Pick max 3 stocks. Never enter more positions simultaneously. Manage position size per your risk tolerance.</span>
      </div>

      {opportunities.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 64, color: '#8B949E', fontSize: 13 }}>
          No high-scoring opportunities right now. Try refreshing data.
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 16,
      }}>
        {opportunities.map((op, i) => (
          <OpportunityCard key={op.symbol} op={op} index={i} />
        ))}
      </div>
    </div>
  )
}
