import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { conditionExperiences, type ConditionExperience } from '../../data/conditions'
import { completeActivity } from '../../session/progressSession'
import type { AppRoute, SessionProgress } from '../../types'

interface Props {
  activity: ConditionExperience
  progress: SessionProgress
  onProgress: (progress: SessionProgress) => void
  onBack: () => void
  onNext: (route: AppRoute) => void
}

export function ConditionsActivity({ activity, progress, onProgress, onBack, onNext }: Props) {
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const challenge = activity.challenges[step]
  const next = conditionExperiences[conditionExperiences.findIndex((item) => item.id === activity.id) + 1]

  const advance = () => {
    if (step + 1 === activity.challenges.length) {
      setFinished(true)
      onProgress(completeActivity(progress, activity.id))
    } else {
      setStep(step + 1)
      setSelected(null)
    }
  }

  return <main className="conditions-activity" style={{ '--condition-accent': activity.color } as React.CSSProperties}>
    <header className="conditions-activity__header">
      <button onClick={onBack}><ArrowLeft size={17} /> Conditions</button>
      <div><small>WORLD 02 · ACTIVITY {activity.order} / {String(conditionExperiences.length).padStart(2, '0')}</small><h1>{activity.title}</h1></div>
      <span>{finished ? 'COMPLETE' : `${step + 1} / ${activity.challenges.length}`}</span>
    </header>
    {finished ? <section className="conditions-activity__finish">
      <span className="conditions-activity__badge"><Check size={40} /></span>
      <p>ACTIVITY COMPLETE</p><h2>Decision made!</h2>
      <p>You followed each condition and found the path Python takes.</p>
      <div><button onClick={() => { setStep(0); setSelected(null); setFinished(false) }}><RotateCcw size={17} /> PLAY AGAIN</button>
        <button onClick={() => next ? onNext(next.id) : onBack()}>{next ? `NEXT: ${next.title}` : 'BACK TO CONDITIONS'} <ArrowRight size={17} /></button></div>
    </section> : <section className="conditions-activity__layout">
      <div className="conditions-activity__lesson">
        <span>THE CODE</span><pre><code>{challenge.code}</code></pre>
        <p>Read the code from top to bottom. An indented line runs only when its condition chooses that path.</p>
      </div>
      <div className="conditions-activity__challenge">
        <div className="conditions-activity__meter" aria-label={`Challenge ${step + 1} of ${activity.challenges.length}`}>{activity.challenges.map((_, index) => <span key={index} className={index <= step ? 'is-active' : ''} />)}</div>
        <small>CHALLENGE {step + 1} OF {activity.challenges.length}</small><h2>{challenge.prompt}</h2>
        <div className="conditions-activity__choices">{challenge.options.map((option, index) => <button key={option} aria-label={`${String.fromCharCode(65 + index)} ${option}`} className={selected === index ? index === challenge.answer ? 'is-correct' : 'is-wrong' : ''} onClick={() => setSelected(index)}><b>{String.fromCharCode(65 + index)}</b>{option}</button>)}</div>
        <div className="conditions-activity__feedback" role="status">{selected === null ? 'Choose an answer to test your thinking.' : <><strong>{selected === challenge.answer ? 'Exactly!' : 'Try another path.'}</strong> {challenge.explanation}</>}</div>
        <button className="conditions-activity__next" disabled={selected !== challenge.answer} onClick={advance}>{step + 1 === activity.challenges.length ? 'FINISH ACTIVITY' : 'NEXT CHALLENGE'} <ArrowRight size={18} /></button>
      </div>
    </section>}
  </main>
}
