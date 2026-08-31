import { python } from '@codemirror/lang-python'
import CodeMirror from '@uiw/react-codemirror'
import { ArrowLeft, Check, ChevronRight, Lightbulb, LoaderCircle, Play, RotateCcw, Save, Sparkles, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DinoGame } from '../components/DinoGame'
import { Toast } from '../components/Toast'
import { dinoMissions, starterCode, starterConfig } from '../data/dinoLab'
import { pythonRunner } from '../lib/pythonRunner'
import { saveCloudProgress } from '../lib/supabase'
import { loadDinoCode, loadDinoConfig, resetDinoStorage, saveDinoCode, saveDinoConfig } from '../lib/storage'
import type { DinoConfig, StudentProfile } from '../types'

interface DinoLabScreenProps {
  profile: StudentProfile
  onBack: () => void
  onUpdateProfile: (profile: StudentProfile) => void
}

type RuntimeState = 'booting' | 'ready' | 'unavailable'

export function DinoLabScreen({ profile, onBack, onUpdateProfile }: DinoLabScreenProps) {
  const [code, setCode] = useState(loadDinoCode)
  const [config, setConfig] = useState<DinoConfig>(loadDinoConfig)
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

  const mission = dinoMissions[selectedMission]
  const completedCount = profile.completedMissions.length
  const missionHints = useMemo(() => getMissionHints(mission.id), [mission.id])

  const runCode = async () => {
    if (runningCode) return
    setRunningCode(true)
    setToast(null)
    try {
      const result = await pythonRunner.run(code)
      setConfig(result.config)
      saveDinoConfig(result.config)
      saveDinoCode(code)
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
      void saveCloudProgress(nextProfile, code, result.config).catch(() => undefined)

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
    setCode(starterCode)
    setConfig(starterConfig)
    resetDinoStorage()
    setRunPulse((value) => value + 1)
    setShowReset(false)
    setToast({ message: 'Dino Lab reset to its original signal.', tone: 'neutral' })
  }

  return (
    <main className="dino-lab-screen">
      <div className="lab-toolbar">
        <button className="back-button" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <div className="lab-toolbar__title"><span>EXPERIENCE 01</span><strong>DINO LAB</strong><em>Variables</em></div>
        <div className={`runtime-status runtime-status--${runtimeState}`}><i /> {runtimeState === 'ready' ? 'PYTHON READY' : runtimeState === 'booting' ? 'WAKING PYTHON...' : 'PYTHON OFFLINE'}</div>
        <button className="hint-button" onClick={revealHint}><Lightbulb size={17} /> HINT <span>{Math.min(3, hintLevel + 1)}/3</span></button>
      </div>

      <section className="lab-workspace">
        <div className="world-panel">
          <div className="panel-label"><span>01</span><div><small>LIVE OUTPUT</small><strong>THE WORLD</strong></div><i>CLICK OR SPACE TO JUMP</i></div>
          <DinoGame config={config} runPulse={runPulse} />
          <div className="mission-dock">
            <div className="mission-dock__title"><span>MISSIONS</span><small>{completedCount}/{dinoMissions.length} CLEARED</small></div>
            <div className="mission-tabs">
              {dinoMissions.map((item, index) => {
                const complete = profile.completedMissions.includes(item.id)
                return (
                  <button
                    key={item.id}
                    className={`${selectedMission === index ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}
                    onClick={() => { setSelectedMission(index); setShowHint(false); setHintLevel(0) }}
                  >
                    <span>{complete ? <Check size={13} /> : item.number}</span>
                    <strong>{item.title}</strong>
                  </button>
                )
              })}
            </div>
            <div className="mission-brief">
              <div><small>CURRENT MISSION // {mission.number}</small><strong>{mission.title}</strong><p>{mission.instruction}</p></div>
              <span>+{mission.reward} XP</span>
              {profile.completedMissions.includes(mission.id) && <b><Check size={14} /> CLEARED</b>}
            </div>
          </div>
        </div>

        <div className="code-panel">
          <div className="panel-label panel-label--code"><span>02</span><div><small>PYTHON CONTROL</small><strong>THE CODE</strong></div><i className={saved ? 'is-saved' : ''}><Save size={13} /> {saved ? 'SAVED' : 'SAVING'}</i></div>
          <div className="code-message"><Zap size={15} /><span>Change a number. Then run it and watch the world react.</span></div>
          <div className="editor-shell">
            <div className="editor-tab"><span className="python-mark">PY</span> dino_lab.py <i>●</i></div>
            <CodeMirror
              value={code}
              height="100%"
              theme="dark"
              extensions={[python()]}
              onChange={setCode}
              basicSetup={{
                foldGutter: false,
                dropCursor: false,
                allowMultipleSelections: false,
                indentOnInput: false,
                bracketMatching: true,
                closeBrackets: false,
                autocompletion: false,
                rectangularSelection: false,
                crosshairCursor: false,
                highlightActiveLine: true,
                highlightSelectionMatches: false,
                closeBracketsKeymap: false,
                searchKeymap: false,
                foldKeymap: false,
                completionKeymap: false,
              }}
              aria-label="Python code editor"
            />
          </div>
          <div className="code-actions">
            <button className="reset-button" onClick={() => setShowReset(true)}><RotateCcw size={16} /> RESET</button>
            <button className="run-button" onClick={runCode} disabled={runningCode || runtimeState === 'unavailable'}>
              {runningCode ? <LoaderCircle className="spin" size={20} /> : <Play size={20} fill="currentColor" />}
              {runningCode ? 'RUNNING PYTHON...' : 'RUN IT'}
            </button>
          </div>
          <div className="code-footer"><span>REAL PYTHON · SAFE MODE</span><span>Changes run inside your browser</span></div>
        </div>
      </section>

      {showHint && (
        <aside className="hint-popover" role="dialog" aria-label="Progressive hint">
          <button onClick={() => setShowHint(false)} aria-label="Close hint"><X size={16} /></button>
          <span className="hint-popover__bulb"><Lightbulb /></span>
          <small>HINT {hintLevel + 1} OF 3</small>
          <strong>{mission.title}</strong>
          <p>{missionHints[hintLevel]}</p>
          {hintLevel < 2 && <button className="hint-next" onClick={() => setHintLevel((level) => level + 1)}>ONE MORE CLUE <ChevronRight size={15} /></button>}
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

function getMissionHints(missionId: string): string[] {
  const hints: Record<string, string[]> = {
    'super-speed': ['Which value sounds like it controls movement speed?', 'Look at player_speed near the top.', 'Try setting player_speed to 15 or more.'],
    'moon-mode': ['Which force pulls the runner back to the track?', 'Look at the line that starts with gravity.', 'Try setting gravity below 4.'],
    'giant-mode': ['Find the value that controls how large the player looks.', 'The line is called player_size.', 'Try setting player_size to 80 or more.'],
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
