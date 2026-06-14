import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, RotateCcw,
  Search, Zap, Briefcase, RefreshCw, Menu, X,
} from 'lucide-react'
import PulseDot from './PulseDot'

const NAV = [
  { path: '/',               label: 'Dashboard',       icon: LayoutDashboard },
  { path: '/fii-dii',       label: 'FII / DII Intel', icon: TrendingUp },
  { path: '/sectors',       label: 'Sector Rotation', icon: RotateCcw },
  { path: '/scanner',       label: 'Scanner',         icon: Search },
  { path: '/opportunities', label: 'Opportunities',   icon: Zap },
  { path: '/portfolio',     label: 'Portfolio',       icon: Briefcase },
]

export default function Sidebar({ onRefresh, lastSync }) {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [mobile, setMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const handleRefresh = () => {
    setSpinning(true)
    onRefresh && onRefresh()
    setTimeout(() => setSpinning(false), 2000)
  }

  const sidebarContent = (
    <div style={{
      width: 220, height: '100%',
      background: '#0D1117',
      borderRight: '1px solid #21293A',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #21293A' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#00E5A0', letterSpacing: 1 }}>
              ⚡ SWING
            </div>
            <div style={{ fontSize: 9, color: '#8B949E', letterSpacing: 2, marginTop: 1 }}>
              INTELLIGENCE TERMINAL
            </div>
          </div>
          {mobile && (
            <button onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#8B949E', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          )}
        </div>
        <div style={{ marginTop: 10 }}>
          <PulseDot />
        </div>
      </div>

      <nav style={{ flex: 1, padding: '10px 0' }}>
        {NAV.map(item => {
          const active = location.pathname === item.path
          const Icon = item.icon
          return (
            <Link key={item.path} to={item.path}
              onClick={() => mobile && setOpen(false)}
              style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                borderLeft: active ? '3px solid #00E5A0' : '3px solid transparent',
                background: active ? '#1C2330' : 'transparent',
                boxShadow: active ? 'inset 3px 0 12px rgba(0,229,160,0.1)' : 'none',
                color: active ? '#E6EDF3' : '#8B949E',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}>
                <Icon size={15} />
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid #21293A' }}>
        {lastSync && (
          <div style={{ fontSize: 9, color: '#8B949E', marginBottom: 8 }}>
            Last sync: {lastSync}
          </div>
        )}
        <button onClick={handleRefresh} style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6,
          padding: '7px 0',
          background: 'rgba(0,229,160,0.08)',
          border: '1px solid rgba(0,229,160,0.25)',
          borderRadius: 6, color: '#00E5A0',
          fontSize: 11, cursor: 'pointer',
        }}>
          <RefreshCw size={12} className={spinning ? 'spin-icon' : ''} />
          REFRESH DATA
        </button>
      </div>
    </div>
  )

  if (mobile) {
    return (
      <>
        <button onClick={() => setOpen(true)} style={{
          position: 'fixed', top: 14, right: 14,
          zIndex: 200, background: '#161B22',
          border: '1px solid #21293A',
          borderRadius: 6, padding: 8,
          color: '#E6EDF3', cursor: 'pointer',
        }}>
          <Menu size={18} />
        </button>
        {open && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}
              onClick={() => setOpen(false)} />
            <div style={{ position: 'relative', zIndex: 151 }}>
              {sidebarContent}
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div style={{ position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 50 }}>
      {sidebarContent}
    </div>
  )
}
