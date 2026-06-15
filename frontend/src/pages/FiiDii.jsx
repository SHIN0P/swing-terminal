import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import Loader from '../components/Loader'
import { getFiiDii } from '../services/api'

const FMT = (v, d = 0) => (v || 0).toLocaleString('en-IN', { maximumFractionDigits: d })
const POS = v => (v || 0) >= 0

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#10141C', border: '1px solid #1A1F2B',
      borderRadius: 3, padding: '8px 12px', fontSize: 10,
    }}>
      <div style={{ color: '#4B5563', marginBottom: 4, letterSpacing: 1 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: (p.value || 0) >= 0 ? '#00E5A0' : '#FF455A' }}>
          {p.name}: {(p.value || 0) >= 0 ? '+' : ''}₹{FMT(p.value)} Cr
        </div>
      ))}
    </div>
  )
}

function MetricCard({ label, value, pos, delay = 0 }) {
  return (
    <div className="card-entrance hud-panel" style={{ padding: '12px 14px', animationDelay: `${delay}s` }}>
      <div style={{ fontSize: 8, color: '#4B5563', letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: pos ? '#00E5A0' : '#FF455A' }} className="num">
        {value < 0 ? '' : ''}₹{FMT(Math.abs(value || 0))} Cr
      </div>
      <div style={{ fontSize: 8, color: '#2A3040', marginTop: 3, letterSpacing: 1 }}>
        {pos ? '▲ INFLOW' : '▼ OUTFLOW'}
      </div>
    </div>
  )
}

