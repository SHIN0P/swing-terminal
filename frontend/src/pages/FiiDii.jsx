import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import Loader from '../components/Loader'
import useCountUp from '../hooks/useCountUp'
import { getFiiDii, getBulkDeals } from '../services/api'

const CARD = ({ label, value, color, suffix = '' }) => {
  const animated = useCountUp(Math.abs(value || 0))
  return (
    <div style={{
      background: '#161B22', border: '1px solid #21293A',
      borderRadius: 10, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 10, color: '#8B949E', letterSpacing: 2, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>
        {value < 0 ? '-' : ''}₹{animated.toLocaleString('en-IN', { maximumFractionDigits: 0 })}{suffix} Cr
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#161B22', border: '1px solid #21293A', borderRadius: 8, padding: '10px 14px', fontSize: 11 }}>
      <div style={{ color: '#8B949E', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.value >= 0 ? '#00E5A0' : '#F85149' }}>
          {p.name}: ₹{p.value?.toLocaleString('en-IN')} Cr
        </div>
      ))}
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
      const d = await getFiiDii(days)
      setData(d)
      setLoading(false)
    }
    load()
  }, [days])

  const daily = data?.daily_data || []
  const recent = daily.slice(0, 5)
  const fii_buy = recent.reduce((a, d) => a + (d.fii_buy || 0), 0) / (recent.length || 1)
  const fii_sell = recent.reduce((a, d) => a + (d.fii_sell || 0), 0) / (recent.length || 1)
  const fii_net_avg = recent.reduce((a, d) => a + (d.fii_net || 0), 0)

  const chartData = daily.slice(0, days).reverse().map(d => ({
    date: d.date?.slice(0, 6) || '',
    fii: Math.round(d.fii_net || 0),
    dii: Math.round(d.dii_net || 0),
  }))

  let fiiCum = 0, diiCum = 0
  const cumulativeData = chartData.map(d => {
    fiiCum += d.fii
    diiCum += d.dii
    return { date: d.date, fii: fiiCum, dii: diiCum }
  })

  const sectorFlows = data?.sector_flows || []
  const bulkDeals = data?.bulk_deals || []

  const signalColor = (data?.scenario_label || '').includes('BULL') ? '#00E5A0'
    : (data?.scenario_label || '').includes('BEAR') ? '#F85149'
    : (data?.scenario_label || '').includes('RISK') ? '#F85149'
    : '#E3B341'

  return (
    <div>
      <Loader isLoading={loading} />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#00E5A0', letterSpacing: 3, fontWeight: 700 }}>FII / DII INTELLIGENCE</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: '#E6EDF3' }}>Institutional Flow Monitor</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <CARD label="FII AVG BUY (5D)" value={fii_buy} color="#00E5A0" />
        <CARD label="FII AVG SELL (5D)" value={fii_sell} color="#F85149" />
        <CARD label="FII NET (5D)" value={fii_net_avg} color={fii_net_avg >= 0 ? '#00E5A0' : '#F85149'} />
        <CARD label="CUMULATIVE (10D)" value={data?.cumulative_10d || 0} color={data?.cumulative_10d >= 0 ? '#00E5A0' : '#F85149'} />
      </div>

      {data?.scenario_label && (
        <div style={{
          padding: '14px 18px', borderRadius: 8, marginBottom: 24,
          background: signalColor + '15',
          borderLeft: `4px solid ${signalColor}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: signalColor }}>{data.scenario_label}</div>
          <div style={{ fontSize: 11, color: '#8B949E', marginTop: 3 }}>{data.scenario_desc}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[10, 20, 30].map(d => (
          <button key={d} onClick={() => setDays(d)} style={{
            padding: '5px 14px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
            background: days === d ? '#00E5A0' : 'transparent',
            color: days === d ? '#080C10' : '#8B949E',
            border: `1px solid ${days === d ? '#00E5A0' : '#21293A'}`,
            fontWeight: days === d ? 700 : 400,
          }}>{d}D</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#161B22', border: '1px solid #21293A', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 11, color: '#8B949E', letterSpacing: 2, marginBottom: 16 }}>FII NET DAILY FLOW (₹ Cr)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8B949E' }} />
              <YAxis tick={{ fontSize: 9, fill: '#8B949E' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="fii" name="FII Net">
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fii >= 0 ? '#00E5A0' : '#F85149'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#161B22', border: '1px solid #21293A', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 11, color: '#8B949E', letterSpacing: 2, marginBottom: 16 }}>CUMULATIVE FII vs DII (₹ Cr)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={cumulativeData}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8B949E' }} />
              <YAxis tick={{ fontSize: 9, fill: '#8B949E' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="fii" name="FII Cumulative" stroke="#00E5A0" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="dii" name="DII Cumulative" stroke="#58A6FF" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: '#161B22', border: '1px solid #21293A', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#8B949E', letterSpacing: 2, marginBottom: 14 }}>ESTIMATED SECTOR FLOWS (10D)</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #21293A' }}>
                {['Sector', 'Est. Flow (₹ Cr)', 'Trend', 'Signal'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#8B949E', letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectorFlows.map((s, i) => {
                const isPos = s.flow >= 0
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #21293A15' }}>
                    <td style={{ padding: '10px 12px', color: '#E6EDF3', fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: '10px 12px', color: isPos ? '#00E5A0' : '#F85149' }}>
                      {isPos ? '+' : ''}₹{(s.flow || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '10px 12px', color: isPos ? '#00E5A0' : '#F85149', fontSize: 14 }}>{s.trend}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: isPos ? 'rgba(0,229,160,0.12)' : 'rgba(248,81,73,0.12)',
                        color: isPos ? '#00E5A0' : '#F85149',
                        border: `1px solid ${isPos ? '#00E5A040' : '#F8514940'}`,
                      }}>
                        {isPos ? 'INFLOW' : 'OUTFLOW'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: '#161B22', border: '1px solid #21293A', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 11, color: '#8B949E', letterSpacing: 2, marginBottom: 14 }}>RECENT BULK DEALS</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #21293A' }}>
                {['Date', 'Stock', 'Institution', 'Type', 'Qty (L)', 'Price'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#8B949E', letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bulkDeals.slice(0, 15).map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #21293A15' }}>
                  <td style={{ padding: '10px 12px', color: '#8B949E' }}>{d.date}</td>
                  <td style={{ padding: '10px 12px', color: '#E6EDF3', fontWeight: 700 }}>{d.symbol}</td>
                  <td style={{ padding: '10px 12px', color: '#8B949E', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.client_name}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: d.buy_sell === 'BUY' ? 'rgba(0,229,160,0.12)' : 'rgba(248,81,73,0.12)',
                      color: d.buy_sell === 'BUY' ? '#00E5A0' : '#F85149',
                    }}>
                      {d.buy_sell}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#E6EDF3' }}>{((d.quantity || 0) / 100000).toFixed(2)}L</td>
                  <td style={{ padding: '10px 12px', color: '#E6EDF3' }}>₹{(d.price || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
