import { Play, RotateCcw, SlidersHorizontal, Zap } from 'lucide-react'
import { useState } from 'react'
import { DinoGame } from '../../components/DinoGame'
import { ExperienceShell } from '../../components/ExperienceShell'
import { dinoHints, starterConfig, starterValues } from '../../data/dinoLab'
import { validateDinoValues } from '../../lib/dinoValidation'
import { completeActivity } from '../../session/progressSession'
import type { DinoValueKey, DinoValues, SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void }

const controls: Array<{ key: DinoValueKey; label: string; min: number; max: number; step: number }> = [
  { key: 'speed', label: 'Speed', min: 1, max: 50, step: 1 },
  { key: 'jump', label: 'Jump', min: 1, max: 60, step: 1 },
  { key: 'gravity', label: 'Gravity', min: 0, max: 30, step: 1 },
  { key: 'obstacles', label: 'Obstacles', min: 0, max: 18, step: 1 },
  { key: 'player_size', label: 'Dino size', min: 16, max: 120, step: 2 },
]

export function DinoVariables({ progress, onProgress, onBack }: Props) {
  const [values, setValues] = useState<DinoValues>(starterValues)
  const [config, setConfig] = useState(starterConfig)
  const [runPulse, setRunPulse] = useState(0)
  const [message, setMessage] = useState('Move a slider. Run it. Watch the world change.')
  const completed = progress.completed.includes('dino-variables')

  const change = (key: DinoValueKey, value: number) => setValues((current) => ({ ...current, [key]: value }))

  const run = () => {
    const result = validateDinoValues(values)
    setConfig(result.config)
    setRunPulse((value) => value + 1)
    setMessage(result.warnings[0] ?? reaction(values))
    onProgress(completeActivity({ ...progress, interestingValues: [...progress.interestingValues, `Dino: speed ${values.speed}, gravity ${values.gravity}`].slice(-8) }, 'dino-variables'))
  }

  const reset = () => {
    setValues(starterValues)
    setConfig(starterConfig)
    setRunPulse((value) => value + 1)
    setMessage('Back to normal. Now change anything you want.')
  }

  return (
    <ExperienceShell order="01" title="Dino Variables" question="What happens when a value changes?" accent="#b9f352" hints={dinoHints} completed={completed} objective="There are no levels. Move any control, run the world, and make your own version." onBack={onBack} onComplete={() => onProgress(completeActivity(progress, 'dino-variables'))} className="dino-experience">
      <section className="dino-world panel-surface">
        <div className="panel-label"><span>LIVE WORLD</span><strong>WATCH THE DINO</strong></div>
        <DinoGame config={config} runPulse={runPulse} />
      </section>
      <section className="dino-control-panel panel-surface">
        <header><SlidersHorizontal /><div><small>REAL PYTHON CONTROLS</small><h2>Change the world</h2><p>Each slider changes the value beside its Python name.</p></div></header>
        <div className="dino-sliders">
          {controls.map((control) => (
            <label key={control.key} htmlFor={`dino-${control.key}`}>
              <span><code>{control.key}</code><i>=</i><strong>{values[control.key]}</strong></span>
              <input id={`dino-${control.key}`} type="range" min={control.min} max={control.max} step={control.step} value={values[control.key]} onChange={(event) => change(control.key, Number(event.target.value))} />
            </label>
          ))}
        </div>
        <div className="run-row"><button className="secondary-action" onClick={reset}><RotateCcw /> Reset</button><button className="primary-action" onClick={run}><Play fill="currentColor" /> RUN IT</button></div>
        <p className="machine-message" role="status"><Zap />{message}</p>
      </section>
    </ExperienceShell>
  )
}

function reaction(values: DinoValues): string {
  if (values.gravity === 0) return 'ZERO GRAVITY. You started a space program.'
  if (values.player_size >= 90) return 'THAT IS A LOT OF DINO.'
  if (values.obstacles >= 10) return 'Obstacle chaos. Excellent choice.'
  if (values.speed >= 15) return 'That dino is FAST.'
  if (values.jump >= 25) return 'The dino can practically fly.'
  return 'The world changed. Move another slider.'
}
