import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TickerStrip from './components/TickerStrip'
import Dashboard from './pages/Dashboard'
import FiiDii from './pages/FiiDii'
import SectorRotation from './pages/SectorRotation'
import Scanner from './pages/Scanner'
import SwingOpportunities from './pages/SwingOpportunities'
import Portfolio from './pages/Portfolio'

function StatusBar() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const t = () => {
      const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      setTime(ist.toLocaleTimeString('en-IN', { hour12: false }))
    }
    t()
    const id = setInterval(t, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="status-bar">
      <span>⚡ SWING INTELLIGENCE TERMINAL</span>
      <span style={{ color: '#1A1F2B' }}>|</span>
      <span>NSE · BSE</span>
      <span style={{ marginLeft: 'auto' }}>IST {time}</span>
      <span style={{ color: '#1A1F2B' }}>|</span>
      <span>LIVE DATA</span>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="scan-overlay" />
      <Sidebar />
      <div style={{
        marginLeft: 200,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 2,
      }}>
        <TickerStrip />
        <main style={{ flex: 1, padding: '22px 26px 40px' }}>
          <Routes>
            <Route path="/"               element={<Dashboard />} />
            <Route path="/fii-dii"        element={<FiiDii />} />
            <Route path="/sectors"        element={<SectorRotation />} />
            <Route path="/scanner"        element={<Scanner />} />
            <Route path="/opportunities"  element={<SwingOpportunities />} />
            <Route path="/portfolio"      element={<Portfolio />} />
          </Routes>
        </main>
        <StatusBar />
      </div>
    </BrowserRouter>
  )
}
