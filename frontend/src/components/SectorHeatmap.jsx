export default function SectorHeatmap({ sectors = [] }) {
  const style = (chg) => {
    if (chg > 2)  return { bg: 'rgba(0,229,160,0.08)',  border: 'rgba(0,229,160,0.25)',  text: '#00E5A0' }
    if (chg > 0)  return { bg: 'rgba(77,159,255,0.08)', border: 'rgba(77,159,255,0.2)',   text: '#4D9FFF' }
    if (chg > -2) return { bg: 'rgba(255,176,32,0.08)', border: 'rgba(255,176,32,0.2)',   text: '#FFB020' }
    return             { bg: 'rgba(255,69,90,0.08)',  border: 'rgba(255,69,90,0.25)',  text: '#FF455A' }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {sectors.map((s, i) => {
        const st = style(s.change_1d || 0)
        const pos = (s.change_1d || 0) >= 0
        return (
          <div key={s.name} className="card-entrance" style={{
            animationDelay: `${i * 0.04}s`,
            background: st.bg,
            border: `1px solid ${st.border}`,
            borderRadius: 3,
            padding: '8px 10px',
            cursor: 'default',
            transition: 'border-color 0.15s',
          }}>
            <div style={{ fontSize: 9, color: '#4B5563', letterSpacing: 1, marginBottom: 4 }}>
              {s.name?.toUpperCase()}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: st.text }} className="num">
              {pos ? '+' : ''}{(s.change_1d || 0).toFixed(2)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}
