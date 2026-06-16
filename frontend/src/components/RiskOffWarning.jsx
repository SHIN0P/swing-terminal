import { useState, useEffect } from 'react'
import { getRegime } from '../services/api'

/** Layer 1 — shown on Scanner/Opportunities when the regime gate says RISK-OFF. */
export default function RiskOffWarning() {
  const [regime, setRegime] = useState(null)

  useEffect(() => {
    const load = async () => setRegime(await getRegime())
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (!regime || regime.regime !== 'RISK-OFF') return null

  return (
    <div style={{
      padding: '10px 14px', borderRadius: 3, marginBottom: 16,
      background: 'rgba(255,69,90,0.08)', border: '1px solid rgba(255,69,90,0.25)',
      borderLeft: '3px solid #FF455A',
      fontSize: 11, color: '#FF455A', fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 14 }}>⚠</span>
      <span>Market is Risk-OFF. New long setups are high-risk. Consider waiting.</span>
    </div>
  )
}
