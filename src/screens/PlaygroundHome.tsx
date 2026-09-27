import { ArrowRight, Braces, Check, Gamepad2, Puzzle } from 'lucide-react'
import { variableExperiences } from '../data/variables'
import { conditionExperiences } from '../data/conditions'
import { extraExperiences } from '../data/extras'
import type { AppRoute, SessionProgress } from '../types'

interface PlaygroundHomeProps {
  progress: SessionProgress
  onNavigate: (route: AppRoute) => void
}

const areas = [
  { route: 'variables' as const, number: '01', title: 'Variables', subtitle: 'Values that can change.', detail: 'Change things. Store information. Make Python remember.', accent: '#b9f352', icon: Gamepad2, status: `${variableExperiences.length} EXPERIENCES` },
  { route: 'conditionals' as const, number: '02', title: 'Conditions', subtitle: 'Code that makes decisions.', detail: 'Choose a path. Test a condition. Make Python decide.', accent: '#72dcff', icon: Braces, status: `${conditionExperiences.length} ACTIVITIES` },
  { route: 'extras' as const, number: '03', title: 'Extras', subtitle: 'A bonus build.', detail: 'One extra challenge lives here: the STOP string sheet.', accent: '#ffcb47', icon: Puzzle, status: `${extraExperiences.length} ${extraExperiences.length === 1 ? 'EXTRA' : 'EXTRAS'}` },
]

const totals = {
  variables: variableExperiences.length,
  conditionals: conditionExperiences.length,
  extras: extraExperiences.length,
}

export function PlaygroundHome({ progress, onNavigate }: PlaygroundHomeProps) {
  const completedByWorld = {
    variables: variableExperiences.filter((item) => progress.completed.includes(item.id)).length,
    conditionals: conditionExperiences.filter((item) => progress.completed.includes(item.id)).length,
    extras: extraExperiences.filter((item) => progress.completed.includes(item.id)).length,
  }
  return (
    <main className="playground-home">
      <section className="home-intro">
        <h1>READY, {progress.name.toUpperCase()}? <em>Let's get to work!</em></h1>
      </section>
      <section className="world-grid">
        {areas.map(({ route, number, title, subtitle, detail, accent, icon: Icon, status }, index) => (
          <button key={route} aria-label={`Open ${title}`} className={`world-card world-card--${index + 1}`} style={{ '--world-accent': accent } as React.CSSProperties} onClick={() => onNavigate(route)}>
            <span className="world-card__number">WORLD {number}</span>
            <span className="world-card__icon"><Icon /></span>
            {index === 0 && <span className="start-flag">START HERE →</span>}
            <span className="world-card__copy"><small>{subtitle}</small><strong>{title}</strong><p>{detail}</p></span>
            <span className="world-card__footer">
              <b>{completedByWorld[route] > 0 ? <><Check size={15} /> {completedByWorld[route]}/{totals[route]} DONE</> : status}</b>
              <i>OPEN <ArrowRight size={18} /></i>
            </span>
          </button>
        ))}
      </section>
    </main>
  )
}
