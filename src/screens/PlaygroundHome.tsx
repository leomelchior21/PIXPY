import { ArrowRight, Braces, Check, FunctionSquare, Gamepad2 } from 'lucide-react'
import type { AppRoute, SessionProgress } from '../types'

interface PlaygroundHomeProps {
  progress: SessionProgress
  onNavigate: (route: AppRoute) => void
}

const areas = [
  { route: 'variables' as const, number: '01', title: 'Variables', subtitle: 'Values that can change.', detail: 'Change things. Store information. Make Python remember.', accent: '#b9f352', icon: Gamepad2, status: '7 EXPERIENCES', available: true },
  { route: 'conditionals' as const, number: '02', title: 'Conditionals', subtitle: 'Code that makes decisions.', detail: 'A new group of experiments is being built.', accent: '#c8c8c3', icon: Braces, status: 'COMING SOON', available: false },
  { route: 'functions' as const, number: '03', title: 'Functions', subtitle: 'Actions you can create.', detail: 'A new group of experiments is being built.', accent: '#c8c8c3', icon: FunctionSquare, status: 'COMING SOON', available: false },
]

export function PlaygroundHome({ progress, onNavigate }: PlaygroundHomeProps) {
  return (
    <main className="playground-home">
      <section className="home-intro">
        <h1>READY, {progress.name.toUpperCase()}? <em>Let's get to work!</em></h1>
      </section>
      <section className="world-grid">
        {areas.map(({ route, number, title, subtitle, detail, accent, icon: Icon, status, available }, index) => (
          <button key={route} aria-label={available ? `Open ${title}` : `${title} coming soon`} className={`world-card world-card--${index + 1} ${available ? '' : 'is-unavailable'}`} style={{ '--world-accent': accent } as React.CSSProperties} onClick={available ? () => onNavigate(route) : undefined} disabled={!available}>
            <span className="world-card__number">WORLD {number}</span>
            <span className="world-card__icon"><Icon /></span>
            {index === 0 && <span className="start-flag">START HERE →</span>}
            <span className="world-card__copy"><small>{subtitle}</small><strong>{title}</strong><p>{detail}</p></span>
            <span className="world-card__footer">
              <b>{index === 0 && progress.completed.length > 0 ? <><Check size={15} /> {progress.completed.length}/7 DONE</> : status}</b>
              {available && <i>OPEN <ArrowRight size={18} /></i>}
            </span>
          </button>
        ))}
      </section>
    </main>
  )
}
