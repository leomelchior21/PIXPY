import { useEffect, useState } from 'react'

interface MorningGreetingRewardProps { message: string }

export function MorningGreetingReward({ message }: MorningGreetingRewardProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(now)
  const date = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(now)

  return (
    <section className="print-reward morning-greeting-reward" aria-label="Morning greeting display" aria-live="polite" tabIndex={0}>
      <div className="morning-orbits" aria-hidden="true"><i /><i /><i /></div>
      <div className="morning-sunrise" aria-hidden="true"><span /></div>
      <div className="morning-clock"><span>LOCAL TIME</span><strong>{time}</strong><small>{date}</small></div>
      <p>{message}</p>
      <i className="reward-scanline" aria-hidden="true" />
    </section>
  )
}
