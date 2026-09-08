import { ArrowLeft, Check, Lightbulb, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

interface ExperienceShellProps {
  order: string
  title: string
  question: string
  accent: string
  hints: string[]
  completed: boolean
  objective: string
  onBack: () => void
  onComplete?: () => void
  children: ReactNode
  className?: string
}

export function ExperienceShell({ order, title, question, accent, hints, completed, onBack, children, className = '' }: ExperienceShellProps) {
  const [hintOpen, setHintOpen] = useState(false)
  const [hintLevel, setHintLevel] = useState(0)
  const style = { '--experience-accent': accent } as CSSProperties
  const hintButton = useRef<HTMLButtonElement>(null)
  const hintPanel = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!hintOpen) return
    hintPanel.current?.focus()
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setHintOpen(false); hintButton.current?.focus() }
    }
    const outside = (event: PointerEvent) => {
      if (!hintPanel.current?.contains(event.target as Node) && !hintButton.current?.contains(event.target as Node)) setHintOpen(false)
    }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside) }
  }, [hintOpen])

  const showHint = () => {
    if (!hintOpen) {
      setHintOpen(true)
      setHintLevel(0)
    } else {
      setHintLevel((level) => Math.min(hints.length - 1, level + 1))
    }
  }

  return (
    <main className={`experience-screen ${className}`} style={style}>
      <header className="experience-header no-print">
        <button className="back-button" onClick={onBack}><ArrowLeft size={18} /> Variables</button>
        <div className="experience-title"><span>EXPERIMENT {order} / 07 {completed && <b><Check size={12} /> EXPLORED</b>}</span><div><h1>{title}</h1><i>—</i><p>{question}</p></div></div>
        <button ref={hintButton} className="hint-button" onClick={showHint} aria-expanded={hintOpen} aria-controls="activity-hint"><Lightbulb size={18} /> Hint <span>{hintOpen ? `${hintLevel + 1}/${hints.length}` : '?'}</span></button>
      </header>

      <section className="experience-body">{children}</section>

      {hintOpen && (
        <aside ref={hintPanel} id="activity-hint" tabIndex={-1} className="hint-drawer no-print" role="dialog" aria-label="Progressive hint">
          <button className="hint-close" onClick={() => { setHintOpen(false); hintButton.current?.focus() }} aria-label="Close hint"><X size={16} /></button>
          <Lightbulb size={28} />
          <small>HINT {hintLevel + 1} OF {hints.length}</small>
          <p>{hints[hintLevel]}</p>
          {hintLevel < hints.length - 1 && <button onClick={() => setHintLevel((level) => level + 1)}>ONE MORE CLUE</button>}
        </aside>
      )}
    </main>
  )
}
