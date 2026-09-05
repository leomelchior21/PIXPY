import { Cloud, Plane, Sparkles, Wind } from 'lucide-react'

interface EmptyLineRewardProps { top: string; bottom: string }

export function EmptyLineReward({ top, bottom }: EmptyLineRewardProps) {
  return (
    <section className="print-reward empty-line-reward" aria-label="Clear airspace between output lines" aria-live="polite" tabIndex={0}>
      <div className="airspace-clouds" aria-hidden="true"><Cloud /><Cloud /><Cloud /></div>
      <div className="flight-path flight-path--top"><strong>{top}</strong><Wind aria-hidden="true" /><Plane aria-hidden="true" /></div>
      <div className="clear-airspace">
        <i aria-hidden="true" />
        <Sparkles aria-hidden="true" />
        <span>CLEAR AIRSPACE</span>
        <b aria-hidden="true" />
      </div>
      <div className="flight-path flight-path--bottom"><Plane aria-hidden="true" /><Wind aria-hidden="true" /><strong>{bottom}</strong></div>
    </section>
  )
}
