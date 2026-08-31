import { Check, ChevronDown, ChevronUp, Flag, Lightbulb, LoaderCircle, Play, RotateCcw, Save, Sparkles, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DinoGame } from '../components/DinoGame'
import { Toast } from '../components/Toast'
import { dinoMissions, starterConfig } from '../data/dinoLab'
import { pythonRunner } from '../lib/pythonRunner'
import { saveCloudProgress } from '../lib/supabase'
import { loadDinoCode, loadDinoConfig, resetDinoStorage, saveDinoCode, saveDinoConfig } from '../lib/storage'
import type { DinoConfig, DinoConfigKey, StudentProfile } from '../types'

interface DinoLabScreenProps {
  profile: StudentProfile
  onBack: () => void
  onUpdateProfile: (profile: StudentProfile) => void
}

type RuntimeState = 'booting' | 'ready' | 'unavailable'

const variableRows: Array<{
  key: DinoConfigKey
  label: string
  min: number
  max: number
  step: number
  missionId?: string
}> = [
  { key: 'player_speed', label: 'Player speed', min: 1, max: 50, step: 1, missionId: 'super-speed' },
  { key: 'jump_power', label: 'Jump power', min: 1, max: 120, step: 1, missionId: 'moon-mode' },
  { key: 'gravity', label: 'Gravity', min: 0, max: 30, step: 1 },
  { key: 'obstacle_speed', label: 'Obstacle speed', min: 1, max: 40, step: 1, missionId: 'giant-mode' },
  { key: 'obstacle_count', label: 'Obstacle count', min: 0, max: 18, step: 1, missionId: 'chaos-mode' },
  { key: 'lives', label: 'Lives', min: 1, max: 30, step: 1, missionId: 'survivor-mode' },
]

const codeRows = [...variableRows, { key: 'player_size' as DinoConfigKey, label: 'Player size', min: 16, max: 120, step: 2 }]

