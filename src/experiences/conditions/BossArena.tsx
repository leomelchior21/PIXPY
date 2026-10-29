import { ArrowLeft, ArrowRight, Award, Check, CircleHelp, Crown, Lightbulb, LoaderCircle, Lock, RotateCcw, Skull, Swords, Trophy, X } from 'lucide-react'
import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { bossOutputMatches, bossSprite, cleanBossOutput, conditionBosses, type ConditionBoss } from '../../data/conditionBosses'
import { runDecisionProgram } from '../../lib/decisionTracer'
import { runGuidedPython } from '../../lib/guidedPython'
import { PythonRunError, pythonRunner } from '../../lib/pythonRunner'
import { completeActivity } from '../../session/progressSession'
import type { BossAttackEvent, BossFighter, SessionProgress } from '../../types'
import { BadgeArt, BadgeAward, BadgeCase } from './BossBadges'
import { BossIntro } from './BossIntro'
import { BossScene } from './BossScenes'
import { bossBadges } from '../../data/bossBadges'
import { defaultFighter, pixelColor } from '../../data/bossFighters'
import { FighterSprite, MiniSprite } from './BossSprites'
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

function reducedMotion(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function freshCards(boss: ConditionBoss): TestCard[] {
  return boss.tests.map((test, i) => ({ ...test, status: i < EXAMPLES ? 'waiting' : 'hidden', got: '', path: [], error: null }))
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
  const [intro, setIntro] = useState(() => !progress.bossTutorialSeen)
  const [caseOpen, setCaseOpen] = useState(false)
  const [arriving, setArriving] = useState<number | undefined>()
  const openCase = (badge?: number) => { setArriving(badge); setCaseOpen(true) }
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

  const fighter = progress.bossFighter ?? defaultFighter(progress.name)
  const closeIntro = (created: BossFighter) => {
    setIntro(false)
    const updated = { ...progressRef.current, bossTutorialSeen: true, bossFighter: created }
    progressRef.current = updated
    onProgress(updated)
  }
  const openIntro = () => setIntro(true)
  const introScreen = <>
    {intro && <BossIntro fighter={fighter} onClose={closeIntro} />}
    {caseOpen && <BadgeCase earned={defeated} arriving={arriving} onClose={() => setCaseOpen(false)} />}
  </>

  const next = () => {
    const bosses = progressRef.current.conditionBosses
    if (bosses.length === conditionBosses.length && index === conditionBosses.length - 1) { setFinished(true); return }
    const open = conditionBosses.findIndex((boss, i) => i > index && !bosses.includes(boss.id))
    setIndex(open === -1 ? Math.min(index + 1, conditionBosses.length - 1) : open)
  }

  if (finished) return <main className="ba-screen">
    <Toolbar onBack={onBack} onHelp={openIntro} counter={<><Crown size={18} /> Champion</>} />
    <BossTrail index={-1} defeated={defeated} accessible={accessible} onSelect={(i) => { setIndex(i); setFinished(false) }} />
    <section className="ba-hall">
      <div className="ba-hall__card">
        <div className="ba-hall__crown"><Crown size={54} /></div>
        <p className="ba-kicker">ALL {conditionBosses.length} BOSSES DEFEATED</p>
        <h1>Conditions Champion</h1>
        <p>Your decisions survived {conditionBosses.reduce((sum, boss) => sum + boss.tests.length, 0)} surprise tests, aimed right at the edges of every rule.</p>
        <div className="ba-hall__row">{conditionBosses.map((boss) => <MiniSprite key={boss.id} boss={boss} size={3} beaten />)}</div>
        <div className="ba-hall__actions"><button className="ba-primary" onClick={() => openCase()}><Award size={17} /> BADGE CASE</button><button className="ba-secondary" onClick={() => { setIndex(0); setFinished(false) }}><RotateCcw size={17} /> REMATCH</button><button className="ba-secondary" onClick={onBack}>BACK TO CONDITIONS <ArrowRight size={17} /></button></div>
      </div>
    </section>
    {introScreen}
  </main>

  const boss = conditionBosses[index]
  return <>
    <BossFight key={boss.id} boss={boss} fighter={fighter} index={index} defeated={defeated} accessible={accessible} drafts={drafts.current}
      onSelect={(i) => { if (accessible(i)) setIndex(i) }} onBack={onBack} onHelp={openIntro} onOpenCase={openCase} onRecord={record} onNext={next} />
    {introScreen}
  </>
}

function Toolbar({ onBack, onHelp, counter }: { onBack: () => void; onHelp: () => void; counter: React.ReactNode }) {
  return <header className="ba-toolbar">
    <button className="ba-back" onClick={onBack}><ArrowLeft size={17} /> Conditions</button>
    <div className="ba-brand"><span><Swords size={20} /></span><div><b>FINAL BOSSES</b><small>THE CONDITIONS ARENA</small></div></div>
    <div className="ba-counter">{counter}<button className="bi-help" onClick={onHelp} aria-label="How the arena works"><CircleHelp size={18} /></button></div>
  </header>
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
    return <button key={boss.id} className={`${i === index ? 'is-current' : ''} ${done ? 'is-done' : ''} ${!open && !done ? 'is-locked' : ''}`} disabled={disabled || !open} aria-current={i === index ? 'step' : undefined}
      aria-label={open || done ? `Boss ${boss.id}: ${boss.name}${done ? ', defeated' : ''}` : `Boss ${boss.id}: locked`} onClick={() => onSelect(i)}>
      {open || done ? <MiniSprite boss={boss} size={2} beaten={done} /> : <MiniSprite boss={boss} size={2} shadow="#06060a" />}
      <span>{String(boss.id).padStart(2, '0')}</span>
      {done ? <Check className="ba-trail__mark" size={12} /> : !open ? <Lock className="ba-trail__mark" size={11} /> : null}
    </button>
  })}</nav>
}

