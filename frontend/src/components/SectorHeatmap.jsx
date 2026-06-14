export default function SectorHeatmap({ sectors = [] }) {
  const getStyle = (change) => {
    if (change > 2)  return { bg: 'rgba(0,229,160,0.15)',  border: '#00E5A0', text: '#00E5A0' }
    if (change > 0)  return { bg: 'rgba(88,166,255,0.12)', border: '#58A6FF', text: '#58A6FF' }
    if (change > -2) return { bg: 'rgba(227,179,65,0.12)', border: '#E3B341', text: '#E3B341' }
    return            { bg: 'rgba(248,81,73,0.15)',   border: '#F85149', text: '#F85149' }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {sectors.map((s, i) => {
        const st = getStyle(s.change_1d || 0)
        return (
          <div key={s.name} className="card-entrance" style={{
            animationDelay: `${i * 0.05}s`,
            background: st.bg,
            border: `1px solid ${st.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: '#8B949E', marginBottom: 3 }}>
              {s.name}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: st.text }}>
              {s.change_1d > 0 ? '+' : ''}{(s.change_1d || 0).toFixed(2)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}
