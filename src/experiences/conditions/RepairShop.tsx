import { ArrowLeft, ArrowRight, Award, BatteryCharging, Bug, Check, CircleHelp, ClipboardCheck, Cookie, DoorClosed, Fan, FlaskConical, Gamepad2, Lamp, Lightbulb, MousePointer, Play, Power, Rotate3d, RotateCcw, Ruler, ScanSearch, Sparkles, Stamp, TriangleAlert, Trophy, UserRound, Wrench, X, Zap } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { PythonCode } from '../../components/PythonCode'
import { behavesCorrectly, bugKindLabels, bugKindMeaning, expectedOutputs, repairTickets, runSegments, segmentLines, symptomKind, ticketSegments, type BugKind, type RepairMachineId, type RepairTicket } from '../../data/repairShop'
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

type Step = 'reproduce' | 'diagnose' | 'locate' | 'fix' | 'verify' | 'done'
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
  { id: 'reproduce', label: 'Reproduce', hint: 'Make it fail', icon: FlaskConical },
  { id: 'diagnose', label: 'Diagnose', hint: 'Name the bug', icon: Stamp },
  { id: 'locate', label: 'Locate', hint: 'Find the line', icon: ScanSearch },
  { id: 'fix', label: 'Fix', hint: 'Swap the part', icon: Wrench },
  { id: 'verify', label: 'Verify', hint: 'Pass every test', icon: ClipboardCheck },
]

const stampOrder: BugKind[] = ['syntax', 'runtime', 'logic']
const kindColors: Record<BugKind, string> = { syntax: '#d6455d', runtime: '#d4741c', logic: '#7b55d6' }
const avatarColors = ['#ff7aa2', '#72dcff', '#b9f352', '#ffcb47', '#7fd8ff', '#b49cff', '#ffd96a', '#ff9b6e']
const stampIcons: Record<BugKind, typeof Bug> = { syntax: Power, runtime: Zap, logic: CircleHelp }

const missions: Record<Step, { title: string; text: (variable: string) => string }> = {
  reproduce: { title: 'Make the bug happen', text: (variable) => `Pick a value for ${variable} and run the machine until it does what the customer saw.` },
  diagnose: { title: 'What kind of bug is it?', text: () => 'Look at the machine and at what Python said, then stamp the bug.' },
  locate: { title: 'Tap the broken line', text: () => 'Read the program. Which line causes the problem?' },
  fix: { title: 'Swap in a new part', text: () => 'Choose a replacement line, then install it and run again.' },
  verify: { title: 'The test bench is checking', text: () => 'One value is not enough. Five values must all pass.' },
  done: { title: 'Ticket closed', text: () => 'Every test passed. The customer is happy.' },
}

// The realistic 3D view comes first; ASCII art is the alternative.
const styleKey = 'pixpy.repair-view.v2'
function savedStyle(): StageStyle {
  try { return localStorage.getItem(styleKey) === 'ascii' ? 'ascii' : 'real' } catch { return 'real' }
}
const stampHints: Record<BugKind, string> = {
  syntax: 'No line ran at all.',
  runtime: 'It started, then crashed.',
  logic: 'It finished, but wrongly.',
}

