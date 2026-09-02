import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { variableExperiences } from '../data/variables'
import type { AppRoute, SessionProgress } from '../types'

interface VariablesHomeProps {
  progress: SessionProgress
  onNavigate: (route: AppRoute) => void
}

export function VariablesHome({ progress, onNavigate }: VariablesHomeProps) {
  return (
    <main className="variables-home">
      <header className="variables-heading">
        <button onClick={() => onNavigate('home')}><ArrowLeft size={17} /> All worlds</button>
        <div><p className="pixel-kicker"><Sparkles size={14} /> WORLD 01</p><h1>Variables</h1><p>Change values. Store information. Make Python remember things.</p></div>
        <aside><strong>{progress.completed.length}<span>/7</span></strong><small>EXPERIENCES<br />EXPLORED</small></aside>
      </header>
      <section className="experience-grid">
        {variableExperiences.map((experience, index) => {
          const Icon = experience.icon
          const complete = progress.completed.includes(experience.id)
          return (
            <button
              key={experience.id}
              aria-label={`${experience.order} ${experience.title}: ${experience.description}`}
              className={`experience-card ${complete ? 'is-complete' : ''} ${index === 0 ? 'is-start' : ''}`}
              style={{ '--card-accent': experience.color } as React.CSSProperties}
              onClick={() => onNavigate(experience.id)}
            >
              <span className="experience-card__order">{experience.order}</span>
              <span className="experience-card__icon"><Icon /></span>
              <span className="experience-card__copy"><strong>{experience.title}</strong><p>{experience.description}</p></span>
              <span className="experience-card__state">{complete ? <><Check size={16} /> DONE</> : <>OPEN <ArrowRight size={16} /></>}</span>
              {index === 0 && !complete && <i>START HERE</i>}
            </button>
          )
        })}
      </section>
      <footer className="variables-note"><span>NO LOCKS</span> Try these in order—or don't. Curiosity makes the rules.</footer>
    </main>
  )
}
