import { Check } from 'lucide-react'
import type { CSSProperties } from 'react'

interface TextFrameRewardProps { output: string; lines: string[] }

export function TextFrameReward({ output, lines }: TextFrameRewardProps) {
  return (
    <section className="print-reward text-frame-reward" aria-label="Assembled text frame" aria-live="polite" tabIndex={0}>
      <div className="frame-tiles" aria-label={output}>
        {lines.map((line, row) => <div key={`${line}-${row}`}>{[...line].map((character, column) => {
          const delay = Math.min((row * line.length + column) * 15, 450)
          return <span className={character === ' ' ? 'is-space' : ''} style={{ '--tile-delay': `${delay}ms` } as CSSProperties} key={`${row}-${column}`}>{character}</span>
        })}</div>)}
      </div>
      <div className="frame-locked"><Check aria-hidden="true" /><strong>FRAME LOCKED</strong></div>
    </section>
  )
}
