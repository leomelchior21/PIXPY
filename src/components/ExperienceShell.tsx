import { ArrowLeft, Lightbulb, X } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'

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

export function ExperienceShell({ order, title, question, accent, hints, onBack, children, className = '' }: ExperienceShellProps) {
  const [hintOpen, setHintOpen] = useState(false)
  const [hintLevel, setHintLevel] = useState(0)
  const style = { '--experience-accent': accent } as CSSProperties

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
        <div className="experience-title"><span>EXPERIENCE {order}</span><div><h1>{title}</h1><i>—</i><p>{question}</p></div></div>
        <button className="hint-button" onClick={showHint}><Lightbulb size={18} /> Hint <span>{hintOpen ? `${hintLevel + 1}/${hints.length}` : '?'}</span></button>
      </header>

      <section className="experience-body">{children}</section>

      {hintOpen && (
        <aside className="hint-drawer no-print" role="dialog" aria-label="Progressive hint">
          <button className="hint-close" onClick={() => setHintOpen(false)} aria-label="Close hint"><X size={16} /></button>
          <Lightbulb size={28} />
          <small>HINT {hintLevel + 1} OF {hints.length}</small>
          <p>{hints[hintLevel]}</p>
          {hintLevel < hints.length - 1 && <button onClick={() => setHintLevel((level) => level + 1)}>ONE MORE CLUE</button>}
        </aside>
      )}
    </main>
  )
}
