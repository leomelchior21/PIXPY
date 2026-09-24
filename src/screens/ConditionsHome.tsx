import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { conditionExperiences } from '../data/conditions'
import type { AppRoute, SessionProgress } from '../types'

interface Props {
  progress: SessionProgress
  onNavigate: (route: AppRoute) => void
}

const previews = ['if score > 5:', 'if ready:\nelse:', 'if score >= 10:', 'if / elif / else', 'Choose your path.']

export function ConditionsHome({ progress, onNavigate }: Props) {
  const completed = conditionExperiences.filter((item) => progress.completed.includes(item.id)).length
  return (
    <main className="variables-home conditions-home">
      <header className="variables-heading">
        <button onClick={() => onNavigate('home')}><ArrowLeft size={17} /> All worlds</button>
        <div><p className="pixel-kicker"><Sparkles size={14} /> WORLD 02</p><h1>Conditions</h1><p>Code that makes decisions. Explore what happens when a condition is true or false.</p></div>
        <aside><strong>{completed}<span>/{conditionExperiences.length}</span></strong><small>ACTIVITIES<br />EXPLORED</small></aside>
      </header>
      <section className="experience-grid">
        {conditionExperiences.map((experience, index) => {
          const Icon = experience.icon
          const complete = progress.completed.includes(experience.id)
          return <button key={experience.id} aria-label={`${experience.order} ${experience.title}: ${experience.description}`} className={`experience-card ${complete ? 'is-complete' : ''} ${index === 0 ? 'is-start' : ''}`} style={{ '--card-accent': experience.color } as React.CSSProperties} onClick={() => onNavigate(experience.id)}>
            <span className="experience-card__order">{experience.order}</span>
            <span className="experience-card__icon"><Icon /></span>
            <span className="experience-card__copy"><strong>{experience.title}</strong><p>{experience.description}</p></span>
            <code className="experience-card__preview" aria-hidden="true">{previews[index]}</code>
            <span className="experience-card__state">{complete ? <><Check size={16} /> DONE · PLAY AGAIN</> : <>LET'S TRY IT <ArrowRight size={16} /></>}</span>
            {index === 0 && !complete && <i>START HERE</i>}
          </button>
        })}
      </section>
      <footer className="variables-note"><span>NO LOCKS</span> Try these in order—or choose your own path.</footer>
    </main>
  )
}
