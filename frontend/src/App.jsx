import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ParticleBackground from './components/ParticleBackground'
import Dashboard from './pages/Dashboard'
import FiiDii from './pages/FiiDii'
import SectorRotation from './pages/SectorRotation'
import Scanner from './pages/Scanner'
import SwingOpportunities from './pages/SwingOpportunities'
import Portfolio from './pages/Portfolio'
import { triggerRefresh } from './services/api'

export default function App() {
  const [lastSync, setLastSync] = useState(null)

  const handleRefresh = async () => {
    await triggerRefresh()
    setLastSync(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
  }

  return (
    <BrowserRouter>
      <ParticleBackground />
      <Sidebar onRefresh={handleRefresh} lastSync={lastSync} />
      <main style={{
        marginLeft: 220,
        minHeight: '100vh',
        padding: '28px 32px',
        position: 'relative',
        zIndex: 1,
      }}>
        <style>{`
          @media (max-width: 768px) {
            main { margin-left: 0 !important; padding: 20px 16px !important; }
          }
        `}</style>
        <Routes>
          <Route path="/"               element={<Dashboard />} />
          <Route path="/fii-dii"        element={<FiiDii />} />
          <Route path="/sectors"        element={<SectorRotation />} />
          <Route path="/scanner"        element={<Scanner />} />
          <Route path="/opportunities"  element={<SwingOpportunities />} />
          <Route path="/portfolio"      element={<Portfolio />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
