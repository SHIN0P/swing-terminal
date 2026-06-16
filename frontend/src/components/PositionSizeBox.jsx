const INR = (v, d = 0) => (v || 0).toLocaleString('en-IN', { maximumFractionDigits: d })

/**
 * Layer 4 (position sizing) + Layer 9 (tax/cost) display.
 * `ps` and `net` come straight from the backend (/api/scanner, /api/opportunities) —
 * computed from the user's saved capital/risk% in Settings, so this is a pure
 * render with zero client-side math to keep in sync.
 */
export default function PositionSizeBox({ ps, net }) {
  if (!ps || !ps.shares) {
    return (
      <div style={{
        background: '#0A0E14', border: '1px solid #0F1318', borderRadius: 3,
        padding: '8px 10px', fontSize: 10, color: '#2A3040',
      }}>
        Position size unavailable — stop too close to entry for current risk settings.
      </div>
    )
  }

  return (
    <div style={{
      background: ps.too_large ? 'rgba(255,69,90,0.06)' : 'rgba(0,229,160,0.05)',
      border: `1px solid ${ps.too_large ? 'rgba(255,69,90,0.25)' : 'rgba(0,229,160,0.15)'}`,
      borderRadius: 3, padding: '10px 12px', fontSize: 10.5,
    }}>
      <div style={{ color: '#2A3040', fontSize: 8, letterSpacing: 1.5, marginBottom: 5, fontWeight: 700 }}>
        POSITION SIZE · ₹{INR(ps.capital)} CAPITAL @ {ps.risk_pct}% RISK
      </div>
      <div style={{ color: '#C8D0DC', fontWeight: 700 }} className="num">
        Buy {ps.shares} shares (₹{INR(ps.position_value)})
        <span style={{ color: '#FF455A', fontWeight: 600, marginLeft: 8 }}>
          · Max loss ₹{INR(ps.max_loss)} ({ps.risk_pct}%)
        </span>
      </div>
      <div style={{ color: '#2A3040', fontSize: 8, marginTop: 3 }}>
        {ps.pct_of_capital}% of capital
      </div>

      {ps.too_large && (
        <div style={{ color: '#FF455A', marginTop: 6, fontWeight: 700, fontSize: 10 }}>
          ⚠ Position too large — reduce or skip
        </div>
      )}

      {net && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1A1F2B', color: '#4B5563', fontSize: 10 }}>
          Target 1 gross profit <span className="num" style={{ color: '#C8D0DC' }}>₹{INR(net.gross_pnl)}</span>
          {' → after 20.8% tax + ~0.1% costs → '}
          <span className="num" style={{ color: net.net_pnl >= 0 ? '#00E5A0' : '#FF455A', fontWeight: 700 }}>
            ₹{INR(net.net_pnl)}
          </span> net
        </div>
      )}
    </div>
  )
}
