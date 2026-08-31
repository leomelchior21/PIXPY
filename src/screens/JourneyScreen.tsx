import { Check, LockKeyhole, Play, Sparkles } from 'lucide-react'
import type { AppRoute, StudentProfile } from '../types'

interface JourneyScreenProps {
  profile: StudentProfile
  onNavigate: (route: AppRoute) => void
}

const futureStops = [
  ['02', 'Game Maker', 'Strings'],
  ['03', 'Terminal Zero', 'print()'],
  ['04', 'Security Gate', 'if'],
  ['05', 'Loop Lab', 'for'],
  ['06', 'Function Forge', 'functions'],
]

export function JourneyScreen({ profile, onNavigate }: JourneyScreenProps) {
  const progress = profile.completedMissions.length * 20

  return (
    <main className="app-page journey-screen">
      <section className="page-heading">
        <div>
          <p className="kicker">WORLD MAP // SECTOR 01</p>
          <h1>Your <em>Journey</em></h1>
          <p>Every lab gives you a new way to control the world.</p>
        </div>
        <div className="journey-score"><strong>{progress}%</strong><span>SECTOR DISCOVERED</span></div>
      </section>

      <section className="journey-map">
        <div className="journey-map__grid" />
        <div className="journey-path" />
        <article className="journey-stop journey-stop--active">
          <button onClick={() => onNavigate('dino-lab')} aria-label="Open Dino Lab">
            <span className="journey-stop__number">01</span>
            <span className="journey-stop__orb"><Play size={22} fill="currentColor" /></span>
          </button>
          <div><small>{progress === 100 ? 'COMPLETED' : 'ACTIVE LAB'}</small><strong>Dino Lab</strong><em>Variables · {profile.completedMissions.length}/5 missions</em></div>
        </article>

        {futureStops.map(([number, title, concept], index) => (
          <article className="journey-stop journey-stop--locked" key={number}>
            <div className="journey-stop__node">
              <span className="journey-stop__number">{number}</span>
              <span className="journey-stop__orb"><LockKeyhole size={18} /></span>
            </div>
            <div><small>{index === 0 ? 'NEXT LAB' : 'ENCRYPTED'}</small><strong>{title}</strong><em>{concept}</em></div>
          </article>
        ))}
        <div className="journey-secret"><Sparkles size={18} /><span>More signals detected beyond this point...</span></div>
      </section>

      <section className="journey-legend">
        <span><i className="legend-dot legend-dot--active" /> Available</span>
        <span><i className="legend-dot legend-dot--done"><Check size={9} /></i> Completed</span>
        <span><i className="legend-dot" /> Locked</span>
      </section>
    </main>
  )
}
