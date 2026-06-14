export default function PulseDot() {
  const isMarketOpen = () => {
    const now = new Date()
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    const day = ist.getDay()
    const h = ist.getHours()
    const m = ist.getMinutes()
    const t = h * 100 + m
    return day >= 1 && day <= 5 && t >= 915 && t <= 1530
  }

  const open = isMarketOpen()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 8, height: 8,
        borderRadius: '50%',
        background: open ? '#00E5A0' : '#8B949E',
        animation: open ? 'pulse 1.5s infinite' : 'none',
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 10, color: open ? '#00E5A0' : '#8B949E', letterSpacing: 1 }}>
        {open ? 'MARKET OPEN' : 'MARKET CLOSED'}
      </span>
    </div>
  )
}
