import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { extraExperiences } from '../data/extras'
import type { AppRoute, SessionProgress } from '../types'
import './extrasHome.css'

interface Props {
  progress: SessionProgress
  onNavigate: (route: AppRoute) => void
}

const demoRows = [
  { label: 'NAME', value: 'Leo', accent: '#5c9dff' },
  { label: 'COLOR', value: 'Blue', accent: '#58d7f5' },
  { label: 'FRUIT', value: 'Mango', accent: '#a994ff' },
  { label: 'SPORT', value: 'Surf', accent: '#59dfb9' },
]

export function ExtrasHome({ progress, onNavigate }: Props) {
  const completed = extraExperiences.filter((item) => progress.completed.includes(item.id)).length
  const stop = extraExperiences[0]
  const stopComplete = progress.completed.includes('stop')
  const [heroTitle, ...heroRest] = stop.title.split(' · ')
  const heroKicker = heroRest.join(' · ') || 'PYTHON · STRINGS'

  return (
    <main className="extras-home">
      <aside className="extras-rail">
        <button className="extras-back" onClick={() => onNavigate('home')}><ArrowLeft size={16} /> All worlds</button>
        <div className="extras-rail__copy">
          <p className="pixel-kicker"><Sparkles size={14} /> WORLD 03</p>
          <h1>Extras</h1>
          <p>One bonus build: the STOP string sheet.</p>
        </div>
        <div className="extras-rail__stat"><strong>{completed}<span>/{extraExperiences.length}</span></strong><small>EXTRA<br />PLAYED</small></div>
      </aside>

      <section className="extras-stage">
        <button
          className={`extra-hero ${stopComplete ? 'is-complete' : ''}`}
          aria-label={`${stop.order} ${stop.title}: ${stop.description}`}
          style={{ '--hero-accent': stop.color } as React.CSSProperties}
          onClick={() => onNavigate(stop.id)}
        >
          <span className="extra-hero__tape">EXTRA {stop.order}</span>
          <div className="extra-hero__copy">
            <span className="extra-hero__signal" aria-hidden="true">STOP</span>
            <small>{heroKicker}</small>
            <strong className="extra-hero__title">{heroTitle}</strong>
            <p>{stop.description} Every labeled print grows the sheet, and RUN validates the real program.</p>
            <span className="extra-hero__cta">{stopComplete ? <><Check size={16} /> PLAY AGAIN</> : <>LET’S TRY IT <ArrowRight size={16} /></>}</span>
            <span className="extra-hero__meta"><i>6 ROWS</i><i>LIVE SHEET</i><i>RUN → VALIDATE</i></span>
          </div>
          <div className="extra-hero__demo" aria-hidden="true">
            <div className="extra-demo__window">
              <header><span><b>PY</b> code.py</span><em>LIVE</em></header>
              <code className="extra-demo__code">
                <span style={{ '--i': 0 } as React.CSSProperties}><b>answer1</b> = <i>"Leo"</i></span>
                <span style={{ '--i': 1 } as React.CSSProperties}><b>print</b>(<i>"Name: "</i> + answer1)</span>
                <span className="is-caret" />
              </code>
            </div>
            <span className="extra-demo__link"><ArrowRight size={16} /></span>
            <div className="extra-demo__sheet">
              {demoRows.map((row, index) => (
                <span key={row.label} className="extra-demo__row" style={{ '--i': index, '--demo-accent': row.accent } as React.CSSProperties}>
                  <b>{row.label}</b><em>{row.value}</em><i><Check size={11} /> VALID</i>
                </span>
              ))}
            </div>
          </div>
        </button>
      </section>

      <footer className="variables-note"><span>RUN IT</span> Type on the left. The sheet answers back on the right.</footer>
    </main>
  )
}
