import { ArrowLeft, ArrowRight, Award, BatteryCharging, Bug, Check, CircleHelp, ClipboardCheck, Cookie, Delete, DoorClosed, Eye, Fan, Gamepad2, Lamp, Lightbulb, MousePointer, Play, Power, Rotate3d, RotateCcw, Ruler, ScanSearch, Sparkles, TriangleAlert, Trophy, UserRound, Wrench, X, Zap } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { PythonCode } from '../../components/PythonCode'
import { behavesCorrectly, bugFixed, bugKindLabels, expectedOutputs, joinTokens, repairTickets, runSegments, segmentLines, ticketSegments, type BugKind, type RepairMachineId, type RepairTicket } from '../../data/repairShop'
import { flattenProgram, formatPythonError, type DecisionRun } from '../../lib/decisionTracer'
import { completeActivity } from '../../session/progressSession'
import type { RepairLogEntry, SessionProgress } from '../../types'
import { AsciiTitle } from './repair/AsciiTitle'
import { CertificatePhoto } from './repair/CertificatePhoto'
import { MonkeyFix } from './repair/MonkeyFix'
import { RepairMeter } from './repair/RepairMeter'
import { RepairStage, type StageStyle, type StageView } from './repair/RepairStage'
import { RepairTutorial } from './repair/RepairTutorial'
import './repairShop.css'

interface Props {
  progress: SessionProgress
  onProgress: (progress: SessionProgress) => void
  onBack: () => void
}

type Step = 'watch' | 'locate' | 'fix' | 'verify' | 'done'
/** The customer's demo: arrive, type the value, run the machine. */
type DemoFrame = 0 | 1 | 2
type MachineState = 'idle' | 'running' | 'ok' | 'wrong' | 'crash' | 'fixed'
type Tone = 'info' | 'good' | 'bad'
interface Message { tone: Tone; title: string; text: string }
interface LastRun { input: string; result: DecisionRun; expected: string[]; ok: boolean }
interface BenchTest { input: string; status: 'waiting' | 'running' | 'pass' | 'fail'; got: string }
type Stats = Omit<RepairLogEntry, 'ticket' | 'at'>

const machines: Record<RepairMachineId, { icon: typeof Gamepad2; label: string; model: string; color: string }> = {
  arcade: { icon: Gamepad2, label: 'ARCADE-3000', model: 'COIN-OP', color: '#ff7aa2' },
  door: { icon: DoorClosed, label: 'SAFE DOOR', model: 'KEYPAD 4X', color: '#72dcff' },
  charger: { icon: BatteryCharging, label: 'PHONE DOCK', model: 'CHARGE+', color: '#b9f352' },
  ride: { icon: Ruler, label: 'RIDE GATE', model: 'HEIGHT CHECK', color: '#ffcb47' },
  fan: { icon: Fan, label: 'THERMO FAN', model: 'LAB SERIES', color: '#7fd8ff' },
  quiz: { icon: Trophy, label: 'QUIZ SHOW', model: 'BUZZER PRO', color: '#b49cff' },
  lamp: { icon: Lamp, label: 'NIGHT LAMP', model: 'DREAM 2', color: '#ffd96a' },
  snack: { icon: Cookie, label: 'SNACK-O-MAT', model: 'VEND 5', color: '#ff9b6e' },
}

const stepOrder: Array<{ id: Exclude<Step, 'done'>; label: string; hint: string; icon: typeof Bug }> = [
  { id: 'watch', label: 'Watch', hint: 'See the problem', icon: Eye },
  { id: 'locate', label: 'Locate', hint: 'Find the line', icon: ScanSearch },
  { id: 'fix', label: 'Rebuild', hint: 'Build a new line', icon: Wrench },
  { id: 'verify', label: 'Verify', hint: 'Pass every test', icon: ClipboardCheck },
]

const kindOrder: BugKind[] = ['syntax', 'runtime', 'logic']
const kindColors: Record<BugKind, string> = { syntax: '#d6455d', runtime: '#d4741c', logic: '#7b55d6' }
const avatarColors = ['#ff7aa2', '#72dcff', '#b9f352', '#ffcb47', '#7fd8ff', '#b49cff', '#ffd96a', '#ff9b6e']

const missions: Record<Step, { title: string; text: (who: string) => string }> = {
  watch: { title: 'Watch the customer', text: (who) => `${who} will show you what goes wrong.` },
  locate: { title: 'Tap the broken line', text: () => 'Read the program. Which line causes the problem?' },
  fix: { title: 'Rebuild the line', text: () => 'Build a new line from the pieces, then install it and run again.' },
  verify: { title: 'The test bench is checking', text: () => 'One value is not enough. Five values must all pass.' },
  done: { title: 'Ticket closed', text: () => 'Every test passed. The customer is happy.' },
}

// The realistic 3D view comes first; ASCII art is the alternative.
const styleKey = 'pixpy.repair-view.v2'
function savedStyle(): StageStyle {
  try { return localStorage.getItem(styleKey) === 'ascii' ? 'ascii' : 'real' } catch { return 'real' }
}

// stampMisses stays 0: the stamp step is gone, but saved logs keep the field.
const emptyStats: Stats = { runs: 0, stampMisses: 0, locateMisses: 0, fixMisses: 0, verifyFails: 0, hints: 0 }

function watchMessage(who: string): Message {
  return { tone: 'info', title: `${who} is here.`, text: 'Watch closely: the customer will show you what goes wrong.' }
}

