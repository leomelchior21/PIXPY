import { ArrowLeft, ChevronLeft, ChevronRight, Footprints, Infinity as InfinityIcon, Lightbulb, Pause, Play, RotateCcw, Siren, Volume2, VolumeX, Zap } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { evaluateCondition, gateXp, generateChallenge, planCourse, sliderRange, type BackroomChallenge, type ComparisonOperator, type CourseTile } from '../../lib/backroomEngine'
import { completeActivity } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { BEND_LENGTH, corridorCenterAt, drawBackroom } from './backroomRenderer'
import './backroomRun.css'

interface Props {
  progress: SessionProgress
  onProgress: (progress: SessionProgress) => void
  onBack: () => void
}

type RunStatus = 'running' | 'passing' | 'paused' | 'milestone' | 'crashed' | 'summary'

const START_DISTANCE = 15
const PASS_DISTANCE = -1.8
const OPEN_SECONDS = 0.7
const BASE_SPEED = 1.55
const SPEED_STEP = 0.075
const MAX_SPEED = 2.9
const SLOW_DISTANCE = 3.4
const CRASH_DISTANCE = 0.32
const STEER_SPEED = 0.92
const WALL_LIMIT = 0.6
const TURN_SHIFT = 1.15
const CURVE_TILE_LENGTH = 20
const GATE_TILE_LENGTH = 26
const MILESTONE_GATES = 5
const SEED_BASE = 20260214
const HINT_AFTER_MS = 26000

function speedForGate(gateNumber: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + (gateNumber - 1) * SPEED_STEP)
}

