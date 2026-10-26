import { ArrowLeft, BatteryFull, ChevronDown, ChevronLeft, ChevronRight, ChevronsUp, ChevronUp, Lightbulb, Pause, Play, RotateCcw, SkipForward, ToggleLeft, ToggleRight, Volume2, VolumeX, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  baseRunSpeed, championGates, clearHeight, comparisonOperators, conditionCode, corridorCenterAt, correctForkSide, energyRange, evaluateGate, explainGate,
  forkLaneOffset, forkSide, gateBool, gateOperators, gateSkills, gateUsesEnergy, gateXp, generateEndlessGate, hitsObstacle, jumpOffset, jumpSeconds, mulberry32, picksUp, pythonBool,
  planCorridor, planCourse, sawEmerge, drillStrike, drillWarn, edgeValues, speedForGate, speedForLevelGate, type BackroomGate, type ComparisonOperator, type CorridorHazard, type CorridorObstacle, type CorridorPickup, type GateExplanation, type GateValues,
} from './backroomEngine'
import { backroomLevels, batteryChance, endlessUnlocked, hazardChance, hazardsFor, levelUnlocked, maxBatteries, nextLevelIndex, normalizeStars, starsFor, type CoachMoment } from './backroomLevels'
import { BackroomAudio, loadAudioPreference, saveAudioPreference } from './backroomAudio'
import { createBackroomRenderer, type BackroomEntity, type BackroomView, type GateSignal } from './backroomRenderer'
import { advanceBackroomLighting, createBackroomLighting } from './backroomLighting'
import { isGuestName, loadBackroomScores, playerKey, rememberBackroomScore, type BackroomScore } from './backroomScores'
import { BackroomMenu, Stars } from './BackroomMenu'
import { CodePanel, CodeTokens, type CodeTruth } from './BackroomCode'
import { BackroomChampionAward, BackroomChampionBadge } from './BackroomChampion'
import { TapeDeck } from './BackroomTape'
import type { TapeCue, TapeKind, TapeLabel } from './tapeTimeline'
import type { BackroomProgress, SkillRecord } from './types'
import './backroomRun.css'

interface Props {
  progress: BackroomProgress
  onProgress: (progress: BackroomProgress) => void
  onBack: () => void
  paused?: boolean
}

type Mode = { type: 'level'; index: number } | { type: 'endless' }
type Status = 'menu' | 'loading' | 'briefing' | 'entering' | 'running' | 'coach' | 'paused' | 'mistake' | 'levelClear' | 'gameOver'
type Tape = { kind: TapeKind; label: TapeLabel; shelf: TapeLabel[]; slot: number; then: 'briefing' | 'running'; key: number }
type MistakeReason = 'closed' | 'wrong-door' | 'pillar'
// Steering hint: dodge left or right, or 2 for a barrier or hole to jump.
type Hazard = 0 | -1 | 1 | 2
// What ends a run on the spot: walls, anything on the floor and the holes.
type Crash = 'wall' | CorridorObstacle['kind']

interface Mistake {
  gate: BackroomGate
  values: GateValues
  explanation: GateExplanation
  reason: MistakeReason
  chosenSide: -1 | 0 | 1
  trueSide: -1 | 1
  livesLeft: number
  // A gate missed with the camcorder already dead ends the run.
  final: boolean
}

interface RunResult {
  mode: Mode
  cleared: boolean
  gates: number
  totalGates: number
  xp: number
  mistakes: Mistake[]
  bestCombo: number
  stars: number
  newBest: boolean
  crash: Crash | null
  // Tapes only: pick the run up again just before this gate.
  resume: Resume | null
}

// Continuing a tape from a gate keeps what the run had earned so far.
interface Resume {
  gate: number
  lives: number
  xp: number
  gates: number
  mistakes: Mistake[]
  crashes: number
  bestCombo: number
}

interface Coach {
  moment: CoachMoment
  satisfied: boolean
  direction?: -1 | 1
}

const START_DISTANCE = 13
const LOCK_DISTANCE = 1.6
const PASS_CLEARANCE = 1.8
const STEER_SPEED = 0.72
const WALL_LIMIT = 0.74
const SEED_BASE = 20260214
// The entry door takes this long to swing open before the run starts.
const ENTRY_SECONDS = 1.35
// Old saves played the original single-gate game; past five gates they know the basics.
const LEGACY_TUTORIAL_GATES = 5

