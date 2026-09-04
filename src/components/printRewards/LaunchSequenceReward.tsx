import { Flame, Rocket } from 'lucide-react'
import type { CSSProperties } from 'react'

interface LaunchSequenceRewardProps { countdown: string[]; liftoff: string }

export function LaunchSequenceReward({ countdown, liftoff }: LaunchSequenceRewardProps) {
  return (
    <section className="print-reward launch-sequence-reward" aria-label="Launch sequence animation" aria-live="polite" tabIndex={0}>
      <div className="launch-countdown-stack">
        {countdown.map((item, index) => (
          <span key={item} style={{ '--count-delay': `${index * 110}ms` } as CSSProperties}>{item}</span>
        ))}
      </div>
      <div className="launch-pad" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <Rocket className="launch-rocket" aria-hidden="true" />
      <div className="launch-flame" aria-hidden="true"><Flame /></div>
      <strong>{liftoff}</strong>
      <div className="launch-stars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
    </section>
  )
}
