import { useMemo } from 'react'

export default function ParticleBackground() {
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${5 + Math.random() * 90}%`,
      duration: `${8 + Math.random() * 14}s`,
      delay: `${Math.random() * 12}s`,
      size: `${3 + Math.random() * 3}px`,
    }))
  }, [])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0,
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 0,
      overflow: 'hidden',
    }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: p.left,
          bottom: '-10px',
          width: p.size,
          height: p.size,
          borderRadius: '50%',
          background: '#00E5A0',
          animation: `floatUp ${p.duration} ${p.delay} infinite linear`,
        }} />
      ))}
    </div>
  )
}
