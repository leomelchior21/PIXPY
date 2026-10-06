import { ArrowLeft, ChevronLeft, ChevronRight, Footprints, Infinity as InfinityIcon, Lightbulb, Pause, Play, RotateCcw, Siren, Volume2, VolumeX, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { baseRunSpeed, championGates, corridorCenterAt, energyRange, evaluateCondition, gateCrossing, gateXp, generateChallenge, hitsObstacle, planCorridor, planCourse, speedForGate, type BackroomChallenge, type ComparisonOperator } from '../../lib/backroomEngine'
import { completeActivity } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { drawBackroom } from './backroomRenderer'
import { BackroomChampionAward, BackroomChampionBadge } from './BackroomChampion'
import './backroomRun.css'

interface Props {
  progress: SessionProgress
  onProgress: (progress: SessionProgress) => void
  onBack: () => void
}

type RunStatus = 'running' | 'passing' | 'paused' | 'milestone' | 'crashed' | 'summary'

const START_DISTANCE = 9
const PASS_CLEARANCE = 1.8
const OPEN_SECONDS = 0.7
const CLOSE_SECONDS = 0.4
const STEER_SPEED = 0.72
const WALL_LIMIT = 0.78
const MILESTONE_GATES = 5
const SEED_BASE = 20260214
const HINT_AFTER_MS = 26000

export function BackroomRun({ progress, onProgress, onBack }: Props) {
  const startingGate = 1
  const [challenge, setChallenge] = useState<BackroomChallenge>(() => generateChallenge(startingGate, SEED_BASE))
  const [value, setValue] = useState(challenge.startValue)
  const [status, setStatus] = useState<RunStatus>('running')
  const [phase, setPhase] = useState<'gate' | 'turn'>('gate')
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
  const [showChampion, setShowChampion] = useState(false)
  const [turnHint, setTurnHint] = useState<0 | -1 | 1>(0)
  const [hazardHint, setHazardHint] = useState<0 | -1 | 1>(0)
  const [crashReason, setCrashReason] = useState<'gate' | 'wall' | 'obstacle'>('gate')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const screenRef = useRef<HTMLElement>(null)
  const challengeRef = useRef(challenge)
  const valueRef = useRef(value)
  const runNumberRef = useRef(runNumber)
  const progressRef = useRef(progress)
  const farSolveRef = useRef(true)
  const hintTimerRef = useRef<number | null>(null)
  const revealTimerRef = useRef<number | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const championTimerRef = useRef<number | null>(null)
  const seenOperatorsRef = useRef<Set<ComparisonOperator>>(new Set())
  const audioRef = useRef<AudioContext | null>(null)
  const steerRef = useRef({ left: false, right: false })
  const steerStartRef = useRef({ left: 0, right: 0 })
  const turnHintRef = useRef<0 | -1 | 1>(0)
  const hazardHintRef = useRef<0 | -1 | 1>(0)
  const energyHoldRef = useRef<{ delay: number | null; interval: number | null; startedAt: number; repeated: boolean }>({ delay: null, interval: null, startedAt: 0, repeated: false })
  const initialPlanRef = useRef<ReturnType<typeof planCorridor> | null>(null)
  if (!initialPlanRef.current) initialPlanRef.current = planCorridor(START_DISTANCE, 0, planCourse())

  const game = useRef({
    depth: 0,
    gateZ: START_DISTANCE,
    gateCenter: 0,
    ...initialPlanRef.current,
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
  const isChampion = Math.max(progress.backroomRunBest, sessionGates) >= championGates
  const pace = speedForGate(phase === 'turn' || status === 'passing' ? runNumber + 1 : runNumber) / baseRunSpeed

  useEffect(() => { challengeRef.current = challenge }, [challenge])
  useEffect(() => { valueRef.current = value; game.current.value = value }, [value])
  useEffect(() => { runNumberRef.current = runNumber }, [runNumber])
  useEffect(() => { progressRef.current = progress }, [progress])
  useEffect(() => {
    if (status !== 'passing') game.current.status = status
  }, [status])

  useEffect(() => {
    if (status === 'running' || status === 'passing') screenRef.current?.focus({ preventScroll: true })
  }, [phase, status])

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
    if (championTimerRef.current) window.clearTimeout(championTimerRef.current)
    championTimerRef.current = null
    hintTimerRef.current = null
    revealTimerRef.current = null
    toastTimerRef.current = null
    if (energyHoldRef.current.delay !== null) window.clearTimeout(energyHoldRef.current.delay)
    if (energyHoldRef.current.interval !== null) window.clearInterval(energyHoldRef.current.interval)
    energyHoldRef.current.delay = null
    energyHoldRef.current.interval = null
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
    g.gateZ = g.nextGateZ
    g.gateCenter = g.nextGateCenter
    Object.assign(g, planCorridor(g.gateZ, g.gateCenter, planCourse()))
    setPhase('gate')
    g.openAmount = 0
    g.falseIntensity = 0
    g.speed = speedForGate(gateNumber)
    g.value = nextChallenge.startValue
    g.operator = nextChallenge.operator
    g.threshold = nextChallenge.threshold
    g.true = evaluateCondition(nextChallenge.startValue, nextChallenge.operator, nextChallenge.threshold)
    g.passLatched = false
    setChallenge(nextChallenge)
    setValue(nextChallenge.startValue)
    setRunNumber(gateNumber)
    setStatus('running')
    setAssistLevel(0)
    setHintOpen(false)
    setTurnHint(0)
    turnHintRef.current = 0
    setHazardHint(0)
    hazardHintRef.current = 0
    farSolveRef.current = true
    scheduleHint()
  }

  const beginTurn = () => {
    const g = game.current
    g.phase = 'turn'
    setPhase('turn')
    setStatus('running')
    setTurnHint(0)
    turnHintRef.current = 0
    playTone(420, 220, 'triangle', 0.03)
  }

  const handlePass = () => {
    const current = challengeRef.current
    setStatus('passing')
    game.current.speed = speedForGate(runNumberRef.current + 1)
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
    progressRef.current = next
    onProgress(next)
    if (runNumberRef.current === championGates) {
      setShowChampion(true)
      if (championTimerRef.current) window.clearTimeout(championTimerRef.current)
      championTimerRef.current = window.setTimeout(() => setShowChampion(false), 10000)
    }
    showToast(`+${xp} XP · PACE UP`)
    playTone(660, 180, 'square', 0.035)
  }

  const handleGateComplete = () => {
    beginTurn()
    if (runNumberRef.current === MILESTONE_GATES) {
      setStatus('milestone')
      setShowMilestone(true)
    }
  }

  const handleCrash = (reason: 'gate' | 'wall' | 'obstacle') => {
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
          g.openAmount = Math.min(1, g.openAmount + dt * Math.max(1, g.speed / baseRunSpeed) / OPEN_SECONDS)
          g.falseIntensity = Math.max(0, g.falseIntensity - dt * 2.4)
        } else {
          g.openAmount = Math.max(0, g.openAmount - dt / CLOSE_SECONDS)
          g.falseIntensity = Math.min(1, Math.max(0, (progress - 0.35) / 0.55))
          if (distance < 4.5) farSolveRef.current = false
        }
      } else {
        g.openAmount = 1
        g.falseIntensity = Math.max(0, g.falseIntensity - dt * 2.4)
      }

      const steer = (steerRef.current.left ? -1 : 0) + (steerRef.current.right ? 1 : 0)
      g.playerX += steer * (STEER_SPEED + Math.max(0, g.speed - baseRunSpeed) * 0.35) * dt
      if (g.phase === 'gate' && steer === 0 && distance > 4) {
        g.playerX += (g.gateCenter - g.playerX) * Math.min(1, dt * 2.8)
      }

      const previousDepth = g.depth
      // Keep the corridor pace through the gate, including while it opens.
      if (g.status === 'running') g.depth += dt * g.speed * 1.6

      const bend = g.phase === 'turn' ? g.bends.find((item) => g.depth >= item.startZ - 3 && g.depth < item.endZ) : undefined
      const hint = bend?.dir ?? 0
      if (hint !== turnHintRef.current) {
        turnHintRef.current = hint
        setTurnHint(hint)
      }
      const obstacle = g.phase === 'turn' ? g.obstacles[0] : undefined
      const hazard = obstacle && g.depth >= (g.bends.at(-1)?.endZ ?? 0) - 1 && obstacle.z - g.depth <= 8 && obstacle.z - g.depth > -0.4 ? -obstacle.side as -1 | 1 : 0
      if (hazard !== hazardHintRef.current) {
        hazardHintRef.current = hazard
        setHazardHint(hazard)
      }

      const center = corridorCenterAt(g.gateCenter, g.bends, g.depth)
      let offset = g.playerX - center
      if (steer !== 0 && Math.sign(offset) === steer) {
        offset = Math.sign(offset) * Math.min(Math.abs(offset), WALL_LIMIT * 0.92)
        g.playerX = center + offset
      }
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
      if (g.status === 'running' && obstacle && hitsObstacle(previousDepth, g.depth, g.playerX, obstacle)) {
        g.status = 'crashed'
        g.shake = 1
        eventsRef.current.handleCrash('obstacle')
        return
      }
      if (g.phase === 'gate' && !g.passLatched && g.status === 'running') {
        const crossing = gateCrossing(previousDepth, g.depth, g.gateZ, g.true, g.openAmount)
        if (crossing === 'blocked') {
          g.status = 'crashed'
          g.shake = 1
          eventsRef.current.handleCrash('gate')
          return
        }
        if (crossing === 'pass') {
          g.passLatched = true
          eventsRef.current.handlePass()
        }
      }
      if (g.phase === 'gate' && g.passLatched && g.depth >= g.gateZ + PASS_CLEARANCE) {
        eventsRef.current.handleGateComplete()
        return
      }
      if (g.phase === 'turn' && g.depth >= g.activationZ) {
        beginGateRef.current(runNumberRef.current + 1, g.operator)
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
        gateCenter: g.gateCenter,
        bends: g.bends,
        obstacles: g.obstacles,
        nextGateZ: g.nextGateZ,
        nextGateCenter: g.nextGateCenter,
        phase: g.phase,
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
    screenRef.current?.focus()
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
    const g = game.current
    if (g.phase !== 'gate' || g.passLatched || g.status !== 'running') return
    const clamped = Math.max(energyRange.min, Math.min(energyRange.max, Math.round(next)))
    valueRef.current = clamped
    g.value = clamped
    setValue(clamped)
  }

  const stopEnergyHold = () => {
    const hold = energyHoldRef.current
    if (hold.delay !== null) window.clearTimeout(hold.delay)
    if (hold.interval !== null) window.clearInterval(hold.interval)
    hold.delay = null
    hold.interval = null
    if (hold.repeated) window.setTimeout(() => { hold.repeated = false }, 0)
  }

  const startEnergyHold = (direction: -1 | 1) => {
    stopEnergyHold()
    const hold = energyHoldRef.current
    hold.startedAt = performance.now()
    hold.repeated = false
    hold.delay = window.setTimeout(() => {
      hold.repeated = true
      changeValue(valueRef.current + direction)
      hold.interval = window.setInterval(() => {
        const elapsed = performance.now() - hold.startedAt
        const step = elapsed > 1400 ? 3 : elapsed > 700 ? 2 : 1
        changeValue(valueRef.current + direction * step)
      }, 70)
    }, 220)
  }

  const clickEnergy = (direction: -1 | 1) => {
    if (energyHoldRef.current.repeated) {
      energyHoldRef.current.repeated = false
      return
    }
    changeValue(valueRef.current + direction)
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
    stopEnergyHold()
    if (championTimerRef.current) window.clearTimeout(championTimerRef.current)
    championTimerRef.current = null
    setShowChampion(false)
    setSessionGates(0)
    setSessionXp(0)
    setSessionOperators([])
    seenOperatorsRef.current.clear()
    setMicroReveal(null)
    setToast(null)
    setShowMilestone(false)
    steerRef.current.left = false
    steerRef.current.right = false
    const g = game.current
    g.depth = 0
    g.playerX = 0
    g.nextGateZ = START_DISTANCE
    g.nextGateCenter = 0
    g.shake = 0
    g.falseIntensity = 0
    g.openAmount = 0
    beginGate(1)
  }

  const steerDown = (direction: -1 | 1) => {
    const side = direction === -1 ? 'left' : 'right'
    if (!steerRef.current[side]) steerStartRef.current[side] = performance.now()
    steerRef.current[side] = true
  }
  const steerUp = (direction: -1 | 1) => {
    const side = direction === -1 ? 'left' : 'right'
    if (!steerRef.current[side]) return
    const heldFor = performance.now() - steerStartRef.current[side]
    steerRef.current[side] = false
    steerStartRef.current[side] = 0
    if (heldFor < 170 && game.current.status === 'running') {
      const g = game.current
      const center = corridorCenterAt(g.gateCenter, g.bends, g.depth)
      g.playerX = Math.max(center - WALL_LIMIT * 0.88, Math.min(center + WALL_LIMIT * 0.88, g.playerX + direction * 0.23))
    }
  }

  const focusScreen = (event: React.PointerEvent) => {
    const tag = (event.target as HTMLElement).tagName
    if (tag === 'BUTTON') return
    screenRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target instanceof HTMLElement ? event.target : null
    const tag = target?.tagName
    if (target?.matches('input, textarea, select') || target?.isContentEditable) return
    const key = event.key
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (game.current.status !== 'running') return
      event.preventDefault()
      steerDown(key === 'ArrowLeft' ? -1 : 1)
      return
    }
    if (key === ' ') {
      if (tag === 'BUTTON') return
      event.preventDefault()
      togglePause()
      return
    }
    if (key === 'a' || key === 'A' || key === 'ArrowDown') {
      if (game.current.status !== 'running') return
      event.preventDefault()
      changeValue(valueRef.current - 1)
    } else if (key === 'd' || key === 'D' || key === 'ArrowUp') {
      if (game.current.status !== 'running') return
      event.preventDefault()
      changeValue(valueRef.current + 1)
    }
  }

  const onKeyUp = (event: KeyboardEvent) => {
    const key = event.key
    if (key === 'ArrowLeft') steerUp(-1)
    if (key === 'ArrowRight') steerUp(1)
  }

  const keysRef = useRef({ onKeyDown, onKeyUp, stopEnergyHold })
  useEffect(() => { keysRef.current = { onKeyDown, onKeyUp, stopEnergyHold } })
  useEffect(() => {
    const down = (event: KeyboardEvent) => keysRef.current.onKeyDown(event)
    const up = (event: KeyboardEvent) => keysRef.current.onKeyUp(event)
    const release = () => {
      steerRef.current.left = false
      steerRef.current.right = false
      keysRef.current.stopEnergyHold()
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', release)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', release)
    }
  }, [])

  return <main
    ref={screenRef}
    className={`br-screen br-screen--${status} ${phase === 'turn' ? 'is-neutral' : isTrue ? 'is-true' : 'is-false'}`}
    tabIndex={0}
    onPointerDown={focusScreen}
  >
    <canvas ref={canvasRef} className="br-canvas" aria-hidden="true" />
    <div className="br-wall-warning" aria-hidden="true"><i /><i /></div>
    <div className="br-vignette" aria-hidden="true" />

    <header className="br-hud">
      {isChampion ? <BackroomChampionBadge /> : <span className="br-badge"><Footprints size={18} /> BACKROOMS RUN</span>}
      <div className="br-stats">
        <span className="br-stat"><b>RUN</b> {String(runNumber).padStart(3, '0')}</span>
        <span className="br-stat"><Zap size={14} fill="currentColor" /> XP {progress.backroomRunXp}</span>
        <span className="br-stat br-stat--pace">PACE {pace.toFixed(1)}×</span>
        <span className="br-stat br-stat--endless"><InfinityIcon size={16} /> ENDLESS</span>
      </div>
      <div className="br-actions">
        <button onClick={toggleAudio} aria-label={audioOn ? 'Turn sound off' : 'Turn sound on'}>{audioOn ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
        <button onClick={togglePause} aria-label={status === 'paused' ? 'Resume run' : 'Pause run'}>{status === 'paused' ? <Play size={17} /> : <Pause size={17} />}</button>
        <button className="br-exit" onClick={openSummary}><ArrowLeft size={15} /> CONDITIONS</button>
      </div>
    </header>

    {toast && <div className="br-toast">{toast}</div>}
    {showChampion && (status === 'running' || status === 'passing') && <BackroomChampionAward celebrate />}
    {microReveal && <div className="br-reveal" role="status"><strong>{microReveal.title}</strong><span>{microReveal.caption}</span></div>}
    <section className="br-console">
      {turnHint !== 0 && hazardHint === 0 && sessionGates < 3 && status === 'running' && <div className={`br-turn ${turnHint < 0 ? 'is-left' : 'is-right'}`} role="status">
        {turnHint < 0 ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
        <strong>TURN {turnHint < 0 ? 'LEFT' : 'RIGHT'}</strong>
      </div>}
      <div className="br-input-group br-input-group--energy" aria-label="Energy controls">
        <span className="br-control-heading">ENERGY · A / D</span>
        <div className="br-energy-controls" aria-label="Adjust energy">
          <button className="br-energy-button" aria-label="Decrease energy" disabled={phase === 'turn' || status !== 'running'} onPointerDown={(event) => { if (event.button === 0) startEnergyHold(-1) }} onPointerUp={stopEnergyHold} onPointerLeave={stopEnergyHold} onPointerCancel={stopEnergyHold} onClick={() => clickEnergy(-1)}><ChevronLeft size={30} /><span>LESS</span><kbd>A</kbd></button>
          <button className="br-energy-button" aria-label="Increase energy" disabled={phase === 'turn' || status !== 'running'} onPointerDown={(event) => { if (event.button === 0) startEnergyHold(1) }} onPointerUp={stopEnergyHold} onPointerLeave={stopEnergyHold} onPointerCancel={stopEnergyHold} onClick={() => clickEnergy(1)}><ChevronRight size={30} /><span>MORE</span><kbd>D</kbd></button>
        </div>
      </div>
      <div className="br-panel">
        <div className="br-readouts">
          <div className="br-condition" aria-label={phase === 'turn' ? `Next gate ${runNumber + 1}` : `Condition: ${challenge.variableName} ${challenge.operator} ${challenge.threshold}`}>
            {phase === 'turn' ? <><b>NEXT GATE</b><strong>{String(runNumber + 1).padStart(2, '0')}</strong></> : <><b>{challenge.variableName}</b><span className="br-operator">{challenge.operator}</span><strong>{challenge.threshold}</strong></>}
          </div>
          <div className="br-variable"><span>energy =</span><strong>{value}</strong><small>{phase === 'turn' ? 'TRAVEL' : isTrue ? 'TRUE' : 'FALSE'}</small></div>
        </div>
        <div className="br-energy-gauge" role="meter" aria-label="Energy" aria-valuemin={energyRange.min} aria-valuemax={energyRange.max} aria-valuenow={value}>
          <span className="br-energy-gauge__title">ENERGY / 100</span>
          <div className="br-energy-gauge__track"><i style={{ width: `${value}%` }} />{phase === 'gate' && assistLevel > 0 && <b style={{ left: `${challenge.threshold}%` }} />}</div>
        </div>
        <div className="br-below">
          <p className="br-instruction">{phase === 'turn' ? 'GATE CLEARED. FOLLOW THE CORRIDOR.' : firstGate ? 'RAISE ENERGY. MAKE IT TRUE.' : 'SET ENERGY TO MAKE IT TRUE'}</p>
          <button className="br-hint-button" disabled={phase === 'turn' || status !== 'running'} onClick={openHint}><Lightbulb size={15} /> HINT</button>
        </div>
        {hintOpen && <p className="br-hint" role="status"><Lightbulb size={15} /> {challenge.hint}</p>}
      </div>
      <div className={`br-steer ${turnHint === -1 ? 'is-left' : turnHint === 1 ? 'is-right' : ''} ${hazardHint === -1 ? 'avoid-left' : hazardHint === 1 ? 'avoid-right' : ''}`} aria-label="Corridor steering">
        <span className="br-control-heading">{hazardHint === 0 ? 'MOVE · ← / →' : `DODGE ${hazardHint < 0 ? 'LEFT' : 'RIGHT'}`}</span>
        <div className="br-steer-buttons">
          <button
            className="br-steer-button"
            aria-label="Move left"
            onPointerDown={() => steerDown(-1)}
            onPointerUp={() => steerUp(-1)}
            onPointerLeave={() => steerUp(-1)}
            onPointerCancel={() => steerUp(-1)}
            onContextMenu={(event) => event.preventDefault()}
          ><ChevronLeft size={30} /><kbd>←</kbd></button>
          <button
            className="br-steer-button"
            aria-label="Move right"
            onPointerDown={() => steerDown(1)}
            onPointerUp={() => steerUp(1)}
            onPointerLeave={() => steerUp(1)}
            onPointerCancel={() => steerUp(1)}
            onContextMenu={(event) => event.preventDefault()}
          ><ChevronRight size={30} /><kbd>→</kbd></button>
        </div>
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
      {isChampion && <BackroomChampionAward />}
      <h2>{crashReason === 'wall' ? 'YOU HIT THE WALL' : crashReason === 'obstacle' ? 'YOU HIT AN OBSTACLE' : 'THE GATE STAYED CLOSED'}</h2>
      <p>{crashReason === 'wall'
        ? 'The corridor turned. Use the left and right arrow keys to follow it.'
        : crashReason === 'obstacle'
          ? 'Watch the floor ahead. Use the left and right arrow keys to move around chairs and trash.'
          : game.current.true
            ? <>The condition was <b className="is-true">TRUE</b>, but you reached the gate before it finished opening. Change the energy earlier and keep running.</>
            : <>The condition was <b className="is-false">FALSE</b>, so the gate never opened. Check the energy value, then try again.</>}</p>
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
      {isChampion && <BackroomChampionAward />}
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