const timecode = (seconds: number) => {
  const whole = Math.floor(seconds)
  return `${String(Math.floor(whole / 3600)).padStart(2, '0')}:${String(Math.floor(whole / 60) % 60).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

const sideWord = (side: number) => side < 0 ? 'LEFT' : 'RIGHT'

// The camcorder's video light runs on the batteries: full beam, dimmer, flickering, then dark.
// The camcorder's video light runs on the batteries. On the last battery it saves power:
// a weak beam and NIGHTSHOT (the infrared lamp) take over.
const cameraLightFor = (lives: number) => {
  if (lives >= maxBatteries) return 1
  if (lives === 2) return 0.74
  if (lives === 1) return 0.3
  return 0
}

const crashCopy: Record<Crash, { title: string; body: string }> = {
  wall: { title: 'YOU TOUCHED THE WALL', body: 'In here the walls take you. Steer early and stay in the middle of the corridor.' },
  chair: { title: 'YOU HIT A CHAIR', body: 'Anything on the floor ends the run. Steer around it before you reach it.' },
  trash: { title: 'YOU HIT A BIN', body: 'Anything on the floor ends the run. Steer around it before you reach it.' },
  barrier: { title: 'YOU HIT THE BARRIER', body: 'Barriers block the whole corridor. Press SPACE (or JUMP) just before it.' },
  hole: { title: 'YOU FELL', body: 'Holes go down forever. Jump just before the edge and stay in the air all the way across.' },
  drill: { title: 'THE DRILL GOT YOU', body: 'A drill comes down from the ceiling or up through the floor in one lane. Watch for the red mark or the glowing cracks and steer into a free lane.' },
  saw: { title: 'THE SAW GOT YOU', body: 'Saws come out of one wall and cover that half. Move to the other side as soon as one appears; jumping does not help.' },
}

function createGameState() {
  return {
    depth: 0,
    gateZ: START_DISTANCE,
    gateCenter: 0,
    bends: [] as ReturnType<typeof planCorridor>['bends'],
    obstacles: [] as ReturnType<typeof planCorridor>['obstacles'],
    pickups: [] as CorridorPickup[],
    nextGateZ: START_DISTANCE,
    nextGateCenter: 0,
    activationZ: 0,
    phase: 'gate' as 'gate' | 'turn',
    playerX: 0,
    gate: null as BackroomGate | null,
    nextGate: null as BackroomGate | null,
    nextTrueSide: 1 as -1 | 1,
    values: { energy: 50, flag: false } as GateValues,
    truth: false,
    resolved: 'none' as 'none' | 'pass' | 'fail',
    trueSide: 1 as -1 | 1,
    openAmount: 0,
    doorOpen: [0, 0] as [number, number],
    flashSide: 0 as -1 | 0 | 1,
    speed: baseRunSpeed,
    slow: 0,
    wallContact: false,
    falseIntensity: 0,
    time: 0,
    lighting: createBackroomLighting(),
    lightsActive: false,
    blackoutFor: 0,
    nightVision: 0,
    entity: null as BackroomEntity | null,
    glitch: 0,
    shake: 0,
    stepDistance: 0,
    // Seconds into the current jump, or -1 on the ground.
    jumpT: -1,
    jump: 0,
    steer: 0,
    status: 'menu' as Status,
    reduced: false,
    menu: true,
    // The door into Level 0: 0 shut, 1 open.
    entry: 0,
    entryT: 0,
    // A crash plays out before the run ends: the impact, or the fall.
    dying: null as { crash: Crash; t: number } | null,
    fall: 0,
    // The camcorder's video light, from the batteries left.
    cameraLight: 1,
    // Saws already heard coming out of the wall, and drills already marked and struck.
    sawsHeard: [] as number[],
    drillsWarned: [] as number[],
    drillsStruck: [] as number[],
  }
}

export function BackroomRun({ progress, onProgress, onBack, paused = false }: Props) {
  const [status, setStatus] = useState<Status>('menu')
  const [mode, setMode] = useState<Mode>({ type: 'level', index: 0 })
  const [gate, setGate] = useState<BackroomGate | null>(null)
  const [values, setValues] = useState<GateValues>({ energy: 50, flag: false })
  const [trueSide, setTrueSide] = useState<-1 | 1>(1)
  const [phase, setPhase] = useState<'gate' | 'turn'>('gate')
  const [gateNumber, setGateNumber] = useState(1)
  const [lives, setLives] = useState(maxBatteries)
  const [xp, setXp] = useState(0)
  const [combo, setCombo] = useState(0)
  const [clock, setClock] = useState(0)
  const [coach, setCoachState] = useState<Coach | null>(null)
  const [mistake, setMistake] = useState<Mistake | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)
  const [toast, setToast] = useState<{ text: string; tone: 'good' | 'bad' | 'info' } | null>(null)
  const [reveal, setReveal] = useState<{ code: string; result: boolean; note: string } | null>(null)
  const [turnHint, setTurnHint] = useState<0 | -1 | 1>(0)
  const [hazardHint, setHazardHint] = useState<Hazard>(0)
  const [pace, setPace] = useState(1)
  const [nightshot, setNightshot] = useState(false)
  const [audioOn, setAudioOn] = useState(loadAudioPreference)
  const [scores, setScores] = useState<BackroomScore[]>([])
  // Guests type a name before playing, so their runs in The Deep reach the top scores.
  const askName = !progress.isTeacher && isGuestName(progress.name)
  const [player, setPlayer] = useState<string | null>(askName ? null : progress.name)
  const playerRef = useRef(player)
  playerRef.current = player
  const scoreId = askName ? (player ? playerKey(player) : '') : progress.username
  const [showChampion, setShowChampion] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  // The choice locks just before the gate; controls show it.
  const [locked, setLocked] = useState(false)
  // Every run starts by loading its tape; a retry rewinds it instead.
  const [tape, setTape] = useState<Tape | null>(null)
  const tapeRef = useRef<Tape | null>(null)
  // The tape a clear just opened: it waits on the shelf with a NEW sticker.
  const [freshTape, setFreshTape] = useState<number | null>(null)
  const [dateStamp] = useState(() => { const now = new Date(); return `${now.toLocaleString('en-US', { month: 'short' }).toUpperCase()}.${now.getDate()} ${now.getFullYear()}` })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const screenRef = useRef<HTMLElement>(null)
  const game = useRef(createGameState())
  const progressRef = useRef(progress)
  const audio = useRef<BackroomAudio | null>(null)
  if (!audio.current) audio.current = new BackroomAudio()
  const run = useRef({
    mode: { type: 'level', index: 0 } as Mode,
    gateNumber: 1,
    lives: maxBatteries,
    combo: 0,
    bestCombo: 0,
    xp: 0,
    gates: 0,
    mistakes: [] as Mistake[],
    clock: 0,
    random: Math.random,
    coachDone: new Set<CoachMoment>(),
    coachAllowed: false,
    bestAtStart: 0,
    // Crashes count against the stars like mistakes do.
    crashes: 0,
  })
  const steerRef = useRef({ left: false, right: false })
  const steerStartRef = useRef({ left: 0, right: 0 })
  const turnHintRef = useRef<0 | -1 | 1>(0)
  const hazardHintRef = useRef<Hazard>(0)
  const timers = useRef<number[]>([])
  const toastTimer = useRef<number | null>(null)
  const revealTimer = useRef<number | null>(null)
  const coachTimer = useRef<number | null>(null)
  const coachRef = useRef<Coach | null>(null)
  const setCoach = (next: Coach | null) => { coachRef.current = next; setCoachState(next) }
  const energyHold = useRef<{ delay: number | null; interval: number | null; startedAt: number; repeated: boolean }>({ delay: null, interval: null, startedAt: 0, repeated: false })

  const stars = normalizeStars(progress.levelStars)
  const champion = progress.backroomRunBest >= championGates
  const level = mode.type === 'level' ? backroomLevels[mode.index] : null

  useEffect(() => { progressRef.current = progress }, [progress])

  useEffect(() => {
    if (status === 'menu') loadBackroomScores(rememberBackroomScore(progressRef.current), setScores)
  }, [status])

  useEffect(() => {
    if (status === 'running' || status === 'coach') screenRef.current?.focus({ preventScroll: true })
  }, [status, phase])

  const later = (callback: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((item) => item !== id)
      callback()
    }, ms)
    timers.current.push(id)
    return id
  }

  const showToast = (text: string, tone: 'good' | 'bad' | 'info' = 'good') => {
    setToast({ text, tone })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 1500)
  }

  const commit = (change: (current: BackroomProgress) => BackroomProgress) => {
    const next = change(progressRef.current)
    progressRef.current = next
    onProgress(next)
  }

  const recordSkills = (target: BackroomGate, right: boolean) => {
    commit((current) => {
      const skills: SkillRecord = { ...current.skills }
      for (const skill of gateSkills(target)) {
        const record = skills[skill] ?? { right: 0, wrong: 0 }
        skills[skill] = right ? { ...record, right: record.right + 1 } : { ...record, wrong: record.wrong + 1 }
      }
      const operators = [...new Set([...current.backroomRunOperators, ...gateOperators(target)])].filter((operator): operator is ComparisonOperator => comparisonOperators.includes(operator))
      return { ...current, skills, backroomRunOperators: operators, backroomRunGates: current.backroomRunGates + (right ? 1 : 0) }
    })
  }

  const stopEnergyHold = () => {
    const hold = energyHold.current
    if (hold.delay !== null) window.clearTimeout(hold.delay)
    if (hold.interval !== null) window.clearInterval(hold.interval)
    hold.delay = null
    hold.interval = null
    if (hold.repeated) window.setTimeout(() => { hold.repeated = false }, 0)
  }

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    for (const ref of [toastTimer, revealTimer, coachTimer]) {
      if (ref.current) window.clearTimeout(ref.current)
      ref.current = null
    }
    stopEnergyHold()
  }

  const setGameStatus = (next: Status) => {
    game.current.status = next
    setStatus(next)
  }

  const gateFor = (number: number, previous: BackroomGate | null): BackroomGate | null => {
    const current = run.current.mode
    if (current.type === 'level') return backroomLevels[current.index].gates[number - 1] ?? null
    return generateEndlessGate(number, run.current.random, previous ?? undefined, progressRef.current.skills)
  }

  const speedFor = (number: number) => {
    const current = run.current.mode
    return current.type === 'level' ? speedForLevelGate(backroomLevels[current.index].speed, number) : speedForGate(number)
  }

  // The fluorescents are dead now: no flicker or blackout events.
  const lightsActiveFor = () => false

  const syncHud = () => {
    const g = game.current
    setGate(g.gate)
    setValues({ ...g.values })
    setTrueSide(g.trueSide)
    setGateNumber(run.current.gateNumber)
    setPhase(g.phase)
  }

  const beginGate = () => {
    const g = game.current
    const r = run.current
    const nextGate = g.nextGate
    if (!nextGate) return
    g.phase = 'gate'
    g.gate = nextGate
    g.gateZ = g.nextGateZ
    g.gateCenter = g.nextGateCenter
    const levelIndex = r.mode.type === 'level' ? r.mode.index : null
    // Hazards: up to two per corridor, from what the tape allows. The rolls are always drawn so seeds stay stable.
    const rolls = [r.random(), r.random(), r.random(), r.random(), r.random(), r.random(), r.random()]
    const allowed = hazardsFor(levelIndex, r.gateNumber)
    const kind = (roll: number, sideRoll: number, slot: number): CorridorHazard | null => {
      if (allowed.length === 0) return null
      // Tapes cycle through every hazard they allow, so each one shows up; The Deep rolls for it.
      const pick = levelIndex !== null ? allowed[(r.gateNumber + slot) % allowed.length] : allowed[Math.floor(roll * allowed.length)]
      if (pick === 'saw') return sideRoll < 0.5 ? 'saw-left' : 'saw-right'
      if (pick === 'drill') return `drill-${sideRoll < 0.5 ? 'ceiling' : 'floor'}-${(['left', 'middle', 'right'] as const)[Math.floor(((sideRoll * 6) % 1) * 3)]}`
      return pick
    }
    const jumps = [
      rolls[0] < hazardChance(levelIndex, r.gateNumber, 0) ? kind(rolls[1], rolls[5], 0) : null,
      rolls[2] < hazardChance(levelIndex, r.gateNumber, 1) ? kind(rolls[3], rolls[6], 1) : null,
    ]
    Object.assign(g, planCorridor(g.gateZ, g.gateCenter, planCourse(), jumps, rolls[4] < batteryChance(r.lives)))
    g.values = { ...nextGate.start }
    g.truth = evaluateGate(nextGate, g.values)
    g.trueSide = g.nextTrueSide
    g.resolved = 'none'
    g.openAmount = 0
    g.doorOpen = [0, 0]
    g.flashSide = 0
    g.falseIntensity = 0
    g.speed = speedFor(r.gateNumber)
    // Pace is shown against the run's opening speed, so every run starts at 1.0x.
    setPace(g.speed / speedFor(1))
    g.nextGate = null
    setLocked(false)
    setHintOpen(false)
    setTurnHint(0)
    turnHintRef.current = 0
    setHazardHint(0)
    hazardHintRef.current = 0
    syncHud()
  }

  const prepareNext = (number: number) => {
    const g = game.current
    g.nextGate = gateFor(number, g.gate)
    g.nextTrueSide = run.current.random() < 0.5 ? -1 : 1
  }

  const beginTurn = () => {
    const g = game.current
    g.phase = 'turn'
    prepareNext(run.current.gateNumber + 1)
    setPhase('turn')
    setTurnHint(0)
    turnHintRef.current = 0
  }

  const resetWorld = () => {
    const g = game.current
    const reduced = g.reduced
    Object.assign(g, createGameState())
    g.reduced = reduced
    g.menu = false
  }

  // quick: straight back into the run, as after losing a tape.
  const startMode = (next: Mode, quick = false, resume: Resume | null = null) => {
    clearTimers()
    resetWorld()
    const seed = next.type === 'endless' ? (Date.now() ^ SEED_BASE) >>> 0 : SEED_BASE + (next.type === 'level' ? next.index : 0)
    const tutorialDone = progressRef.current.levelStars[0] > 0 || progressRef.current.backroomRunBest >= LEGACY_TUTORIAL_GATES
    const levelCleared = next.type === 'level' && (progressRef.current.levelStars[next.index] ?? 0) > 0
    run.current = {
      mode: next,
      gateNumber: 1,
      lives: maxBatteries,
      combo: 0,
      bestCombo: 0,
      xp: 0,
      gates: 0,
      mistakes: [],
      clock: 0,
      random: mulberry32(seed),
      coachDone: new Set(progressRef.current.coachSeen ?? []),
      coachAllowed: next.type === 'level' && !levelCleared && !(next.index === 0 && tutorialDone),
      bestAtStart: progressRef.current.backroomRunBest,
      crashes: 0,
    }
    if (resume) Object.assign(run.current, { gateNumber: resume.gate, lives: resume.lives, xp: resume.xp, gates: resume.gates, mistakes: resume.mistakes, crashes: resume.crashes, bestCombo: resume.bestCombo })
    const g = game.current
    g.nextGateZ = START_DISTANCE
    g.nextGateCenter = 0
    prepareNext(run.current.gateNumber)
    beginGate()
    g.lightsActive = lightsActiveFor()
    setMode(next)
    setLives(run.current.lives)
    setXp(run.current.xp)
    setCombo(0)
    setClock(0)
    setCoach(null)
    setMistake(null)
    setResult(null)
    setReveal(null)
    setToast(null)
    setNightshot(false)
    setShowChampion(false)
    steerRef.current = { left: false, right: false }
    const tapeLevel = next.type === 'level' ? backroomLevels[next.index] : null
    const label: TapeLabel = tapeLevel
      ? { number: String(tapeLevel.id).padStart(2, '0'), title: tapeLevel.title, focus: tapeLevel.focus, stars: normalizeStars(progressRef.current.levelStars)[next.type === 'level' ? next.index : 0], deep: false, tip: `${tapeLevel.examples[0].code} → ${tapeLevel.examples[0].result ? 'TRUE' : 'FALSE'}` }
      : { number: '∞', title: 'THE DEEP', focus: 'ENDLESS · EVERY GATE', stars: 0, deep: true, tip: '70 >= 70 → TRUE' }
    const starsNow = normalizeStars(progressRef.current.levelStars)
    const unlockAll = progressRef.current.unlockAll ?? progressRef.current.isTeacher
    const shelf: TapeLabel[] = [
      ...backroomLevels.map((item, index) => ({ number: String(item.id).padStart(2, '0'), title: item.title, focus: item.focus, stars: starsNow[index], deep: false, locked: !levelUnlocked(index, starsNow, unlockAll) })),
      { number: '∞', title: 'THE DEEP', focus: 'ENDLESS · EVERY GATE', stars: 0, deep: true, locked: !endlessUnlocked(starsNow, unlockAll) },
    ]
    if (!quick) setFreshTape(null)
    const loaded: Tape = { kind: quick ? 'rewind' : 'insert', label, shelf, slot: next.type === 'level' ? next.index : backroomLevels.length, then: quick ? 'running' : 'briefing', key: Date.now() }
    tapeRef.current = loaded
    setTape(loaded)
    // Choosing a tape is a tap, so the deck may already make its sounds.
    if (audioOn) audio.current?.enable()
    setGameStatus('loading')
  }

  const tapeCue = (cue: TapeCue) => {
    const sound = audio.current
    if (!sound) return
    const play: Partial<Record<TapeCue, () => void>> = {
      pull: () => sound.tapeInsert(), eject: () => sound.tapeEject(), insert: () => sound.tapeInsert(), seat: () => sound.tapeSeat(), clack: () => sound.tapeClack(),
      motor: () => sound.tapeMotor(), play: () => sound.tapePlay(), static: () => sound.tapeStatic(), rewind: () => sound.tapeRewind(),
    }
    play[cue]?.()
  }

  const finishTape = () => {
    if (game.current.status !== 'loading') return
    const then = tapeRef.current?.then ?? 'briefing'
    tapeRef.current = null
    setTape(null)
    if (then === 'running') enterLevel()
    else setGameStatus('briefing')
  }

  // The door into Level 0 swings open, then the run starts on its own.
  const enterLevel = () => {
    enableAudioFromGesture()
    const g = game.current
    g.entry = 0
    g.entryT = 0
    audio.current?.entryDoor()
    setGameStatus('entering')
    screenRef.current?.focus()
  }

  const startRunning = () => {
    if (game.current.status !== 'entering') return
    setGameStatus('running')
    screenRef.current?.focus()
  }

  const enableAudioFromGesture = () => {
    if (!audioOn) return
    audio.current?.enable()
    audio.current?.startHum()
  }

  const launch = () => enterLevel()

  const toMenu = () => {
    clearTimers()
    resetWorld()
    game.current.menu = true
    audio.current?.stopHum()
    setCoach(null)
    setMistake(null)
    setResult(null)
    setNightshot(false)
    setGameStatus('menu')
  }

  const finishRun = (cleared: boolean, crash: Crash | null = null) => {
    const r = run.current
    const g = game.current
    if (g.status === 'levelClear' || g.status === 'gameOver') return
    const current = r.mode
    const levelStars = current.type === 'level' && cleared ? starsFor(r.mistakes.length + r.crashes) : 0
    // A first clear opens the next tape on the shelf.
    if (current.type === 'level' && cleared && (normalizeStars(progressRef.current.levelStars)[current.index] ?? 0) === 0) setFreshTape(current.index + 1)
    const bonus = levelStars * 10
    r.xp += bonus
    setXp(r.xp)
    const before = progressRef.current
    const newBest = current.type === 'endless' ? r.gates > r.bestAtStart : r.xp > before.backroomRunXp
    commit((p) => {
      const nextStars = normalizeStars(p.levelStars)
      if (current.type === 'level' && cleared) nextStars[current.index] = Math.max(nextStars[current.index], levelStars)
      return {
        ...p,
        levelStars: nextStars,
        backroomRunXp: Math.max(p.backroomRunXp, r.xp),
        backroomRunBest: current.type === 'endless' ? Math.max(p.backroomRunBest, r.gates) : p.backroomRunBest,
      }
    })
    if (current.type === 'endless') {
      const entry = playerRef.current && !progressRef.current.isTeacher ? { username: askName ? playerKey(playerRef.current) : progressRef.current.username, name: playerRef.current, gates: r.gates, xp: r.xp } : undefined
      loadBackroomScores(rememberBackroomScore(progressRef.current, askName ? entry : undefined), setScores)
    }
    setResult({
      mode: current,
      cleared,
      gates: r.gates,
      totalGates: current.type === 'level' ? backroomLevels[current.index].gates.length : r.gates,
      xp: r.xp,
      mistakes: r.mistakes,
      bestCombo: r.bestCombo,
      stars: levelStars,
      newBest,
      crash,
      // A lost tape can go on from the gate it was heading for.
      resume: !cleared && current.type === 'level' ? {
        gate: Math.min(backroomLevels[current.index].gates.length, g.phase === 'turn' ? r.gateNumber + 1 : r.gateNumber),
        lives: Math.max(1, r.lives), xp: r.xp, gates: r.gates, mistakes: r.mistakes, crashes: r.crashes + (crash ? 1 : 0), bestCombo: r.bestCombo,
      } : null,
    })
    g.glitch = cleared ? 0 : 1
    audio.current?.stopHum()
    if (cleared) audio.current?.clear()
    setGameStatus(cleared ? 'levelClear' : 'gameOver')
  }

  const afterGate = () => {
    const r = run.current
    const current = r.mode
    if (current.type === 'level' && r.gateNumber >= backroomLevels[current.index].gates.length) {
      finishRun(true)
      return
    }
    beginTurn()
  }

  const handlePass = () => {
    const g = game.current
    const r = run.current
    const target = g.gate!
    r.combo += 1
    r.bestCombo = Math.max(r.bestCombo, r.combo)
    // Opening a gate with the value right on the edge shows the operator was understood.
    const compare = target.clauses[0]
    const onEdge = target.kind === 'set' && compare?.type === 'compare' && edgeValues(compare.operator, compare.threshold).includes(g.values.energy)
    const earned = gateXp(r.combo) + (onEdge ? 5 : 0)
    r.xp += earned
    r.gates += 1
    setCombo(r.combo)
    setXp(r.xp)
    recordSkills(target, true)
    const explanation = explainGate(target, g.values)
    const last = explanation.steps[explanation.steps.length - 1]
    setReveal({
      code: last.code,
      result: explanation.result,
      note: target.kind === 'fork' ? `${explanation.result ? 'TRUE' : 'FALSE'} DOOR` : onEdge ? 'ON THE EDGE · +5 XP' : 'GATE OPEN',
    })
    if (revealTimer.current) window.clearTimeout(revealTimer.current)
    revealTimer.current = window.setTimeout(() => setReveal(null), 1700)
    showToast(`+${earned} XP${onEdge ? ' · EDGE BONUS' : ''} · PACE UP${r.combo >= 3 ? ` · COMBO ${r.combo}` : ''}`)
    audio.current?.doorOpen()
    audio.current?.correct()
    if (r.combo === 3 || r.combo === 6) audio.current?.combo()
    if (r.mode.type === 'endless') {
      commit((p) => ({ ...p, backroomRunBest: Math.max(p.backroomRunBest, r.gates), backroomRunXp: Math.max(p.backroomRunXp, r.xp) }))
      if (r.gates === championGates) {
        setShowChampion(true)
        later(() => setShowChampion(false), 10000)
      }
    }
  }

  const handleMistake = (reason: MistakeReason, chosenSide: -1 | 0 | 1) => {
    const g = game.current
    const r = run.current
    const target = g.gate!
    // With the camera already dead there is nothing left to lose: the run ends.
    const final = r.lives <= 0
    r.lives = Math.max(0, r.lives - 1)
    r.combo = 0
    if (r.lives === 0 && !final) ensureBattery()
    const entry: Mistake = { gate: target, values: { ...g.values }, explanation: explainGate(target, g.values), reason, chosenSide, trueSide: g.trueSide, livesLeft: r.lives, final }
    r.mistakes = [...r.mistakes, entry]
    setLives(r.lives)
    setCombo(0)
    setMistake(entry)
    recordSkills(target, false)
    g.shake = 1
    g.glitch = 1
    steerRef.current = { left: false, right: false }
    stopEnergyHold()
    audio.current?.slam()
    audio.current?.mistake()
    setGameStatus('mistake')
  }

  const continueAfterMistake = () => {
    const g = game.current
    if (mistake?.final) {
      finishRun(false)
      return
    }
    g.resolved = 'pass'
    g.flashSide = 0
    if (g.gate?.kind === 'fork') g.playerX = g.gateCenter + correctForkSide(g.truth, g.trueSide) * forkLaneOffset
    setMistake(null)
    setGameStatus('running')
    screenRef.current?.focus()
  }

  const resolveGate = () => {
    const g = game.current
    const target = g.gate!
    setLocked(true)
    if (target.kind === 'set') {
      if (g.truth) {
        g.resolved = 'pass'
        handlePass()
      } else {
        g.resolved = 'fail'
        handleMistake('closed', 0)
      }
      return
    }
    const side = forkSide(g.playerX, g.gateCenter)
    const correct = correctForkSide(g.truth, g.trueSide)
    if (side === correct) {
      g.resolved = 'pass'
      handlePass()
    } else {
      g.resolved = 'fail'
      g.flashSide = side
      handleMistake(side === 0 ? 'pillar' : 'wrong-door', side)
    }
  }

  const openCoach = (moment: CoachMoment, direction?: -1 | 1) => {
    run.current.coachDone.add(moment)
    if (!(progressRef.current.coachSeen ?? []).includes(moment)) commit((p) => ({ ...p, coachSeen: [...(p.coachSeen ?? []), moment] }))
    steerRef.current = { left: false, right: false }
    setCoach({ moment, satisfied: false, direction })
    setGameStatus('coach')
  }

  const closeCoach = () => {
    if (coachTimer.current) window.clearTimeout(coachTimer.current)
    coachTimer.current = null
    setCoach(null)
    if (game.current.status === 'coach') setGameStatus('running')
  }

  // Coach moments that wait for a TRUE condition resume shortly after it turns TRUE.
  const checkCoach = () => {
    const g = game.current
    const current = coachRef.current
    if (g.status !== 'coach' || !g.gate || !current || current.satisfied || current.moment !== 'energy') return
    if (!evaluateGate(g.gate, g.values)) return
    setCoach({ ...current, satisfied: true })
    coachTimer.current = window.setTimeout(closeCoach, 1100)
  }

  // Walls, furniture, barriers and holes end the run on the spot.
  const crash = (kind: Crash) => {
    const g = game.current
    if (g.dying) return
    g.dying = { crash: kind, t: 0 }
    g.shake = 1
    g.glitch = 1
    steerRef.current = { left: false, right: false }
    stopEnergyHold()
    run.current.combo = 0
    setCombo(0)
    if (kind === 'hole') audio.current?.fall()
    else audio.current?.slam()
    audio.current?.mistake()
  }

  // The camera never dies without a spare battery somewhere ahead.
  const ensureBattery = () => {
    const g = game.current
    const last = g.bends[g.bends.length - 1]
    if (!last || g.pickups.some((item) => item.z > g.depth)) return
    const chair = g.obstacles.find((item) => item.kind === 'chair' || item.kind === 'trash')
    const z = Math.max(last.endZ + 3, g.depth + 6)
    g.pickups = [...g.pickups, { z, x: corridorCenterAt(g.gateCenter, g.bends, z) - (chair?.side ?? 1) * 0.22 }]
  }

  const collectBattery = (pickup: CorridorPickup) => {
    const g = game.current
    const r = run.current
    g.pickups = g.pickups.filter((item) => item !== pickup)
    const wasDead = r.lives <= 0
    r.lives = Math.min(maxBatteries, r.lives + 1)
    setLives(r.lives)
    audio.current?.battery()
    showToast(wasDead ? 'BATTERY IN · CAMERA ON' : `BATTERY +1 · ${r.lives}/${maxBatteries}`, 'info')
  }

  const lowPower = () => showToast('LAST BATTERY · NIGHTSHOT ON', 'bad')
  const events = useRef({ beginGate, afterGate, resolveGate, openCoach, crash, collectBattery, finishRun, startRunning, setClock, setNightshot, lowPower })
  useEffect(() => { events.current = { beginGate, afterGate, resolveGate, openCoach, crash, collectBattery, finishRun, startRunning, setClock, setNightshot, lowPower } })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const view = createBackroomRenderer(canvas)
    const g = game.current
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const motionPreference = () => { g.reduced = !!media?.matches }
    motionPreference()
    media?.addEventListener?.('change', motionPreference)
    let frame = 0
    let last = performance.now()

    const resize = () => view.resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(canvas)

    const atmosphere = (dt: number, lightsActive: boolean, canBlackout: boolean) => {
      const previousMode = g.lighting.mode
      advanceBackroomLighting(g.lighting, dt, canBlackout, g.reduced || !lightsActive)
      if (previousMode === 'steady' && g.lighting.mode !== 'steady') {
        if (g.lighting.mode === 'blackout') audio.current?.blackout()
        const lowBattery = run.current.lives === 1 && !g.menu
        if (!g.entity && Math.random() < (lowBattery ? 0.85 : 0.5)) {
          const z = g.depth + 17 + Math.random() * 5
          g.entity = { z, x: corridorCenterAt(g.gateCenter, g.bends, z) + (Math.random() - 0.5) * 0.5, alpha: 0 }
          audio.current?.presence()
        }
      }
      g.blackoutFor = g.lighting.mode === 'blackout' && g.lighting.strength < 0.2 ? g.blackoutFor + dt : 0
      // NIGHTSHOT: the camera's low-power mode on its last battery.
      const nightTarget = !g.menu && run.current.lives === 1 && g.status !== 'gameOver' && g.status !== 'levelClear' ? 1 : 0
      // Something sometimes stands down the corridor, at the edge of the beam; more often,
      // and farther off, in NIGHTSHOT.
      const nightshot = g.nightVision > 0.9
      const inRun = g.status === 'running' && !g.menu
      if (inRun && !g.entity && !g.reduced && Math.random() < dt * (nightshot ? 0.1 : 0.035)) {
        const z = g.depth + (nightshot ? 17 + Math.random() * 5 : 12 + Math.random() * 4)
        g.entity = { z, x: corridorCenterAt(g.gateCenter, g.bends, z) + (Math.random() - 0.5) * 0.5, alpha: 0 }
        audio.current?.presence()
      }
      const before = g.nightVision
      g.nightVision = nightTarget > g.nightVision ? Math.min(1, g.nightVision + dt * 4) : Math.max(0, g.nightVision - dt * 2.2)
      if (before < 0.5 && g.nightVision >= 0.5) { audio.current?.nightshot(); events.current.setNightshot(true); events.current.lowPower() }
      if (before >= 0.5 && g.nightVision < 0.5) events.current.setNightshot(false)
      if (g.entity) {
        const visible = inRun && g.entity.z - g.depth > 8
        g.entity.alpha = visible ? Math.min(0.92, g.entity.alpha + dt * 3) : Math.max(0, g.entity.alpha - dt * 5)
        if (!visible && g.entity.alpha <= 0) g.entity = null
        else if (visible && !g.reduced) g.glitch = Math.max(g.glitch, 0.12)
      }
      audio.current?.setHumLevel(g.lighting.strength)
    }

    const idle = (dt: number) => {
      g.time += dt
      g.depth += dt * 0.55
      atmosphere(dt, false, false)
    }

    const enter = (dt: number) => {
      g.time += dt
      g.entryT += dt
      const k = Math.min(1, g.entryT / 1.05)
      g.entry = 1 - (1 - k) ** 3
      // A small step toward the doorway as it opens.
      g.depth = Math.min(0.35, g.entryT * 0.3)
      g.cameraLight = cameraLightFor(run.current.lives)
      if (g.entryT >= ENTRY_SECONDS) events.current.startRunning()
    }

    const dying = (dt: number) => {
      const d = g.dying!
      d.t += dt
      g.time += dt
      if (d.crash === 'hole') {
        // Over the edge: a little momentum, then straight down into the dark.
        g.depth += dt * g.speed * 1.6 * Math.max(0, 0.6 - d.t)
        g.fall = Math.min(4, d.t * d.t * 6)
        g.cameraLight = Math.max(0, g.cameraLight - dt * 1.2)
      } else g.shake = Math.max(g.shake, 0.6 - d.t * 0.5)
      g.glitch = Math.max(g.glitch, d.t > 0.5 ? 1 : 0.5)
      if (d.t >= 1.05) {
        const kind = d.crash
        g.dying = null
        events.current.finishRun(false, kind)
      }
    }

    const update = (dt: number) => {
      const r = run.current
      if (g.dying) { dying(dt); return }
      g.time += dt
      g.cameraLight = cameraLightFor(r.lives)
      r.clock += dt
      if (Math.floor(r.clock) !== Math.floor(r.clock - dt)) events.current.setClock(r.clock)
      g.lightsActive = false
      const blackoutClearance = g.speed * 1.6 * 1.8 + 2
      const canBlackout = g.phase === 'gate'
        ? g.gateZ - g.depth > blackoutClearance
        : g.bends.every((bend) => bend.endZ < g.depth || bend.startZ - g.depth > blackoutClearance)
          && g.obstacles.every((obstacle) => obstacle.z + 0.35 < g.depth || obstacle.z - g.depth > blackoutClearance)
      atmosphere(dt, g.lightsActive, canBlackout)

      const target = g.gate
      const distance = g.gateZ - g.depth

      // Guided pauses appear once per level, the first time it is played.
      if (r.coachAllowed && target) {
        const level = r.mode.type === 'level' ? backroomLevels[r.mode.index] : null
        const allowed = (moment: CoachMoment) => !!level?.coach.includes(moment) && !r.coachDone.has(moment)
        // Forks pause earlier: reading the condition takes longer than nudging a value.
        if (g.phase === 'gate' && g.resolved === 'none' && distance <= (target.kind === 'fork' ? 10 : 7.5)) {
          const truth = evaluateGate(target, g.values)
          const moment: CoachMoment | null = target.kind === 'fork' ? (allowed('fork') ? 'fork' : null)
            : truth ? null
              : allowed('energy') ? 'energy' : null
          if (moment) { events.current.openCoach(moment); return }
        }
        const ahead = (kind: CorridorObstacle['kind'], from: number) => g.phase === 'turn' && g.obstacles.some((item) => item.kind === kind && item.z - g.depth > 0 && item.z - g.depth <= from)
        const hazardMoment: CoachMoment | null = allowed('jump') && ahead('barrier', 4.5) ? 'jump'
          : allowed('hole') && ahead('hole', 4.5) ? 'hole'
            : allowed('saw') && ahead('saw', sawEmerge - 1.2) ? 'saw'
              : allowed('drill') && ahead('drill', drillWarn - 1) ? 'drill' : null
        if (hazardMoment) { events.current.openCoach(hazardMoment); return }
        if (g.phase === 'turn' && allowed('steer')) {
          const bend = g.bends[0]
          if (bend && g.depth >= bend.startZ - 3.2) { events.current.openCoach('steer', bend.dir); return }
        }
      }

      if (g.phase === 'gate' && target) {
        g.truth = evaluateGate(target, g.values)
        const live = target.kind === 'set' && target.liveTruth
        if (target.kind === 'set') {
          const opening = g.resolved === 'pass' || (live && g.truth && g.resolved === 'none')
          g.openAmount = opening ? Math.min(1, g.openAmount + dt / (g.resolved === 'pass' ? 0.28 : 0.6)) : Math.max(0, g.openAmount - dt / 0.4)
          const approach = Math.max(0, Math.min(1, 1 - Math.max(distance, 0) / 16))
          g.falseIntensity = live && !g.truth && g.resolved === 'none' ? Math.min(1, Math.max(0, (approach - 0.35) / 0.55)) : Math.max(0, g.falseIntensity - dt * 2.4)
        } else if (g.resolved === 'pass') {
          const side = correctForkSide(g.truth, g.trueSide)
          g.doorOpen[side < 0 ? 0 : 1] = Math.min(1, g.doorOpen[side < 0 ? 0 : 1] + dt / 0.28)
          g.falseIntensity = 0
        }
      } else {
        g.falseIntensity = Math.max(0, g.falseIntensity - dt * 2.4)
      }

      const steer = (steerRef.current.left ? -1 : 0) + (steerRef.current.right ? 1 : 0)
      g.steer += (steer - g.steer) * Math.min(1, dt * 6)
      g.playerX += steer * (STEER_SPEED + Math.max(0, g.speed - baseRunSpeed) * 0.35) * dt
      if (g.phase === 'gate' && target) {
        if (target.kind === 'set' && steer === 0 && distance > 4) g.playerX += (g.gateCenter - g.playerX) * Math.min(1, dt * 2.8)
        if (target.kind === 'fork' && g.resolved === 'pass') {
          const lane = g.gateCenter + correctForkSide(g.truth, g.trueSide) * forkLaneOffset
          g.playerX += (lane - g.playerX) * Math.min(1, dt * 6)
        }
      }

      const previousDepth = g.depth
      g.slow = Math.max(0, g.slow - dt)
      g.depth += dt * g.speed * (g.slow > 0 ? 0.55 : 1) * 1.6
      if (g.jumpT >= 0) {
        g.jumpT += dt
        g.jump = jumpOffset(g.jumpT)
        if (g.jumpT >= jumpSeconds) {
          g.jumpT = -1
          g.jump = 0
          g.shake = Math.max(g.shake, 0.18)
          audio.current?.land()
        }
      }
      const airborne = g.jump > clearHeight
      g.stepDistance += g.depth - previousDepth
      if (g.stepDistance >= 0.85) { g.stepDistance = 0; if (g.jumpT < 0) audio.current?.footstep() }

      const bend = g.phase === 'turn' ? g.bends.find((item) => g.depth >= item.startZ - 3 && g.depth < item.endZ) : undefined
      const hint = bend?.dir ?? 0
      if (hint !== turnHintRef.current) { turnHintRef.current = hint; setTurnHint(hint) }
      const lastBendEnd = g.bends[g.bends.length - 1]?.endZ ?? 0
      const next = g.phase === 'turn'
        ? g.obstacles.filter((item) => item.z - g.depth > -0.4 && item.z - g.depth <= 8 && (item.kind === 'barrier' || item.kind === 'hole' || item.kind === 'saw' || g.depth >= lastBendEnd - 1)).sort((a, b) => a.z - b.z)[0]
        : undefined
      const nextCenter = next ? corridorCenterAt(g.gateCenter, g.bends, next.z) : 0
      const hazard: Hazard = !next ? 0 : next.kind === 'barrier' || next.kind === 'hole' ? 2
        : next.kind === 'drill' ? (Math.abs(next.x - nextCenter) < 0.05 ? (g.playerX < nextCenter ? -1 : 1) : next.x > nextCenter ? -1 : 1)
          : -next.side as -1 | 1
      if (hazard !== hazardHintRef.current) { hazardHintRef.current = hazard; setHazardHint(hazard) }

      const center = corridorCenterAt(g.gateCenter, g.bends, g.depth)
      const offset = g.playerX - center
      const screen = screenRef.current
      if (screen) {
        screen.style.setProperty('--wall-right', Math.max(0, Math.min(1, offset / WALL_LIMIT)).toFixed(2))
        screen.style.setProperty('--wall-left', Math.max(0, Math.min(1, -offset / WALL_LIMIT)).toFixed(2))
      }
      // Touching a wall, anything on the floor or a hole ends the run.
      if (Math.abs(offset) >= WALL_LIMIT) {
        g.playerX = center + Math.sign(offset) * WALL_LIMIT
        events.current.crash('wall')
        return
      }
      const hit = g.obstacles.find((item) => hitsObstacle(previousDepth, g.depth, g.playerX, item, airborne))
      if (hit) { events.current.crash(hit.kind); return }
      // A drill beeps when its mark appears, then roars as it comes through.
      for (const drill of g.obstacles) {
        if (drill.kind !== 'drill') continue
        const gap = drill.z - g.depth
        if (gap <= drillWarn && gap > 0 && !g.drillsWarned.includes(drill.z)) { g.drillsWarned = [...g.drillsWarned, drill.z]; audio.current?.drillWarn() }
        if (gap <= drillStrike && gap > 0 && !g.drillsStruck.includes(drill.z)) { g.drillsStruck = [...g.drillsStruck, drill.z]; audio.current?.drill(); g.shake = Math.max(g.shake, 0.45) }
      }
      // A saw whines as it starts coming out of the wall.
      const saw = g.obstacles.find((item) => item.kind === 'saw' && item.z - g.depth <= sawEmerge && item.z - g.depth > 0 && !g.sawsHeard.includes(item.z))
      if (saw) { g.sawsHeard = [...g.sawsHeard, saw.z]; audio.current?.saw() }
      const pickup = g.pickups.find((item) => picksUp(previousDepth, g.depth, g.playerX, item))
      if (pickup) events.current.collectBattery(pickup)

      if (g.phase === 'gate' && target) {
        if (g.resolved === 'none' && distance <= LOCK_DISTANCE) {
          events.current.resolveGate()
          return
        }
        if (g.resolved === 'pass' && g.depth >= g.gateZ + PASS_CLEARANCE) {
          events.current.afterGate()
          return
        }
      }
      if (g.phase === 'turn' && g.depth >= g.activationZ) {
        r.gateNumber += 1
        events.current.beginGate()
      }
      g.shake = Math.max(0, g.shake - dt * 1.6)
    }

    const frameLoop = (now: number) => {
      frame = requestAnimationFrame(frameLoop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!document.hidden) {
        if (g.status === 'running') update(dt)
        else if (g.status === 'entering') enter(dt)
        else if (g.status === 'menu') idle(dt)
        else g.time += dt
        g.glitch = Math.max(0, g.glitch - dt * 1.4)
      }
      // The tape deck covers the corridor while it loads a tape: no need to draw both.
      if (g.status === 'loading' && tapeRef.current?.kind === 'insert') return
      // Values can change while the run is frozen for a guide, so the sign follows them.
      if (g.gate) g.truth = evaluateGate(g.gate, g.values)
      const signal: GateSignal = !g.gate ? 'unknown'
        : g.gate.kind === 'set' && g.gate.liveTruth ? (g.truth ? 'true' : 'false')
          : g.resolved === 'none' ? 'unknown' : g.truth ? 'true' : 'false'
      const frameView: BackroomView = {
        depth: g.depth,
        gateZ: g.gateZ,
        gateCenter: g.gateCenter,
        bends: g.bends,
        obstacles: g.obstacles,
        nextGateZ: g.nextGateZ,
        nextGateCenter: g.nextGateCenter,
        phase: g.phase,
        playerX: g.playerX,
        gateKind: g.gate?.kind ?? 'set',
        nextGateKind: g.nextGate?.kind ?? 'set',
        signal,
        trueSide: g.trueSide,
        nextTrueSide: g.nextTrueSide,
        openAmount: g.openAmount,
        doorOpen: g.doorOpen,
        flashSide: g.flashSide,
        falseIntensity: g.falseIntensity,
        time: g.time,
        roomLight: g.lighting.strength,
        lightsActive: g.menu || g.lightsActive,
        nightVision: g.nightVision,
        entity: g.entity,
        glitch: g.glitch,
        gateNumber: run.current.gateNumber,
        seed: SEED_BASE,
        reduced: g.reduced,
        shake: g.shake,
        steer: g.steer,
        jump: g.jump,
        pace: g.speed / baseRunSpeed,
        hideGate: g.menu,
        pickups: g.pickups,
        entry: g.menu ? -1 : g.entry,
        cameraLight: g.menu ? 1 : g.cameraLight,
        fall: g.fall,
      }
      view.render(frameView)
      // Browser checks steer through real tapes; they switch this on, students never do.
      const qa = (window as unknown as { __backroomQA?: { view?: BackroomView; centerAt?: (z: number) => number } }).__backroomQA
      if (qa) { qa.view = frameView; qa.centerAt = (z) => corridorCenterAt(g.gateCenter, g.bends, z) }
      screenRef.current?.style.setProperty('--false', g.falseIntensity.toFixed(3))
    }
    frame = requestAnimationFrame(frameLoop)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      view.dispose()
      media?.removeEventListener?.('change', motionPreference)
    }
  }, [])

  useEffect(() => {
    const player = audio.current
    return () => {
      clearTimers()
      player?.dispose()
    }
  }, [])

  const pause = () => {
    const g = game.current
    if (g.status !== 'running' && g.status !== 'coach') return
    steerRef.current = { left: false, right: false }
    stopEnergyHold()
    if (coachTimer.current) { window.clearTimeout(coachTimer.current); coachTimer.current = null }
    // A paused coach moment shows again on resume.
    if (coachRef.current) run.current.coachDone.delete(coachRef.current.moment)
    setCoach(null)
    setGameStatus('paused')
  }

  const resume = () => {
    if (paused || game.current.status !== 'paused') return
    enableAudioFromGesture()
    setGameStatus('running')
    screenRef.current?.focus()
  }

  const togglePause = () => {
    const current = game.current.status
    if (current === 'paused') resume()
    else pause()
  }

  const pauseRef = useRef(pause)
  useEffect(() => { pauseRef.current = pause })

  useEffect(() => {
    if (paused) pauseRef.current()
  }, [paused])

  useEffect(() => {
    const onHidden = () => { if (document.hidden) pauseRef.current() }
    const onBlur = () => {
      steerRef.current = { left: false, right: false }
      pauseRef.current()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('blur', onBlur)
    const release = () => { steerRef.current = { left: false, right: false } }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [])

  const editable = () => {
    const g = game.current
    return g.phase === 'gate' && g.resolved === 'none' && g.gate?.kind === 'set' && (g.status === 'running' || g.status === 'coach')
  }

  const changeEnergy = (next: number) => {
    const g = game.current
    if (!editable() || !g.gate || !gateUsesEnergy(g.gate)) return
    const clamped = Math.max(energyRange.min, Math.min(energyRange.max, Math.round(next)))
    if (clamped === g.values.energy) return
    g.values = { ...g.values, energy: clamped }
    setValues({ ...g.values })
    audio.current?.tick()
    checkCoach()
  }

  const toggleFlag = () => {
    const g = game.current
    if (!editable() || !g.gate || !gateBool(g.gate)) return
    g.values = { ...g.values, flag: !g.values.flag }
    setValues({ ...g.values })
    audio.current?.toggle()
    checkCoach()
  }

  const startEnergyHold = (direction: -1 | 1) => {
    stopEnergyHold()
    const hold = energyHold.current
    hold.startedAt = performance.now()
    hold.repeated = false
    hold.delay = window.setTimeout(() => {
      hold.repeated = true
      changeEnergy(game.current.values.energy + direction)
      hold.interval = window.setInterval(() => {
        const elapsed = performance.now() - hold.startedAt
        const step = elapsed > 1400 ? 3 : elapsed > 700 ? 2 : 1
        changeEnergy(game.current.values.energy + direction * step)
      }, 70)
    }, 220)
  }

  const clickEnergy = (direction: -1 | 1) => {
    if (energyHold.current.repeated) {
      energyHold.current.repeated = false
      return
    }
    changeEnergy(game.current.values.energy + direction)
  }

  const steerDown = (direction: -1 | 1) => {
    const g = game.current
    const current = coachRef.current
    if (g.status === 'coach' && current && (current.moment === 'steer' || current.moment === 'fork' || current.moment === 'saw' || current.moment === 'drill')) closeCoach()
    else if (g.status !== 'running') return
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
    if (heldFor < 170 && game.current.status === 'running') game.current.playerX += direction * 0.23
  }

  const jump = () => {
    const g = game.current
    const current = coachRef.current
    if (g.status === 'coach' && (current?.moment === 'jump' || current?.moment === 'hole')) closeCoach()
    else if (g.status !== 'running') return
    if (g.jumpT >= 0) return
    g.jumpT = 0
    audio.current?.jump()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.matches('input, textarea, select') || target?.isContentEditable) return
    const key = event.key
    const current = game.current.status
    if (key === 'ArrowLeft' || key === 'a' || key === 'A' || key === 'ArrowRight' || key === 'd' || key === 'D') {
      if (current !== 'running' && current !== 'coach') return
      event.preventDefault()
      if (!event.repeat) steerDown(key === 'ArrowLeft' || key === 'a' || key === 'A' ? -1 : 1)
      return
    }
    if (key === 'ArrowUp' || key === 'w' || key === 'W' || key === 'ArrowDown' || key === 's' || key === 'S') {
      if (current !== 'running' && current !== 'coach') return
      event.preventDefault()
      changeEnergy(game.current.values.energy + (key === 'ArrowUp' || key === 'w' || key === 'W' ? 1 : -1))
      return
    }
    if (key === 't' || key === 'T' || key === 'e' || key === 'E') {
      if (current !== 'running' && current !== 'coach') return
      event.preventDefault()
      toggleFlag()
      return
    }
    if (key === ' ' && (current === 'running' || current === 'coach')) {
      event.preventDefault()
      jump()
      return
    }
    // A focused button handles Enter and Space itself.
    if ((key === 'Enter' || key === ' ') && target?.tagName === 'BUTTON') return
    if (current === 'loading' && (key === 'Enter' || key === ' ' || key === 'Escape')) { event.preventDefault(); finishTape(); return }
    if (key === 'Enter' || key === ' ') {
      if (current === 'briefing') { event.preventDefault(); launch(); return }
      if (current === 'mistake') { event.preventDefault(); continueAfterMistake(); return }
      if (current === 'paused') { event.preventDefault(); resume(); return }
    }
    if (key === 'Escape' || key === 'p' || key === 'P') {
      if (current === 'running' || current === 'coach' || current === 'paused') {
        event.preventDefault()
        togglePause()
      }
    }
  }

  const onKeyUp = (event: KeyboardEvent) => {
    const key = event.key
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') steerUp(-1)
    if (key === 'ArrowRight' || key === 'd' || key === 'D') steerUp(1)
  }

  const keys = useRef({ onKeyDown, onKeyUp })
  useEffect(() => { keys.current = { onKeyDown, onKeyUp } })
  useEffect(() => {
    const down = (event: KeyboardEvent) => keys.current.onKeyDown(event)
    const up = (event: KeyboardEvent) => keys.current.onKeyUp(event)
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
  }, [])

  const toggleAudio = () => {
    const next = !audioOn
    setAudioOn(next)
    saveAudioPreference(next)
    if (next) {
      audio.current?.enable()
      audio.current?.toggle()
      if (game.current.status === 'running') audio.current?.startHum()
    } else audio.current?.disable()
  }

  const focusScreen = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest('button')) return
    screenRef.current?.focus()
  }

  const playLevel = (index: number) => { if (playerRef.current) startMode({ type: 'level', index }) }
  const playEndless = () => { if (playerRef.current) startMode({ type: 'endless' }) }
  const retry = () => startMode(run.current.mode, true)
  const continueRun = () => { if (result?.resume) startMode(result.mode, true, result.resume) }

  const live = status !== 'menu'
  const cameraOff = live && lives <= 0 && status !== 'gameOver' && status !== 'levelClear'
  const inGate = phase === 'gate'
  const canEdit = inGate && !locked && gate?.kind === 'set' && (status === 'running' || status === 'coach')
  const usesEnergy = !!gate && gateUsesEnergy(gate)
  const flagName = gate ? gateBool(gate) : null
  // Value controls only appear for gates the student edits.
  const padGate = phase === 'turn' ? game.current.nextGate ?? gate : gate
  const showValues = padGate?.kind === 'set'
  const truthNow = gate ? evaluateGate(gate, values) : false
  const codeGate = phase === 'turn' ? game.current.nextGate ?? gate : gate
  const codeValues = phase === 'turn' && game.current.nextGate ? game.current.nextGate.start : values
  const codeTruth: CodeTruth = phase === 'turn' ? 'next' : gate?.liveTruth ? (truthNow ? 'true' : 'false') : 'unknown'
  const levelGates = level ? level.gates.length : 0
  const forkNow = inGate && gate?.kind === 'fork'
  const nextIndex = nextLevelIndex(stars)

  const coachCopy = (() => {
    if (!coach || !gate) return null
    switch (coach.moment) {
      case 'energy': return coach.satisfied
        ? { title: 'TRUE. THE GATE OPENS.', body: `${values.energy} ${conditionCode(gate).replace('energy ', '')} is TRUE. Keep going.` }
        : { title: 'MAKE IT TRUE', body: `This gate runs if ${conditionCode(gate)}: energy is ${values.energy}, so the condition is FALSE. Use ▲ / ▼ (or ↑ / ↓) to change energy until it reads TRUE.` }
      case 'steer': return { title: 'FOLLOW THE CORRIDOR', body: `The corridor bends ${sideWord(coach.direction ?? 1)}. Hold ${coach.direction === -1 ? '◀ (or ←)' : '▶ (or →)'} to steer. Touch a wall and the run is over.` }
      case 'jump': return { title: 'JUMP!', body: 'A barrier blocks the whole corridor. Press SPACE or tap JUMP just before it. Touch it and the run is over.' }
      case 'hole': return { title: 'A HOLE', body: 'This one goes down forever. Jump just before the edge and stay in the air all the way across.' }
      case 'saw': return { title: 'A SAW!', body: 'It comes out of one wall and covers that half of the corridor, past the middle. Steer to the other side. Jumping does not help.' }
      case 'drill': return { title: 'A DRILL!', body: 'A red mark on the floor or glowing cracks show the lane where a drill will strike. Steer into another lane before it comes through.' }
      case 'fork': return { title: 'TWO DOORS', body: 'This time the code sets the values. Read the condition: is it TRUE or FALSE? Steer into that door. Your choice locks just before the gate.' }
    }
  })()

  const hint = (() => {
    if (!gate || gate.kind === 'fork') return 'Work out the condition with the given values, then pick the door that matches.'
    const compare = gate.clauses.find((clause) => clause.type === 'compare')
    const lines: string[] = []
    if (compare?.type === 'compare') {
      const t = compare.threshold
      lines.push(compare.operator === '>' ? `Try a number above ${t}.` : compare.operator === '<' ? `Try a number below ${t}.`
        : compare.operator === '>=' ? `${t} works too. Try ${t} or more.` : compare.operator === '<=' ? `${t} works too. Try ${t} or less.`
          : compare.operator === '==' ? `Land exactly on ${t}.` : `Any number except ${t}.`)
    }
    const flagClause = gate.clauses.find((clause) => clause.type === 'bool')
    if (flagClause?.type === 'bool') lines.push(`${flagClause.name} must be ${pythonBool(flagClause.form !== 'false')}.`)
    return lines.join(' ')
  })()

  const mistakeTitle = mistake?.reason === 'closed' ? 'THE GATE STAYED SHUT' : mistake?.reason === 'pillar' ? 'YOU HIT THE PILLAR' : 'WRONG DOOR'
  const mistakeLead = mistake
    ? mistake.reason === 'closed' ? 'The condition was FALSE when you reached the gate.'
      : mistake.reason === 'pillar' ? `You stayed in the middle. The condition is ${mistake.explanation.result ? 'TRUE' : 'FALSE'}, so the ${mistake.explanation.result ? 'TRUE' : 'FALSE'} door was the way.`
        : `You took the ${mistake.chosenSide === mistake.trueSide ? 'TRUE' : 'FALSE'} door, but the condition is ${mistake.explanation.result ? 'TRUE' : 'FALSE'}.`
    : ''

  const gateCode = (target: BackroomGate, given: GateValues) => {
    const lines: string[] = []
    if (gateUsesEnergy(target)) lines.push(`energy = ${given.energy}`)
    const name = gateBool(target)
    if (name) lines.push(`${name} = ${pythonBool(given.flag)}`)
    lines.push(`if ${conditionCode(target)}:`)
    return lines
  }

  const batteries = (count: number) => <span className={`br-battery ${count <= 1 ? 'is-low' : ''}`} aria-label={`${count} of ${maxBatteries} batteries`}>
    {Array.from({ length: maxBatteries }, (_, index) => <i key={index} className={index < count ? 'is-full' : ''} />)}
  </span>

  return <main
    ref={screenRef}
    className={`br-screen br-screen--${status} ${live ? 'is-live' : ''} ${nightshot ? 'is-nightshot' : ''} ${lives <= 1 && live ? 'is-low-battery' : ''} ${cameraOff ? 'is-camera-off' : ''}`}
    tabIndex={0}
    onPointerDown={focusScreen}
  >
    <canvas ref={canvasRef} className="br-canvas" aria-hidden="true" />
    <div className="br-wall-warning" aria-hidden="true"><i /><i /></div>
    <div className="br-film" aria-hidden="true"><i className="br-grain" /><i className="br-scan" /><i className="br-vignette" /></div>

    {live && <>
      <div className="br-viewfinder" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="br-lcd" aria-hidden="true"><i /></div>
      {cameraOff && <div className="br-blind" role="status"><b>NO BATTERY</b><span>Find a battery on the floor</span></div>}
      <header className="br-osd">
        <div className="br-osd-left">
          <span className="br-rec-row">{clock < 2 ? <span className="br-rec is-play">▶ PLAY</span> : <span className="br-rec"><i /> REC</span>}<span className="br-sp">SP</span></span>
          <span className="br-timecode">{timecode(clock)}</span>
          <span className="br-tapename">{level ? `TAPE ${String(level.id).padStart(2, '0')} · ${level.title}` : 'THE DEEP · ENDLESS'}</span>
          <span className="br-zoom" aria-hidden="true">W<i><b style={{ width: `${Math.round(Math.min(1, Math.max(0.08, (pace - 1) / 1.4)) * 100)}%` }} /></i>T</span>
          {nightshot && <span className="br-nightshot">NIGHTSHOT</span>}
        </div>
        <div className="br-osd-center" aria-label={level ? `Gate ${gateNumber} of ${levelGates}` : `Gate ${gateNumber}`}>
          {level ? <span className="br-pips">{level.gates.map((_, index) => <i key={index} className={index < gateNumber - (phase === 'gate' ? 1 : 0) ? 'is-done' : index === gateNumber - 1 && phase === 'gate' ? 'is-now' : ''} />)}</span>
            : <span className="br-gatecount">GATE {String(gateNumber).padStart(3, '0')}</span>}
        </div>
        <div className="br-osd-right">
          {champion && mode.type === 'endless' && <BackroomChampionBadge />}
          {combo >= 2 && <span className="br-combo" key={combo}>COMBO {combo}</span>}
          <span className="br-pace" aria-label={`Pace ${pace.toFixed(1)} times`}>PACE {pace.toFixed(1)}×</span>
          <span className="br-xp"><Zap size={15} fill="currentColor" /> {xp}</span>
          {batteries(lives)}
          <span className="br-datestamp" aria-hidden="true">{dateStamp}</span>
          <button className="br-icon" onClick={toggleAudio} aria-label={audioOn ? 'Turn sound off' : 'Turn sound on'}>{audioOn ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
          <button className="br-icon" onClick={togglePause} aria-label={status === 'paused' ? 'Resume run' : 'Pause run'}>{status === 'paused' ? <Play size={17} /> : <Pause size={17} />}</button>
        </div>
      </header>

      {toast && <div className={`br-toast is-${toast.tone}`} role="status">{toast.text}</div>}
      {showChampion && <BackroomChampionAward celebrate />}
      {reveal && <div className="br-reveal" role="status"><code><CodeTokens code={reveal.code} /></code><strong className={reveal.result ? 'is-true' : 'is-false'}>→ {reveal.result ? 'TRUE' : 'FALSE'}</strong><span>{reveal.note}</span></div>}

      <section className={`br-console ${forkNow ? 'is-fork' : ''}`}>
        <div className="br-pad br-pad--values" aria-label="Value controls">
          {showValues && usesEnergy && <div className="br-energy">
            <button className="br-key" aria-label="Increase energy" disabled={!canEdit} onPointerDown={(event) => { if (event.button === 0) startEnergyHold(1) }} onPointerUp={stopEnergyHold} onPointerLeave={stopEnergyHold} onPointerCancel={stopEnergyHold} onClick={() => clickEnergy(1)} onContextMenu={(event) => event.preventDefault()}><ChevronUp size={30} /><kbd>↑</kbd></button>
            <span className="br-energy-label">ENERGY</span>
            <button className="br-key" aria-label="Decrease energy" disabled={!canEdit} onPointerDown={(event) => { if (event.button === 0) startEnergyHold(-1) }} onPointerUp={stopEnergyHold} onPointerLeave={stopEnergyHold} onPointerCancel={stopEnergyHold} onClick={() => clickEnergy(-1)} onContextMenu={(event) => event.preventDefault()}><ChevronDown size={30} /><kbd>↓</kbd></button>
          </div>}
          {showValues && flagName && <button className={`br-switch ${values.flag ? 'is-on' : 'is-off'}`} aria-label={`Toggle ${flagName}`} aria-pressed={values.flag} disabled={!canEdit} onClick={toggleFlag}>
            {values.flag ? <ToggleRight size={34} /> : <ToggleLeft size={34} />}
            <span>{flagName}</span><b>{pythonBool(values.flag)}</b><kbd>T</kbd>
          </button>}
          {!showValues && <span className="br-pad-given">VALUES<br />GIVEN</span>}
        </div>

        <div className="br-console-center">
          {codeGate && <CodePanel key={`${phase}-${gateNumber}`} gate={codeGate} values={codeValues} editable={canEdit} truth={codeTruth} trueSide={phase === 'turn' ? game.current.nextTrueSide : trueSide} label={phase === 'turn' ? `NEXT · GATE ${String(gateNumber + 1).padStart(2, '0')}` : `GATE ${String(gateNumber).padStart(2, '0')}`} />}
          <div className="br-console-foot">
            <p className="br-instruction">{locked && phase === 'gate' ? 'LOCKED IN' : phase === 'turn' ? (hazardHint === 2 ? 'JUMP! · SPACE' : hazardHint !== 0 ? `DODGE ${sideWord(hazardHint)}` : turnHint !== 0 ? `TURN ${sideWord(turnHint)}` : 'FOLLOW THE CORRIDOR · THE CODE LOADS AT THE GATE') : forkNow ? 'PICK THE DOOR THAT MATCHES' : gate?.liveTruth ? 'MAKE IT TRUE' : 'NO LIGHT ON THIS GATE · THINK IT THROUGH'}</p>
            <button className="br-hint-button" disabled={!inGate || (status !== 'running' && status !== 'coach')} onClick={() => setHintOpen((open) => !open)} aria-expanded={hintOpen}><Lightbulb size={15} /> HINT</button>
          </div>
          {hintOpen && inGate && <p className="br-hint" role="status"><Lightbulb size={15} /> {hint}</p>}
        </div>

        <div className={`br-pad br-pad--steer ${turnHint === -1 ? 'is-left' : turnHint === 1 ? 'is-right' : ''} ${hazardHint === -1 ? 'avoid-left' : hazardHint === 1 ? 'avoid-right' : hazardHint === 2 ? 'is-jump' : ''}`} aria-label="Corridor steering">
          <button className="br-key br-key--jump" aria-label="Jump" onPointerDown={(event) => { if (event.button === 0) jump() }} onContextMenu={(event) => event.preventDefault()}><ChevronsUp size={22} /> JUMP <kbd>SPACE</kbd></button>
          <div className="br-steer-row">
          <button className="br-key br-key--steer" aria-label="Move left" onPointerDown={() => steerDown(-1)} onPointerUp={() => steerUp(-1)} onPointerLeave={() => steerUp(-1)} onPointerCancel={() => steerUp(-1)} onContextMenu={(event) => event.preventDefault()}>
            <ChevronLeft size={34} />{forkNow ? <small className={trueSide < 0 ? 'is-true' : 'is-false'}>{trueSide < 0 ? 'TRUE' : 'FALSE'}</small> : <kbd>←</kbd>}
          </button>
          <button className="br-key br-key--steer" aria-label="Move right" onPointerDown={() => steerDown(1)} onPointerUp={() => steerUp(1)} onPointerLeave={() => steerUp(1)} onPointerCancel={() => steerUp(1)} onContextMenu={(event) => event.preventDefault()}>
            <ChevronRight size={34} />{forkNow ? <small className={trueSide > 0 ? 'is-true' : 'is-false'}>{trueSide > 0 ? 'TRUE' : 'FALSE'}</small> : <kbd>→</kbd>}
          </button>
          </div>
        </div>
      </section>

      {status === 'coach' && coachCopy && <div className={`br-coach br-coach--${coach?.moment} ${coach?.satisfied ? 'is-satisfied' : ''}`} role="dialog" aria-label={coachCopy.title}>
        <small>{coach?.satisfied ? 'NICE' : 'FIELD GUIDE'}</small>
        <strong>{coachCopy.title}</strong>
        <p>{coachCopy.body}</p>
        {coach && coach.moment !== 'energy' && <button className="br-secondary" onClick={closeCoach}>GOT IT</button>}
      </div>}
    </>}

    {status === 'loading' && tape && <TapeDeck key={tape.key} kind={tape.kind} label={tape.label} shelf={tape.shelf} slot={tape.slot} reduced={game.current.reduced} onCue={tapeCue} onDone={finishTape} />}

    {status === 'menu' && <BackroomMenu progress={progress} scores={scores} you={scoreId} player={askName ? player : undefined} onPlayer={setPlayer} audioOn={audioOn} champion={champion} fresh={freshTape} onToggleAudio={toggleAudio} onPlayLevel={playLevel} onPlayEndless={playEndless} onBack={onBack} />}

    {status === 'briefing' && <div className="br-overlay br-overlay--briefing" role="dialog" aria-label="Briefing">
      <div className="br-card">
        <small className="br-kicker"><i /> {level ? `TAPE ${String(level.id).padStart(2, '0')} · ${level.focus}` : 'THE DEEP · ENDLESS'}</small>
        <h2 className="br-title br-title--md" data-text={level ? level.title : 'THE DEEP'}>{level ? level.title : 'THE DEEP'}</h2>
        <p>{level ? level.lead : 'Everything you learned, mixed. No gate shows TRUE or FALSE before you reach it. The pace keeps climbing. Spare batteries lie on the floor when the camera needs them.'}</p>
        <ul className="br-examples">
          {(level ? level.examples : [{ code: '70 >= 70', result: true }, { code: '30 > 40 and True', result: false }]).map((example) => <li key={example.code}><code><CodeTokens code={example.code} /></code><span className={example.result ? 'is-true' : 'is-false'}>→ {example.result ? 'TRUE' : 'FALSE'}</span></li>)}
        </ul>
        <div className="br-brief-meta">
          <span>{level ? `${level.gates.length} GATES` : '∞ GATES'}</span>
          <span>{batteries(maxBatteries)} {maxBatteries} BATTERIES</span>
          <span>WRONG GATE = −1 BATTERY</span>
          <span className="is-bad">WALLS · PROPS · HOLES = SIGNAL LOST</span>
        </div>
        <div className="br-overlay-actions">
          <button className="br-primary" onClick={launch}><Play size={18} fill="currentColor" /> {level && level.id === 1 && stars[0] === 0 ? 'START TUTORIAL' : 'PRESS PLAY'}</button>
          <button className="br-secondary" onClick={toMenu}>TAPES</button>
        </div>
        <p className="br-keys-note">← → steer · ↑ ↓ energy · SPACE jump · ESC pause</p>
      </div>
    </div>}

    {status === 'paused' && <div className="br-overlay br-overlay--paused" role="dialog" aria-label="Paused">
      <div className="br-card br-card--compact">
        <h2 className="br-title br-title--md" data-text="❚❚ PAUSE">❚❚ PAUSE</h2>
        <p>The corridor waits. Your batteries and XP are safe.</p>
        <div className="br-overlay-actions">
          <button className="br-primary" onClick={resume}><Play size={16} fill="currentColor" /> KEEP RUNNING</button>
          <button className="br-secondary" onClick={toMenu}>QUIT TO TAPES</button>
        </div>
      </div>
    </div>}

    {status === 'mistake' && mistake && <div className="br-overlay br-overlay--mistake" role="dialog" aria-label={mistakeTitle}>
      <div className="br-card br-card--mistake">
        <small className="br-kicker is-bad"><i /> {mistake.final ? 'NO BATTERY LEFT' : mistake.livesLeft === 0 ? '−1 BATTERY · CAMERA OFF' : `−1 BATTERY · ${mistake.livesLeft} LEFT`}</small>
        <h2 className="br-title br-title--md is-bad" data-text={mistakeTitle}>{mistakeTitle}</h2>
        <p>{mistakeLead}</p>
        <pre className="br-trace">
          {gateCode(mistake.gate, mistake.values).map((line) => <code key={line}><CodeTokens code={line} /></code>)}
          {mistake.explanation.steps.map((step, index) => <code key={`${step.code}-${index}`} className="br-trace-step"><span className="br-trace-arrow">{index === mistake.explanation.steps.length - 1 && mistake.explanation.steps.length > 1 ? '⇒' : '→'}</span><span><CodeTokens code={step.code} /></span><b className={step.result ? 'is-true' : 'is-false'}>{pythonBool(step.result)}</b></code>)}
        </pre>
        <p className="br-tip"><Lightbulb size={16} /> {mistake.explanation.tip}</p>
        {mistake.livesLeft === 0 && !mistake.final && <p className="br-dark-note">The camera is off. Find a spare battery on the floor; miss a gate in the dark and the run is over.</p>}
        <div className="br-overlay-actions">
          <button className="br-primary" onClick={continueAfterMistake} autoFocus>{mistake.final ? <><SkipForward size={16} /> SEE RESULTS</> : <><Play size={16} fill="currentColor" /> {mistake.livesLeft === 0 ? 'CONTINUE IN THE DARK' : 'CONTINUE'}</>}</button>
        </div>
        <span className="br-batteries-line">{batteries(mistake.livesLeft)}</span>
      </div>
    </div>}

    {(status === 'levelClear' || status === 'gameOver') && result && <div className={`br-overlay br-overlay--${status}`} role="dialog" aria-label={status === 'levelClear' ? 'Tape cleared' : 'Signal lost'}>
      <div className="br-card br-card--result">
        {status === 'levelClear' ? <>
          <small className="br-kicker is-good"><i /> {result.mode.type === 'level' ? `TAPE ${String(result.mode.index + 1).padStart(2, '0')}` : 'THE DEEP'} · CLEARED</small>
          <h2 className="br-title" data-text="TAPE CLEARED">TAPE CLEARED</h2>
          <Stars count={result.stars} size={40} />
          <p>{result.stars === 3 ? 'Perfect tape. Every condition read right.' : result.stars === 2 ? 'One wrong answer. Replay for three stars.' : 'Cleared. Replay it to read every gate right.'}</p>
          {result.mode.type === 'level' && result.mode.index === backroomLevels.length - 1 && <div className="br-unlock"><BatteryFull size={20} /> THE DEEP IS OPEN · ENDLESS UNLOCKED</div>}
        </> : <>
          <small className="br-kicker is-bad"><i /> {result.crash ? crashCopy[result.crash].title : result.mode.type === 'level' ? 'GATE MISSED IN THE DARK' : 'THE DEEP'}</small>
          <h2 className="br-title is-bad" data-text="SIGNAL LOST">SIGNAL LOST</h2>
          <p>{result.crash ? crashCopy[result.crash].body : result.mode.type === 'level' ? 'The camera was dead and the gate stayed shut. Read the notes below, then try again.' : ''}{result.mode.type === 'endless' ? ` ${result.newBest ? 'New personal record in The Deep.' : 'The Deep keeps going. So can you.'}` : ''}</p>
        </>}
        <div className="br-summary-grid">
          <article><strong>{result.mode.type === 'level' ? `${result.gates}/${result.totalGates}` : result.gates}</strong><span>GATES READ RIGHT</span></article>
          <article><strong>{result.xp}</strong><span>XP{result.stars ? ` · +${result.stars * 10} CLEAR` : ''}</span></article>
          <article><strong>{result.bestCombo}</strong><span>BEST COMBO</span></article>
          {result.mode.type === 'endless' && <article><strong>{progress.backroomRunBest}</strong><span>BEST RUN</span></article>}
        </div>
        {result.mistakes.length > 0 && <div className="br-debrief">
          <h3>FIELD NOTES · {result.mistakes.length} {result.mistakes.length === 1 ? 'MISTAKE' : 'MISTAKES'}</h3>
          <ul>{result.mistakes.slice(-3).map((item, index) => <li key={index}>
            <code><CodeTokens code={item.explanation.steps[item.explanation.steps.length - 1].code} /></code>
            <b className={item.explanation.result ? 'is-true' : 'is-false'}>{item.explanation.result ? 'TRUE' : 'FALSE'}</b>
            <span>{item.explanation.tip}</span>
          </li>)}</ul>
        </div>}
        {status === 'gameOver' && result.mode.type === 'endless' && scores.length > 0 && <ol className="br-mini-board">{scores.map((score, index) => <li key={score.username} className={score.username === scoreId ? 'is-you' : ''}><b>{index + 1}</b><span>{score.name}</span><strong>{score.gates}</strong></li>)}</ol>}
        <div className="br-overlay-actions">
          {status === 'levelClear' && <button className="br-primary" onClick={toMenu}><ArrowLeft size={16} /> BACK TO THE SHELF</button>}
          {status === 'gameOver' && result.resume && <button className="br-primary" onClick={continueRun}><Play size={16} fill="currentColor" /> CONTINUE FROM GATE {String(result.resume.gate).padStart(2, '0')}</button>}
          <button className={status === 'gameOver' && !result.resume ? 'br-primary' : 'br-secondary'} onClick={retry}><RotateCcw size={16} /> {result.mode.type === 'endless' ? 'RUN AGAIN' : status === 'gameOver' ? 'RETRY TAPE' : 'REPLAY'}</button>
          {status === 'gameOver' && <button className="br-secondary" onClick={toMenu}>TAPES</button>}
          {status === 'gameOver' && nextIndex === null && result.mode.type === 'level' && <button className="br-secondary" onClick={onBack}><ArrowLeft size={15} /> CONDITIONS</button>}
        </div>
      </div>
    </div>}
  </main>
}
