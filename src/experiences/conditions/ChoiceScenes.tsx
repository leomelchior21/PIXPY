const rainDrops = Array.from({ length: 40 }, (_, index) => ({
  x: 8 + ((index * 53) % 306),
  y: 28 + ((index * 37) % 186),
  length: 12 + (index % 4) * 4,
  delay: (index % 11) * 0.1,
  duration: 0.8 + (index % 5) * 0.11,
}))

export function RainScene() {
  return <div className="cm-scene cm-scene--rain" role="img" aria-label="Heavy rain falling outside an open window, with an umbrella waiting by the door">
    <svg viewBox="0 0 320 288" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="cm-rain-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334f6a" />
          <stop offset="48%" stopColor="#5d84a4" />
          <stop offset="100%" stopColor="#a9cade" />
        </linearGradient>
        <linearGradient id="cm-rain-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#40607a" />
          <stop offset="100%" stopColor="#223a4b" />
        </linearGradient>
        <clipPath id="cm-rain-clip"><rect width="320" height="288" rx="9" /></clipPath>
      </defs>
      <g clipPath="url(#cm-rain-clip)">
        <rect width="320" height="288" fill="url(#cm-rain-sky)" />
        <g className="cm-rain-clouds">
          <g fill="#e4eef5" opacity=".92">
            <ellipse cx="66" cy="58" rx="62" ry="22" />
            <ellipse cx="110" cy="42" rx="44" ry="17" />
            <ellipse cx="248" cy="66" rx="72" ry="24" />
            <ellipse cx="214" cy="48" rx="43" ry="16" />
          </g>
          <g fill="#c3d6e4" opacity=".8">
            <ellipse cx="160" cy="26" rx="100" ry="17" />
            <ellipse cx="40" cy="20" rx="54" ry="13" />
          </g>
        </g>
        <g className="cm-rain-drops" stroke="#eaf7ff" strokeWidth="2.6" strokeLinecap="round">
          {rainDrops.map((drop, index) => <line key={index} x1={drop.x} y1={drop.y} x2={drop.x - 3.4} y2={drop.y + drop.length} style={{ animationDelay: `${drop.delay}s`, animationDuration: `${drop.duration}s` }} />)}
        </g>
        <rect y="238" width="320" height="50" fill="url(#cm-rain-ground)" />
        <g className="cm-rain-water">
          <ellipse cx="54" cy="256" rx="38" ry="7" fill="#8ec7e6" opacity=".6" />
          <ellipse cx="152" cy="268" rx="52" ry="8" fill="#8ec7e6" opacity=".45" />
          <ellipse cx="268" cy="254" rx="40" ry="7" fill="#8ec7e6" opacity=".6" />
          <g stroke="#d8f1ff" strokeWidth="1.6" fill="none">
            <ellipse className="cm-rain-ripple" cx="152" cy="268" rx="26" ry="4.6" />
            <ellipse className="cm-rain-ripple cm-rain-ripple--two" cx="54" cy="256" rx="18" ry="3.6" />
            <ellipse className="cm-rain-ripple cm-rain-ripple--three" cx="268" cy="254" rx="20" ry="3.8" />
          </g>
        </g>
        <g className="cm-rain-person">
          <path d="M48 178 Q92 134 136 178 Z" fill="#b9f352" stroke="#08101a" strokeWidth="2.4" />
          <path d="M92 178 Q92 134 92 178" fill="none" stroke="#08101a" strokeWidth="2" />
          <line x1="92" y1="160" x2="92" y2="202" stroke="#08101a" strokeWidth="2.6" />
          <path d="M92 202 q-8 3 -9 10" fill="none" stroke="#08101a" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="92" cy="192" r="8" fill="#f4cfa9" stroke="#08101a" strokeWidth="2" />
          <path d="M84.6 188 a7.4 7.4 0 0 1 14.8 0" fill="#2a3a4c" />
          <path d="M84 205 h16 l3 28 h-22 Z" fill="#ff855e" stroke="#08101a" strokeWidth="2" />
          <line x1="89" y1="233" x2="88" y2="248" stroke="#08101a" strokeWidth="3" strokeLinecap="round" />
          <line x1="95" y1="233" x2="97" y2="248" stroke="#08101a" strokeWidth="3" strokeLinecap="round" />
        </g>
        <rect className="cm-rain-window" x="4" y="4" width="312" height="280" rx="9" fill="none" stroke="#08101a" strokeWidth="7" />
        <line x1="160" y1="4" x2="160" y2="284" stroke="#08101a" strokeWidth="5" />
        <line x1="4" y1="150" x2="316" y2="150" stroke="#08101a" strokeWidth="5" />
      </g>
    </svg>
  </div>
}

const lockKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
const pressedKeys: Record<string, string> = { '4': 'is-ok', '7': 'is-ok', '2': 'is-ok', '8': 'is-bad' }

export function LockScene() {
  return <div className="cm-scene cm-scene--lock" role="img" aria-label="A door lock with keys from 0 to 9. The secret code is 4729, but the typed code is 4728">
    <div className="cm-lock">
      <div className="cm-lock__shackle" aria-hidden="true" />
      <div className="cm-lock__body">
        <div className="cm-lock__top">
          <span className="cm-lock__led" aria-hidden="true" />
          <small>DOOR LOCK</small>
        </div>
        <div className="cm-lock__screen">
          <small>TYPED CODE</small>
          <strong>472<b className="is-bad">8</b></strong>
        </div>
        <div className="cm-lock__secret">SECRET CODE <b>4729</b></div>
        <div className="cm-lock__keys">{lockKeys.map((key) => <span key={key} className={pressedKeys[key] ?? ''}>{key}</span>)}</div>
      </div>
    </div>
  </div>
}

const gradeRows = [
  { name: 'ALICE', grade: 10 },
  { name: 'BRUNO', grade: 9 },
  { name: 'CARLA', grade: 8, target: true },
  { name: 'DAVI', grade: 6 },
  { name: 'EVA', grade: 5 },
]

export function GradeScene({ revealed = false }: { revealed?: boolean }) {
  return <div className="cm-scene cm-scene--grade" role="img" aria-label={`A grade book with the pass mark at 7. Carla has an 8, and her row is circled${revealed ? ' and stamped approved' : ''}`}>
    <div className="cm-gradebook">
      <div className="cm-gradebook__rings" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
      <header><span>GRADE BOOK · CLASS 8B</span><b>PASS MARK: 7</b></header>
      <ul>
        {gradeRows.map((row) => <li key={row.name} className={row.target ? 'is-target' : ''}>
          <span className="cm-gradebook__name">{row.name}</span>
          <i className="cm-gradebook__leader" aria-hidden="true" />
          <strong>{row.grade}</strong>
          {row.target && <em className="cm-gradebook__circle" aria-hidden="true" />}
        </li>)}
      </ul>
      {revealed && <span className="cm-gradebook__stamp" aria-hidden="true">APPROVED</span>}
    </div>
  </div>
}

export function ChoiceScene({ id, revealed = false }: { id: 'rain' | 'password' | 'grade'; revealed?: boolean }) {
  if (id === 'rain') return <RainScene />
  if (id === 'password') return <LockScene />
  return <GradeScene revealed={revealed} />
}
