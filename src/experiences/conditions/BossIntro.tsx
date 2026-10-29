import { ArrowLeft, ArrowRight, Check, Swords, X, Zap } from 'lucide-react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { conditionBosses } from '../../data/conditionBosses'
import type { BossFighter } from '../../types'
import { fighterBases, fighterColors } from '../../data/bossFighters'
import { FighterSprite, MiniSprite } from './BossSprites'

interface Props {
  fighter: BossFighter
  onClose: (fighter: BossFighter) => void
}

const [slime] = conditionBosses
const finalBoss = conditionBosses[conditionBosses.length - 1]

function Fighter({ fighter, size = 7 }: { fighter: BossFighter; size?: number }) {
  return <div className="bi-hero">
    <span className="bi-hero__pad"><FighterSprite fighter={fighter} size={size} /></span>
    <b>{fighter.name}</b>
    <small>YOUR FIGHTER</small>
  </div>
}

interface SceneContext { fighter: BossFighter; setFighter: (fighter: BossFighter) => void }
interface Scene { kicker: string; title: string; text: string; stage: (context: SceneContext) => ReactNode }

const scenes: Scene[] = [
  {
    kicker: 'BEFORE THE FIRST ROUND',
    title: 'Create your fighter',
    text: 'Pick a body, a colour and a name. Your fighter enters the arena with you and attacks with your code.',
    stage: ({ fighter, setFighter }) => <div className="bi-create">
      <div className="bi-create__preview"><span className="bi-hero__pad is-big"><FighterSprite fighter={fighter} size={9} /></span><b>{fighter.name || '…'}</b></div>
      <div className="bi-create__controls">
        <div className="bi-create__row" role="radiogroup" aria-label="Fighter body">{fighterBases.map((base) => <button key={base.id} role="radio" aria-checked={fighter.base === base.id} aria-label={base.label} className={fighter.base === base.id ? 'is-on' : ''} onClick={() => setFighter({ ...fighter, base: base.id })}>
          <FighterSprite fighter={{ ...fighter, base: base.id }} size={3} /><small>{base.label}</small>
        </button>)}</div>
        <div className="bi-create__colors" role="radiogroup" aria-label="Fighter colour">{fighterColors.map((color, i) => <button key={color.label} role="radio" aria-checked={fighter.color === i} aria-label={color.label} className={fighter.color === i ? 'is-on' : ''} style={{ '--swatch': color.body, '--swatch-shade': color.shade } as CSSProperties} onClick={() => setFighter({ ...fighter, color: i })} />)}</div>
        <label className="bi-create__name"><small>NAME</small><input value={fighter.name} maxLength={12} onChange={(event) => setFighter({ ...fighter, name: event.target.value })} aria-label="Fighter name" /></label>
      </div>
    </div>,
  },
  {
    kicker: 'ROUND 1 · THE CLUB DOOR',
    title: 'Your fighter against ten bosses',
    text: 'Every boss guards a decision. Write Python that makes the right choice for every value, and your fighter takes the boss down.',
    stage: ({ fighter }) => <div className="bi-versus">
      <div className="bi-versus__side is-left"><Fighter fighter={fighter} /></div>
      <div className="bi-versus__vs" aria-hidden="true"><span>VS</span><i /><i /></div>
      <div className="bi-versus__side is-right"><div className="bi-boss"><MiniSprite boss={slime} size={8} /><b>{slime.name.toUpperCase()}</b><small>BOSS 01</small></div></div>
    </div>,
  },
  {
    kicker: 'HOW A FIGHT WORKS',
    title: 'Right answers hit, wrong answers hurt',
    text: 'Press ATTACK and your code runs once for each test. A right answer and your fighter hits the boss. A wrong one and the boss hits back. Five hits knock the boss out.',
    stage: ({ fighter }) => <div className="bi-fight">
      <div className="bi-fight__hero"><FighterSprite fighter={fighter} size={5} /></div>
      <div className="bi-fight__lane" aria-hidden="true"><i className="bi-fight__bolt" /><i className="bi-fight__counter" /></div>
      <div className="bi-fight__boss">
        <div className="bi-hpbar" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>
        <div className="bi-fight__sprite"><MiniSprite boss={slime} size={6} /></div>
        <span className="bi-fight__damage">-1</span>
      </div>
    </div>,
  },
  {
    kicker: 'THE TESTS',
    title: 'Two tests shown, three surprises',
    text: 'You see two tests before you attack. The other three stay hidden and aim right at the edge of the rule, like exactly 18.',
    stage: () => <div className="bi-cards">
      {[['age = 20', 'Welcome in'], ['age = 12', 'Too young'], ['age = 18', 'Welcome in'], ['age = 17', 'Too young'], ['age = 45', 'Welcome in']].map(([input, out], i) => <div key={input} className={`bi-card ${i >= 2 ? 'is-surprise' : ''}`} style={{ '--i': i } as CSSProperties}>
        <div className="bi-card__inner">
          <div className="bi-card__face"><small>TEST {i + 1}</small><b>{input}</b><span><Check size={11} /> {out}</span></div>
          {i >= 2 && <div className="bi-card__back"><small>TEST {i + 1}</small><b>?</b><span>surprise</span></div>}
        </div>
      </div>)}
    </div>,
  },
  {
    kicker: 'THE HELP RUNS OUT',
    title: 'Each round, you write more',
    text: 'Round 1 gives you the if and the else. Then the help shrinks, and from round 4 you write the whole decision.',
    stage: () => <div className="bi-ladder">
      {[
        { round: '1', task: 'Last print', code: ['if age >= 18:', '    print("Welcome in")', 'else:', '    ▮▮▮▮▮▮▮▮'] },
        { round: '2', task: 'Both prints', code: ['if temp > 30:', '    ▮▮▮▮▮▮▮▮', 'else:', '    ▮▮▮▮▮▮▮▮'] },
        { round: '3', task: 'Prints + else', code: ['if code == 4729:', '    ▮▮▮▮▮▮▮▮', '▮▮▮▮▮', '    ▮▮▮▮▮▮▮▮'] },
        { round: '4+', task: 'Everything', code: ['▮▮▮▮▮▮▮▮▮▮▮', '    ▮▮▮▮▮▮▮▮', '▮▮▮▮▮', '    ▮▮▮▮▮▮▮▮'] },
      ].map((step, i) => <div key={step.round} className="bi-step" style={{ '--i': i } as CSSProperties}>
        <span className="bi-step__round">ROUND {step.round}</span>
        <pre>{step.code.map((line, j) => <code key={j}>{line.split(/(▮+)/).map((part, k) => part.startsWith('▮') ? <mark key={k}>{part}</mark> : part)}</code>)}</pre>
        <b>{step.task}</b>
      </div>)}
    </div>,
  },
  {
    kicker: 'THE BOSSES ARE COMING',
    title: 'Ten bosses wait in the arena',
    text: 'Each one is tougher than the last. Defeat all ten to become the Conditions Champion.',
    stage: () => <div className="bi-lineup">
      {conditionBosses.map((boss, i) => <div key={boss.id} className={`bi-lineup__boss ${i === 0 ? 'is-first' : ''} ${boss.id === finalBoss.id ? 'is-final' : ''}`} style={{ '--i': i } as CSSProperties}>
        {i === 0 ? <MiniSprite boss={boss} size={4} /> : <MiniSprite boss={boss} size={boss.id === finalBoss.id ? 5 : 4} shadow="#06060a" />}
        <small>{i === 0 ? boss.name : boss.id === finalBoss.id ? 'FINAL BOSS' : '???'}</small>
      </div>)}
    </div>,
  },
]

