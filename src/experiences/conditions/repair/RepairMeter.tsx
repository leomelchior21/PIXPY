import { Hammer, Wrench } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

interface Props {
  /** 0 to 100. */
  percent: number
  /** What the last right move was, e.g. "Bug reproduced". */
  label: string
}

/** The repair progress bar: a tall gauge down the story panel that fills from the bottom with every right move. */
export function RepairMeter({ percent, label }: Props) {
  const previous = useRef(percent)
  const [gain, setGain] = useState<{ id: number; amount: number } | null>(null)
  useEffect(() => {
    const amount = Math.round(percent - previous.current)
    previous.current = percent
    if (amount > 0) setGain((current) => ({ id: (current?.id ?? 0) + 1, amount }))
  }, [percent])
  const done = percent >= 100
  return <div className={`rs-meter ${done ? 'is-done' : ''}`} role="meter" aria-label={`Repair progress: ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
    <b className="rs-meter__value">{Math.round(percent)}<small>%</small></b>
    <div className="rs-meter__track">
      <div className="rs-meter__fill" style={{ '--fill': `${percent}%` } as CSSProperties}>
        <span className="rs-meter__tool"><Wrench size={13} /></span>
      </div>
      {Array.from({ length: 9 }, (_, i) => <i key={i} className="rs-meter__tick" style={{ bottom: `${(i + 1) * 10}%` }} />)}
      {gain && <span key={gain.id} className="rs-meter__gain" style={{ '--at': `${percent}%` } as CSSProperties}><b>+{gain.amount}%</b><small>{label}</small></span>}
      {gain && <span key={`burst-${gain.id}`} className="rs-meter__burst" style={{ '--at': `${percent}%` } as CSSProperties}>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--a': `${i * 45}deg` } as CSSProperties} />)}</span>}
    </div>
    <span className="rs-meter__name"><Hammer size={13} /><span>{done ? 'REPAIRED' : 'REPAIR'}</span></span>
  </div>
}