/** What the customer says once the machine has misbehaved in front of you. */
function complaintAbout(run: LastRun): string {
  const error = run.result.error
  if (error) return error.phase === 'syntax' ? 'See? It won’t even start!' : 'See? It started… then crashed!'
  return run.result.outputs.length ? `See? It said ${run.result.outputs.join(' and ')}!` : 'See? It said nothing at all!'
}

function reducedMotion(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function firstOpenTicket(fixed: number[]): number {
  const index = repairTickets.findIndex((ticket) => !fixed.includes(ticket.id))
  return index === -1 ? 0 : index
}

export function RepairShop({ progress, onProgress, onBack }: Props) {
  const fixed = progress.repairTickets
  const [index, setIndex] = useState(() => firstOpenTicket(fixed))
  const [finished, setFinished] = useState(() => fixed.length === repairTickets.length)
  const [guide, setGuide] = useState(() => !progress.repairTutorialSeen)
  const progressRef = useRef(progress)
  useEffect(() => { progressRef.current = progress }, [progress])
  const nextOpen = repairTickets.findIndex((ticket) => !fixed.includes(ticket.id))
  const accessible = (i: number) => progress.isTeacher || fixed.includes(repairTickets[i].id) || i === nextOpen

  const record = (entry: RepairLogEntry) => {
    const previous = progressRef.current
    const tickets = [...new Set([...previous.repairTickets, entry.ticket])].sort((a, b) => a - b)
    let updated: SessionProgress = { ...previous, repairTickets: tickets, repairLog: [...previous.repairLog, entry].slice(-50) }
    if (tickets.length === repairTickets.length) updated = completeActivity(updated, 'make-it-work')
    progressRef.current = updated
    onProgress(updated)
  }

  const closeGuide = () => {
    setGuide(false)
    if (progressRef.current.repairTutorialSeen) return
    const updated = { ...progressRef.current, repairTutorialSeen: true }
    progressRef.current = updated
    onProgress(updated)
  }
  const tutorial = guide && <RepairTutorial onClose={closeGuide} />
  const openGuide = () => setGuide(true)

  const next = () => {
    const tickets = progressRef.current.repairTickets
    if (tickets.length === repairTickets.length && index === repairTickets.length - 1) { setFinished(true); return }
    const open = repairTickets.findIndex((ticket, i) => i > index && !tickets.includes(ticket.id))
    setIndex(open === -1 ? Math.min(index + 1, repairTickets.length - 1) : open)
  }

  if (finished) return <main className="rs-screen">
    <Toolbar onBack={onBack} onHelp={openGuide} counter={<><Trophy size={18} /> Certified</>}>
      <TicketRail index={-1} fixed={fixed} accessible={accessible} onSelect={(i) => { setIndex(i); setFinished(false) }} onCertificate={() => undefined} />
    </Toolbar>
    <section className="rs-certificate">
      <div className="rs-certificate__card has-photo">
        {/* The student can put their own photo on the certificate and save it as an image. */}
        <CertificatePhoto certificate={{ name: progress.name || 'Bug Fixer', bugs: repairTickets.reduce((sum, ticket) => sum + ticket.bugs.length, 0), machines: repairTickets.length, kinds: kindOrder.map((kind) => ({ label: bugKindLabels[kind], count: repairTickets.flatMap((ticket) => ticket.bugs).filter((bug) => bug.kind === kind).length, color: kindColors[kind] })) }} />
        <div className="rs-certificate__text">
        <span className="rs-certificate__seal"><Wrench size={42} /></span>
        <p className="rs-kicker">PIXPY REPAIR SHOP · OFFICIAL</p>
        <h1>Certified Bug Fixer</h1>
        <p className="rs-certificate__name">awarded to <b>{progress.name || 'you'}</b></p>
        <p>You watched, located, rebuilt, and verified {repairTickets.reduce((sum, ticket) => sum + ticket.bugs.length, 0)} bugs in {repairTickets.length} machines.</p>
        <div className="rs-certificate__kinds">{kindOrder.map((kind) => <div key={kind} className={`rs-kind rs-kind--${kind}`}><b>{repairTickets.flatMap((ticket) => ticket.bugs).filter((bug) => bug.kind === kind).length}</b><span>{bugKindLabels[kind]}</span></div>)}</div>
        <div className="rs-certificate__actions"><button className="rs-secondary" onClick={() => { setIndex(0); setFinished(false) }}><RotateCcw size={17} /> REPAIR AGAIN</button><button className="rs-secondary" onClick={onBack}>BACK TO CONDITIONS <ArrowRight size={17} /></button></div>
        </div>
      </div>
    </section>
    {tutorial}
  </main>

  return <>
    <TicketBench key={repairTickets[index].id} ticket={repairTickets[index]} index={index} fixed={fixed} accessible={accessible}
      onSelect={(i) => { if (accessible(i)) setIndex(i) }} onBack={onBack} onHelp={openGuide} onCertificate={() => setFinished(true)} onRecord={record} onNext={next} />
    {tutorial}
  </>
}

function Toolbar({ onBack, onHelp, counter, children }: { onBack: () => void; onHelp: () => void; counter: ReactNode; children: ReactNode }) {
  return <header className="rs-toolbar">
    <button className="rs-back" onClick={onBack} aria-label="Back to Conditions"><ArrowLeft size={17} /><span>Conditions</span></button>
    <div className="rs-brand"><span><Wrench size={20} /></span><div><b>REPAIR SHOP</b><small>FIND AND FIX THE BUGS</small></div></div>
    {children}
    <div className="rs-counter">{counter}</div>
    <button className="rs-help" onClick={onHelp} aria-label="How the repair shop works"><CircleHelp size={18} /><span>How it works</span></button>
  </header>
}

function TicketRail({ index, fixed, accessible, onSelect, onCertificate, disabled = false }: { index: number; fixed: number[]; accessible: (i: number) => boolean; onSelect: (i: number) => void; onCertificate?: () => void; disabled?: boolean }) {
  const certified = fixed.length === repairTickets.length
  return <nav className="rs-rail" aria-label="Repair tickets">
    {repairTickets.map((ticket, i) => {
      const done = fixed.includes(ticket.id)
      const Icon = machines[ticket.machine].icon
      return <button key={ticket.id} className={`rs-rail__ticket ${i === index ? 'is-current' : ''} ${done ? 'is-done' : ''}`} style={{ '--machine': machines[ticket.machine].color } as CSSProperties}
        disabled={disabled || !accessible(i)} aria-current={i === index ? 'step' : undefined} aria-label={`Ticket ${ticket.id}: ${ticket.title}${done ? ', fixed' : accessible(i) ? '' : ', locked'}`} onClick={() => onSelect(i)}>
        <span className="rs-rail__number">{String(ticket.id).padStart(2, '0')}</span>
        {done ? <Check className="rs-rail__done" size={15} strokeWidth={3} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}
      </button>
    })}
    {/* Once all eight are fixed, the certificate stays one tap away. */}
    {certified && onCertificate && <button className={`rs-rail__ticket rs-rail__cert ${index === -1 ? 'is-current' : ''}`} disabled={disabled} aria-current={index === -1 ? 'page' : undefined} aria-label="Your Certified Bug Fixer certificate" onClick={onCertificate}>
      <Award size={16} aria-hidden="true" /><span className="rs-rail__number">CERT</span>
    </button>}
  </nav>
}

interface BenchProps {
  ticket: RepairTicket
  onCertificate: () => void
  index: number
  fixed: number[]
  accessible: (i: number) => boolean
  onSelect: (i: number) => void
  onBack: () => void
  onHelp: () => void
  onRecord: (entry: RepairLogEntry) => void
  onNext: () => void
}

function TicketBench({ ticket, index, fixed, accessible, onSelect, onBack, onHelp, onCertificate, onRecord, onNext }: BenchProps) {
  const [who, role] = ticket.customer.split(/,\s*/)
  const [step, setStep] = useState<Step>('watch')
  const [demo, setDemo] = useState<DemoFrame>(0)
  const [bugIndex, setBugIndex] = useState(0)
  const [installed, setInstalled] = useState<Record<number, string[]>>({})
  const [lastRun, setLastRun] = useState<LastRun | null>(null)
  const [machine, setMachine] = useState<MachineState>('idle')
  const [traceLine, setTraceLine] = useState<number | null>(null)
  const [built, setBuilt] = useState<string[]>([])
  const [located, setLocated] = useState<number[]>([])
  const [wrongLine, setWrongLine] = useState<number | null>(null)
  const [bench, setBench] = useState<BenchTest[]>([])
  const [clueOpen, setClueOpen] = useState(ticket.support === 'high')
  const [message, setMessage] = useState<Message>(() => watchMessage(who))
  const [stats, setStats] = useState<Stats>(emptyStats)
  const [showDone, setShowDone] = useState(false)
  const [freshLines, setFreshLines] = useState<number[]>([])
  const [stageStyle, setStageStyle] = useState<StageStyle>(savedStyle)
  const timers = useRef<number[]>([])
  const version = useRef(0)
  const statsRef = useRef<Stats>(emptyStats)
  useEffect(() => () => { version.current += 1; timers.current.forEach((id) => window.clearTimeout(id)) }, [])

  const bug = ticket.bugs[bugIndex]
  const segments = ticketSegments(ticket, installed)
  const lines = flattenProgram(segments)
  const bugLines = segmentLines(segments, bug.line)
  const busy = machine === 'running'
  const meta = machines[ticket.machine]
  const errorLine = lastRun?.result.error?.line ?? null
  const bump = (key: keyof Stats) => {
    statsRef.current = { ...statsRef.current, [key]: statsRef.current[key] + 1 }
    setStats(statsRef.current)
  }
  const later = (callback: () => void, delay: number) => { timers.current.push(window.setTimeout(callback, delay)) }

  /** Runs the machine with one input, animating the executed lines. */
  const play = (program: string[], input: string, done: (run: LastRun) => void) => {
    const run = ++version.current
    const result = runSegments(program, input)
    const expected = expectedOutputs(ticket, input)
    const outcome: LastRun = { input, result, expected, ok: behavesCorrectly(ticket, result, input) }
    bump('runs')
    setMachine('running'); setTraceLine(null); setLastRun(null)
    const lineSteps = result.events.map((event) => event.line)
    if (result.error?.phase === 'runtime') lineSteps.push(result.error.line)
    const finish = () => {
      if (run !== version.current) return
      setTraceLine(null)
      setLastRun(outcome)
      setMachine(result.error ? 'crash' : outcome.ok ? 'ok' : 'wrong')
      done(outcome)
    }
    if (reducedMotion()) { finish(); return }
    lineSteps.forEach((line, i) => later(() => { if (run === version.current) setTraceLine(line) }, 380 + i * 260))
    later(finish, 380 + lineSteps.length * 260 + 160)
  }

  /** The customer's demo: NEXT, then RUN IT plays the machine with their value. */
  const watchNext = () => {
    if (busy || step !== 'watch') return
    if (demo === 0) {
      setDemo(1)
      setMessage({ tone: 'info', title: `${who} types ${bug.demo}.`, text: `Look at the machine: ${ticket.variable} = ${bug.demo}. Press RUN IT to see what happens.` })
      return
    }
    play(segments, bug.demo, (run) => {
      setDemo(2)
      setMessage({ tone: 'bad', title: `${who}: “${complaintAbout(run)}”`, text: 'Now you know what goes wrong. Find the line that causes it.' })
    })
  }
  const watchAgain = () => { if (!busy) play(segments, bug.demo, () => undefined) }
  const findLine = () => {
    if (busy) return
    setStep('locate')
    setMessage({ tone: 'info', title: 'Your turn.', text: 'Read the program and tap the line that causes the problem.' })
  }

  const locate = (line: number) => {
    if (step !== 'locate' || busy) return
    if (bugLines.includes(line)) {
      setLocated(bugLines); setWrongLine(null); setBuilt([])
      setStep('fix')
      setMessage({ tone: 'good', title: `Found it: line ${line + 1}.`, text: 'Rebuild it: tap the pieces in order, then install your new line.' })
      return
    }
    bump('locateMisses'); setWrongLine(line)
    later(() => setWrongLine(null), 700)
    setMessage({ tone: 'bad', title: `Line ${line + 1} looks fine.`, text: bug.locate })
    setClueOpen(true)
  }

  const addPiece = (token: string) => { if (step === 'fix' && !busy && built.length < 10) setBuilt([...built, token]) }
  const removePiece = (at: number) => { if (step === 'fix' && !busy) setBuilt(built.filter((_, i) => i !== at)) }

  const install = () => {
    if (!built.length || busy) return
    const trial = { ...installed, [bugIndex]: built }
    const program = ticketSegments(ticket, trial)
    const moreBugs = bugIndex < ticket.bugs.length - 1
    const solved = moreBugs && bugFixed(ticket, trial, bugIndex)
    setInstalled(trial)
    setFreshLines(segmentLines(program, bug.line))
    later(() => setFreshLines([]), 900)
    play(program, bug.demo, (run) => {
      if (solved) {
        // Fixing one bug can reveal the next: the customer shows it.
        setBugIndex(bugIndex + 1); setLocated([]); setBuilt([]); setDemo(0); setStep('watch')
        setMessage({ tone: 'good', title: 'One bug down!', text: `But ${who} still is not happy. Watch again.` })
        return
      }
      if (!run.ok || moreBugs) {
        bump('fixMisses')
        setMessage({ tone: 'bad', title: `Still broken with ${bug.demo}.`, text: run.result.error ? `Python reports ${run.result.error.type}. Look at your line again.` : run.ok ? 'Look at your line again.' : `The machine said “${run.result.outputs.join(' + ') || 'nothing'}”. Look at your line again.` })
        return
      }
      startVerify(program)
    })
  }

  const startVerify = (program: string[]) => {
    const run = ++version.current
    setStep('verify')
    setMessage({ tone: 'info', title: 'Test bench running…', text: 'One input is not enough. The bench tries values on both sides of the rule.' })
    const tests: BenchTest[] = ticket.tests.map((input) => ({ input, status: 'waiting', got: '' }))
    setBench(tests)
    const fast = reducedMotion()
    const results = ticket.tests.map((input) => {
      const result = runSegments(program, input)
      return { result, pass: behavesCorrectly(ticket, result, input), got: result.error ? result.error.type : result.outputs.join(' + ') || '(nothing)' }
    })
    const failure = results.findIndex((result) => !result.pass)
    const last = failure === -1 ? tests.length - 1 : failure
    const conclude = () => {
      if (run !== version.current) return
      if (failure === -1) {
        setMachine('fixed'); setStep('done'); setShowDone(true)
        setMessage({ tone: 'good', title: 'Machine fixed!', text: 'Every test passed. The customer is happy.' })
        onRecord({ ticket: ticket.id, ...statsRef.current, at: Date.now() })
      } else {
        bump('verifyFails')
        const input = ticket.tests[failure]
        const { result } = results[failure]
        setLastRun({ input, result, expected: expectedOutputs(ticket, input), ok: false })
        setMachine(result.error ? 'crash' : 'wrong'); setStep('fix')
        setMessage({ tone: 'bad', title: `Test failed with ${input}.`, text: `Your line works for ${bug.demo}, but with ${input} the machine said “${results[failure].got}” instead of “${expectedOutputs(ticket, input).join(' + ')}”. Change your line.` })
      }
    }
    if (fast) {
      setBench(tests.map((test, i) => i <= last ? { ...test, status: results[i].pass ? 'pass' : 'fail', got: results[i].got } : test))
      conclude()
      return
    }
    setMachine('running')
    for (let i = 0; i <= last; i += 1) {
      later(() => { if (run === version.current) setBench((current) => current.map((test, j) => j === i ? { ...test, status: 'running' } : test)) }, 250 + i * 520)
      later(() => { if (run === version.current) setBench((current) => current.map((test, j) => j === i ? { ...test, status: results[i].pass ? 'pass' : 'fail', got: results[i].got } : test)) }, 250 + i * 520 + 340)
    }
    later(conclude, 250 + last * 520 + 600)
  }

  const showClue = () => { if (!clueOpen) { setClueOpen(true); bump('hints') } }
  const restart = () => {
    version.current += 1
    timers.current.forEach((id) => window.clearTimeout(id)); timers.current = []
    setStep('watch'); setDemo(0); setBugIndex(0); setInstalled({}); setLastRun(null); setMachine('idle'); setTraceLine(null)
    setBuilt([]); setLocated([]); setBench([]); setShowDone(false)
    setMessage(watchMessage(who))
  }

  const clue = step === 'locate' ? bug.locate
    : bug.kind === 'syntax' ? 'Python refuses lines that break its rules. Look closely at symbols like :, = and ==.'
    : bug.kind === 'runtime' ? 'Python stopped at a word it did not know. How should that word be written?'
    : 'Think about the customer’s value AND the values around it. The test bench will try both.'

  const stepIndex = stepOrder.findIndex((item) => item.id === step)
  // Repair progress: each bug's watch, locate and rebuild share 60%, the test bench fills up to 95%,
  // and the monkey's last hammer blow in the finale takes it to 100%.
  const stepShare: Record<Step, number> = { watch: 0, locate: 1 / 3, fix: 2 / 3, verify: 1, done: 1 }
  const benchPassed = bench.filter((test) => test.status === 'pass').length
  const meterPercent = step === 'done' ? 100
    : step === 'verify' ? 60 + 35 * (benchPassed / ticket.tests.length)
    : 60 * (bugIndex + stepShare[step]) / ticket.bugs.length
  const meterLabel = step === 'done' ? 'Every test passed' : step === 'verify' ? `${benchPassed} of ${ticket.tests.length} tests passed`
    : step === 'watch' ? (bugIndex > 0 ? 'One bug fixed' : 'Watch the customer') : step === 'locate' ? 'Problem seen' : 'Broken line found'
  const benchInput = step === 'verify' ? bench.find((test) => test.status === 'running')?.input ?? null : null
  const repaired = step === 'verify' || step === 'done'
  const broken = step !== 'done' && (step === 'locate' || step === 'fix' || lastRun !== null && !lastRun.ok)
  const fault = machine === 'crash' && lastRun?.result.error ? lastRun.result.error.phase === 'syntax' ? 'syntax' : 'runtime' : null
  const demoInput = step === 'watch' && demo === 0 ? '' : bug.demo
  const shownInput = machine === 'running' && benchInput ? benchInput : step === 'watch' ? demoInput : lastRun?.input ?? demoInput
  const stageView: StageView = {
    mood: machine, fault, broken: broken && machine !== 'running', variable: ticket.variable, input: shownInput,
    outputs: lastRun?.result.outputs ?? [], error: lastRun?.result.error?.type ?? null,
    caption: machine === 'running' ? step === 'verify' ? `TEST BENCH · ${ticket.variable} = ${benchInput ?? '…'}` : `${ticket.variable} = ${shownInput}`
      : machine === 'crash' ? lastRun?.result.error?.type ?? 'ERROR' : machine === 'fixed' ? 'ALL TESTS PASSED' : machine === 'idle' ? 'READY' : `${ticket.variable} = ${shownInput}`,
  }
  const status = machine === 'crash' ? fault === 'syntax' ? { tone: 'crash', text: 'WON’T START', icon: Power } : { tone: 'crash', text: 'CRASHED', icon: Zap }
    : machine === 'wrong' ? { tone: 'wrong', text: 'WRONG ANSWER', icon: TriangleAlert }
    : machine === 'ok' ? { tone: 'ok', text: 'WORKS', icon: Check }
    : machine === 'fixed' ? { tone: 'ok', text: 'FIXED', icon: Sparkles }
    : machine === 'running' ? { tone: 'running', text: step === 'verify' ? 'TESTING' : 'RUNNING', icon: Play }
    : { tone: 'idle', text: broken ? 'OUT OF ORDER' : 'READY', icon: broken ? Bug : Power }
  const StatusIcon = status.icon
  const screenText = machine === 'running' ? 'RUNNING…'
    : machine === 'crash' ? fault === 'syntax' ? `NO BOOT · ${lastRun?.result.error?.type}` : `CRASH · ${lastRun?.result.error?.type}`
    : machine === 'fixed' ? 'WORKING!'
    : lastRun ? lastRun.result.outputs.join('  /  ') || '(nothing)' : '_'
  const mission = missions[step]
  const partsOpen = step === 'fix' || step === 'verify' && bench.length === 0
  const drawerAfter = partsOpen ? bugLines[bugLines.length - 1] : -1
  const chooseStyle = (next: StageStyle) => { setStageStyle(next); try { localStorage.setItem(styleKey, next) } catch { /* private mode */ } }
  const avatar = avatarColors[(ticket.id - 1) % avatarColors.length]

  return <main className={`rs-screen rs-step--${step}`} style={{ '--machine': meta.color } as CSSProperties}>
    <Toolbar onBack={onBack} onHelp={onHelp} counter={<><span>TICKET</span><b>{String(ticket.id).padStart(2, '0')}</b><small>/ {String(repairTickets.length).padStart(2, '0')}</small></>}>
      <TicketRail index={index} fixed={fixed} accessible={accessible} onSelect={onSelect} onCertificate={onCertificate} disabled={busy} />
    </Toolbar>
    <section className="rs-layout" inert={showDone}>
      {/* Left: the story and the machine, one screen. */}
      <article className={`rs-story is-${status.tone}`}>
        <header className="rs-story__head">
          <p className="rs-story__meta"><span>TICKET {String(ticket.id).padStart(2, '0')}/{String(repairTickets.length).padStart(2, '0')}</span><span>{meta.model}</span>{ticket.bugs.length > 1 && <span className="rs-bug-count"><Bug size={11} /> BUG {bugIndex + 1} OF {ticket.bugs.length}</span>}</p>
          <AsciiTitle text={meta.label} />
          <h1>{ticket.title}</h1>
          {/* The complaint arrives like a chat message from the customer. */}
          <figure className="rs-story__quote rs-chat" style={{ '--avatar': avatar } as CSSProperties}>
            <span className="rs-chat__avatar" aria-hidden="true"><UserRound size={22} strokeWidth={2.2} /><i /></span>
            <div className="rs-chat__bubble">
              <figcaption><b>{who}</b>{role && <small>{role}</small>}<time>just now</time></figcaption>
              <blockquote><p>{ticket.complaint}</p></blockquote>
            </div>
          </figure>
          <p className="rs-story__spec"><b>MUST DO</b><span>{ticket.rule}</span></p>
        </header>
        <RepairStage machine={ticket.machine} view={stageView} style={stageStyle} label={`${meta.label}: ${status.text.toLowerCase()}`}
          fallback={<FlatMachine meta={meta} machine={machine} broken={broken} lastRun={lastRun} input={shownInput} benchInput={benchInput} step={step} variable={ticket.variable} />}
          overlay={<>
            <div className="rs-stage__style" role="group" aria-label="Machine view">{(['real', 'ascii'] as const).map((option) => <button key={option} aria-pressed={stageStyle === option} onClick={() => chooseStyle(option)}>{option === 'ascii' ? 'MATRIX' : '3D'}</button>)}</div>
            <div className="rs-stage__hint" aria-hidden="true"><Rotate3d size={13} /> drag to turn · pinch to zoom</div>
          </>} />
        <footer className="rs-story__readout">
          <span className={`rs-stage__status is-${status.tone}`}><StatusIcon size={13} />{status.text}</span>
          <span className="rs-readout__input"><small>IN</small>{ticket.variable} = {shownInput || '?'}</span>
          <span className="rs-readout__screen"><small>OUT</small><b>{screenText}</b></span>
        </footer>
      </article>

      {/* Between the panels: the repair gauge. */}
      <RepairMeter percent={meterPercent} label={meterLabel} />

      {/* Right: the workbench for the current step. */}
      <section className="rs-work" aria-label="Workbench">
        <header className="rs-work__head">
          <ol className="rs-steps" aria-label="Repair steps" style={{ '--progress': `${(step === 'done' ? 3 : stepIndex) / 3}` } as CSSProperties}>{stepOrder.map((item, i) => {
            const Icon = item.icon
            const state = step === 'done' || i < stepIndex ? 'is-done' : i === stepIndex ? 'is-current' : ''
            return <li key={item.id} className={state} aria-current={i === stepIndex ? 'step' : undefined}><span>{state === 'is-done' ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}</span><b>{item.label}</b></li>
          })}</ol>
          <div className="rs-mission">
            <span className="rs-mission__number">{step === 'done' ? <Check size={26} strokeWidth={3} /> : String(stepIndex + 1).padStart(2, '0')}</span>
            <div><small>{step === 'done' ? 'ALL FOUR STEPS DONE' : `STEP ${stepIndex + 1} OF ${stepOrder.length} · ${stepOrder[stepIndex].label.toUpperCase()}`}</small><h2>{mission.title}</h2><p>{mission.text(who)}</p></div>
          </div>
        </header>

        <div className="rs-work__body" aria-live="polite">
          {step === 'watch' && <DemoCard frame={demo} who={who} avatar={avatar} variable={ticket.variable} value={bug.demo} run={machine === 'running' ? null : lastRun} again={bugIndex > 0} busy={busy} onReplay={watchAgain} />}
          <div className={`rs-code ${step === 'locate' ? 'is-locating' : ''}`}>
            <header><div className="rs-dots" aria-hidden="true"><i /><i /><i /></div><span>machine.py</span>{step === 'locate' && <em className="rs-code__tap"><MousePointer size={13} /> tap a line</em>}{(step !== 'watch' || bugIndex > 0) && <button onClick={restart} disabled={busy} aria-label="Restart this ticket"><RotateCcw size={14} /> Restart</button>}</header>
            <div className="rs-code__lines" aria-label="Machine program">{lines.map((line, i) => {
              const classes = [traceLine === i ? 'is-executing' : '', errorLine === i && machine === 'crash' ? 'is-error' : '', located.includes(i) ? repaired ? 'is-installed' : 'is-located' : '', wrongLine === i ? 'is-wrong' : '', freshLines.includes(i) ? 'is-fresh' : ''].join(' ')
              const content = <><span className="rs-code__number">{i + 1}</span><PythonCode code={line || ' '} />{located.includes(i) && (repaired ? <Check className="rs-code__ok" size={15} /> : <Bug className="rs-code__bug" size={15} />)}{errorLine === i && machine === 'crash' && <TriangleAlert className="rs-code__alert" size={15} />}</>
              const row = step === 'locate'
                ? <button key={i} className={`rs-code__line ${classes}`} onClick={() => locate(i)} aria-label={`Line ${i + 1}: ${line.trim()}`}>{content}</button>
                : <div key={i} className={`rs-code__line ${classes}`}>{content}</div>
              if (i !== drawerAfter) return row
              // The workbench opens right under the broken line: rebuild it from the pieces.
              return <div key={i} className="rs-code__slot">{row}
                <div className="rs-drawer rs-builder">
                  <p><Wrench size={13} /> Rebuild line {bugLines[0] + 1}</p>
                  <div className="rs-builder__row rs-builder__row--old"><small>OLD</small><s><PythonCode code={ticket.lines[bug.line].trim()} /></s></div>
                  <div className="rs-builder__row rs-builder__row--new" aria-label="Your new line"><small>NEW</small>
                    <div className="rs-builder__line">{built.length
                      ? built.map((token, at) => <button key={at} className="rs-piece is-placed" disabled={busy} onClick={() => removePiece(at)} aria-label={`Remove ${token}`}><PythonCode code={token} /></button>)
                      : <em>tap the pieces below, in order</em>}</div>
                    {built.length > 0 && <button className="rs-builder__clear" disabled={busy} onClick={() => setBuilt([])} aria-label="Clear the new line"><Delete size={15} /></button>}
                  </div>
                  <div className="rs-tray" aria-label="Pieces">{bug.tokens.map((token) => <button key={token} className="rs-piece" disabled={busy} onClick={() => addPiece(token)} aria-label={`Add ${token}`}><PythonCode code={token} /></button>)}</div>
                  {built.length > 0 && <p className="rs-builder__preview">Python will read: <code>{joinTokens(built)}</code></p>}
                </div>
              </div>
            })}</div>
            {lastRun && machine !== 'running' && <Console run={lastRun} variable={ticket.variable} />}
          </div>

          {step === 'verify' && bench.length > 0 && <div className="rs-tool"><Bench tests={bench} ticket={ticket} /></div>}
          {step === 'done' && <div className="rs-tool"><Bench tests={bench} ticket={ticket} /></div>}
          {(step === 'locate' || step === 'fix') && <div className="rs-clue">{clueOpen ? <p><Lightbulb size={16} /> {clue}</p> : <button onClick={showClue}><Lightbulb size={15} /> Need a clue?</button>}</div>}
        </div>

        <footer className={`rs-footer rs-footer--${message.tone}`}>
          <div role="status"><span className="rs-footer__icon">{message.tone === 'good' ? <Check size={20} /> : message.tone === 'bad' ? <Bug size={20} /> : <Sparkles size={20} />}</span><p><b>{message.title}</b>{message.text}</p></div>
          {step === 'watch' && <button className="rs-primary" disabled={busy} onClick={demo === 2 ? findLine : watchNext}>{busy ? 'RUNNING…' : demo === 0 ? <>NEXT <ArrowRight size={17} /></> : demo === 1 ? <><Play size={17} fill="currentColor" /> RUN IT</> : <><ScanSearch size={17} /> FIND THE BROKEN LINE</>}</button>}
          {step === 'fix' && <button className="rs-primary" disabled={busy || !built.length} onClick={install}><Wrench size={17} /> {busy ? 'RUNNING…' : 'INSTALL + RUN'}</button>}
          {step === 'done' && <button className="rs-primary" onClick={onNext}>{index === repairTickets.length - 1 ? 'FINISH' : 'NEXT TICKET'} <ArrowRight size={17} /></button>}
        </footer>
      </section>
    </section>

    {showDone && <div className="rs-done-backdrop">
      {/* Two columns so the monkey, the lesson and both buttons fit on one screen without scrolling. */}
      <div className="rs-done" role="dialog" aria-modal="true" aria-labelledby="rs-done-title">
        <span className="rs-done__stamp" aria-hidden="true">FIXED</span>
        <MonkeyFix last={index === repairTickets.length - 1} />
        <div className="rs-done__info">
          <p className="rs-kicker">TICKET #{String(ticket.id).padStart(2, '0')} · {meta.label}</p>
          <h2 id="rs-done-title">Machine fixed!</h2>
          {ticket.bugs.map((item, i) => <p key={i} className="rs-done__lesson"><span className={`rs-kind rs-kind--${item.kind}`}>{bugKindLabels[item.kind]}</span>{item.lesson}</p>)}
          <dl className="rs-done__stats"><div><dt>Test runs</dt><dd>{stats.runs}</dd></div><div><dt>Tests passed</dt><dd>{ticket.tests.length} / {ticket.tests.length}</dd></div><div><dt>Retries</dt><dd>{stats.locateMisses + stats.fixMisses + stats.verifyFails}</dd></div></dl>
          <div className="rs-done__actions"><button className="rs-primary" autoFocus onClick={() => { setShowDone(false); onNext() }}>{index === repairTickets.length - 1 ? 'FINISH' : 'NEXT TICKET'} <ArrowRight size={17} /></button><button className="rs-secondary" onClick={() => setShowDone(false)}>REVIEW THE FIX</button></div>
        </div>
      </div>
    </div>}
  </main>
}

interface FlatProps {
  meta: (typeof machines)[RepairMachineId]
  machine: MachineState
  broken: boolean
  lastRun: LastRun | null
  input: string
  benchInput: string | null
  step: Step
  variable: string
}

/** The drawn machine, used where the 3D scene cannot run. */
function FlatMachine({ meta, machine, broken, lastRun, input, benchInput, step, variable }: FlatProps) {
  const MachineIcon = meta.icon
  return <div className={`rs-machine rs-machine--${machine} ${broken ? 'is-broken' : ''}`}>
    <div className="rs-machine__head"><i className="rs-machine__led" /><b>{meta.label}</b><small>{meta.model}</small></div>
    <div className="rs-machine__screen">
      <div className="rs-machine__glass">
        {machine === 'running' && <><small>{step === 'verify' ? `TEST BENCH${benchInput ? ` · ${variable} = ${benchInput}` : ''}` : `${variable} = ${input}`}</small><strong className="rs-blink">RUNNING…</strong></>}
        {machine === 'idle' && <><small>READY</small><strong>_<span className="rs-cursor" /></strong></>}
        {(machine === 'ok' || machine === 'wrong') && lastRun && <><small>{variable} = {lastRun.input}</small>{lastRun.result.outputs.length ? lastRun.result.outputs.map((output, i) => <strong key={i}>{output}</strong>) : <strong className="is-empty">(nothing)</strong>}</>}
        {machine === 'crash' && lastRun?.result.error && <><small>{lastRun.result.error.type.toUpperCase()}</small><strong className="rs-glitch" data-text="ERROR">ERROR</strong></>}
        {machine === 'fixed' && <><small>ALL TESTS PASSED</small><strong>WORKING!</strong></>}
      </div>
    </div>
    <div className="rs-machine__body">
      <span className="rs-machine__icon"><MachineIcon size={46} strokeWidth={1.6} /></span>
      <span className="rs-machine__slot"><small>INPUT</small><b>{machine === 'running' && benchInput ? benchInput : input || '—'}</b></span>
    </div>
    {broken && machine !== 'running' && <div className="rs-tape" aria-hidden="true"><span>OUT OF ORDER · OUT OF ORDER · OUT OF ORDER</span></div>}
    {machine === 'crash' && <div className="rs-sparks" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--a': `${i * 36}deg`, '--d': `${(i % 4) * 60}ms` } as CSSProperties} />)}<b /><b /><b /></div>}
    {machine === 'fixed' && <div className="rs-burst" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--a': `${i * 26}deg`, '--d': `${(i % 5) * 50}ms` } as CSSProperties} />)}</div>}
  </div>
}

interface DemoProps {
  frame: DemoFrame
  who: string
  avatar: string
  variable: string
  value: string
  run: LastRun | null
  again: boolean
  busy: boolean
  onReplay: () => void
}

/** The customer shows the problem in three beats: arrive, type the value, run the machine. */
function DemoCard({ frame, who, avatar, variable, value, run, again, busy, onReplay }: DemoProps) {
  const said = frame === 2 && run ? complaintAbout(run) : frame === 1 ? `I type ${value}… now watch the machine.` : again ? 'It still is not right. Look!' : 'Let me show you!'
  return <div className={`rs-tool rs-demo is-frame-${frame}`} style={{ '--avatar': avatar } as CSSProperties}>
    <ol className="rs-demo__beats" aria-label={`Demo, part ${frame + 1} of 3`}>{[0, 1, 2].map((beat) => <li key={beat} className={beat < frame ? 'is-done' : beat === frame ? 'is-current' : ''} />)}</ol>
    <div className="rs-demo__scene">
      <span className="rs-demo__avatar" aria-hidden="true"><UserRound size={30} strokeWidth={2.2} /></span>
      <p key={said} className="rs-demo__bubble"><b>{who}</b>“{said}”</p>
      {frame >= 1 && <span className="rs-demo__keypad"><code>{variable} =</code><code className="rs-demo__value">{value}</code></span>}
    </div>
    {frame === 2 && <button className="rs-demo__replay" disabled={busy} onClick={onReplay}><RotateCcw size={14} /> Watch again</button>}
  </div>
}

function Console({ run, variable }: { run: LastRun; variable: string }) {
  const error = run.result.error
  if (error) return <div className="rs-console is-error">
    <span>PYTHON SAYS</span>
    <pre>{formatPythonError(error)}</pre>
    <p>{error.phase === 'syntax' ? 'Python checks every line before it starts. Nothing ran.' : `Python started with ${variable} = ${run.input}, then stopped on line ${error.line + 1}.`}</p>
  </div>
  return <div className={`rs-console ${run.ok ? 'is-ok' : 'is-wrong'}`}>
    <div><span>OUTPUT</span><pre>{run.result.outputs.join('\n') || '(nothing printed)'}</pre></div>
    <div><span>SHOULD BE</span><pre>{run.expected.join('\n')}</pre></div>
    {run.ok ? <Check size={18} /> : <X size={18} />}
  </div>
}

function Bench({ tests, ticket }: { tests: BenchTest[]; ticket: RepairTicket }) {
  return <div className="rs-bench-belt">
    <div className="rs-belt" aria-hidden="true" />
    <ol>{tests.map((test) => <li key={test.input} className={`is-${test.status}`}>
      <span className="rs-capsule"><small>{ticket.variable}</small><b>{test.input}</b></span>
      <span className="rs-bench__result">{test.status === 'pass' ? <Check size={14} /> : test.status === 'fail' ? <X size={14} /> : test.status === 'running' ? <i className="rs-spinner" /> : null}<small>{test.status === 'waiting' ? 'waiting' : test.status === 'running' ? 'testing' : test.got}</small></span>
    </li>)}</ol>
  </div>
}