/** The arena intro: build a fighter, then a match-up against the bosses. Opens on the first visit and from the help button. */
export function BossIntro({ fighter: initial, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const [fighter, setFighter] = useState(initial)
  const scene = scenes[index]
  const last = index === scenes.length - 1
  const finish = () => onClose({ ...fighter, name: fighter.name.trim().slice(0, 12) || initial.name })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Arrow keys move the caret while the name field is focused.
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'ArrowRight') setIndex((current) => Math.min(scenes.length - 1, current + 1))
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(0, current - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return <div className="bi-backdrop" onKeyDown={(event) => { if (event.key === 'Escape') finish() }}>
    <div className="bi" role="dialog" aria-modal="true" aria-labelledby="bi-title">
      <div className="bi__embers" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--x': `${(i * 53) % 100}%`, '--d': `${(i % 6) * 0.6}s`, '--s': `${3 + (i % 3) * 2}px` } as CSSProperties} />)}</div>
      <button className="bi__close" onClick={finish} aria-label="Close the intro"><X size={18} /></button>
      <div key={index} className={`bi__stage bi__stage--${index}`}>{scene.stage({ fighter, setFighter })}</div>
      <div key={`copy-${index}`} className="bi__copy">
        <p className="bi__kicker"><Zap size={13} /> {scene.kicker}</p>
        <h2 id="bi-title">{scene.title}</h2>
        <p className="bi__text">{scene.text}</p>
      </div>
      <div className="bi__nav">
        <button className="bi__back" onClick={() => setIndex(index - 1)} disabled={index === 0}><ArrowLeft size={16} /> BACK</button>
        <div className="bi__dots" aria-hidden="true">{scenes.map((_, dot) => <i key={dot} className={dot === index ? 'is-on' : dot < index ? 'is-past' : ''} />)}</div>
        <button className="bi__next" autoFocus onClick={() => (last ? finish() : setIndex(index + 1))}>{last ? <><Swords size={16} /> ENTER THE ARENA</> : index === 0 ? <>READY <ArrowRight size={16} /></> : <>NEXT <ArrowRight size={16} /></>}</button>
      </div>
    </div>
  </div>
}
