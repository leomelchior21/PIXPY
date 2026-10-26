import { ArrowLeft, ArrowRight, Check, Crown, Lightbulb, LoaderCircle, Lock, RotateCcw, Skull, Swords, Trophy, X } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { bossOutputMatches, bossSprite, cleanBossOutput, conditionBosses, type ConditionBoss } from '../../data/conditionBosses'
import { runDecisionProgram } from '../../lib/decisionTracer'
import { runGuidedPython } from '../../lib/guidedPython'
import { PythonRunError, pythonRunner } from '../../lib/pythonRunner'
import { completeActivity } from '../../session/progressSession'
import type { BossAttackEvent, SessionProgress } from '../../types'
import './bossArena.css'

interface Props {
  progress: SessionProgress
  onProgress: (progress: SessionProgress) => void
  onBack: () => void
}

type TestStatus = 'hidden' | 'waiting' | 'firing' | 'hit' | 'miss'
interface TestCard { inputs: string[]; expected: string; status: TestStatus; got: string; path: string[]; error: string | null }
type Phase = 'ready' | 'attacking' | 'survived' | 'defeated'

const EXAMPLES = 2
const kindLabels: Record<ConditionBoss['kind'], string> = { write: 'WRITE THE DECISION', fix: 'FIX THE BROKEN CODE', finish: 'FINISH THE CODE' }

