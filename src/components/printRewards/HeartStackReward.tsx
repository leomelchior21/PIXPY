import { Heart, Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'

interface HeartStackRewardProps { output: string; lines: string[] }

export function HeartStackReward({ output, lines }: HeartStackRewardProps) {
  return (
    <section className="print-reward heart-stack-reward" aria-label="Stacked heart celebration" aria-live="polite" tabIndex={0}>
      <div className="heart-stack-output" aria-label={output}>
        {lines.map((line, index) => (
          <span key={`${line}-${index}`} style={{ '--heart-row-delay': `${index * 110}ms` } as CSSProperties}>{line}</span>
        ))}
      </div>
      <div className="heart-stack-status">
        <Sparkles aria-hidden="true" />
        <strong>HEART STACKED</strong>
        <Heart aria-hidden="true" fill="currentColor" />
      </div>
    </section>
  )
}