export default function FiiDii() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setData(await getFiiDii(days))
      setLoading(false)
    }
    load()
  }, [days])

  const daily   = data?.daily_data || []
  const recent  = daily.slice(0, 5)
  const fii_buy_avg  = recent.reduce((a, d) => a + (d.fii_buy  || 0), 0) / (recent.length || 1)
  const fii_sell_avg = recent.reduce((a, d) => a + (d.fii_sell || 0), 0) / (recent.length || 1)
  const fii_net_5d   = recent.reduce((a, d) => a + (d.fii_net  || 0), 0)

  const chartData = [...daily].slice(0, days).reverse().map(d => ({
    date: d.date?.slice(0, 6) || '',
    fii:  Math.round(d.fii_net || 0),
    dii:  Math.round(d.dii_net || 0),
  }))

  let fiiC = 0, diiC = 0
  const cumData = chartData.map(d => {
    fiiC += d.fii; diiC += d.dii
    return { date: d.date, fii: fiiC, dii: diiC }
  })

  const sectorFlows = data?.sector_flows || []
  const bulkDeals   = data?.bulk_deals   || []
  const sigColor = (data?.scenario_label || '').includes('BULL') ? '#00E5A0'
    : (data?.scenario_label || '').includes('BEAR') ? '#FF455A'
    : '#FFB020'

  const AXIS_STYLE  = { fontSize: 9, fill: '#2A3040' }
  const CHART_STYLE = { background: '#10141C', border: '1px solid #1A1F2B', borderRadius: 4, padding: '12px 14px' }

  return (
    <div>
      <Loader isLoading={loading} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 8, color: '#00E5A0', letterSpacing: 3, fontWeight: 700, marginBottom: 2 }}>FII / DII INTELLIGENCE</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#C8D0DC' }}>Institutional Flow Monitor</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[10, 20, 30].map(d => (
            <button key={d} onClick={() => setDays(d)} className={days === d ? 'terminal-btn active' : 'terminal-btn-ghost'}>
              {d}D
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <MetricCard label="FII AVG BUY (5D)"  value={fii_buy_avg}  pos={true}  delay={0} />
        <MetricCard label="FII AVG SELL (5D)" value={fii_sell_avg} pos={false} delay={0.04} />
        <MetricCard label="FII NET (5D SUM)"  value={fii_net_5d}  pos={POS(fii_net_5d)} delay={0.08} />
        <MetricCard label="CUMUL. (10D)"      value={data?.cumulative_10d || 0} pos={POS(data?.cumulative_10d)} delay={0.12} />
      </div>

      {data?.scenario_label && (
        <div style={{
          padding: '10px 14px', borderRadius: 3, marginBottom: 16,
          background: sigColor + '10', border: `1px solid ${sigColor}25`,
          borderLeft: `3px solid ${sigColor}`,
          display: 'flex', gap: 14, alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: sigColor, letterSpacing: 1 }}>{data.scenario_label}</div>
            <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>{data.scenario_desc}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={CHART_STYLE}>
          <div className="section-header">
            <span className="section-header-label">FII Net Daily</span>
            <span className="section-header-accent" />
            <span style={{ fontSize: 8, color: '#2A3040' }}>₹ CR</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barCategoryGap="25%">
              <XAxis dataKey="date" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="fii" name="FII Net" radius={[2, 2, 0, 0]}>
                {chartData.map((e, i) => (
                  <Cell key={i} fill={e.fii >= 0 ? '#00E5A0' : '#FF455A'} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={CHART_STYLE}>
          <div className="section-header">
            <span className="section-header-label">Cumulative FII vs DII</span>
            <span className="section-header-accent" />
            <span style={{ fontSize: 8, color: '#2A3040' }}>₹ CR</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cumData}>
              <XAxis dataKey="date" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 9, color: '#4B5563' }} />
              <Line type="monotone" dataKey="fii" name="FII" stroke="#00E5A0" dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="dii" name="DII" stroke="#4D9FFF" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="hud-panel" style={{ padding: '14px', marginBottom: 12 }}>
        <div className="section-header">
          <span className="section-header-label">Sector Flows (Est. 10D)</span>
          <span className="section-header-accent" />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {['Sector', 'Est. Flow (₹ Cr)', 'Trend', 'Signal'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 8, color: '#2A3040', letterSpacing: 1, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectorFlows.map((s, i) => {
              const pos = POS(s.flow)
              return (
                <tr key={i} className="data-row">
                  <td style={{ padding: '8px 10px', color: '#C8D0DC', fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: '8px 10px', color: pos ? '#00E5A0' : '#FF455A' }} className="num">
                    {pos ? '+' : ''}₹{FMT(s.flow)}
                  </td>
                  <td style={{ padding: '8px 10px', color: pos ? '#00E5A0' : '#FF455A', fontSize: 13 }}>{s.trend}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span className={pos ? 'badge badge-buy' : 'badge badge-sell'}>
                      {pos ? 'INFLOW' : 'OUTFLOW'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="hud-panel" style={{ padding: '14px' }}>
        <div className="section-header">
          <span className="section-header-label">Bulk Deals</span>
          <span className="section-header-accent" />
          <span style={{ fontSize: 8, color: '#2A3040', letterSpacing: 1 }}>NSE · TODAY</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['Date', 'Stock', 'Institution', 'Type', 'Quantity', 'Price'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 8, color: '#2A3040', letterSpacing: 1, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bulkDeals.slice(0, 20).map((d, i) => (
                <tr key={i} className="data-row">
                  <td style={{ padding: '7px 10px', color: '#2A3040' }}>{d.date}</td>
                  <td style={{ padding: '7px 10px', color: '#C8D0DC', fontWeight: 700 }}>{d.symbol}</td>
                  <td style={{ padding: '7px 10px', color: '#4B5563', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.client_name}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <span className={d.buy_sell === 'BUY' ? 'badge badge-buy' : 'badge badge-sell'}>{d.buy_sell}</span>
                  </td>
                  <td style={{ padding: '7px 10px', color: '#8B99A8' }} className="num">{((d.quantity || 0) / 100000).toFixed(2)}L</td>
                  <td style={{ padding: '7px 10px', color: '#C8D0DC' }} className="num">₹{(d.price || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
