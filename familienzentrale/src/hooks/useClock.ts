import { useEffect, useState } from 'react'

/** Current time, refreshed every `intervalMs` (default: every 20 seconds). */
export function useClock(intervalMs = 20_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