export function DinoLabScreen({ profile, onUpdateProfile }: DinoLabScreenProps) {
  const [code, setCode] = useState(() => formatConfigCode(readConfigFromCode(loadDinoCode(), loadDinoConfig())))
  const [config, setConfig] = useState<DinoConfig>(loadDinoConfig)
  const [draftConfig, setDraftConfig] = useState<DinoConfig>(() => readConfigFromCode(loadDinoCode(), loadDinoConfig()))
  const [runPulse, setRunPulse] = useState(0)
  const [runningCode, setRunningCode] = useState(false)
  const [runtimeState, setRuntimeState] = useState<RuntimeState>(pythonRunner.getState())
  const [selectedMission, setSelectedMission] = useState(() => {
    const index = dinoMissions.findIndex((mission) => !profile.completedMissions.includes(mission.id))
    return index < 0 ? 0 : index
  })
  const [hintLevel, setHintLevel] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [showReveal, setShowReveal] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'warning' | 'neutral' } | null>(null)
  const [saved, setSaved] = useState(true)

  useEffect(() => pythonRunner.subscribe(setRuntimeState), [])

  useEffect(() => {
    setSaved(false)
    const timeout = window.setTimeout(() => {
      saveDinoCode(code)
      setSaved(true)
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [code])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        void runCode()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const mission = dinoMissions[selectedMission]
  const completedCount = dinoMissions.filter((item) => profile.completedMissions.includes(item.id)).length
  const challengeUnlocked = completedCount === dinoMissions.length
  const challengeComplete = profile.badges.includes('runner-challenge')
  const missionHints = useMemo(() => getMissionHints(mission.id), [mission.id])
  const missionTarget = challengeUnlocked ? null : getMissionTarget(mission.id)
  const missionNumberLabel = challengeUnlocked ? 'FINAL CHALLENGE' : `MISSION ${mission.number}`
  const missionName = challengeUnlocked
    ? challengeComplete ? 'SLICE 01 COMPLETE' : 'CENTURY RUN'
    : mission.title.toUpperCase()
  const missionInstruction = challengeUnlocked
    ? challengeComplete ? 'You finished the first pizza slice.' : 'Reach 100 points in the runner to complete Slice 01.'
    : mission.instruction
  const missionCardComplete = challengeUnlocked ? challengeComplete : profile.completedMissions.includes(mission.id)

  const completeChallenge = () => {
    if (!challengeUnlocked || challengeComplete) return
    const nextProfile: StudentProfile = {
      ...profile,
      xp: profile.xp + 200,
      badges: [...profile.badges, 'runner-challenge'],
      lastActiveAt: new Date().toISOString(),
    }
    onUpdateProfile(nextProfile)
    void saveCloudProgress(nextProfile, code, config).catch(() => undefined)
    setToast({ message: 'Century Run cleared! Slice 01 complete. +200 XP', tone: 'success' })
  }

  const runCode = async () => {
    if (runningCode) return
    setRunningCode(true)
    setToast(null)
    try {
      const result = await pythonRunner.run(code)
      const nextCode = formatConfigCode(result.config)
      setCode(nextCode)
      setConfig(result.config)
      setDraftConfig(result.config)
      saveDinoConfig(result.config)
      saveDinoCode(nextCode)
      setRunPulse((value) => value + 1)
      setSaved(true)

      const newlyCompleted = dinoMissions.filter(
        (item) => item.check(result.config) && !profile.completedMissions.includes(item.id),
      )
      const completedMissions = [...profile.completedMissions, ...newlyCompleted.map((item) => item.id)]
      const badges = new Set(profile.badges)
      badges.add('first-run')
      if (completedMissions.length >= 3) badges.add('experimenter')
      if (result.config.obstacle_count >= 10 || result.warnings.length) badges.add('chaos-engineer')
      if (completedMissions.length === dinoMissions.length) badges.add('lab-survivor')

      const nextProfile: StudentProfile = {
        ...profile,
        xp: profile.xp + newlyCompleted.reduce((total, item) => total + item.reward, 0),
        completedMissions,
        badges: [...badges],
        lastActiveAt: new Date().toISOString(),
      }
      onUpdateProfile(nextProfile)
      void saveCloudProgress(nextProfile, nextCode, result.config).catch(() => undefined)

      if (newlyCompleted.length) {
        const reward = newlyCompleted.reduce((total, item) => total + item.reward, 0)
        setToast({ message: `${newlyCompleted[0].title} unlocked! +${reward} XP`, tone: 'success' })
        const nextIndex = dinoMissions.findIndex((item) => !completedMissions.includes(item.id))
        if (nextIndex >= 0) setSelectedMission(nextIndex)
        if (completedMissions.length >= 3 && !localStorage.getItem('pixpy.variables.revealed')) {
          localStorage.setItem('pixpy.variables.revealed', 'true')
          window.setTimeout(() => setShowReveal(true), 700)
        }
      } else if (result.warnings.length) {
        setToast({ message: result.warnings[0], tone: 'warning' })
      } else {
        setToast({ message: getReaction(result.config), tone: 'neutral' })
      }
    } catch (reason) {
      setToast({ message: reason instanceof Error ? reason.message : 'Python could not understand that yet.', tone: 'warning' })
    } finally {
      setRunningCode(false)
    }
  }

  const revealHint = () => {
    if (!showHint) {
      setShowHint(true)
      setHintLevel(0)
    } else {
      setHintLevel((level) => Math.min(2, level + 1))
    }
  }

  const reset = () => {
    const nextCode = formatConfigCode(starterConfig)
    setCode(nextCode)
    setConfig(starterConfig)
    setDraftConfig(starterConfig)
    resetDinoStorage()
    setRunPulse((value) => value + 1)
    setShowReset(false)
    setToast({ message: 'Runner Lab reset to its original signal.', tone: 'neutral' })
  }

  const updateDraftVariable = (key: DinoConfigKey, rawValue: string) => {
    const row = variableRows.find((item) => item.key === key)
    const numericValue = Number(rawValue)
    if (!row || !Number.isFinite(numericValue)) return
    const nextConfig: DinoConfig = { ...draftConfig, [key]: clamp(numericValue, row.min, row.max) }
    setDraftConfig(nextConfig)
    setCode(formatConfigCode(nextConfig))
  }

  const stepDraftVariable = (key: DinoConfigKey, direction: 1 | -1) => {
    const row = variableRows.find((item) => item.key === key)
    if (!row) return
    const nextValue = clamp(draftConfig[key] + row.step * direction, row.min, row.max)
    const nextConfig: DinoConfig = { ...draftConfig, [key]: nextValue }
    setDraftConfig(nextConfig)
    setCode(formatConfigCode(nextConfig))
  }

  return (
    <main className="dino-lab-screen">
      <section className="lab-workspace">
        <div className="world-panel">
          <div className="world-panel__label">
            <div>
              <small>LIVE OUTPUT</small>
              <strong>THE WORLD</strong>
            </div>
          </div>
          <DinoGame
            config={config}
            runPulse={runPulse}
            challengeActive={challengeUnlocked && !challengeComplete}
            onChallengeComplete={completeChallenge}
          />
        </div>

        <div className="lab-side">
          <section className={`mission-card ${missionCardComplete ? 'is-complete' : ''}`}>
            <span className="mission-card__icon"><Flag size={34} fill="currentColor" /></span>
            <div className="mission-card__copy">
              <span className="mission-card__lab-name">RUNNER LAB</span>
              <small>{missionNumberLabel}</small>
              <strong>{missionName}</strong>
              <p>{missionInstruction}</p>
            </div>
            <button className="mission-card__hint" onClick={revealHint}>
              <Lightbulb size={18} />
              HINT
              <span>{Math.min(3, hintLevel + 1)}/3</span>
            </button>
          </section>

          <div className="code-panel">
            <div className="code-panel__bar">
              <div><span className="python-mark">PY</span><strong>PYTHON</strong></div>
              <span><Save size={14} /> {saved ? 'runner_lab.py' : 'saving...'}</span>
            </div>
            <div className="variable-console" role="group" aria-label="Python code editor">
              {variableRows.map((row, index) => {
                const complete = row.missionId ? profile.completedMissions.includes(row.missionId) : false
                const target = missionTarget === row.key
                return (
                  <div key={row.key} className={`variable-row ${target ? 'is-target' : ''} ${complete ? 'is-complete' : ''}`}>
                    <span className="variable-row__line">{index + 1}</span>
                    <label className="variable-row__name" htmlFor={`variable-${row.key}`}>{row.key}</label>
                    <span className="variable-row__equals">=</span>
                    <div className="variable-value">
                      <input
                        id={`variable-${row.key}`}
                        type="number"
                        min={row.min}
                        max={row.max}
                        step={row.step}
                        value={draftConfig[row.key]}
                        onChange={(event) => updateDraftVariable(row.key, event.target.value)}
                        aria-label={`${row.label} value`}
                      />
                      <div className="variable-stepper">
                        <button type="button" onClick={() => stepDraftVariable(row.key, 1)} aria-label={`Increase ${row.label}`}><ChevronUp size={17} /></button>
                        <button type="button" onClick={() => stepDraftVariable(row.key, -1)} aria-label={`Decrease ${row.label}`}><ChevronDown size={17} /></button>
                      </div>
                    </div>
                    {complete && <Check className="variable-row__check" size={18} />}
                  </div>
                )
              })}
            </div>
            <div className="code-actions">
              <button className="reset-button" onClick={() => setShowReset(true)}><RotateCcw size={17} /> RESET</button>
              <button className="run-button" onClick={runCode} disabled={runningCode || runtimeState === 'unavailable'}>
                {runningCode ? <LoaderCircle className="spin" size={22} /> : <Play size={23} fill="currentColor" />}
                {runningCode ? 'RUNNING WORLD...' : 'RUN WORLD'}
                <kbd>CTRL + ENTER</kbd>
              </button>
            </div>
            <div className="code-message"><Zap size={18} /><span>Run the world to see how your changes affect the game.</span></div>
          </div>
        </div>
      </section>

      <nav className="mission-stepbar" aria-label={`${completedCount} of ${dinoMissions.length} missions complete`}>
        {dinoMissions.map((item, index) => {
          const complete = profile.completedMissions.includes(item.id)
          return (
            <button
              key={item.id}
              className={`${selectedMission === index ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}
              onClick={() => { setSelectedMission(index); setShowHint(false); setHintLevel(0) }}
              aria-label={`${item.number} ${item.title}${complete ? ', complete' : ''}`}
            >
              <span>{item.number}</span>
              <strong>{item.title}</strong>
              {complete && <Check size={22} />}
            </button>
          )
        })}
      </nav>

      {showHint && (
        <aside className="hint-popover" role="dialog" aria-label="Progressive hint">
          <button onClick={() => setShowHint(false)} aria-label="Close hint"><X size={16} /></button>
          <span className="hint-popover__bulb"><Lightbulb /></span>
          <small>HINT {hintLevel + 1} OF 3</small>
          <strong>{mission.title}</strong>
          <p>{missionHints[hintLevel]}</p>
          {hintLevel < 2 && <button className="hint-next" onClick={() => setHintLevel((level) => level + 1)}>ONE MORE CLUE</button>}
          <div>{[0, 1, 2].map((level) => <i key={level} className={level <= hintLevel ? 'is-active' : ''} />)}</div>
        </aside>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {showReset && (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
            <span><RotateCcw /></span>
            <small>RESET EXPERIENCE</small>
            <h2 id="reset-title">Rewind this experiment?</h2>
            <p>Your current code will return to the starter values. Earned XP and cleared missions will stay.</p>
            <div><button className="ghost-button" onClick={() => setShowReset(false)}>KEEP MY CODE</button><button className="danger-button" onClick={reset}>RESET CODE</button></div>
          </div>
        </div>
      )}

      {showReveal && (
        <div className="modal-backdrop" role="presentation">
          <div className="concept-modal" role="dialog" aria-modal="true" aria-labelledby="concept-title">
            <button onClick={() => setShowReveal(false)} aria-label="Close"><X /></button>
            <div className="concept-modal__spark"><Sparkles /></div>
            <p className="kicker">NEW TOOL UNLOCKED</p>
            <h2 id="concept-title">VARIABLES</h2>
            <code>player_speed <span>=</span> 15</code>
            <p>Those values you changed have a name. A <b>variable</b> gives a name to a value so your program can use and change it.</p>
            <button className="primary-button" onClick={() => setShowReveal(false)}>I CHANGED THE WORLD</button>
          </div>
        </div>
      )}
    </main>
  )
}

function getMissionTarget(missionId: string): DinoConfigKey | null {
  const targets: Record<string, DinoConfigKey> = {
    'super-speed': 'player_speed',
    'moon-mode': 'jump_power',
    'giant-mode': 'obstacle_speed',
    'chaos-mode': 'obstacle_count',
    'survivor-mode': 'lives',
  }
  return targets[missionId] ?? null
}

function readConfigFromCode(code: string, fallback: DinoConfig): DinoConfig {
  return codeRows.reduce<DinoConfig>((nextConfig, row) => {
    const pattern = new RegExp(`^\\s*${row.key}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`, 'm')
    const match = code.match(pattern)
    if (!match) return nextConfig
    const value = Number(match[1])
    return Number.isFinite(value) ? { ...nextConfig, [row.key]: clamp(value, row.min, row.max) } : nextConfig
  }, { ...fallback })
}

function formatConfigCode(config: DinoConfig): string {
  return codeRows.map((row) => `${row.key} = ${config[row.key]}`).join('\n')
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getMissionHints(missionId: string): string[] {
  const hints: Record<string, string[]> = {
    'super-speed': ['Which value sounds like it controls movement speed?', 'Look at player_speed near the top.', 'Try setting player_speed to 10 or more.'],
    'moon-mode': ['Which value sounds like it controls the jump?', 'Look at the line that starts with jump_power.', 'Try setting jump_power to 20 or more.'],
    'giant-mode': ['Which value could make hazards move?', 'Look for obstacle_speed.', 'Try setting obstacle_speed to 10 or more.'],
    'chaos-mode': ['How could you ask the game for more obstacles?', 'Look for obstacle_count.', 'Try setting obstacle_count to 10 or more.'],
    'survivor-mode': ['What would help you survive many collisions?', 'The lives variable is near the bottom.', 'Try setting lives to 20 or more.'],
  }
  return hints[missionId]
}

function getReaction(config: DinoConfig): string {
  if (config.gravity === 0) return 'Zero gravity! Welcome to the PixPy space program.'
  if (config.player_size >= 100) return "Okay, that's a VERY big runner."
  if (config.obstacle_count === 0) return 'No obstacles? You found peaceful mode.'
  if (config.player_speed >= 25) return 'The speed sensors are screaming.'
  return 'Signal accepted. What will you change next?'
}
