import { ArrowLeft, ArrowRight, Check, Flame, Lock, Sparkles } from 'lucide-react'
import backroomImage from '../assets/cards/backroom-run.webp'
import choiceImage from '../assets/cards/choice-machine.webp'
import bossesImage from '../assets/cards/final-bosses.webp'
import ifElseImage from '../assets/cards/if-else.webp'
import choicesImage from '../assets/cards/more-choices.webp'
import repairImage from '../assets/cards/repair-shop.webp'
import { conditionBosses } from '../data/conditionBosses'
import { conditionExperiences } from '../data/conditions'
import { moreChoiceLevels } from '../data/moreChoices'
import { repairTickets } from '../data/repairShop'
import { completedIfElseLevels } from '../lib/ifElseProgress'
import type { ActivityId, AppRoute, SessionProgress } from '../types'
import { levelCount } from '../experiences/conditions/backroom/backroomLevels'
import './conditionsHome.css'

interface Props {
  progress: SessionProgress
  onNavigate: (route: AppRoute) => void
}

// Screenshots taken from each activity.
const covers: Record<ActivityId, string> = {
  'backroom-run': backroomImage,
  'choice-machine': choiceImage,
  'if-else': ifElseImage,
  'make-it-work': repairImage,
  'more-than-one-choice': choicesImage,
  'conditions-final-bosses': bossesImage,
} as Record<ActivityId, string>

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
      <section className="experience-grid cond-grid">
        {conditionExperiences.map((experience, index) => {
          const Icon = experience.icon
          const complete = progress.completed.includes(experience.id)
          const saved = savedSteps(progress, experience.id)
          const final = experience.id === 'conditions-final-bosses'
          return <button key={experience.id} disabled={experience.disabled} aria-label={`${experience.order} ${experience.title}: ${experience.disabled ? 'Coming soon' : experience.description}`} className={`cond-card cond-card--${experience.id} ${experience.disabled ? 'is-disabled' : ''} ${complete ? 'is-complete' : ''}`} style={{ '--card-accent': experience.color } as React.CSSProperties} onClick={() => onNavigate(experience.id)}>
            <span className="cond-card__media" aria-hidden="true"><img src={covers[experience.id]} alt="" loading="lazy" draggable={false} /></span>
            <span className="cond-card__order" aria-hidden="true">{experience.order}</span>
            {index === 0 && !complete && <i className="cond-card__ribbon">START HERE</i>}
            {final && <i className="cond-card__ribbon is-final"><Flame size={13} /> FINAL ROUND</i>}
            <span className="cond-card__title"><span className="cond-card__icon"><Icon size={20} /></span><strong>{experience.title}</strong></span>
            <span className="cond-card__body">
              <p>{experience.description}</p>
              <span className="cond-card__state">{experience.disabled ? <><Lock size={15} /> COMING SOON</> : complete ? <><Check size={15} /> DONE · PLAY AGAIN</> : saved && saved.count > 0 ? <>{saved.count} / {saved.total} {saved.label} · CONTINUE <ArrowRight size={15} /></> : <>LET'S TRY IT <ArrowRight size={15} /></>}</span>
            </span>
          </button>
        })}
      </section>
      <footer className="variables-note"><span>{open} ACTIVITIES OPEN</span> Start with Backroom Run. Finish by defeating the Final Bosses.</footer>
    </main>
  )
}
