import { Plane } from 'lucide-react'

interface EmptyLineRewardProps { top: string; bottom: string }

export function EmptyLineReward({ top, bottom }: EmptyLineRewardProps) {
  return (
    <section className="print-reward empty-line-reward" aria-label="Clear airspace between output lines" aria-live="polite" tabIndex={0}>
      <div className="flight-path flight-path--top"><strong>{top}</strong><Plane aria-hidden="true" /></div>
      <div className="clear-airspace"><span>CLEAR AIRSPACE</span></div>
      <div className="flight-path flight-path--bottom"><Plane aria-hidden="true" /><strong>{bottom}</strong></div>
    </section>
  )
}
