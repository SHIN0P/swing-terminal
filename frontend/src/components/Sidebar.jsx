import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { triggerRefresh } from '../services/api'

const NAV = [
  { path: '/',              label: 'DASHBOARD',  icon: '▣', sub: 'Market Overview' },
  { path: '/fii-dii',      label: 'FII / DII',  icon: '◈', sub: 'Institutional Flow' },
  { path: '/sectors',      label: 'SECTORS',    icon: '◉', sub: 'Rotation Clock' },
  { path: '/scanner',      label: 'SCANNER',    icon: '⊕', sub: 'Signal Scanner' },
  { path: '/opportunities',label: 'SETUPS',     icon: '◆', sub: 'Swing Setups' },
  { path: '/portfolio',    label: 'PORTFOLIO',  icon: '◐', sub: 'My Positions' },
]

function Clock() {
  const [time, setTime]   = useState('--:--:--')
  const [date, setDate]   = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const tick = () => {
      const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const h = ist.getHours(), m = ist.getMinutes(), s = ist.getSeconds()
      setTime(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
      setDate(ist.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }))
      const wd = ist.getDay()
      const after915  = h > 9  || (h === 9  && m >= 15)
      const before1530 = h < 15 || (h === 15 && m < 30)
      setIsOpen(wd >= 1 && wd <= 5 && after915 && before1530)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid #0F1318' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#C8D0DC', letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}>
        {time}
      </div>
      <div style={{ fontSize: 9, color: '#2A3040', marginTop: 2, letterSpacing: 1 }}>IST · {date}</div>
      <div style={{
        marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 8, fontWeight: 700, letterSpacing: 1.5,
        color: isOpen ? '#00E5A0' : '#4B5563',
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: isOpen ? '#00E5A0' : '#2A3040',
          boxShadow: isOpen ? '0 0 5px #00E5A0' : 'none',
          display: 'inline-block',
          animation: isOpen ? 'pulse 2s infinite' : 'none',
        }} />
        {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
      </div>
    </div>
  )
}

export default function Sidebar() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
  const [refreshing, setRefreshing] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try { await triggerRefresh() } catch {}
    setTimeout(() => setRefreshing(false), 1200)
  }

  const inner = (
    <div style={{
      width: 200, height: '100%',
      background: '#07090D',
      borderRight: '1px solid #0F1318',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #0F1318' }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 3, color: '#00E5A0', marginBottom: 2 }}>⚡ SWING</div>
        <div style={{ fontSize: 8, color: '#1A1F2B', letterSpacing: 2 }}>INTELLIGENCE TERMINAL</div>
      </div>

      <Clock />

      <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
        {NAV.map(({ path, label, icon, sub }) => {
          const active = pathname === path
          return (
            <button key={path} onClick={() => { navigate(path); setMobileOpen(false) }} style={{
              width: '100%', textAlign: 'left',
              padding: '8px 14px',
              background: active ? 'rgba(0,229,160,0.05)' : 'transparent',
              border: 'none',
              borderLeft: `2px solid ${active ? '#00E5A0' : 'transparent'}`,
              cursor: 'pointer',
              transition: 'all 0.12s',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
            onMouseEnter={e => !active && (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 11, color: active ? '#00E5A0' : '#1A1F2B', width: 14, textAlign: 'center' }}>{icon}</span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: active ? '#C8D0DC' : '#4B5563' }}>
                  {label}
                </div>
                <div style={{ fontSize: 8, color: active ? '#1A1F2B' : '#111520', marginTop: 1 }}>{sub}</div>
              </div>
            </button>
          )
        })}
      </nav>

      <div style={{ padding: '10px 14px', borderTop: '1px solid #0F1318' }}>
        <button onClick={handleRefresh} disabled={refreshing} style={{
          width: '100%', padding: '6px 0',
          background: 'transparent',
          border: '1px solid #1A1F2B', borderRadius: 2,
          color: refreshing ? '#00E5A0' : '#2A3040',
          fontSize: 8, fontWeight: 700, letterSpacing: 2,
          cursor: refreshing ? 'default' : 'pointer',
          transition: 'all 0.12s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none', fontSize: 11 }}>↻</span>
          {refreshing ? 'REFRESHING...' : 'REFRESH DATA'}
        </button>
        <div style={{ fontSize: 7, color: '#111520', textAlign: 'center', marginTop: 8, letterSpacing: 1 }}>
          v2.0 · NSE/BSE LIVE
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button onClick={() => setMobileOpen(o => !o)} style={{
        position: 'fixed', top: 36, left: 12, zIndex: 200,
        background: '#10141C', border: '1px solid #1A1F2B',
        borderRadius: 2, color: '#C8D0DC', padding: '4px 10px',
        cursor: 'pointer', fontSize: 12,
        display: 'none',
      }}>☰</button>

      <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, height: '100vh', zIndex: 50 }}>
        {inner}
      </div>

      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setMobileOpen(false)} />
          <div style={{ position: 'relative', zIndex: 151, height: '100%' }}>
            {inner}
          </div>
        </div>
      )}
    </>
  )
}
