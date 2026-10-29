import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import './activityGuide.css'

export interface GuideSlide {
  kicker: string
  title: string
  text: string
  art: ReactNode
}

interface Props {
  slides: GuideSlide[]
  /** Label of the last button, e.g. "START REPAIRING". */
  finish: ReactNode
  onClose: () => void
}

/** Short illustrated cards that introduce an activity. Opens on the first visit and from a ? button. */
export function ActivityGuide({ slides, finish, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const slide = slides[index]
  const last = index === slides.length - 1

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') setIndex((current) => Math.min(slides.length - 1, current + 1))
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(0, current - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, slides.length])

  return <div className="guide-backdrop">
    <div className="guide" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <button className="guide__close" onClick={onClose} aria-label="Close the guide"><X size={18} /></button>
      <div key={index} className="guide__stage">{slide.art}</div>
      <p className="guide__kicker">{slide.kicker}</p>
      <h2 id="guide-title">{slide.title}</h2>
      <p className="guide__text">{slide.text}</p>
      <div className="guide__nav">
        <button className="guide__back" onClick={() => setIndex(index - 1)} disabled={index === 0}><ArrowLeft size={16} /> BACK</button>
        <div className="guide__dots" aria-hidden="true">{slides.map((_, dot) => <i key={dot} className={dot === index ? 'is-on' : ''} />)}</div>
        <button className="guide__next" autoFocus onClick={() => (last ? onClose() : setIndex(index + 1))}>{last ? finish : <>NEXT <ArrowRight size={16} /></>}</button>
      </div>
    </div>
  </div>
}