interface FightProps {
  boss: ConditionBoss
  fighter: BossFighter
  index: number
  defeated: number[]
  accessible: (i: number) => boolean
  drafts: Record<number, string>
  onSelect: (i: number) => void
  onBack: () => void
  onHelp: () => void
  /** Opens the badge case; `arriving` animates that badge into its slot. */
  onOpenCase: (arriving?: number) => void
  onRecord: (event: BossAttackEvent) => void
  onNext: () => void
}

function BossFight({ boss, fighter, index, defeated, accessible, drafts, onSelect, onBack, onHelp, onOpenCase, onRecord, onNext }: FightProps) {
  const alreadyBeaten = defeated.includes(boss.id)
  const [code, setCode] = useState(() => drafts[boss.id] ?? boss.starter)
  const [cards, setCards] = useState<TestCard[]>(() => freshCards(boss))
  const [phase, setPhase] = useState<Phase>('ready')
  const [hp, setHp] = useState(boss.tests.length)
  // The student's fighter loses one HP for every test the code fails.
  const [heroHp, setHeroHp] = useState(boss.tests.length)
  const [shot, setShot] = useState<{ id: number; hit: boolean } | null>(null)
  const [hints, setHints] = useState(0)
  // A badge is awarded the first time this boss falls.
  const [award, setAward] = useState(false)
  const [newBadge, setNewBadge] = useState(false)
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
  const earned = defeated
  const earnedCount = bossBadges.filter((item) => earned.includes(item.id)).length
  const badge = bossBadges.find((item) => item.id === boss.id)!
  const failing = cards.find((card) => card.status === 'miss')

  const pause = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, reducedMotion() ? 0 : ms) })

  const attack = async () => {
    if (busy) return
    const run = ++version.current
    const tests = freshCards(boss)
    setCards(tests); setPhase('attacking'); setHp(boss.tests.length); setHeroHp(boss.tests.length); setShot(null)
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
      await pause(480)
      if (run !== version.current) return
      if (hit) { hits += 1; setHp((value) => value - 1) } else setHeroHp((value) => value - 1)
      tests[i] = { ...tests[i], status: hit ? 'hit' : 'miss', got, path, error: failure }
      setCards([...tests])
      await pause(260)
    }
    if (run !== version.current) return
    setShot(null)
    onRecord({ boss: boss.id, hits, total: tests.length, hints, at: Date.now() })
    if (hits === tests.length) {
      setPhase('defeated')
      if (!alreadyBeaten) window.setTimeout(() => { if (run === version.current) setAward(true) }, reducedMotion() ? 0 : 1500)
      setNote({ tone: 'good', title: `${boss.name} defeated!`, text: `All ${tests.length} tests passed, including the edge cases.` })
    } else {
      setPhase('survived')
      const miss = tests.find((card) => card.status === 'miss')!
      setNote({ tone: 'bad', title: `${boss.name} survived with ${tests.length - hits} HP.`, text: stopError ? 'Python could not read your code. Fix the error shown below, then attack again.' : miss.error ? `With ${miss.inputs.join(', ')} your code crashed. Read Python’s message below.` : `With ${miss.inputs.join(', ')} your code printed ${miss.got ? `“${miss.got}”` : 'nothing'}, but the boss needed “${miss.expected}”.` })
    }
  }

  const editCode = (value: string) => {
    setCode(value)
    if (phase !== 'attacking' && phase !== 'ready') { setPhase('ready'); setHp(boss.tests.length); setHeroHp(boss.tests.length); setCards(freshCards(boss)) }
  }
  const resetCode = () => { version.current += 1; setCode(boss.starter); setPhase('ready'); setHp(boss.tests.length); setHeroHp(boss.tests.length); setCards(freshCards(boss)); setShot(null) }
  const nextHint = () => setHints((value) => Math.min(boss.hints.length, value + 1))

  return <main className={`ba-screen ba-phase--${phase}`}>
    <Toolbar onBack={onBack} onHelp={onHelp} counter={<><span>BOSS</span><b>{String(boss.id).padStart(2, '0')}</b><small>/ {conditionBosses.length}</small></>} />
    <BossTrail index={index} defeated={defeated} accessible={accessible} onSelect={onSelect} disabled={busy} />
    <section className="ba-layout">
      <div className={`ba-arena ${shot ? `${shot.hit ? 'is-impact' : 'is-countered'} ${shot.id % 2 ? 'is-odd' : 'is-even'}` : ''}`} style={{ '--boss': boss.palette.body, '--accent': boss.palette.accent } as CSSProperties}>
        <BossScene bossId={boss.id} />
        <div className="ba-arena__shade" aria-hidden="true" />
        <div className="ba-arena__sky" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i % 5) * 0.7}s`, '--s': `${4 + (i % 4) * 2}px` } as CSSProperties} />)}</div>
        <div className="ba-arena__floor" aria-hidden="true" />
        <header className="ba-hp">
          <div><b>{boss.name}</b><small>{boss.mission.toUpperCase()}</small></div>
          <div className="ba-hp__bar" role="meter" aria-label={`${boss.name} health`} aria-valuemin={0} aria-valuemax={boss.tests.length} aria-valuenow={hp}>{boss.tests.map((_, i) => <i key={i} className={i < hp ? 'is-full' : 'is-lost'} />)}</div>
          <span>HP {hp}/{boss.tests.length}</span>
        </header>
        <div className="ba-field">
          <div className={`ba-boss ${shot?.hit ? 'is-hit' : ''} ${shot && !shot.hit ? 'is-laughing' : ''} ${phase === 'defeated' ? 'is-defeated' : ''}`} key={phase === 'defeated' ? 'down' : 'up'} role="img" aria-label={`${boss.name}${phase === 'defeated' ? ', defeated' : ''}`}>
            <span className="ba-boss__shadow" />
            <div className="ba-reveal"><BossSprite boss={boss} /></div>
            {shot?.hit && <span key={`dmg-${shot.id}`} className="ba-damage is-hit">-1</span>}
          </div>
          {/* The student's fighter: it strikes on a passed test and takes the hit on a failed one. */}
          <div className={`ba-fighter ${shot?.hit ? 'is-striking' : ''} ${shot && !shot.hit ? 'is-hurt' : ''} ${phase === 'defeated' ? 'is-winning' : ''} ${heroHp === 0 ? 'is-down' : ''}`} key={shot ? `f-${shot.id}` : 'f'} role="img" aria-label={`${fighter.name}, your fighter`}>
            <span className="ba-fighter__platform" />
            <FighterSprite fighter={fighter} size={7} />
            {shot && !shot.hit && <span className="ba-damage is-miss">-1</span>}
          </div>
          <div className="ba-fighter-card">
            <div><b>{fighter.name}</b><small>YOUR FIGHTER</small></div>
            <div className="ba-hp__bar is-hero" role="meter" aria-label={`${fighter.name} health`} aria-valuemin={0} aria-valuemax={boss.tests.length} aria-valuenow={heroHp}>{boss.tests.map((_, i) => <i key={i} className={i < heroHp ? 'is-full' : 'is-lost'} />)}</div>
            <span>HP {heroHp}/{boss.tests.length}</span>
          </div>
          {shot && <span key={`bolt-${shot.id}`} className={`ba-bolt ${shot.hit ? 'is-hit' : 'is-miss'}`} aria-hidden="true" />}
          {/* The punch lands: a burst of shards where the blow hits, and a flash over the whole arena. */}
          {shot && <span key={`impact-${shot.id}`} className={`ba-impact ${shot.hit ? 'is-hit' : 'is-miss'}`} aria-hidden="true"><b />{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--a': `${i * 36 + 8}deg`, '--l': `${46 + (i % 3) * 18}px` } as CSSProperties} />)}</span>}
          {shot && <span key={`flash-${shot.id}`} className={`ba-flash ${shot.hit ? 'is-hit' : 'is-miss'}`} aria-hidden="true" />}
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
          <header><span className={`ba-kind ba-kind--${boss.kind}`}>ROUND {boss.id} · {boss.task}</span><span className="ba-inputs">{boss.inputNames.map((name) => <code key={name}>{name}</code>)}</span></header>
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
      <button className={`ba-case-button ${newBadge ? 'is-new' : ''}`} onClick={() => onOpenCase()} aria-label={`Badge case: ${earnedCount} of ${bossBadges.length} badges`}>
        <span className="ba-case-button__stack">{(earnedCount ? bossBadges.filter((badge) => earned.includes(badge.id)).slice(-3) : [bossBadges[0]]).map((badge) => <BadgeArt key={badge.id} badge={badge} size={32} locked={!earnedCount} />)}</span>
        <span><b>BADGES</b><small>{earnedCount} / {bossBadges.length}</small></span>
      </button>
      <div role="status"><span className="ba-footer__icon">{note.tone === 'good' ? <Trophy size={21} /> : note.tone === 'bad' ? <Skull size={21} /> : <Swords size={21} />}</span><p><b>{note.title}</b>{note.text}</p></div>
      {phase === 'defeated'
        ? <button className="ba-primary" onClick={onNext}>{index === conditionBosses.length - 1 ? 'CLAIM THE CROWN' : 'NEXT BOSS'} <ArrowRight size={17} /></button>
        : <button className="ba-primary" onClick={() => void attack()} disabled={busy}>{busy ? <LoaderCircle size={17} className="ba-spin" /> : <Swords size={17} />} {busy ? 'ATTACKING…' : `ATTACK · ${boss.tests.length} TESTS`}</button>}
    </footer>
    {award && <BadgeAward badge={badge} total={earnedCount} onClose={() => { setAward(false); setNewBadge(true); onOpenCase(boss.id) }} />}
  </main>
}