function reducedMotion(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function freshCards(boss: ConditionBoss): TestCard[] {
  return boss.tests.map((test, i) => ({ ...test, status: i < EXAMPLES ? 'waiting' : 'hidden', got: '', path: [], error: null }))
}

function pixelColor(boss: ConditionBoss, key: string): string | null {
  switch (key) {
    case 'o': return '#1b1d2a'
    case 'b': return boss.palette.body
    case 'd': return boss.palette.shade
    case 'l': return boss.palette.light
    case 'a': return boss.palette.accent
    case 'w': case 't': return '#ffffff'
    case 'p': return '#1b1d2a'
    case 'm': return '#3b1022'
    default: return null
  }
}

/** The path the tracer saw, only when it agrees with the real run. */
function decisionPath(code: string, inputs: string[], output: string): string[] {
  try {
    const traced = runDecisionProgram(code.split('\n'), inputs)
    if (traced.error || traced.outputs.join('\n').trim() !== output) return []
    return traced.events.filter((event) => event.kind !== 'assign').map((event) => event.kind === 'test' ? `${event.text} → ${event.truth ? 'True' : 'False'}` : event.kind === 'else' ? 'else' : `print → ${event.output}`)
  } catch {
    return []
  }
}

export function BossArena({ progress, onProgress, onBack }: Props) {
  const defeated = progress.conditionBosses
  const firstOpen = conditionBosses.findIndex((boss) => !defeated.includes(boss.id))
  const [index, setIndex] = useState(() => Math.max(0, firstOpen))
  const [finished, setFinished] = useState(() => firstOpen === -1)
  const drafts = useRef<Record<number, string>>({})
  const progressRef = useRef(progress)
  useEffect(() => { progressRef.current = progress }, [progress])
  const accessible = (i: number) => progress.isTeacher || defeated.includes(conditionBosses[i].id) || i === firstOpen

  const record = (event: BossAttackEvent) => {
    const previous = progressRef.current
    const won = event.hits === event.total
    const bosses = won ? [...new Set([...previous.conditionBosses, event.boss])].sort((a, b) => a - b) : previous.conditionBosses
    let updated: SessionProgress = { ...previous, conditionBosses: bosses, conditionBossLog: [...previous.conditionBossLog, event].slice(-200) }
    if (bosses.length === conditionBosses.length) updated = completeActivity(updated, 'conditions-final-bosses')
    progressRef.current = updated
    onProgress(updated)
  }

  const next = () => {
    const bosses = progressRef.current.conditionBosses
    if (bosses.length === conditionBosses.length && index === conditionBosses.length - 1) { setFinished(true); return }
    const open = conditionBosses.findIndex((boss, i) => i > index && !bosses.includes(boss.id))
    setIndex(open === -1 ? Math.min(index + 1, conditionBosses.length - 1) : open)
  }

  if (finished) return <main className="ba-screen">
    <Toolbar onBack={onBack} counter={<><Crown size={18} /> Champion</>} />
    <BossTrail index={-1} defeated={defeated} accessible={accessible} onSelect={(i) => { setIndex(i); setFinished(false) }} />
    <section className="ba-hall">
      <div className="ba-hall__card">
        <div className="ba-hall__crown"><Crown size={54} /></div>
        <p className="ba-kicker">ALL {conditionBosses.length} BOSSES DEFEATED</p>
        <h1>Conditions Champion</h1>
        <p>Your decisions survived {conditionBosses.reduce((sum, boss) => sum + boss.tests.length, 0)} surprise tests, aimed right at the edges of every rule.</p>
        <div className="ba-hall__row">{conditionBosses.map((boss) => <MiniSprite key={boss.id} boss={boss} size={3} beaten />)}</div>
        <div className="ba-hall__actions"><button className="ba-primary" onClick={() => { setIndex(0); setFinished(false) }}><RotateCcw size={17} /> REMATCH</button><button className="ba-secondary" onClick={onBack}>BACK TO CONDITIONS <ArrowRight size={17} /></button></div>
      </div>
    </section>
  </main>

  const boss = conditionBosses[index]
  return <BossFight key={boss.id} boss={boss} index={index} defeated={defeated} accessible={accessible} drafts={drafts.current}
    onSelect={(i) => { if (accessible(i)) setIndex(i) }} onBack={onBack} onRecord={record} onNext={next} />
}

function Toolbar({ onBack, counter }: { onBack: () => void; counter: React.ReactNode }) {
  return <header className="ba-toolbar">
    <button className="ba-back" onClick={onBack}><ArrowLeft size={17} /> Conditions</button>
    <div className="ba-brand"><span><Swords size={20} /></span><div><b>FINAL BOSSES</b><small>THE CONDITIONS ARENA</small></div></div>
    <div className="ba-counter">{counter}</div>
  </header>
}

function MiniSprite({ boss, size, beaten = false, locked = false }: { boss: ConditionBoss; size: number; beaten?: boolean; locked?: boolean }) {
  const shadow = useMemo(() => bossSprite(boss.sprite).flatMap((row, y) => [...row].flatMap((key, x) => {
    const color = pixelColor(boss, key)
    return color ? [`${x * size}px ${y * size}px 0 ${locked ? '#2a2d3d' : color}`] : []
  })).join(','), [boss, size, locked])
  return <span className={`ba-mini ${beaten ? 'is-beaten' : ''}`} style={{ width: size * 16, height: size * 16 }} aria-hidden="true"><i style={{ width: size, height: size, boxShadow: shadow }} /></span>
}

/** 256 pixels that only re-render when the boss changes. */
const BossSprite = memo(function BossSprite({ boss }: { boss: ConditionBoss }) {
  return <div className="ba-sprite">{bossSprite(boss.sprite).flatMap((row, y) => [...row].map((key, x) => {
    const color = pixelColor(boss, key)
    if (!color) return null
    // Deterministic scatter for the defeat explosion.
    const seed = (x * 73 + y * 151 + boss.id * 37) % 360
    const style = { gridColumn: x + 1, gridRow: y + 1, background: color, '--dx': `${Math.cos(seed) * (80 + (seed % 7) * 22)}px`, '--dy': `${Math.sin(seed) * (60 + (seed % 5) * 26) - 40}px`, '--r': `${(seed % 9) * 40 - 160}deg`, '--delay': `${((x + y) % 8) * 25}ms` }
    return <i key={`${x}-${y}`} style={style as CSSProperties} />
  }))}</div>
})

function BossTrail({ index, defeated, accessible, onSelect, disabled = false }: { index: number; defeated: number[]; accessible: (i: number) => boolean; onSelect: (i: number) => void; disabled?: boolean }) {
  return <nav className="ba-trail" aria-label="Bosses">{conditionBosses.map((boss, i) => {
    const done = defeated.includes(boss.id)
    const open = accessible(i)
    return <button key={boss.id} className={`${i === index ? 'is-current' : ''} ${done ? 'is-done' : ''}`} disabled={disabled || !open} aria-current={i === index ? 'step' : undefined}
      aria-label={`Boss ${boss.id}: ${boss.name}${done ? ', defeated' : open ? '' : ', locked'}`} onClick={() => onSelect(i)}>
      <MiniSprite boss={boss} size={2} beaten={done} locked={!open && !done} />
      <span>{String(boss.id).padStart(2, '0')}</span>
      {done ? <Check className="ba-trail__mark" size={12} /> : !open ? <Lock className="ba-trail__mark" size={11} /> : null}
    </button>
  })}</nav>
}

interface FightProps {
  boss: ConditionBoss
  index: number
  defeated: number[]
  accessible: (i: number) => boolean
  drafts: Record<number, string>
  onSelect: (i: number) => void
  onBack: () => void
  onRecord: (event: BossAttackEvent) => void
  onNext: () => void
}

function BossFight({ boss, index, defeated, accessible, drafts, onSelect, onBack, onRecord, onNext }: FightProps) {
  const alreadyBeaten = defeated.includes(boss.id)
  const [code, setCode] = useState(() => drafts[boss.id] ?? boss.starter)
  const [cards, setCards] = useState<TestCard[]>(() => freshCards(boss))
  const [phase, setPhase] = useState<Phase>('ready')
  const [hp, setHp] = useState(boss.tests.length)
  const [shot, setShot] = useState<{ id: number; hit: boolean } | null>(null)
  const [hints, setHints] = useState(0)
  const [note, setNote] = useState<{ tone: 'info' | 'good' | 'bad'; title: string; text: string }>(() => alreadyBeaten
    ? { tone: 'good', title: `${boss.name} was already defeated.`, text: 'Attack again to test another solution.' }
    : { tone: 'info', title: `${boss.name} appears!`, text: `It has ${boss.tests.length} HP. Every test your code passes is a hit.` })
  const [runtime, setRuntime] = useState(pythonRunner.getState())
  const version = useRef(0)
  useEffect(() => {
    const unsubscribe = pythonRunner.subscribe(setRuntime)
    return () => { unsubscribe() }
  }, [])
  useEffect(() => () => { version.current += 1 }, [])
  useEffect(() => { drafts[boss.id] = code }, [boss.id, code, drafts])

  const busy = phase === 'attacking'
  const failing = cards.find((card) => card.status === 'miss')

  const pause = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, reducedMotion() ? 0 : ms) })

  const attack = async () => {
    if (busy) return
    const run = ++version.current
    const tests = freshCards(boss)
    setCards(tests); setPhase('attacking'); setHp(boss.tests.length); setShot(null)
    setNote({ tone: 'info', title: 'Attack!', text: 'Your code runs once for every surprise test.' })
    let hits = 0
    let stopError: string | null = null
    for (let i = 0; i < tests.length; i += 1) {
      if (run !== version.current) return
      tests[i] = { ...tests[i], status: 'firing' }
      setCards([...tests])
      let got = ''
      let hit = false
      let path: string[] = []
      let failure: string | null = null
      if (stopError) failure = stopError
      else {
        try {
          // While Python is still downloading, use the classroom fallback right away
          // instead of waiting for the runner's timeout on every single test.
          const result = pythonRunner.getState() === 'booting' ? runGuidedPython(code, tests[i].inputs) : await pythonRunner.runScript(code, tests[i].inputs)
          got = cleanBossOutput(code, result.stdout)
          hit = bossOutputMatches(got, tests[i].expected)
          if (!hit) path = decisionPath(code, tests[i].inputs, got)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Python could not run this code.'
          failure = error instanceof PythonRunError && error.line ? `Line ${error.line}: ${message}` : message
          // A program that cannot be read fails every test the same way.
          if (/SyntaxError|IndentationError/.test(message)) stopError = failure
        }
      }
      if (run !== version.current) return
      await pause(stopError && i > 0 ? 80 : 280)
      if (run !== version.current) return
      setShot({ id: i, hit })
      await pause(380)
      if (run !== version.current) return
      if (hit) { hits += 1; setHp((value) => value - 1) }
      tests[i] = { ...tests[i], status: hit ? 'hit' : 'miss', got, path, error: failure }
      setCards([...tests])
      await pause(260)
    }
    if (run !== version.current) return
    setShot(null)
    onRecord({ boss: boss.id, hits, total: tests.length, hints, at: Date.now() })
    if (hits === tests.length) {
      setPhase('defeated')
      setNote({ tone: 'good', title: `${boss.name} defeated!`, text: `All ${tests.length} tests passed, including the edge cases.` })
    } else {
      setPhase('survived')
      const miss = tests.find((card) => card.status === 'miss')!
      setNote({ tone: 'bad', title: `${boss.name} survived with ${tests.length - hits} HP.`, text: stopError ? 'Python could not read your code. Fix the error shown below, then attack again.' : miss.error ? `With ${miss.inputs.join(', ')} your code crashed. Read Python’s message below.` : `With ${miss.inputs.join(', ')} your code printed ${miss.got ? `“${miss.got}”` : 'nothing'}, but the boss needed “${miss.expected}”.` })
    }
  }

  const editCode = (value: string) => {
    setCode(value)
    if (phase !== 'attacking' && phase !== 'ready') { setPhase('ready'); setHp(boss.tests.length); setCards(freshCards(boss)) }
  }
  const resetCode = () => { version.current += 1; setCode(boss.starter); setPhase('ready'); setHp(boss.tests.length); setCards(freshCards(boss)); setShot(null) }
  const nextHint = () => setHints((value) => Math.min(boss.hints.length, value + 1))

  return <main className={`ba-screen ba-phase--${phase}`}>
    <Toolbar onBack={onBack} counter={<><span>BOSS</span><b>{String(boss.id).padStart(2, '0')}</b><small>/ {conditionBosses.length}</small></>} />
    <BossTrail index={index} defeated={defeated} accessible={accessible} onSelect={onSelect} disabled={busy} />
    <section className="ba-layout">
      <div className={`ba-arena ${shot && !shot.hit ? 'is-countered' : ''}`} style={{ '--boss': boss.palette.body, '--accent': boss.palette.accent } as CSSProperties}>
        <div className="ba-arena__sky" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i % 5) * 0.7}s`, '--s': `${4 + (i % 4) * 2}px` } as CSSProperties} />)}</div>
        <div className="ba-arena__floor" aria-hidden="true" />
        <header className="ba-hp">
          <div><b>{boss.name}</b><small>{boss.mission.toUpperCase()}</small></div>
          <div className="ba-hp__bar" role="meter" aria-label={`${boss.name} health`} aria-valuemin={0} aria-valuemax={boss.tests.length} aria-valuenow={hp}>{boss.tests.map((_, i) => <i key={i} className={i < hp ? 'is-full' : 'is-lost'} />)}</div>
          <span>HP {hp}/{boss.tests.length}</span>
        </header>
        <div className={`ba-boss ${shot?.hit ? 'is-hit' : ''} ${shot && !shot.hit ? 'is-laughing' : ''} ${phase === 'defeated' ? 'is-defeated' : ''}`} key={phase === 'defeated' ? 'down' : 'up'} role="img" aria-label={`${boss.name}${phase === 'defeated' ? ', defeated' : ''}`}>
          <BossSprite boss={boss} />
          <span className="ba-boss__shadow" />
          {shot && <span key={`dmg-${shot.id}`} className={`ba-damage ${shot.hit ? 'is-hit' : 'is-miss'}`}>{shot.hit ? '-1' : 'MISS'}</span>}
          {shot && <span key={`bolt-${shot.id}`} className={`ba-bolt ${shot.hit ? 'is-hit' : 'is-miss'}`} aria-hidden="true" />}
          <div className="ba-hero" aria-hidden="true"><Swords size={22} /><small>YOUR CODE</small></div>
        </div>
        {phase === 'defeated' && <div className="ba-victory"><span>DEFEATED!</span><Trophy size={34} /></div>}
        <ol className="ba-tests" aria-label="Surprise tests">{cards.map((card, i) => <li key={i} className={`is-${card.status}`}>
          <small>TEST {i + 1}</small>
          <b>{card.status === 'hidden' ? '?' : card.inputs.map((input, j) => `${boss.inputNames[j]}=${input}`).join(' ')}</b>
          <span>{card.status === 'hidden' ? 'surprise' : card.status === 'hit' ? <><Check size={11} /> {card.expected}</> : card.status === 'miss' ? <><X size={11} /> {card.expected}</> : card.status === 'firing' ? <LoaderCircle size={11} className="ba-spin" /> : card.expected}</span>
        </li>)}</ol>
      </div>

      <div className="ba-desk">
        <article className="ba-mission">
          <header><span className={`ba-kind ba-kind--${boss.kind}`}>{kindLabels[boss.kind]}</span><span className="ba-inputs">{boss.inputNames.map((name) => <code key={name}>{name}</code>)}</span></header>
          <h1>{boss.mission}</h1>
          <p>{boss.prompt}</p>
        </article>
        <div className="ba-editor">
          <CodeEditor value={code} onChange={editCode} readOnly={busy} minHeight="150px" label={`Code to defeat ${boss.name}`} />
        </div>
        {failing && phase === 'survived' && <div className="ba-report">
          <span>WHAT HAPPENED IN TEST {cards.indexOf(failing) + 1}</span>
          <div><code>{failing.inputs.map((input, j) => `${boss.inputNames[j]} = ${input}`).join(', ')}</code>{failing.error ? <p>needed <b className="is-good">{failing.expected}</b></p> : <p>printed <b className="is-bad">{failing.got || 'nothing'}</b> · needed <b className="is-good">{failing.expected}</b></p>}</div>
          {failing.error && <pre className="ba-report__error">Python said: {failing.error}</pre>}
          {failing.path.length > 0 && <ol>{failing.path.map((step, i) => <li key={i}>{step}</li>)}</ol>}
        </div>}
        <div className="ba-tools">
          <button className="ba-tool" onClick={resetCode} disabled={busy}><RotateCcw size={15} /> Reset code</button>
          <button className="ba-tool" onClick={nextHint} disabled={busy || hints >= boss.hints.length}><Lightbulb size={15} /> {hints === 0 ? 'Need a hint?' : hints < boss.hints.length ? 'Another hint' : 'No more hints'}</button>
          {runtime === 'booting' && <small className="ba-runtime"><LoaderCircle size={13} className="ba-spin" /> Python is warming up…</small>}
        </div>
        {hints > 0 && <ul className="ba-hints">{boss.hints.slice(0, hints).map((hint) => <li key={hint}><Lightbulb size={14} /> {hint}</li>)}</ul>}
      </div>
    </section>

    <footer className={`ba-footer ba-footer--${note.tone}`}>
      <div role="status"><span className="ba-footer__icon">{note.tone === 'good' ? <Trophy size={21} /> : note.tone === 'bad' ? <Skull size={21} /> : <Swords size={21} />}</span><p><b>{note.title}</b>{note.text}</p></div>
      {phase === 'defeated'
        ? <button className="ba-primary" onClick={onNext}>{index === conditionBosses.length - 1 ? 'CLAIM THE CROWN' : 'NEXT BOSS'} <ArrowRight size={17} /></button>
        : <button className="ba-primary" onClick={() => void attack()} disabled={busy}>{busy ? <LoaderCircle size={17} className="ba-spin" /> : <Swords size={17} />} {busy ? 'ATTACKING…' : `ATTACK · ${boss.tests.length} TESTS`}</button>}
    </footer>
  </main>
}
