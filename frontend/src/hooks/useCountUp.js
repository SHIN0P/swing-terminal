import { useState, useEffect } from 'react'

export const useCountUp = (target, duration = 1200) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (target === null || target === undefined || isNaN(target)) return
    const numTarget = parseFloat(target)
    if (numTarget === 0) { setCount(0); return }

    let current = 0
    const steps = duration / 16
    const increment = numTarget / steps

    const timer = setInterval(() => {
      current += increment
      if (current >= numTarget) {
        setCount(numTarget)
        clearInterval(timer)
      } else {
        setCount(current)
      }
    }, 16)

    return () => clearInterval(timer)
  }, [target, duration])

  return count
}

export default useCountUp
