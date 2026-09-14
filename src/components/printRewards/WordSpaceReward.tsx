import { MoveHorizontal, Sparkles } from 'lucide-react'

interface WordSpaceRewardProps { left: string; right: string }

export function WordSpaceReward({ left, right }: WordSpaceRewardProps) {
  return (
    <section className="print-reward word-space-reward" aria-label="One space between TOP and BOTTOM" aria-live="polite" tabIndex={0}>
      <div className="word-space-output" aria-label={`${left} space ${right}`}>
        <strong>{left}</strong>
        <span aria-label="one space"><i aria-hidden="true" /><MoveHorizontal aria-hidden="true" /><small>ONE SPACE</small><i aria-hidden="true" /></span>
        <strong>{right}</strong>
      </div>
      <div className="word-space-status"><Sparkles aria-hidden="true" /><strong>SPACE ADDED</strong></div>
    </section>
  )
}
