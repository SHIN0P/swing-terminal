import { useState, useEffect } from 'react'
import { getMarketPulse } from '../services/api'

const FMT = v => v?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '--'

export default function TickerStrip() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const load = async () => {
      try { const d = await getMarketPulse(); setData(d) } catch {}
    }
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  const items = data ? [
    { sym: 'NIFTY 50',   val: data.nifty50,      chg: data.nifty50_change },
    { sym: 'SENSEX',     val: data.sensex,        chg: data.sensex_change },
    { sym: 'BANK NIFTY', val: data.nifty_bank,    chg: data.nifty_bank_change },
    { sym: 'NIFTY IT',   val: data.nifty_it,      chg: data.nifty_it_change },
    { sym: 'NIFTY AUTO', val: data.nifty_auto,    chg: data.nifty_auto_change },
    { sym: 'NIFTY FMCG', val: data.nifty_fmcg,   chg: data.nifty_fmcg_change },
    { sym: 'NIFTY PHARMA', val: data.nifty_pharma, chg: data.nifty_pharma_change },
    { sym: 'NIFTY METAL', val: data.nifty_metal,  chg: data.nifty_metal_change },
    { sym: 'INDIA VIX',  val: data.india_vix,     chg: data.india_vix_change },
  ] : []

  const doubled = [...items, ...items]

  return (
    <div style={{
      height: 28,
      background: '#07090D',
      borderBottom: '1px solid #0F1318',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 80, zIndex: 2,
        background: 'linear-gradient(90deg, #07090D 60%, transparent)',
        display: 'flex', alignItems: 'center', paddingLeft: 10,
      }}>
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: '#00E5A0' }}>LIVE</span>
      </div>

      <div style={{ paddingLeft: 80, overflow: 'hidden', width: '100%' }}>
        <div className="ticker-track">
          {doubled.map((item, i) => {
            const pos = (item.chg || 0) >= 0
            return (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '0 20px',
                fontSize: 10, whiteSpace: 'nowrap',
                borderRight: '1px solid #0F1318',
              }}>
                <span style={{ color: '#4B5563', letterSpacing: 1 }}>{item.sym}</span>
                <span style={{ color: '#C8D0DC', fontWeight: 600 }} className="num">{FMT(item.val)}</span>
                <span style={{ color: pos ? '#00E5A0' : '#FF455A', fontSize: 9 }}>
                  {pos ? '▲' : '▼'} {Math.abs(item.chg || 0).toFixed(2)}%
                </span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
