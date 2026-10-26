import { ArrowLeft, ArrowRight, Check, Lock, Sparkles } from 'lucide-react'
import { conditionBosses } from '../data/conditionBosses'
import { conditionExperiences } from '../data/conditions'
import { moreChoiceLevels } from '../data/moreChoices'
import { repairTickets } from '../data/repairShop'
import { completedIfElseLevels } from '../lib/ifElseProgress'
import type { ActivityId, AppRoute, SessionProgress } from '../types'
import { levelCount } from '../experiences/conditions/backroom/backroomLevels'

interface Props {
  progress: SessionProgress
  onNavigate: (route: AppRoute) => void
}

const previews = ['energy > 60 → TRUE', 'if score > 5:', 'if ready:\nelse:', 'if code = 4729  # bug!', 'else:\n    if …', 'HP ▮▮▮▮▯']

/** Saved steps for activities that can be continued later. */
function savedSteps(progress: SessionProgress, id: ActivityId): { count: number; total: number; label: string } | null {
  if (id === 'backroom-run') return { count: progress.backroomLevelStars.filter((stars) => stars > 0).length, total: levelCount, label: 'TAPES' }
  if (id === 'if-else') return { count: completedIfElseLevels(progress).length, total: 10, label: 'SAVED' }
  if (id === 'make-it-work') return { count: progress.repairTickets.length, total: repairTickets.length, label: 'FIXED' }
  if (id === 'more-than-one-choice') return { count: progress.moreChoiceLevels.length, total: moreChoiceLevels.length, label: 'SOLVED' }
  if (id === 'conditions-final-bosses') return { count: progress.conditionBosses.length, total: conditionBosses.length, label: 'DEFEATED' }
  return null
}

export function ConditionsHome({ progress, onNavigate }: Props) {
  const completed = conditionExperiences.filter((item) => progress.completed.includes(item.id)).length
  const open = conditionExperiences.filter((item) => !item.disabled).length
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
          const saved = savedSteps(progress, experience.id)
          return <button key={experience.id} disabled={experience.disabled} aria-label={`${experience.order} ${experience.title}: ${experience.disabled ? 'Coming soon' : experience.description}`} className={`experience-card ${experience.disabled ? 'is-disabled' : ''} ${experience.id === 'backroom-run' ? 'is-backroom' : ''} ${complete ? 'is-complete' : ''} ${index === 0 ? 'is-start' : ''}`} style={{ '--card-accent': experience.color } as React.CSSProperties} onClick={() => onNavigate(experience.id)}>
            <span className="experience-card__order">{experience.order}</span>
            <span className="experience-card__icon"><Icon /></span>
            <span className="experience-card__copy"><strong>{experience.title}</strong><p>{experience.description}</p></span>
            <code className="experience-card__preview" aria-hidden="true">{previews[index]}</code>
            <span className="experience-card__state">{experience.disabled ? <><Lock size={16} /> COMING SOON</> : complete ? <><Check size={16} /> DONE · PLAY AGAIN</> : saved && saved.count > 0 ? <>{saved.count} / {saved.total} {saved.label} · CONTINUE <ArrowRight size={16} /></> : <>LET'S TRY IT <ArrowRight size={16} /></>}</span>
            {index === 0 && !complete && <i>START HERE</i>}
          </button>
        })}
      </section>
      <footer className="variables-note"><span>{open} ACTIVITIES OPEN</span> Start with Backroom Run. Finish by defeating the Final Bosses.</footer>
    </main>
  )
}