export function BackroomRun({ progress, onProgress, onBack }: Props) {
  const startingGate = progress.backroomRunGates + 1
  const [challenge, setChallenge] = useState<BackroomChallenge>(() => generateChallenge(startingGate, SEED_BASE))
  const [value, setValue] = useState(challenge.startValue)
  const [status, setStatus] = useState<RunStatus>('running')
  const [runNumber, setRunNumber] = useState(startingGate)
  const [sessionGates, setSessionGates] = useState(0)
  const [sessionXp, setSessionXp] = useState(0)
  const [sessionOperators, setSessionOperators] = useState<ComparisonOperator[]>([])
  const [assistLevel, setAssistLevel] = useState(0)
  const [hintOpen, setHintOpen] = useState(false)
  const [microReveal, setMicroReveal] = useState<{ title: string; caption: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [audioOn, setAudioOn] = useState(false)
  const [showMilestone, setShowMilestone] = useState(false)
  const [turnHint, setTurnHint] = useState<0 | -1 | 1>(0)
  const [crashReason, setCrashReason] = useState<'gate' | 'wall'>('gate')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const screenRef = useRef<HTMLElement>(null)
  const challengeRef = useRef(challenge)
  const valueRef = useRef(value)
  const runNumberRef = useRef(runNumber)
  const progressRef = useRef(progress)
  const awardedRef = useRef<Set<string>>(new Set())
  const gateStartRef = useRef(performance.now())
  const farSolveRef = useRef(true)
  const hintTimerRef = useRef<number | null>(null)
  const revealTimerRef = useRef<number | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const seenOperatorsRef = useRef<Set<ComparisonOperator>>(new Set())
  const audioRef = useRef<AudioContext | null>(null)
  const steerRef = useRef({ left: false, right: false })

  const game = useRef({
    depth: 0,
    gateZ: START_DISTANCE,
    currentCenter: 0,
    nextCenter: 0,
    boundaryZ: GATE_TILE_LENGTH / 2,
    tileEndZ: GATE_TILE_LENGTH,
    course: planCourse() as CourseTile[],
    playerX: 0,
    phase: 'gate' as 'gate' | 'turn',
    openAmount: 0,
    speed: speedForGate(startingGate),
    status: 'running' as RunStatus,
    value: challenge.startValue,
    operator: challenge.operator,
    threshold: challenge.threshold,
    true: evaluateCondition(challenge.startValue, challenge.operator, challenge.threshold),
    falseIntensity: 0,
    time: 0,
    shake: 0,
    passLatched: false,
    reduced: false,
  })

  const isTrue = evaluateCondition(value, challenge.operator, challenge.threshold)
  const firstGate = sessionGates === 0 && runNumber === 1

  useEffect(() => { challengeRef.current = challenge }, [challenge])
  useEffect(() => { valueRef.current = value; game.current.value = value }, [value])
  useEffect(() => { runNumberRef.current = runNumber }, [runNumber])
  useEffect(() => { progressRef.current = progress }, [progress])
  useEffect(() => {
    if (status !== 'passing') game.current.status = status
  }, [status])

  const playTone = (frequency: number, durationMs: number, type: OscillatorType, gain = 0.04) => {
    if (!audioOn) return
    try {
      const context = audioRef.current ?? new AudioContext()
      audioRef.current = context
      const oscillator = context.createOscillator()
      const volume = context.createGain()
      oscillator.type = type
      oscillator.frequency.value = frequency
      volume.gain.value = gain
      oscillator.connect(volume)
      volume.connect(context.destination)
      oscillator.start()
      volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationMs / 1000)
      oscillator.stop(context.currentTime + durationMs / 1000)
    } catch { /* audio is optional */ }
  }

  const clearTimers = () => {
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    hintTimerRef.current = null
    revealTimerRef.current = null
    toastTimerRef.current = null
  }

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1600)
  }

  const scheduleHint = () => {
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)
    hintTimerRef.current = window.setTimeout(() => {
      setAssistLevel((level) => Math.max(level, 1))
      setHintOpen(true)
    }, HINT_AFTER_MS)
  }

  const beginGate = (gateNumber: number, previousOperator?: ComparisonOperator) => {
    const nextChallenge = generateChallenge(gateNumber, SEED_BASE, 1, previousOperator)
    const g = game.current
    g.phase = 'gate'
    g.gateZ = g.depth + START_DISTANCE
    g.openAmount = 0
    g.speed = speedForGate(gateNumber)
    g.value = nextChallenge.startValue
    g.operator = nextChallenge.operator
    g.threshold = nextChallenge.threshold
    g.true = evaluateCondition(nextChallenge.startValue, nextChallenge.operator, nextChallenge.threshold)
    g.passLatched = false
    g.course = planCourse()
    setChallenge(nextChallenge)
    setValue(nextChallenge.startValue)
    setRunNumber(gateNumber)
    setStatus('running')
    setAssistLevel(0)
    setHintOpen(false)
    setTurnHint(0)
    farSolveRef.current = true
    gateStartRef.current = performance.now()
    scheduleHint()
  }

  const beginTurn = () => {
    const g = game.current
    g.phase = 'turn'
    setStatus('running')
    if (g.nextCenter !== g.currentCenter) setTurnHint(Math.sign(g.nextCenter - g.currentCenter) as -1 | 1)
    playTone(420, 220, 'triangle', 0.03)
  }

  const handlePass = () => {
    const current = challengeRef.current
    setStatus('passing')
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)

    const xp = gateXp(farSolveRef.current)
    setSessionGates((gates) => gates + 1)
    setSessionXp((total) => total + xp)

    const seen = seenOperatorsRef.current
    const newOperator = !seen.has(current.operator)
    seen.add(current.operator)
    setSessionOperators([...seen])

    setMicroReveal(newOperator
      ? { title: `${current.operator} ${current.threshold}`, caption: current.operatorWords }
      : { title: `${valueRef.current} ${current.operator} ${current.threshold}`, caption: 'TRUE' })
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current)
    revealTimerRef.current = window.setTimeout(() => setMicroReveal(null), 1900)

    if (!awardedRef.current.has(current.id)) {
      awardedRef.current.add(current.id)
      const base = progressRef.current
      const operators = [...new Set([...base.backroomRunOperators, current.operator])]
      let next: SessionProgress = {
        ...base,
        backroomRunXp: base.backroomRunXp + xp,
        backroomRunGates: base.backroomRunGates + 1,
        backroomRunBest: Math.max(base.backroomRunBest, runNumberRef.current),
        backroomRunOperators: operators,
      }
      if (runNumberRef.current >= MILESTONE_GATES) next = completeActivity(next, 'backroom-run')
      onProgress(next)
      showToast(`+${xp} XP`)
      playTone(660, 180, 'square', 0.035)
    }
  }

  const handleGateComplete = () => {
    beginTurn()
    if (runNumberRef.current === MILESTONE_GATES) {
      setStatus('milestone')
      setShowMilestone(true)
    }
  }

  const handleCrash = (reason: 'gate' | 'wall') => {
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)
    setStatus('crashed')
    setCrashReason(reason)
    playTone(90, 620, 'sawtooth', 0.05)
  }

  const eventsRef = useRef({ handlePass, handleGateComplete, handleCrash })
  useEffect(() => { eventsRef.current = { handlePass, handleGateComplete, handleCrash } })

  const beginGateRef = useRef(beginGate)
  useEffect(() => { beginGateRef.current = beginGate })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const g = game.current
    g.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let last = performance.now()

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(240, Math.round(rect.width / 3))
      canvas.height = Math.max(140, Math.round(rect.height / 3))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const update = (dt: number) => {
      g.time += dt
      g.true = evaluateCondition(g.value, g.operator, g.threshold)
      const distance = g.gateZ - g.depth
      const progress = Math.max(0, Math.min(1, 1 - Math.max(distance, 0) / START_DISTANCE))

      if (g.phase === 'gate') {
        if (g.true) {
          g.openAmount = Math.min(1, g.openAmount + dt / OPEN_SECONDS)
          g.falseIntensity = Math.max(0, g.falseIntensity - dt * 2.4)
        } else {
          g.falseIntensity = Math.min(1, Math.max(0, (progress - 0.35) / 0.55))
          if (distance < 4.5) farSolveRef.current = false
        }
      } else {
        g.openAmount = 1
        g.falseIntensity = Math.max(0, g.falseIntensity - dt * 2.4)
      }

      const steer = (steerRef.current.left ? -1 : 0) + (steerRef.current.right ? 1 : 0)
      g.playerX += steer * STEER_SPEED * dt

      let factor = 1
      if (g.phase === 'gate') {
        if (g.true && g.openAmount < 0.85) factor = 0.3
        else if (g.true) factor = 1.22
        else if (distance < SLOW_DISTANCE) factor = 0.55
      }
      if (g.status === 'running') g.depth += dt * g.speed * factor

      if (g.depth > g.boundaryZ + BEND_LENGTH) {
        g.currentCenter = g.nextCenter
        const tile = g.course.shift()
        const length = tile?.kind === 'curve' ? CURVE_TILE_LENGTH : GATE_TILE_LENGTH
        g.tileEndZ += length
        g.boundaryZ = g.tileEndZ - length / 2
        if (tile?.kind === 'curve') {
          g.nextCenter = g.currentCenter + tile.dir * TURN_SHIFT
          setTurnHint(tile.dir)
        } else {
          g.nextCenter = g.currentCenter
          beginGateRef.current(runNumberRef.current + 1, g.operator)
          return
        }
      }

      const center = corridorCenterAt(g.currentCenter, g.nextCenter, g.boundaryZ, g.depth)
      const offset = g.playerX - center
      const screen = screenRef.current
      if (screen) {
        screen.style.setProperty('--wall-right', Math.max(0, Math.min(1, offset / WALL_LIMIT)).toFixed(2))
        screen.style.setProperty('--wall-left', Math.max(0, Math.min(1, -offset / WALL_LIMIT)).toFixed(2))
      }
      if (g.status === 'running' && Math.abs(offset) > WALL_LIMIT) {
        g.status = 'crashed'
        g.shake = 1
        eventsRef.current.handleCrash('wall')
        return
      }
      if (g.phase === 'gate' && !g.true && distance <= CRASH_DISTANCE && g.status === 'running') {
        g.status = 'crashed'
        g.shake = 1
        eventsRef.current.handleCrash('gate')
        return
      }
      if (g.phase === 'gate' && !g.passLatched && g.true && g.openAmount >= 0.85 && distance <= 0.9) {
        g.passLatched = true
        eventsRef.current.handlePass()
      }
      if (g.phase === 'gate' && g.passLatched && distance <= PASS_DISTANCE) {
        eventsRef.current.handleGateComplete()
        return
      }
      g.shake = Math.max(0, g.shake - dt * 1.6)
    }

    const frameLoop = (now: number) => {
      frame = requestAnimationFrame(frameLoop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (document.hidden || g.status === 'paused' || g.status === 'milestone' || g.status === 'summary' || g.status === 'crashed') return
      update(dt)
      drawBackroom(context, canvas.width, canvas.height, {
        depth: g.depth,
        gateZ: g.gateZ,
        currentCenter: g.currentCenter,
        nextCenter: g.nextCenter,
        boundaryZ: g.boundaryZ,
        playerX: g.playerX,
        openAmount: g.openAmount,
        conditionTrue: g.true,
        falseIntensity: g.falseIntensity,
        time: g.time,
        gateNumber: runNumberRef.current,
        seed: SEED_BASE,
        reduced: g.reduced,
        shake: g.shake,
      })
      screenRef.current?.style.setProperty('--false', g.falseIntensity.toFixed(3))
    }
    frame = requestAnimationFrame(frameLoop)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    scheduleHint()
    return clearTimers
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setStatus((current) => current === 'running' ? 'paused' : current)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const stopSteering = () => { steerRef.current.left = false; steerRef.current.right = false }
    window.addEventListener('pointerup', stopSteering)
    window.addEventListener('pointercancel', stopSteering)
    return () => {
      window.removeEventListener('pointerup', stopSteering)
      window.removeEventListener('pointercancel', stopSteering)
    }
  }, [])

  const changeValue = (next: number) => {
    setValue(Math.max(sliderRange.min, Math.min(sliderRange.max, Math.round(next))))
  }

  const openHint = () => {
    setHintOpen(true)
    setAssistLevel(2)
  }

  const togglePause = () => setStatus((current) => current === 'paused' ? 'running' : current === 'running' ? 'paused' : current)

  const toggleAudio = () => {
    setAudioOn((on) => {
      if (!on) {
        try {
          audioRef.current = audioRef.current ?? new AudioContext()
          const context = audioRef.current
          const oscillator = context.createOscillator()
          const volume = context.createGain()
          oscillator.frequency.value = 520
          volume.gain.value = 0.03
          oscillator.connect(volume)
          volume.connect(context.destination)
          oscillator.start()
          oscillator.stop(context.currentTime + 0.09)
        } catch { /* audio is optional */ }
      }
      return !on
    })
  }

  const openSummary = () => setStatus('summary')
  const resume = () => { setShowMilestone(false); setStatus('running') }
  const tryAgain = () => {
    setSessionGates(0)
    setSessionXp(0)
    const g = game.current
    g.depth = 0
    g.playerX = 0
    g.currentCenter = 0
    g.nextCenter = 0
    g.boundaryZ = GATE_TILE_LENGTH / 2
    g.tileEndZ = GATE_TILE_LENGTH
    g.shake = 0
    g.falseIntensity = 0
    g.openAmount = 0
    beginGate(1)
  }

  const steerDown = (direction: -1 | 1) => {
    if (direction === -1) steerRef.current.left = true
    else steerRef.current.right = true
  }
  const steerUp = (direction: -1 | 1) => {
    if (direction === -1) steerRef.current.left = false
    else steerRef.current.right = false
  }

  const focusScreen = (event: React.PointerEvent) => {
    const tag = (event.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'BUTTON') return
    screenRef.current?.focus()
  }

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const tag = (event.target as HTMLElement).tagName
    const key = event.key
    const sliderFocused = tag === 'INPUT'
    const left = key === 'a' || key === 'A' || key === 'ArrowLeft'
    const right = key === 'd' || key === 'D' || key === 'ArrowRight'
    if (left || right) {
      if (sliderFocused && (key === 'ArrowLeft' || key === 'ArrowRight')) return
      event.preventDefault()
      if (left) steerRef.current.left = true
      else steerRef.current.right = true
      return
    }
    if (key === ' ') {
      if (tag === 'BUTTON' || sliderFocused) return
      event.preventDefault()
      togglePause()
      return
    }
    if (sliderFocused) return
    if (key === 'w' || key === 'W' || key === 'ArrowUp') {
      event.preventDefault()
      changeValue(valueRef.current + 1)
    } else if (key === 's' || key === 'S' || key === 'ArrowDown') {
      event.preventDefault()
      changeValue(valueRef.current - 1)
    }
  }

  const onKeyUp = (event: ReactKeyboardEvent) => {
    const key = event.key
    if (key === 'a' || key === 'A' || key === 'ArrowLeft') steerRef.current.left = false
    if (key === 'd' || key === 'D' || key === 'ArrowRight') steerRef.current.right = false
  }

  return <main
    ref={screenRef}
    className={`br-screen br-screen--${status} ${isTrue ? 'is-true' : 'is-false'}`}
    style={{ '--assist': assistLevel } as CSSProperties}
    tabIndex={0}
    onPointerDown={focusScreen}
    onKeyDown={onKeyDown}
    onKeyUp={onKeyUp}
    onBlur={() => { steerRef.current.left = false; steerRef.current.right = false }}
  >
    <canvas ref={canvasRef} className="br-canvas" aria-hidden="true" />
    <div className="br-wall-warning" aria-hidden="true"><i /><i /></div>
    <div className="br-vignette" aria-hidden="true" />

    <header className="br-hud">
      <span className="br-badge"><Footprints size={18} /> BACKROOMS RUN</span>
      <div className="br-stats">
        <span className="br-stat"><b>RUN</b> {String(runNumber).padStart(3, '0')}</span>
        <span className="br-stat"><Zap size={14} fill="currentColor" /> XP {progress.backroomRunXp}</span>
        <span className="br-stat br-stat--endless"><InfinityIcon size={16} /> ENDLESS</span>
      </div>
      <div className="br-actions">
        <button onClick={toggleAudio} aria-label={audioOn ? 'Turn sound off' : 'Turn sound on'}>{audioOn ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
        <button onClick={togglePause} aria-label={status === 'paused' ? 'Resume run' : 'Pause run'}>{status === 'paused' ? <Play size={17} /> : <Pause size={17} />}</button>
        <button className="br-exit" onClick={openSummary}><ArrowLeft size={15} /> CONDITIONS</button>
      </div>
    </header>

    {toast && <div className="br-toast">{toast}</div>}
    {microReveal && <div className="br-reveal" role="status"><strong>{microReveal.title}</strong><span>{microReveal.caption}</span></div>}
    <section className="br-console">
      {turnHint !== 0 && status === 'running' && <div className={`br-turn ${turnHint < 0 ? 'is-left' : 'is-right'}`} role="status">
        {turnHint < 0 ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
        <strong>TURN {turnHint < 0 ? 'LEFT' : 'RIGHT'}</strong>
      </div>}
      <div className="br-panel">
        <div className="br-readouts">
          <div className="br-condition" aria-label={`Condition: ${challenge.variableName} ${challenge.operator} ${challenge.threshold}`}>
            <b>{challenge.variableName}</b>
            <span className="br-operator">{challenge.operator}</span>
            <strong>{challenge.threshold}</strong>
          </div>
          <div className="br-variable"><span>{challenge.variableName} =</span><strong>{value}</strong></div>
        </div>
        <div className="br-slider">
          <div className="br-track" aria-hidden="true">
            {assistLevel > 0 && <span className="br-threshold" style={{ left: `${challenge.threshold}%` }} />}
            <span className="br-bubble" style={{ left: `${value}%` }}>{value}</span>
            <input
              type="range"
              min={sliderRange.min}
              max={sliderRange.max}
              step={1}
              value={value}
              onChange={(event) => changeValue(Number(event.target.value))}
              onPointerUp={() => screenRef.current?.focus()}
              aria-label={`Set ${challenge.variableName} value`}
            />
          </div>
          <span className="br-scale" aria-hidden="true"><i>0</i><i>20</i><i>40</i><i>60</i><i>80</i><i>100</i></span>
        </div>
        <div className="br-below">
          <p className="br-instruction">{firstGate ? 'MOVE ENERGY. MAKE IT TRUE.' : 'MAKE THE CONDITION TRUE'}</p>
          <button className="br-hint-button" onClick={openHint}><Lightbulb size={15} /> HINT</button>
        </div>
        {hintOpen && <p className="br-hint" role="status"><Lightbulb size={15} /> {challenge.hint}</p>}
      </div>
      <div className={`br-steer ${turnHint === -1 ? 'is-left' : turnHint === 1 ? 'is-right' : ''}`} aria-label="Corridor steering">
        <div className="br-steer-buttons">
          <button
            className="br-steer-button"
            aria-label="Move left"
            onPointerDown={() => steerDown(-1)}
            onPointerUp={() => steerUp(-1)}
            onPointerLeave={() => steerUp(-1)}
            onContextMenu={(event) => event.preventDefault()}
          ><ChevronLeft size={30} /></button>
          <button
            className="br-steer-button"
            aria-label="Move right"
            onPointerDown={() => steerDown(1)}
            onPointerUp={() => steerUp(1)}
            onPointerLeave={() => steerUp(1)}
            onContextMenu={(event) => event.preventDefault()}
          ><ChevronRight size={30} /></button>
        </div>
        <span className="br-steer-hint" aria-hidden="true">← → · A D</span>
      </div>
    </section>

    {status === 'paused' && <div className="br-overlay">
      <Siren size={34} />
      <h2>PAUSED</h2>
      <p>The corridor waits. Your XP is safe.</p>
      <div className="br-overlay-actions">
        <button className="br-primary" onClick={resume}><Play size={16} /> KEEP RUNNING</button>
        <button className="br-secondary" onClick={openSummary}>FINISH RUN</button>
      </div>
    </div>}

    {status === 'crashed' && <div className="br-overlay br-overlay--crash">
      <RotateCcw size={36} />
      <small>GAME OVER</small>
      <h2>{crashReason === 'wall' ? 'YOU HIT THE WALL' : 'THE GATE STAYED CLOSED'}</h2>
      <p>{crashReason === 'wall'
        ? 'The corridor turned and energy only opens gates. Steer with the ← → keys or A/D to follow the corridor.'
        : <>The condition was <b className="is-false">FALSE</b>, so the gate never opened. A condition is either true or false — check the value, then try again.</>}</p>
      <div className="br-summary-grid">
        <article><strong>{sessionGates}</strong><span>GATES OPENED</span></article>
        <article><strong>{sessionXp}</strong><span>XP THIS RUN</span></article>
        <article><strong>{progress.backroomRunXp}</strong><span>TOTAL XP</span></article>
      </div>
      <div className="br-overlay-actions">
        <button className="br-primary" onClick={tryAgain}><RotateCcw size={16} /> TRY AGAIN</button>
        <button className="br-secondary" onClick={openSummary}>BACK TO CONDITIONS</button>
      </div>
    </div>}

    {showMilestone && status === 'milestone' && <div className="br-overlay br-overlay--milestone">
      <Footprints size={34} />
      <h2>YOU GET IT.</h2>
      <p>A condition can be <b>TRUE</b> or <b>FALSE</b>. You just opened {MILESTONE_GATES} gates by making conditions true.</p>
      <div className="br-overlay-actions">
        <button className="br-primary" onClick={resume}>KEEP RUNNING</button>
        <button className="br-secondary" onClick={openSummary}>BACK TO CONDITIONS</button>
      </div>
    </div>}

    {status === 'summary' && <div className="br-overlay br-overlay--summary">
      <Footprints size={30} />
      <small>CHECKPOINT CONDITIONS</small>
      <h2>RUN SUMMARY</h2>
      <div className="br-summary-grid">
        <article><strong>{sessionGates}</strong><span>GATES OPENED</span></article>
        <article><strong>{sessionXp}</strong><span>XP EARNED</span></article>
        <article><strong>{sessionOperators.join(' ') || '—'}</strong><span>OPERATORS SEEN</span></article>
      </div>
      <p>Total XP saved: <b>{progress.backroomRunXp}</b> · Best run: <b>{progress.backroomRunBest}</b></p>
      <div className="br-overlay-actions">
        <button className="br-primary" onClick={onBack}><ArrowLeft size={16} /> BACK TO CONDITIONS</button>
        <button className="br-secondary" onClick={resume}>KEEP RUNNING</button>
      </div>
    </div>}
  </main>
}