const emptyStats: Stats = { runs: 0, stampMisses: 0, locateMisses: 0, fixMisses: 0, verifyFails: 0, hints: 0 }

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
        <CertificatePhoto certificate={{ name: progress.name || 'Bug Fixer', bugs: repairTickets.reduce((sum, ticket) => sum + ticket.bugs.length, 0), machines: repairTickets.length, kinds: stampOrder.map((kind) => ({ label: bugKindLabels[kind], count: repairTickets.flatMap((ticket) => ticket.bugs).filter((bug) => bug.kind === kind).length, color: kindColors[kind] })) }} />
        <div className="rs-certificate__text">
        <span className="rs-certificate__seal"><Wrench size={42} /></span>
        <p className="rs-kicker">PIXPY REPAIR SHOP · OFFICIAL</p>
        <h1>Certified Bug Fixer</h1>
        <p className="rs-certificate__name">awarded to <b>{progress.name || 'you'}</b></p>
        <p>You reproduced, diagnosed, located, fixed, and verified {repairTickets.reduce((sum, ticket) => sum + ticket.bugs.length, 0)} bugs in {repairTickets.length} machines.</p>
        <div className="rs-certificate__kinds">{stampOrder.map((kind) => <div key={kind} className={`rs-kind rs-kind--${kind}`}><b>{repairTickets.flatMap((ticket) => ticket.bugs).filter((bug) => bug.kind === kind).length}</b><span>{bugKindLabels[kind]}</span></div>)}</div>
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
  const [step, setStep] = useState<Step>('reproduce')
  const [bugIndex, setBugIndex] = useState(0)
  const [installed, setInstalled] = useState<Record<number, number>>({})
  const [draft, setDraft] = useState(ticket.suggested ?? ticket.tryValues[0])
  const [reproInput, setReproInput] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<LastRun | null>(null)
  const [machine, setMachine] = useState<MachineState>('idle')
  const [traceLine, setTraceLine] = useState<number | null>(null)
  const [selectedPart, setSelectedPart] = useState<number | null>(null)
  const [located, setLocated] = useState<number[]>([])
  const [wrongLine, setWrongLine] = useState<number | null>(null)
  const [stamped, setStamped] = useState<BugKind | null>(null)
  const [wrongStamp, setWrongStamp] = useState<BugKind | null>(null)
  const [bench, setBench] = useState<BenchTest[]>([])
  const [clueOpen, setClueOpen] = useState(ticket.support === 'high')
  const [message, setMessage] = useState<Message>({ tone: 'info', title: 'Reproduce the problem', text: 'Run the machine with an input that shows what the customer saw.' })
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

  const reproduce = (value: string) => {
    const input = value.trim()
    if (!input || busy) return
    play(segments, input, (run) => {
      if (run.ok) {
        setMessage({ tone: 'info', title: `Works with ${input}.`, text: 'The problem did not show up. Read the complaint again and try the customer’s situation, or a value right at the limit.' })
        return
      }
      setReproInput(input)
      setStep('diagnose')
      setMessage({ tone: 'bad', title: 'Bug reproduced!', text: 'You made the problem happen on purpose. Now name what kind of bug it is.' })
    })
  }

  const chooseStamp = (kind: BugKind) => {
    if (!lastRun || step !== 'diagnose') return
    const correct = symptomKind(lastRun.result)
    if (kind !== correct) {
      bump('stampMisses'); setWrongStamp(kind)
      later(() => setWrongStamp(null), 600)
      setMessage({ tone: 'bad', title: `Not a ${bugKindLabels[kind].toLowerCase()}.`, text: `${stampHints[kind]} Look at what happened: ${lastRun.result.error ? lastRun.result.error.phase === 'syntax' ? 'Python stopped before running a single line.' : `Python ran some lines, then stopped with ${lastRun.result.error.type}.` : 'Python finished with no error, but the output is wrong.'}` })
      return
    }
    setStamped(kind)
    setStep('locate')
    setMessage({ tone: 'good', title: bugKindLabels[kind], text: `${bugKindMeaning[kind]} Now tap the line you think is broken.` })
  }

  const locate = (line: number) => {
    if (step !== 'locate' || busy) return
    if (bugLines.includes(line)) {
      setLocated(bugLines); setWrongLine(null); setSelectedPart(null)
      setStep('fix')
      setMessage({ tone: 'good', title: `Found it: line ${line + 1}.`, text: 'Pick a replacement part, then install it and run the machine again.' })
      return
    }
    bump('locateMisses'); setWrongLine(line)
    later(() => setWrongLine(null), 700)
    const crashHint = bug.crashLine && line === errorLine ? bug.crashLine : null
    setMessage({ tone: 'bad', title: `Line ${line + 1} looks fine.`, text: crashHint ?? bug.locate })
    if (!crashHint) setClueOpen(true)
  }

  const install = () => {
    if (selectedPart === null || !reproInput || busy) return
    const trial = { ...installed, [bugIndex]: selectedPart }
    const program = ticketSegments(ticket, trial)
    setInstalled(trial)
    setFreshLines(segmentLines(program, bug.line))
    later(() => setFreshLines([]), 900)
    play(program, reproInput, (run) => {
      const stillFailing = !run.ok
      const moreBugs = bugIndex < ticket.bugs.length - 1
      if (selectedPart === bug.answer && moreBugs) {
        const nextBug = bugIndex + 1
        setBugIndex(nextBug); setLocated([]); setStamped(null); setSelectedPart(null)
        if (stillFailing) {
          setStep('diagnose')
          setMessage({ tone: 'bad', title: 'One bug down… and another appears!', text: 'Fixing one bug can reveal the next. What kind of bug is this one?' })
        } else {
          setReproInput(null); setStep('reproduce')
          setMessage({ tone: 'info', title: 'One bug down!', text: `It runs with ${reproInput} now. But the complaint mentions another problem. Reproduce it.` })
        }
        return
      }
      if (stillFailing) {
        bump('fixMisses')
        setMessage({ tone: 'bad', title: `Still broken with ${reproInput}.`, text: run.result.error ? `Python reports ${run.result.error.type}. Try another part.` : `The machine said “${run.result.outputs.join(' + ') || 'nothing'}”. Try another part.` })
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
        setMessage({ tone: 'bad', title: `Test failed with ${input}.`, text: `Your part works for ${reproInput}, but with ${input} the machine said “${results[failure].got}” instead of “${expectedOutputs(ticket, input).join(' + ')}”. Choose another part.` })
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
    setStep('reproduce'); setBugIndex(0); setInstalled({}); setReproInput(null); setLastRun(null); setMachine('idle'); setTraceLine(null)
    setSelectedPart(null); setLocated([]); setStamped(null); setBench([]); setShowDone(false)
    setMessage({ tone: 'info', title: 'Reproduce the problem', text: 'Run the machine with an input that shows what the customer saw.' })
  }

  const clue = step === 'reproduce'
    ? ticket.suggested ? `The customer used ${ticket.suggested}. Try exactly that value.` : 'Use the situation from the complaint. Values right at the limit often reveal bugs.'
    : step === 'diagnose' ? 'Did any line run? Did it crash halfway? Or did it finish with a wrong answer?'
    : step === 'locate' ? bug.locate
    : bug.kind === 'syntax' ? 'Only one part follows every Python rule. Look closely at symbols like :, = and spaces.'
    : bug.kind === 'runtime' ? 'Which part gives Python values it can actually work with?'
    : 'Think about the value from the complaint AND all the other values. The test bench will try both.'

  const stepIndex = stepOrder.findIndex((item) => item.id === step)
  // Repair progress: each bug's diagnose, locate and fix share 60%, the test bench fills up to 95%,
  // and the monkey's last hammer blow in the finale takes it to 100%.
  const stepShare: Record<Step, number> = { reproduce: 0, diagnose: 0.25, locate: 0.5, fix: 0.75, verify: 1, done: 1 }
  const benchPassed = bench.filter((test) => test.status === 'pass').length
  const meterPercent = step === 'done' ? 100
    : step === 'verify' ? 60 + 35 * (benchPassed / ticket.tests.length)
    : 60 * (bugIndex + stepShare[step]) / ticket.bugs.length
  const meterLabel = step === 'done' ? 'Every test passed' : step === 'verify' ? `${benchPassed} of ${ticket.tests.length} tests passed`
    : step === 'reproduce' ? (bugIndex > 0 ? 'One bug fixed' : 'Make the bug happen') : step === 'diagnose' ? 'Bug reproduced' : step === 'locate' ? 'Bug named' : 'Broken line found'
  const benchInput = step === 'verify' ? bench.find((test) => test.status === 'running')?.input ?? null : null
  const repaired = step === 'verify' || step === 'done'
  const broken = step !== 'done' && (reproInput !== null || lastRun !== null && !lastRun.ok)
  const fault = machine === 'crash' && lastRun?.result.error ? lastRun.result.error.phase === 'syntax' ? 'syntax' : 'runtime' : null
  const shownInput = machine === 'running' && benchInput ? benchInput : lastRun?.input ?? reproInput ?? draft
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
  const stampBadge = stamped && step !== 'done' && <span key={stamped} className={`rs-machine__stamp rs-kind--${stamped}`}>{bugKindLabels[stamped]}</span>
  const [who, role] = ticket.customer.split(/,\s*/)
  const mission = missions[step]
  const partsOpen = step === 'fix' || step === 'verify' && bench.length === 0
  const drawerAfter = partsOpen ? bugLines[bugLines.length - 1] : -1
  const chooseStyle = (next: StageStyle) => { setStageStyle(next); try { localStorage.setItem(styleKey, next) } catch { /* private mode */ } }

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
          <figure className="rs-story__quote rs-chat" style={{ '--avatar': avatarColors[(ticket.id - 1) % avatarColors.length] } as CSSProperties}>
            <span className="rs-chat__avatar" aria-hidden="true"><UserRound size={22} strokeWidth={2.2} /><i /></span>
            <div className="rs-chat__bubble">
              <figcaption><b>{who}</b>{role && <small>{role}</small>}<time>just now</time></figcaption>
              <blockquote><p>{ticket.complaint}</p></blockquote>
            </div>
          </figure>
          <p className="rs-story__spec"><b>MUST DO</b><span>{ticket.rule}</span></p>
        </header>
        <RepairStage machine={ticket.machine} view={stageView} style={stageStyle} label={`${meta.label}: ${status.text.toLowerCase()}`}
          fallback={<FlatMachine meta={meta} machine={machine} broken={broken} lastRun={lastRun} reproInput={reproInput} draft={draft} benchInput={benchInput} step={step} variable={ticket.variable} stamp={stampBadge} />}
          overlay={<>
            <div className="rs-stage__style" role="group" aria-label="Machine view">{(['real', 'ascii'] as const).map((option) => <button key={option} aria-pressed={stageStyle === option} onClick={() => chooseStyle(option)}>{option === 'ascii' ? 'MATRIX' : '3D'}</button>)}</div>
            <div className="rs-stage__hint" aria-hidden="true"><Rotate3d size={13} /> drag to turn · pinch to zoom</div>
            {stampBadge}
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
          <ol className="rs-steps" aria-label="Repair steps" style={{ '--progress': `${(step === 'done' ? 4 : stepIndex) / 4}` } as CSSProperties}>{stepOrder.map((item, i) => {
            const Icon = item.icon
            const state = step === 'done' || i < stepIndex ? 'is-done' : i === stepIndex ? 'is-current' : ''
            return <li key={item.id} className={state} aria-current={i === stepIndex ? 'step' : undefined}><span>{state === 'is-done' ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}</span><b>{item.label}</b></li>
          })}</ol>
          <div className="rs-mission">
            <span className="rs-mission__number">{step === 'done' ? <Check size={26} strokeWidth={3} /> : String(stepIndex + 1).padStart(2, '0')}</span>
            <div><small>{step === 'done' ? 'ALL FIVE STEPS DONE' : `STEP ${stepIndex + 1} OF 5 · ${stepOrder[stepIndex].label.toUpperCase()}`}</small><h2>{mission.title}</h2><p>{mission.text(ticket.variable)}</p></div>
          </div>
        </header>

        <div className="rs-work__body" aria-live="polite">
          <div className={`rs-code ${step === 'locate' ? 'is-locating' : ''}`}>
            <header><div className="rs-dots" aria-hidden="true"><i /><i /><i /></div><span>machine.py</span>{step === 'locate' && <em className="rs-code__tap"><MousePointer size={13} /> tap a line</em>}{(reproInput || lastRun) && <button onClick={restart} disabled={busy} aria-label="Restart this ticket"><RotateCcw size={14} /> Restart</button>}</header>
            <div className="rs-code__lines" aria-label="Machine program">{lines.map((line, i) => {
              const classes = [traceLine === i ? 'is-executing' : '', errorLine === i && machine === 'crash' ? 'is-error' : '', located.includes(i) ? repaired ? 'is-installed' : 'is-located' : '', wrongLine === i ? 'is-wrong' : '', freshLines.includes(i) ? 'is-fresh' : ''].join(' ')
              const content = <><span className="rs-code__number">{i + 1}</span><PythonCode code={line || ' '} />{located.includes(i) && (repaired ? <Check className="rs-code__ok" size={15} /> : <Bug className="rs-code__bug" size={15} />)}{errorLine === i && machine === 'crash' && <TriangleAlert className="rs-code__alert" size={15} />}</>
              const row = step === 'locate'
                ? <button key={i} className={`rs-code__line ${classes}`} onClick={() => locate(i)} aria-label={`Line ${i + 1}: ${line.trim()}`}>{content}</button>
                : <div key={i} className={`rs-code__line ${classes}`}>{content}</div>
              if (i !== drawerAfter) return row
              // The parts drawer opens right under the broken line.
              return <div key={i} className="rs-code__slot">{row}
                <div className="rs-drawer">
                  <p><Wrench size={13} /> Replacement parts for line {bugLines[0] + 1}</p>
                  <div className="rs-parts" role="radiogroup" aria-label="Replacement parts">{bug.parts.map((part, index) => <button key={index} role="radio" aria-checked={selectedPart === index} className={`rs-part ${selectedPart === index ? 'is-selected' : ''} ${installed[bugIndex] === index && machine !== 'running' ? 'is-installed' : ''}`} disabled={busy} onClick={() => setSelectedPart(index)}><span className="rs-part__bolt" aria-hidden="true" /><pre><PythonCode code={part} /></pre>{selectedPart === index && <Check size={15} />}</button>)}</div>
                </div>
              </div>
            })}</div>
            {lastRun && machine !== 'running' && <Console run={lastRun} variable={ticket.variable} />}
          </div>

          {step === 'reproduce' && <div className="rs-tool rs-prompt">
            <span className="rs-prompt__label"><code>{ticket.variable} =</code></span>
            <div className="rs-chips">{ticket.tryValues.map((value) => <button key={value} className={`${draft === value ? 'is-selected' : ''} ${clueOpen && ticket.suggested === value ? 'is-suggested' : ''}`} aria-pressed={draft === value} disabled={busy} onClick={() => setDraft(value)}>{value}</button>)}
              <label className="rs-custom"><span className="sr-only">Custom {ticket.variable}</span><input value={draft} disabled={busy} inputMode="numeric" onChange={(event) => setDraft(event.target.value.slice(0, 12))} onKeyDown={(event) => { if (event.key === 'Enter') reproduce(draft) }} aria-label={`${ticket.variable} value`} /></label>
            </div>
          </div>}
          {step === 'diagnose' && <div className="rs-tool">
            <div className="rs-stamps">{stampOrder.map((kind) => {
              const Icon = stampIcons[kind]
              return <button key={kind} className={`rs-stamp rs-kind--${kind} ${wrongStamp === kind ? 'is-wrong' : ''}`} disabled={busy} onClick={() => chooseStamp(kind)}><Icon size={20} /><b>{bugKindLabels[kind]}</b><small>{stampHints[kind]}</small></button>
            })}</div>
          </div>}
          {step === 'verify' && bench.length > 0 && <div className="rs-tool"><Bench tests={bench} ticket={ticket} /></div>}
          {step === 'done' && <div className="rs-tool"><Bench tests={bench} ticket={ticket} /></div>}
          {step !== 'done' && step !== 'verify' && <div className="rs-clue">{clueOpen ? <p><Lightbulb size={16} /> {clue}</p> : <button onClick={showClue}><Lightbulb size={15} /> Need a clue?</button>}</div>}
        </div>

        <footer className={`rs-footer rs-footer--${message.tone}`}>
          <div role="status"><span className="rs-footer__icon">{message.tone === 'good' ? <Check size={20} /> : message.tone === 'bad' ? <Bug size={20} /> : <Sparkles size={20} />}</span><p><b>{message.title}</b>{message.text}</p></div>
          {step === 'reproduce' && <button className="rs-primary" disabled={busy || !draft.trim()} onClick={() => reproduce(draft)}><Play size={17} fill="currentColor" /> {busy ? 'RUNNING…' : `RUN WITH ${draft.trim() || '?'}`}</button>}
          {step === 'fix' && <button className="rs-primary" disabled={busy || selectedPart === null} onClick={install}><Wrench size={17} /> {busy ? 'RUNNING…' : 'INSTALL + RUN'}</button>}
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
          <dl className="rs-done__stats"><div><dt>Test runs</dt><dd>{stats.runs}</dd></div><div><dt>Tests passed</dt><dd>{ticket.tests.length} / {ticket.tests.length}</dd></div><div><dt>Retries</dt><dd>{stats.stampMisses + stats.locateMisses + stats.fixMisses + stats.verifyFails}</dd></div></dl>
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
  reproInput: string | null
  draft: string
  benchInput: string | null
  step: Step
  variable: string
  stamp: ReactNode
}

/** The drawn machine, used where the 3D scene cannot run. */
function FlatMachine({ meta, machine, broken, lastRun, reproInput, draft, benchInput, step, variable, stamp }: FlatProps) {
  const MachineIcon = meta.icon
  return <div className={`rs-machine rs-machine--${machine} ${broken ? 'is-broken' : ''}`}>
    <div className="rs-machine__head"><i className="rs-machine__led" /><b>{meta.label}</b><small>{meta.model}</small></div>
    <div className="rs-machine__screen">
      <div className="rs-machine__glass">
        {machine === 'running' && <><small>{step === 'verify' ? `TEST BENCH${benchInput ? ` · ${variable} = ${benchInput}` : ''}` : `${variable} = ${lastRun?.input ?? reproInput ?? draft}`}</small><strong className="rs-blink">RUNNING…</strong></>}
        {machine === 'idle' && <><small>READY</small><strong>_<span className="rs-cursor" /></strong></>}
        {(machine === 'ok' || machine === 'wrong') && lastRun && <><small>{variable} = {lastRun.input}</small>{lastRun.result.outputs.length ? lastRun.result.outputs.map((output, i) => <strong key={i}>{output}</strong>) : <strong className="is-empty">(nothing)</strong>}</>}
        {machine === 'crash' && lastRun?.result.error && <><small>{lastRun.result.error.type.toUpperCase()}</small><strong className="rs-glitch" data-text="ERROR">ERROR</strong></>}
        {machine === 'fixed' && <><small>ALL TESTS PASSED</small><strong>WORKING!</strong></>}
      </div>
    </div>
    <div className="rs-machine__body">
      <span className="rs-machine__icon"><MachineIcon size={46} strokeWidth={1.6} /></span>
      <span className="rs-machine__slot"><small>INPUT</small><b>{machine === 'running' && benchInput ? benchInput : lastRun?.input ?? reproInput ?? '—'}</b></span>
    </div>
    {broken && machine !== 'running' && <div className="rs-tape" aria-hidden="true"><span>OUT OF ORDER · OUT OF ORDER · OUT OF ORDER</span></div>}
    {machine === 'crash' && <div className="rs-sparks" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--a': `${i * 36}deg`, '--d': `${(i % 4) * 60}ms` } as CSSProperties} />)}<b /><b /><b /></div>}
    {machine === 'fixed' && <div className="rs-burst" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--a': `${i * 26}deg`, '--d': `${(i % 5) * 50}ms` } as CSSProperties} />)}</div>}
    {stamp}
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
