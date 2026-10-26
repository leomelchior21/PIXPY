import { useEffect, useRef, useState } from 'react'
import { SkipForward } from 'lucide-react'
import { supportsWebGL, tapeLoading, tapeTimeline, type TapeCue, type TapeKind, type TapeLabel } from './tapeTimeline'

interface Props {
  kind: TapeKind
  label: TapeLabel
  // Every tape on the shelf, and the slot of the one being played.
  shelf: TapeLabel[]
  slot: number
  reduced: boolean
  onCue: (cue: TapeCue) => void
  onDone: () => void
}

// The tape change: a 3D camcorder takes the tape before a run; a retry rewinds it.
export function TapeDeck({ kind, label, shelf, slot, reduced, onCue, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stage, setStage] = useState<TapeCue | 'start'>('start')
  const [mode, setMode] = useState<'loading' | '3d' | 'flat'>(kind === 'insert' ? 'loading' : 'flat')
  const callbacks = useRef({ onCue, onDone })
  callbacks.current = { onCue, onDone }
  const finished = useRef(false)
  // Seconds into the loading screen, or null before it starts.
  const [booting, setBooting] = useState<number | null>(null)

  useEffect(() => {
    const cue = (next: TapeCue) => { setStage(next); callbacks.current.onCue(next) }
    const done = () => { if (!finished.current) { finished.current = true; callbacks.current.onDone() } }
    let disposed = false
    let handle: { dispose(): void } | null = null
    const timers: number[] = []
    // A new tape loads before the briefing: the 3D deck closes and the level builds step by step.
    let loadingStarted = false
    const finish = () => {
      if (finished.current || loadingStarted) return
      if (kind !== 'insert' || reduced) { done(); return }
      loadingStarted = true
      handle?.dispose()
      handle = null
      const started = performance.now()
      // Browser checks film at a slower pace; students always get real time.
      const pace = (window as unknown as { __tapeDeckPace?: number }).__tapeDeckPace ?? 1
      setBooting(0)
      const tick = window.setInterval(() => setBooting(((performance.now() - started) / 1000) * pace), 80)
      timers.push(tick)
      timers.push(window.setTimeout(() => { window.clearInterval(tick); done() }, (tapeLoading.end / pace) * 1000))
    }
    const flat = () => {
      setMode('flat')
      const { cues, end } = tapeTimeline[kind]
      cues.forEach(([at, name]) => timers.push(window.setTimeout(() => cue(name), at * 1000)))
      timers.push(window.setTimeout(finish, end * 1000))
    }
    if (reduced) {
      setMode('flat')
      setStage('play')
      timers.push(window.setTimeout(finish, 700))
    } else if (kind === 'insert' && supportsWebGL()) {
      let drawing = false
      // A scene that never draws must not hold the student at a black screen.
      timers.push(window.setTimeout(() => { if (!drawing) finish() }, 8000))
      import('./tapeDeckScene')
        .then((module) => {
          if (disposed) return
          handle = canvasRef.current ? module.createTapeDeckScene(canvasRef.current, label, shelf, slot, cue, finish, () => { drawing = true; setMode('3d') }) : null
          if (!handle) { drawing = true; flat() }
        })
        .catch(() => { if (!disposed) flat() })
    } else flat()
    return () => {
      disposed = true
      handle?.dispose()
      timers.forEach((id) => { window.clearTimeout(id); window.clearInterval(id) })
    }
    // The sequence runs once per mount; the parent remounts it for every tape.
  }, [])

  const skip = () => { if (!finished.current) { finished.current = true; callbacks.current.onDone() } }
  const status = stage === 'pull' ? 'TAPE OFF THE SHELF' : stage === 'eject' ? '⏏ EJECT' : stage === 'insert' || stage === 'seat' || stage === 'clack' ? 'TAPE IN' : stage === 'motor' || stage === 'zoom' ? 'LOADING' : ''

  return <div className={`br-deck br-deck--${kind} is-${mode} stage-${stage}`} role="dialog" aria-label={`Loading tape ${label.number}`}>
    {kind === 'insert' && <canvas ref={canvasRef} className="br-deck-canvas" aria-hidden="true" />}
    {kind === 'insert' && mode === 'flat' && <div className="br-deck-flat" aria-hidden="true">
      <div className="br-deck-cassette">
        <div className="br-deck-window"><i /><i /></div>
        <div className={`br-deck-label ${label.deep ? 'is-deep' : ''}`}>
          <small>{label.deep ? 'DO NOT PLAY' : 'LEVEL 0 · FOUND FOOTAGE'}<b>TAPE {label.number}</b></small>
          <strong>{label.title}</strong>
          <em>{label.focus}</em>
        </div>
      </div>
    </div>}
    {kind === 'rewind' && <div className="br-deck-rewind" aria-hidden="true"><i /><i /><i /><i /></div>}

    <div className="br-deck-osd">
      <span className="br-deck-kicker">{kind === 'rewind' ? 'REWIND' : `TAPE ${label.number}`} · {label.title}</span>
      {kind === 'rewind' && stage !== 'play' && <b className="br-deck-rew">◀◀ REW</b>}
      {status && <b className="br-deck-status" key={status}>{status}{status === 'LOADING' && <i><span /><span /><span /></i>}</b>}
    </div>

    {stage === 'play' || stage === 'static' ? <div className={`br-deck-blue ${kind === 'rewind' ? 'is-clear' : ''}`} aria-hidden="true">
      <span className="br-deck-play">▶ PLAY</span>
      <span className="br-deck-sp">SP</span>
      {kind === 'insert' && <strong>TAPE {label.number}<small>{label.title}</small></strong>}
      <span className="br-deck-counter">0:00:00</span>
      <i className="br-deck-tracking" />
    </div> : null}
    {stage === 'static' && <div className="br-deck-static" aria-hidden="true" />}

    {booting !== null && <TapeLoading label={label} elapsed={booting} />}

    <button className="br-deck-skip" onClick={skip}>SKIP <SkipForward size={14} /></button>
  </div>
}

// VHS loading screen: spinning reels, a block bar, the level being built, and one thing to remember.
function TapeLoading({ label, elapsed }: { label: TapeLabel; elapsed: number }) {
  const share = Math.min(1, elapsed / (tapeLoading.end - 0.25))
  // The bar stutters like a tape motor: quick, a pause, quick again.
  const percent = Math.min(100, Math.round(100 * (share < 0.45 ? share * 1.3 : share < 0.6 ? 0.585 : 0.585 + (share - 0.6) * 1.04)))
  const steps = tapeLoading.steps
  return <div className="br-boot" role="status" aria-label={`Loading tape ${label.number}: ${percent}%`}>
    <div className="br-boot-reels" aria-hidden="true"><i /><span /><i /></div>
    <strong>LOADING TAPE {label.number}</strong>
    <small>{label.title}</small>
    <div className="br-boot-bar" aria-hidden="true">{Array.from({ length: 20 }, (_, index) => <i key={index} className={index < Math.round(percent / 5) ? 'is-on' : ''} />)}</div>
    <b className="br-boot-percent">{percent}%</b>
    <ol className="br-boot-steps">{steps.map(([at, text], index) => {
      const next = steps[index + 1]?.[0] ?? tapeLoading.end - 0.25
      const state = elapsed >= next ? 'is-done' : elapsed >= at ? 'is-now' : ''
      return <li key={text} className={state}>{state === 'is-done' ? '✓' : state === 'is-now' ? '▸' : '·'} {text}</li>
    })}</ol>
    {label.tip && <p className="br-boot-tip">REMEMBER <code>{label.tip}</code></p>}
  </div>
}
