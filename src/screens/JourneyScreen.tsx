import { ArrowRight, Check, Flag, LockKeyhole, Play } from 'lucide-react'
import { dinoMissions } from '../data/dinoLab'
import type { AppRoute, StudentProfile } from '../types'

interface JourneyScreenProps {
  profile: StudentProfile
  onNavigate: (route: AppRoute) => void
}

const JOURNEY_SLICES = 5
const FIRST_SLICE_START = -126
const FIRST_SLICE_END = -54

export function JourneyScreen({ profile, onNavigate }: JourneyScreenProps) {
  const completed = dinoMissions.filter((mission) => profile.completedMissions.includes(mission.id)).length
  const allModesComplete = completed === dinoMissions.length
  const challengeComplete = profile.badges.includes('runner-challenge')

  return (
    <main className="app-page journey-screen journey-screen--pizza">
      <section className="page-heading journey-heading">
        <div>
          <p className="kicker">JOURNEY // SLICE 01</p>
          <h1>Build your first slice.</h1>
          <p>Five modes grow Runner Lab from the center out. Clear its final challenge to finish the slice.</p>
        </div>
        <div className={`journey-score ${challengeComplete ? 'is-complete' : ''}`}>
          <strong>{challengeComplete ? 'DONE' : `${completed}/5`}</strong>
          <span>{challengeComplete ? 'SLICE COMPLETE' : 'MODES CLEARED'}</span>
        </div>
      </section>

      <section className="pizza-journey-window">
        <div className="retro-titlebar retro-titlebar--journey"><span>JOURNEY_SLICE_01.PIZZA</span><i>— □ ×</i></div>
        <div className="pizza-journey-layout">
          <div
            className="pizza-chart"
            role="img"
            aria-label={`Journey slice 1: ${completed} of 5 modes complete. Final challenge ${challengeComplete ? 'complete' : allModesComplete ? 'unlocked' : 'locked'}.`}
          >
            <svg viewBox="0 0 440 440">
              <circle cx="220" cy="220" r="207" className="pizza-rim" />
              {Array.from({ length: JOURNEY_SLICES }, (_, index) => {
                const start = FIRST_SLICE_START + index * 72
                return (
                  <path
                    key={index}
                    d={pizzaSlicePath(220, 220, 195, start, start + 68)}
                    className={`pizza-step-slice ${index === 0 ? 'is-current-step' : 'is-locked'}`}
                  />
                )
              })}

              {dinoMissions.map((mission, index) => {
                const done = profile.completedMissions.includes(mission.id)
                const active = !done && index === completed
                const innerRadius = 52 + index * 25
                return (
                  <path
                    key={mission.id}
                    d={pizzaDegreePath(220, 220, innerRadius, innerRadius + 23, FIRST_SLICE_START + 3, FIRST_SLICE_END - 3)}
                    className={`pizza-degree ${done ? 'is-complete' : ''} ${active ? 'is-active' : ''}`}
                  />
                )
              })}

              <path
                d={pizzaDegreePath(220, 220, 180, 204, FIRST_SLICE_START + 2, FIRST_SLICE_END - 2)}
                className={`pizza-challenge-crust ${challengeComplete ? 'is-complete' : ''} ${allModesComplete && !challengeComplete ? 'is-active' : ''}`}
              />
              <circle cx="220" cy="220" r="51" className="pizza-center" />
              <text x="220" y="212" textAnchor="middle" className="pizza-center__number">01</text>
              <text x="220" y="237" textAnchor="middle" className="pizza-center__label">{completed}/5 MODES</text>
            </svg>
          </div>

          <div className="pizza-details">
            <p className="kicker">SLICE 01 // RUNNER LAB</p>
            <h2>Five modes. One challenge.</h2>
            <p>Every completed mode adds one level to this slice. The outer crust is the end-of-step challenge.</p>
            <div className="pizza-mission-list">
              {dinoMissions.map((mission, index) => {
                const done = profile.completedMissions.includes(mission.id)
                const active = !done && index === completed
                return (
                  <div className={`${done ? 'is-complete' : ''} ${active ? 'is-active' : ''}`} key={mission.id}>
                    <span>{done ? <Check size={14} /> : String(index + 1).padStart(2, '0')}</span>
                    <strong>{mission.title}</strong>
                    <em>{done ? 'DONE' : active ? 'NEXT MODE' : 'LOCKED'}</em>
                  </div>
                )
              })}
            </div>

            <div className={`journey-challenge ${challengeComplete ? 'is-complete' : ''} ${allModesComplete && !challengeComplete ? 'is-active' : ''}`}>
              <span>{challengeComplete ? <Check size={20} /> : allModesComplete ? <Flag size={20} /> : <LockKeyhole size={18} />}</span>
              <div>
                <small>END-OF-STEP CHALLENGE</small>
                <strong>Century Run</strong>
                <p>{challengeComplete ? 'Challenge cleared. Slice 01 is complete.' : allModesComplete ? 'Reach 100 points in the runner to complete Slice 01.' : 'Complete all five modes to unlock.'}</p>
              </div>
              <em>+200 XP</em>
            </div>

            <button className="primary-button" onClick={() => onNavigate('dino-lab')}>
              <Play size={17} fill="currentColor" /> {allModesComplete && !challengeComplete ? 'ENTER FINAL CHALLENGE' : completed ? 'CONTINUE RUNNER LAB' : 'START RUNNER LAB'} <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function pizzaSlicePath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, radius, startAngle)
  const end = polar(cx, cy, radius, endAngle)
  return [`M ${cx} ${cy}`, `L ${start.x} ${start.y}`, `A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`, 'Z'].join(' ')
}

function pizzaDegreePath(cx: number, cy: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  const outerStart = polar(cx, cy, outerRadius, startAngle)
  const outerEnd = polar(cx, cy, outerRadius, endAngle)
  const innerEnd = polar(cx, cy, innerRadius, endAngle)
  const innerStart = polar(cx, cy, innerRadius, startAngle)
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = angle * Math.PI / 180
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }
}
