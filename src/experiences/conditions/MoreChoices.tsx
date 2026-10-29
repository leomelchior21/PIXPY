import { ArrowDownUp, ArrowLeft, ArrowRight, Check, CircleHelp, Lightbulb, Minus, MoveDown, Plus, RotateCcw, ScanLine, Sparkles, Split, Trophy, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { PythonCode } from '../../components/PythonCode'
import { chainComplete, chainMap, chainProgram, firstMismatch, moreChoiceLevels, runChain, unreachableMessages, type ChainLine, type DecisionChain, type MapSegment, type MoreChoiceLevel } from '../../data/moreChoices'
import type { DecisionRun } from '../../lib/decisionTracer'
import { completeActivity } from '../../session/progressSession'
import type { MoreChoiceEvent, SessionProgress } from '../../types'
import { MoreChoicesGuide } from './MoreChoicesGuide'
import './moreChoices.css'

interface Props {
  progress: SessionProgress
  onProgress: (progress: SessionProgress) => void
  onBack: () => void
}

type Tone = 'info' | 'good' | 'bad'
interface Message { tone: Tone; title: string; text: string }

// Tower geometry, in SVG units.
const W = 560
const TRUNK = 40
const GATE_X = 66
const GATE_W = 236
const BIN_X = 352
const BIN_W = 188
const ROW_H = 56
const Y0 = 112
const ROW_GAP = 102
const START_Y = 28
const rowY = (row: number) => Y0 + row * ROW_GAP

interface Frame {
  x: number
  y: number
  line: number | null
  tested?: { rule: number; truth: boolean; text: string }
  lit?: number
  spark?: number
  exit?: boolean
}

function reducedMotion(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Turns Python's trace into ball positions through the tower. */
function buildFrames(chain: DecisionChain, layout: ChainLine[], run: DecisionRun): Frame[] {
  const rows = chain.rules.length
  const frames: Frame[] = [{ x: TRUNK, y: START_Y, line: 0 }]
  const lineInfo = (line: number) => layout.find((entry) => entry.line === line)
  for (const event of run.events) {
    const info = lineInfo(event.line)
    if (!info || info.rule === undefined) continue
    if (event.kind === 'test') frames.push({ x: TRUNK, y: rowY(info.rule), line: event.line, tested: { rule: info.rule, truth: Boolean(event.truth), text: event.text } })
    if (event.kind === 'else' && info.rule === rows - 1) frames.push({ x: TRUNK, y: rowY(rows), line: event.line })
    if (event.kind === 'print') {
      if (chain.shape === 'nested') frames.push({ x: BIN_X + 28, y: rowY(info.rule), line: event.line, lit: info.rule })
      else frames.push({ x: TRUNK, y: rowY(info.rule), line: event.line, spark: info.rule })
    }
  }
  if (chain.shape === 'separate') frames.push({ x: TRUNK, y: rowY(rows), line: null, exit: true })
  return frames
}

function bins(chain: DecisionChain): string[] {
  return chain.shape === 'nested' ? [...chain.rules.map((rule) => rule.message), chain.elseMessage ?? ''] : chain.rules.map((rule) => rule.message)
}

export function MoreChoices({ progress, onProgress, onBack }: Props) {
  const solved = progress.moreChoiceLevels
  const nextOpen = moreChoiceLevels.findIndex((level) => !solved.includes(level.id))
  const [index, setIndex] = useState(() => Math.max(0, nextOpen))
  const [finished, setFinished] = useState(() => nextOpen === -1)
  const [guide, setGuide] = useState(() => !progress.moreChoiceTutorialSeen)
  const progressRef = useRef(progress)
  useEffect(() => { progressRef.current = progress }, [progress])
  const accessible = (i: number) => progress.isTeacher || solved.includes(moreChoiceLevels[i].id) || i === nextOpen

  const log = (event: Omit<MoreChoiceEvent, 'at'>, solvedLevel = false) => {
    const previous = progressRef.current
    const levels = solvedLevel ? [...new Set([...previous.moreChoiceLevels, event.level])].sort((a, b) => a - b) : previous.moreChoiceLevels
    let updated: SessionProgress = { ...previous, moreChoiceLevels: levels, moreChoiceLog: [...previous.moreChoiceLog, { ...event, at: Date.now() }].slice(-200) }
    if (levels.length === moreChoiceLevels.length) updated = completeActivity(updated, 'more-than-one-choice')
    progressRef.current = updated
    onProgress(updated)
  }

  const closeGuide = () => {
    setGuide(false)
    if (progressRef.current.moreChoiceTutorialSeen) return
    const updated = { ...progressRef.current, moreChoiceTutorialSeen: true }
    progressRef.current = updated
    onProgress(updated)
  }
  const openGuide = () => setGuide(true)
  const tutorial = guide && <MoreChoicesGuide onClose={closeGuide} />

  const next = () => {
    const levels = progressRef.current.moreChoiceLevels
    if (index === moreChoiceLevels.length - 1) { if (levels.length === moreChoiceLevels.length) setFinished(true); else onBack(); return }
    setIndex(index + 1)
  }

  if (finished) return <main className="mc-screen">
    <Toolbar onBack={onBack} onHelp={openGuide} counter={<><Trophy size={18} /> Complete!</>} />
    <LevelNav index={-1} solved={solved} accessible={accessible} onSelect={(i) => { setIndex(i); setFinished(false) }} />
    <section className="mc-finish">
      <div className="mc-finish__card">
        <div className="mc-finish__tree" aria-hidden="true"><i /><i /><i /><b /><b /><b /></div>
        <p className="mc-kicker">ALL 8 LEVELS COMPLETE</p>
        <h1>Three paths. One answer.</h1>
        <p>You found overlaps and gaps in separate ifs, nested an if inside else, fixed the order, and built your own three-way decisions.</p>
        <div className="mc-finish__actions"><button className="mc-primary" onClick={() => { setIndex(0); setFinished(false) }}><RotateCcw size={17} /> PLAY AGAIN</button><button className="mc-secondary" onClick={onBack}>BACK TO CONDITIONS <ArrowRight size={17} /></button></div>
      </div>
    </section>
    {tutorial}
  </main>

  return <>
    <ChoiceLevel key={moreChoiceLevels[index].id} level={moreChoiceLevels[index]} index={index} solved={solved} accessible={accessible}
      onSelect={(i) => { if (accessible(i)) setIndex(i) }} onBack={onBack} onHelp={openGuide} onLog={log} onNext={next} />
    {tutorial}
  </>
}

function Toolbar({ onBack, onHelp, counter }: { onBack: () => void; onHelp: () => void; counter: React.ReactNode }) {
  return <header className="mc-toolbar">
    <button className="mc-back" onClick={onBack}><ArrowLeft size={17} /> Conditions</button>
    <div className="mc-brand"><span><Split size={20} /></span><div><b>MORE THAN ONE CHOICE?</b><small>THE SORTING TOWER</small></div></div>
    <div className="mc-counter">{counter}<button className="mc-help" onClick={onHelp} aria-label="How the sorting tower works"><CircleHelp size={18} /></button></div>
  </header>
}

function LevelNav({ index, solved, accessible, onSelect, disabled = false }: { index: number; solved: number[]; accessible: (i: number) => boolean; onSelect: (i: number) => void; disabled?: boolean }) {
  return <nav className="mc-levels" aria-label="Sorting tower levels">{moreChoiceLevels.map((level, i) => {
    const done = solved.includes(level.id)
    return <button key={level.id} className={`${i === index ? 'is-current' : ''} ${done ? 'is-done' : ''}`} disabled={disabled || !accessible(i)} aria-current={i === index ? 'step' : undefined}
      aria-label={`Level ${level.id}: ${level.title}${done ? ', solved' : accessible(i) ? '' : ', locked'}`} onClick={() => onSelect(i)}>
      <span>{done ? <Check size={12} /> : level.id}</span><small>{level.skill}</small>
    </button>
  })}</nav>
}

interface LevelProps {
  level: MoreChoiceLevel
  index: number
  solved: number[]
  accessible: (i: number) => boolean
  onSelect: (i: number) => void
  onBack: () => void
  onHelp: () => void
  onLog: (event: Omit<MoreChoiceEvent, 'at'>, solved?: boolean) => void
  onNext: () => void
}

type Slot = 'q0' | 'q1' | 'm0' | 'm1' | 'm2'
const slotOrder: Slot[] = ['q0', 'm0', 'q1', 'm1', 'm2']

function ChoiceLevel({ level, index, solved, accessible, onSelect, onBack, onHelp, onLog, onNext }: LevelProps) {
  const builder = level.mode === 'build' || level.mode === 'convert' || level.mode === 'solo'
  const [chain, setChain] = useState<DecisionChain>(level.chain)
  const [value, setValue] = useState(level.start)
  const [frames, setFrames] = useState<Frame[]>([])
  const [frame, setFrame] = useState(-1)
  const [run, setRun] = useState<DecisionRun | null>(null)
  const [dropping, setDropping] = useState(false)
  const [visited, setVisited] = useState<string[]>([])
  const [round, setRound] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [prediction, setPrediction] = useState<string | null>(null)
  const [mapShown, setMapShown] = useState(level.mode === 'order' || level.mode === 'build' || level.mode === 'convert')
  const [scanning, setScanning] = useState(false)
  const [mismatch, setMismatch] = useState<{ from: number; to: number } | null>(null)
  const [swapPhase, setSwapPhase] = useState<'idle' | 'moving' | 'snap'>('idle')
  const swapping = swapPhase !== 'idle'
  const [activeSlot, setActiveSlot] = useState<Slot>('q0')
  const [hintOpen, setHintOpen] = useState(false)
  const [complete, setComplete] = useState(false)
  const [showWin, setShowWin] = useState(false)
  const [message, setMessage] = useState<Message>({ tone: 'info', title: level.title, text: level.instruction })
  const timers = useRef<number[]>([])
  const version = useRef(0)
  useEffect(() => () => { version.current += 1; timers.current.forEach((id) => window.clearTimeout(id)) }, [])
  const later = (callback: () => void, delay: number) => { timers.current.push(window.setTimeout(callback, delay)) }

  const ready = chainComplete(chain)
  const { lines, layout } = chainProgram(chain, level.variable)
  const segments = useMemo(() => ready ? chainMap(chain, level) : [], [chain, level, ready])
  const missionSegments = useMemo(() => level.target ? chainMap(level.target, level) : [], [level])
  const beforeSegments = useMemo(() => level.before ? chainMap(level.before, level) : [], [level])
  const unreachable = ready && mapShown ? unreachableMessages(chain, segments) : []
  const roundValue = level.rounds ? level.rounds[Math.min(round, level.rounds.length - 1)][attempt % level.rounds[0].length] : null
  const dropValue = roundValue ?? value
  const colorOf = (text: string) => level.messages.find((item) => item.text === text)?.color ?? '#8b8fa3'
  const current = frame >= 0 ? frames[frame] : null
  const seen = frames.slice(0, frame + 1)
  const binTexts = bins(chain)

  const fail = (title: string, text: string) => setMessage({ tone: 'bad', title, text })
  const win = (text: string) => {
    if (complete) return
    setComplete(true); setMapShown(true)
    setMessage({ tone: 'good', title: 'Level solved!', text })
    onLog({ level: level.id, kind: level.mode === 'predict' ? 'prediction' : level.mode === 'build' || level.mode === 'convert' || level.mode === 'solo' ? 'check' : 'drop', ok: true }, true)
    later(() => setShowWin(true), reducedMotion() ? 0 : 700)
  }

  const evaluateDrop = (result: DecisionRun, input: number) => {
    const outputs = result.outputs
    const said = outputs.length ? outputs.map((output) => `“${output}”`).join(' and ') : 'nothing'
    if (level.mode === 'overlap') {
      if (outputs.length >= 2) win(`With ${input}${level.unit}, two separate questions were TRUE, so Python printed ${said}.`)
      else { fail(`${input}${level.unit} → ${said}.`, 'Only one message this time. Keep hunting for a value that makes two questions TRUE.'); onLog({ level: level.id, kind: 'drop', ok: false }) }
      return
    }
    if (level.mode === 'gap') {
      if (outputs.length === 0) win(`With ${input}${level.unit}, both questions were FALSE. The phone printed nothing at all.`)
      else { fail(`${input}${level.unit} → ${said}.`, 'The phone still said something. Find the value that slips between both questions.'); onLog({ level: level.id, kind: 'drop', ok: false }) }
      return
    }
    if (level.mode === 'visitAll') {
      const nextVisited = [...new Set([...visited, ...outputs])]
      setVisited(nextVisited)
      const missing = binTexts.filter((text) => !nextVisited.includes(text))
      if (!missing.length) { win('Every temperature landed in exactly one bin. The inner if only runs when the first answer is FALSE.'); return }
      onLog({ level: level.id, kind: 'drop', ok: true })
      setMessage({ tone: 'info', title: `${input}${level.unit} → ${said}.`, text: `Exactly one message. Still to find: ${missing.join(', ')}.` })
      return
    }
    if (level.mode === 'predict') {
      const actual = outputs[0] ?? ''
      const right = actual === prediction
      onLog({ level: level.id, kind: 'prediction', ok: right }, right && round === (level.rounds?.length ?? 1) - 1)
      setPrediction(null)
      if (!right) { setAttempt((value) => value + 1); fail(`It landed in ${actual}.`, 'Follow the gates from the top: Python stops at the first TRUE. Try this round again with a new score.'); return }
      if (round === (level.rounds?.length ?? 1) - 1) { setComplete(true); setMapShown(true); setMessage({ tone: 'good', title: 'Level solved!', text: 'Four right predictions in a row.' }); later(() => setShowWin(true), reducedMotion() ? 0 : 700); return }
      setRound(round + 1); setAttempt(0)
      setMessage({ tone: 'good', title: `Right: ${actual}!`, text: `Round ${round + 2} of ${level.rounds?.length}. Predict the next drop.` })
      return
    }
    if (level.mode === 'order') {
      const fixed = firstMismatch(segments, missionSegments, level) === null
      if (fixed && outputs[0] === 'Gold') { win(`${input} points reached the Gold question first. Asking the hardest question first rescued Gold.`); return }
      onLog({ level: level.id, kind: 'drop', ok: false })
      if (!fixed) fail(`${input} points → ${said}.`, 'Gold is still out of reach. Swap the two questions.')
      else setMessage({ tone: 'info', title: `${input} points → ${said}.`, text: 'The order is fixed. Now drop a score that wins Gold.' })
      return
    }
    setMessage({ tone: 'info', title: `${input}${level.unit} → ${said}.`, text: builder ? 'Try more values, or press CHECK MACHINE to test every boundary.' : level.instruction })
  }

  const drop = () => {
    if (!ready || dropping) return
    const input = dropValue
    const result = runChain(chain, level.variable, input)
    const nextFrames = buildFrames(chain, layout, result)
    const playId = ++version.current
    setRun(null); setFrames(nextFrames); setMismatch(null)
    const finish = () => {
      if (playId !== version.current) return
      setFrame(nextFrames.length - 1); setRun(result); setDropping(false)
      if (level.mode === 'visitAll') setMapShown(true)
      evaluateDrop(result, input)
    }
    if (reducedMotion()) { finish(); return }
    setDropping(true); setFrame(0)
    nextFrames.forEach((_, i) => { if (i > 0) later(() => { if (playId === version.current) setFrame(i) }, i * 560) })
    later(finish, nextFrames.length * 560 + 200)
  }

  const check = () => {
    if (!ready || scanning || !level.target) return
    const playId = ++version.current
    const problem = firstMismatch(segments, missionSegments, level)
    setScanning(true); setMismatch(null); setMapShown(true)
    later(() => {
      if (playId !== version.current) return
      setScanning(false)
      if (!problem) { win(level.lesson); return }
      onLog({ level: level.id, kind: 'check', ok: false })
      setMismatch({ from: problem.from, to: problem.to })
      const range = problem.from === problem.to ? `At ${problem.from}${level.unit}` : `From ${problem.from} to ${problem.to}${level.unit}`
      const actual = problem.actual.length ? problem.actual.map((text) => `“${text}”`).join(' and ') : 'nothing'
      fail('The scan found a problem.', `${range} your machine says ${actual}, but the rule says “${problem.expected.join(', ')}”.`)
    }, reducedMotion() ? 0 : 1300)
  }

  const swap = () => {
    if (dropping || swapping || complete) return
    setSwapPhase('moving'); setFrames([]); setFrame(-1); setRun(null)
    later(() => {
      // Swap the code while the gates sit in their new places, without animating back.
      setChain((currentChain) => ({ ...currentChain, rules: [...currentChain.rules].reverse() }))
      setSwapPhase('snap')
      setMessage({ tone: 'info', title: 'Questions swapped.', text: 'Look at the map. Then drop a score to test the new order.' })
      later(() => setSwapPhase('idle'), 60)
    }, reducedMotion() ? 0 : 420)
  }

  const fillSlot = (slot: Slot, text: string) => {
    if (dropping || scanning || complete) return
    setChain((currentChain) => {
      const rules = currentChain.rules.map((rule) => ({ ...rule }))
      if (slot === 'q0') rules[0].condition = text
      if (slot === 'q1') rules[1].condition = text
      if (slot === 'm0') rules[0].message = text
      if (slot === 'm1') rules[1].message = text
      return { ...currentChain, rules, elseMessage: slot === 'm2' ? text : currentChain.elseMessage }
    })
    setFrames([]); setFrame(-1); setRun(null); setMismatch(null)
    if (level.mode === 'solo') setMapShown(false)
    const nextEmpty = slotOrder.find((candidate) => candidate !== slot && !slotValue(chain, candidate))
    if (nextEmpty) setActiveSlot(nextEmpty)
  }

  const pickTile = (kind: 'q' | 'm', text: string) => {
    const target = activeSlot.startsWith(kind) ? activeSlot : slotOrder.find((slot) => slot.startsWith(kind) && !slotValue(chain, slot)) ?? (kind === 'q' ? 'q0' : 'm0')
    fillSlot(target, text)
  }

  const showHint = () => { if (!hintOpen) { setHintOpen(true); onLog({ level: level.id, kind: 'hint', ok: true }) } }
  const busy = dropping || scanning || swapping
  const primary = complete
    ? <button className="mc-primary" onClick={onNext}>{index === moreChoiceLevels.length - 1 ? 'FINISH' : 'NEXT LEVEL'} <ArrowRight size={17} /></button>
    : builder
      ? <button className="mc-primary" disabled={!ready || busy} onClick={check}><ScanLine size={17} /> {scanning ? 'SCANNING…' : 'CHECK MACHINE'}</button>
      : <button className="mc-primary" disabled={!ready || busy || level.mode === 'predict' && !prediction} onClick={drop}><MoveDown size={17} /> {dropping ? 'DROPPING…' : `DROP ${dropValue}`}</button>

  return <main className={`mc-screen mc-mode--${level.mode}`}>
    <Toolbar onBack={onBack} onHelp={onHelp} counter={<><span>LEVEL</span><b>{String(level.id).padStart(2, '0')}</b><small>/ {String(moreChoiceLevels.length).padStart(2, '0')}</small></>} />
    <LevelNav index={index} solved={solved} accessible={accessible} onSelect={onSelect} disabled={busy} />
    <section className="mc-layout" inert={showWin}>
      <aside className="mc-mission">
        <span className="mc-kicker">LEVEL {level.id} · {level.skill.toUpperCase()}</span>
        <h1>{level.title}</h1>
        <p className="mc-story">{level.story}</p>
        <p className="mc-task"><Sparkles size={16} /> {level.instruction}</p>
        {level.mode === 'visitAll' && <ul className="mc-goals" aria-label="Bins found">{binTexts.map((text) => <li key={text} className={visited.includes(text) ? 'is-done' : ''} style={{ '--c': colorOf(text) } as CSSProperties}>{visited.includes(text) ? <Check size={13} /> : <i />}{text}</li>)}</ul>}
        {level.mode === 'predict' && level.rounds && <div className="mc-predict">
          <div className="mc-rounds" aria-label={`Round ${round + 1} of ${level.rounds.length}`}>{level.rounds.map((_, i) => <i key={i} className={i < round || complete ? 'is-done' : i === round ? 'is-current' : ''} />)}</div>
          <p>Where will <code>{level.variable} = {dropValue}</code> land?</p>
          <div className="mc-predict__choices">{level.messages.map((item) => <button key={item.text} aria-pressed={prediction === item.text} disabled={busy || complete} style={{ '--c': item.color } as CSSProperties} onClick={() => setPrediction(item.text)}>{item.text}{prediction === item.text && <Check size={14} />}</button>)}</div>
        </div>}
        {builder && <Tiles level={level} kind={activeSlot.startsWith('q') ? 'q' : 'm'} disabled={busy || complete} onPick={pickTile} />}
        {level.mode === 'order' && <button className="mc-swap" onClick={swap} disabled={busy || complete}><ArrowDownUp size={18} /> SWAP THE TWO QUESTIONS</button>}
        {level.mode !== 'predict' && <div className="mc-input">
          <label htmlFor={`mc-value-${level.id}`}><code>{level.variable}</code><b>{value}<small>{level.unit}</small></b></label>
          <div><button aria-label={`Decrease ${level.variable}`} disabled={busy || value <= level.min} onClick={() => setValue(Math.max(level.min, value - 1))}><Minus size={16} /></button>
            <input id={`mc-value-${level.id}`} type="range" min={level.min} max={level.max} step={1} value={value} disabled={busy} onChange={(event) => setValue(Number(event.target.value))} />
            <button aria-label={`Increase ${level.variable}`} disabled={busy || value >= level.max} onClick={() => setValue(Math.min(level.max, value + 1))}><Plus size={16} /></button></div>
          <small><span>{level.min}</span><span>{level.max}</span></small>
          {builder && <button className="mc-text-button" disabled={!ready || busy} onClick={drop}><MoveDown size={14} /> Drop {value} to try it</button>}
        </div>}
        <div className="mc-hint">{hintOpen ? <p><Lightbulb size={15} /> {level.hint}</p> : <button onClick={showHint}><Lightbulb size={15} /> Need a hint?</button>}</div>
      </aside>

      <div className="mc-code">
        <header><div className="mc-dots" aria-hidden="true"><i /><i /><i /></div><span>{builder ? 'build_it.py' : 'tower.py'}</span><small>{chain.shape === 'nested' ? 'if / else inside else' : 'separate ifs'}</small></header>
        {builder ? <Builder level={level} chain={chain} activeSlot={activeSlot} activeLine={current?.line ?? null} disabled={busy || complete} onActivate={setActiveSlot} colorOf={colorOf} />
          : <div className="mc-code__lines">{lines.map((line, i) => <div key={i} className={`mc-line ${current?.line === i ? 'is-active' : ''}`}><span>{i + 1}</span><PythonCode code={line} /></div>)}</div>}
        <div className="mc-printed" aria-live="polite"><span>PRINTED</span>{run ? run.outputs.length ? run.outputs.map((output, i) => <b key={i} style={{ '--c': colorOf(output) } as CSSProperties}>{output}</b>) : <em>nothing at all</em> : <em>drop a value to see</em>}</div>
        <div className={`mc-maps ${scanning ? 'is-scanning' : ''}`}>
          {level.before && <RangeMap label="OLD APP" segments={beforeSegments} level={level} colorOf={colorOf} />}
          {level.target && (level.mode !== 'solo' || complete) && <RangeMap label="MISSION" segments={missionSegments} level={level} colorOf={colorOf} />}
          <RangeMap label="YOUR MACHINE" segments={segments} level={level} colorOf={colorOf} hidden={!mapShown || !ready} marker={dropValue} mismatch={mismatch} />
        </div>
      </div>

      <div className="mc-stage">
        <Tower chain={chain} frames={frames} frame={frame} seen={seen} value={dropValue} colorOf={colorOf} unreachable={unreachable} swapPhase={swapPhase} dropping={dropping} />
      </div>
    </section>

    <footer className={`mc-footer mc-footer--${message.tone}`} inert={showWin}>
      <div role="status"><span className="mc-footer__icon">{message.tone === 'good' ? <Check size={22} /> : message.tone === 'bad' ? <X size={22} /> : <Split size={22} />}</span><p><b>{message.title}</b>{message.text}</p></div>
      {primary}
    </footer>

    {showWin && <div className="mc-win-backdrop">
      <div className="mc-win" role="dialog" aria-modal="true" aria-labelledby="mc-win-title">
        <div className="mc-win__balls" aria-hidden="true">{level.messages.map((item, i) => <i key={item.text} style={{ '--c': item.color, '--i': i } as CSSProperties} />)}</div>
        <p className="mc-kicker">LEVEL {level.id} OF {moreChoiceLevels.length} · {level.title.toUpperCase()}</p>
        <h2 id="mc-win-title">Level solved!</h2>
        <p>{level.lesson}</p>
        <RangeMap label="THE WHOLE PICTURE" segments={segments} level={level} colorOf={colorOf} />
        <div className="mc-win__actions"><button className="mc-primary" autoFocus onClick={() => { setShowWin(false); onNext() }}>{index === moreChoiceLevels.length - 1 ? 'FINISH' : 'NEXT LEVEL'} <ArrowRight size={17} /></button><button className="mc-secondary" onClick={() => setShowWin(false)}>KEEP EXPLORING</button></div>
      </div>
    </div>}
  </main>
}

function slotValue(chain: DecisionChain, slot: Slot): string {
  if (slot === 'q0') return chain.rules[0].condition
  if (slot === 'q1') return chain.rules[1].condition
  if (slot === 'm0') return chain.rules[0].message
  if (slot === 'm1') return chain.rules[1].message
  return chain.elseMessage ?? ''
}

function Tiles({ level, kind, disabled, onPick }: { level: MoreChoiceLevel; kind: 'q' | 'm'; disabled: boolean; onPick: (kind: 'q' | 'm', text: string) => void }) {
  return <div className="mc-tiles">
    <div className={kind === 'q' ? 'is-focus' : ''}><span>QUESTIONS</span><div>{level.tiles?.map((tile) => <button key={tile} disabled={disabled} onClick={() => onPick('q', tile)} aria-label={`Use question ${tile}`}><code>{tile}</code></button>)}</div></div>
    <div className={kind === 'm' ? 'is-focus' : ''}><span>MESSAGES</span><div>{level.messages.map((item) => <button key={item.text} disabled={disabled} style={{ '--c': item.color } as CSSProperties} onClick={() => onPick('m', item.text)} aria-label={`Use message ${item.text}`}>{item.text}</button>)}</div></div>
  </div>
}

function Builder({ level, chain, activeSlot, activeLine, disabled, onActivate, colorOf }: { level: MoreChoiceLevel; chain: DecisionChain; activeSlot: Slot; activeLine: number | null; disabled: boolean; onActivate: (slot: Slot) => void; colorOf: (text: string) => string }) {
  const slot = (id: Slot, kind: 'q' | 'm') => {
    const text = slotValue(chain, id)
    return <button className={`mc-slot mc-slot--${kind} ${activeSlot === id ? 'is-active' : ''} ${text ? 'is-filled' : ''}`} disabled={disabled} aria-label={`${kind === 'q' ? 'Question' : 'Message'} slot ${id[1] === '0' ? 'one' : id[1] === '1' ? 'two' : 'three'}: ${text || 'empty'}`} onClick={() => onActivate(id)}
      style={kind === 'm' && text ? { '--c': colorOf(text) } as CSSProperties : undefined}>{text ? kind === 'm' ? `"${text}"` : text : '?'}</button>
  }
  const rows: Array<{ indent: number; content: React.ReactNode }> = [
    { indent: 0, content: <PythonCode code={`${level.variable} = int(input())`} /> },
    { indent: 0, content: <><code className="mc-kw">if </code>{slot('q0', 'q')}<code>:</code></> },
    { indent: 1, content: <><code className="mc-fn">print(</code>{slot('m0', 'm')}<code className="mc-fn">)</code></> },
    { indent: 0, content: <code className="mc-kw">else:</code> },
    { indent: 1, content: <><code className="mc-kw">if </code>{slot('q1', 'q')}<code>:</code></> },
    { indent: 2, content: <><code className="mc-fn">print(</code>{slot('m1', 'm')}<code className="mc-fn">)</code></> },
    { indent: 1, content: <code className="mc-kw">else:</code> },
    { indent: 2, content: <><code className="mc-fn">print(</code>{slot('m2', 'm')}<code className="mc-fn">)</code></> },
  ]
  return <div className="mc-code__lines">{rows.map((row, i) => <div key={i} className={`mc-line ${activeLine === i ? 'is-active' : ''}`}><span>{i + 1}</span><div style={{ paddingLeft: `${row.indent * 2}em` }}>{row.content}</div></div>)}</div>
}

function Tower({ chain, frames, frame, seen, value, colorOf, unreachable, swapPhase, dropping }: { chain: DecisionChain; frames: Frame[]; frame: number; seen: Frame[]; value: number; colorOf: (text: string) => string; unreachable: string[]; swapPhase: 'idle' | 'moving' | 'snap'; dropping: boolean }) {
  const swapping = swapPhase === 'moving'
  const rows = chain.rules.length
  const height = rowY(rows) + ROW_H / 2 + 22
  const current = frame >= 0 ? frames[frame] : null
  const tested = new Map(seen.filter((item) => item.tested).map((item) => [item.tested!.rule, item.tested!]))
  const lit = new Set(seen.flatMap((item) => [item.lit, item.spark]).filter((item): item is number => item !== undefined))
  const binList = bins(chain)
  const nested = chain.shape === 'nested'
  const ball = current ?? { x: TRUNK, y: START_Y }
  const label = `Sorting tower with ${rows} questions. ${nested ? 'Questions are nested inside else, so the ball stops in one bin.' : 'Separate questions: the ball passes every question.'}`
  return <svg className={`mc-tower ${nested ? 'is-nested' : 'is-separate'} ${swapping ? 'is-swapping' : ''} ${swapPhase === 'snap' ? 'is-snap' : ''} ${frame <= 0 ? 'is-reset' : ''}`} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
    <defs>
      <radialGradient id="mc-marble-body" cx="38%" cy="32%" r="78%"><stop offset="0%" stopColor="#f3edff" /><stop offset="22%" stopColor="#a994ff" /><stop offset="68%" stopColor="#5532e0" /><stop offset="100%" stopColor="#1d1060" /></radialGradient>
      <linearGradient id="mc-marble-swirl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffe066" /><stop offset="100%" stopColor="#ff6fa8" /></linearGradient>
      <filter id="mc-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <path className="mc-hopper" d={`M${TRUNK - 30} 4 H${TRUNK + 30} L${TRUNK + 12} 46 H${TRUNK - 12} Z`} />
    <line className="mc-trunk" x1={TRUNK} y1={46} x2={TRUNK} y2={rowY(rows) + (nested ? 0 : 6)} />
    {chain.rules.map((rule, i) => {
      const y = rowY(i)
      const test = tested.get(i)
      const state = current?.tested?.rule === i ? 'is-testing' : test ? test.truth ? 'is-true' : 'is-false' : ''
      const shift = swapping ? (i === 0 ? ROW_GAP : -ROW_GAP) : 0
      return <g key={`gate-${i}`} className={`mc-gate ${state}`} style={{ transform: `translateY(${shift}px)` }}>
        <line className="mc-stub" x1={TRUNK} y1={y} x2={GATE_X} y2={y} />
        <rect x={GATE_X} y={y - ROW_H / 2} width={GATE_W} height={ROW_H} rx={14} />
        <text className="mc-gate__code" x={GATE_X + GATE_W / 2} y={y + 6}>{`if ${rule.condition || '?'}:`}</text>
        <line className={`mc-pipe ${lit.has(i) ? 'is-lit' : ''}`} x1={GATE_X + GATE_W} y1={y} x2={BIN_X} y2={y} />
        <text className="mc-pipe__label" x={(GATE_X + GATE_W + BIN_X) / 2} y={y - 8}>TRUE</text>
        {i < rows - 1 || nested ? <text className="mc-false__label" x={TRUNK + 8} y={y + ROW_H / 2 + 24}>{nested ? 'FALSE' : 'NEXT'}</text> : null}
        {test && <g className={`mc-verdict ${test.truth ? 'is-true' : 'is-false'}`}><rect x={GATE_X + GATE_W - 132} y={y - ROW_H / 2 - 22} width={132} height={20} rx={10} /><text x={GATE_X + GATE_W - 66} y={y - ROW_H / 2 - 8}>{`${test.text} → ${test.truth ? 'True' : 'False'}`}</text></g>}
      </g>
    })}
    {nested && <g className={`mc-gate mc-gate--else ${seen.some((item) => item.y === rowY(rows) && item.x === TRUNK && item.line !== null) ? 'is-true' : ''}`}>
      <line className="mc-stub" x1={TRUNK} y1={rowY(rows)} x2={GATE_X} y2={rowY(rows)} />
      <rect x={GATE_X} y={rowY(rows) - ROW_H / 2} width={GATE_W} height={ROW_H} rx={14} />
      <text className="mc-gate__code" x={GATE_X + GATE_W / 2} y={rowY(rows) + 6}>else:</text>
      <line className={`mc-pipe ${lit.has(rows) ? 'is-lit' : ''}`} x1={GATE_X + GATE_W} y1={rowY(rows)} x2={BIN_X} y2={rowY(rows)} />
    </g>}
    {!nested && <g className={`mc-exit ${current?.exit ? 'is-on' : ''}`}><circle cx={TRUNK} cy={rowY(rows)} r={20} /><text x={TRUNK} y={rowY(rows) + 4}>END</text></g>}
    {binList.map((text, i) => {
      const y = rowY(i)
      const on = lit.has(i)
      return <g key={`bin-${i}`} className={`mc-bin ${on ? 'is-lit' : ''} ${text && unreachable.includes(text) ? 'is-unreachable' : ''}`} style={{ '--c': text ? colorOf(text) : '#5b6075', transform: swapping && i < rows ? `translateY(${i === 0 ? ROW_GAP : -ROW_GAP}px)` : undefined } as CSSProperties}>
        <rect x={BIN_X} y={y - ROW_H / 2} width={BIN_W} height={ROW_H} rx={12} filter={on ? 'url(#mc-glow)' : undefined} />
        <text x={BIN_X + BIN_W / 2 + (nested ? 16 : 0)} y={y + 6}>{text || '?'}</text>
        {nested ? <text className="mc-bin__kind" x={BIN_X + 12} y={y - ROW_H / 2 + 13}>BIN</text> : <circle className="mc-lamp" cx={BIN_X + BIN_W - 14} cy={y - ROW_H / 2 + 12} r={5} />}
        {text && unreachable.includes(text) && <g className="mc-never"><rect x={BIN_X + BIN_W - 92} y={y + ROW_H / 2 - 9} width={98} height={20} rx={5} /><text x={BIN_X + BIN_W - 43} y={y + ROW_H / 2 + 5}>NEVER REACHED</text></g>}
        {on && <g className="mc-printed-pop"><text x={BIN_X + BIN_W / 2} y={y - ROW_H / 2 - 8}>print!</text></g>}
      </g>
    })}
    {current?.spark !== undefined && <circle key={`spark-${frame}`} className="mc-spark" cx={0} cy={0} r={8} style={{ '--sy': `${rowY(current.spark)}px`, '--sx0': `${TRUNK}px`, '--sx1': `${BIN_X + BIN_W / 2}px` } as CSSProperties} />}
    {/* A glass marble: ghosts trail it while it falls, its swirl spins as it rolls, and it bounces into the bin. */}
    {[3, 2, 1].map((lag) => <g key={`ghost-${lag}`} className="mc-ghost" aria-hidden="true" style={{ transform: `translate(${ball.x}px, ${ball.y}px)`, transitionDelay: `${lag * 45}ms`, opacity: dropping ? 0.22 - lag * 0.05 : 0 }}><circle r={15} fill="url(#mc-marble-body)" /></g>)}
    {current?.lit !== undefined && <g key={`land-${frame}`} className="mc-landing" aria-hidden="true" style={{ transform: `translate(${ball.x}px, ${ball.y}px)`, '--c': colorOf(binList[current.lit] ?? '') } as CSSProperties}>
      <circle className="mc-landing__ripple" r={20} />
      {Array.from({ length: 8 }, (_, i) => <circle key={i} className="mc-landing__spark" r={3} style={{ '--a': `${i * 45}deg` } as CSSProperties} />)}
    </g>}
    <g className={`mc-ball ${dropping ? 'is-moving' : ''} ${current?.lit !== undefined ? 'is-landed' : ''} ${current?.tested ? 'is-checking' : ''}`} style={{ transform: `translate(${ball.x}px, ${ball.y}px)` }}>
      <ellipse className="mc-ball__shadow" cx={0} cy={21} rx={14} ry={4} />
      <g className="mc-marble">
        <circle r={18} fill="url(#mc-marble-body)" />
        <g className="mc-marble__spin">
          <circle r={18} fill="transparent" />
          <path d="M-13 5 C-8 -11 9 -13 13 -2 C6 -7 -3 -5 -7 7 Z" fill="url(#mc-marble-swirl)" opacity=".85" />
          <path d="M11 7 C4 15 -9 13 -12 6" stroke="#ffffffaa" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
        <ellipse cx={-6} cy={-9} rx={6.5} ry={3.6} fill="#fff" opacity=".9" transform="rotate(-30 -6 -9)" />
        <circle r={17.2} fill="none" stroke="#ffffff66" strokeWidth="1.5" />
      </g>
      <text className="mc-ball__value" y={5}>{value}</text>
    </g>
  </svg>
}

function RangeMap({ label, segments, level, colorOf, hidden = false, marker, mismatch }: { label: string; segments: MapSegment[]; level: MoreChoiceLevel; colorOf: (text: string) => string; hidden?: boolean; marker?: number; mismatch?: { from: number; to: number } | null }) {
  const span = level.max - level.min + 1
  const left = (from: number) => `${((from - level.min) / span) * 100}%`
  const width = (from: number, to: number) => `${((to - from + 1) / span) * 100}%`
  // Keep tick labels apart: neighbours closer than 6% of the bar would overlap.
  const ticks = [...new Set([level.min, ...segments.slice(1).map((segment) => segment.from), level.max])].reduce<number[]>((kept, tick) => {
    if (!kept.length || (tick - kept.at(-1)!) / span >= .06) return [...kept, tick]
    return tick === level.max ? [...kept.slice(0, -1), tick] : kept
  }, [])
  return <div className={`mc-map ${hidden ? 'is-hidden' : ''}`}>
    <span className="mc-map__label">{label}</span>
    <div className="mc-map__bar" role="img" aria-label={hidden ? `${label}: hidden` : `${label}: ${segments.map((segment) => `${segment.from} to ${segment.to}: ${segment.outputs.join(' and ') || 'nothing'}`).join('; ')}`}>
      {hidden ? <div className="mc-map__fog">?</div> : segments.map((segment) => {
        const colors = segment.outputs.map(colorOf)
        const background = colors.length === 0 ? undefined : colors.length === 1 ? colors[0] : `repeating-linear-gradient(135deg, ${colors.map((color, i) => `${color} ${i * 8}px ${(i + 1) * 8}px`).join(', ')})`
        return <div key={segment.from} className={`mc-map__seg ${segment.outputs.length === 0 ? 'is-gap' : segment.outputs.length > 1 ? 'is-overlap' : ''}`} style={{ left: left(segment.from), width: width(segment.from, segment.to), background }} title={`${segment.from}–${segment.to}: ${segment.outputs.join(' + ') || 'nothing'}`}>
          <span>{segment.outputs.length === 0 ? 'NONE' : segment.outputs.length > 1 ? `×${segment.outputs.length}` : segment.outputs[0]}</span>
        </div>
      })}
      {!hidden && mismatch && <i className="mc-map__mismatch" style={{ left: left(mismatch.from), width: width(mismatch.from, mismatch.to) }} />}
      {!hidden && marker !== undefined && <i className="mc-map__marker" style={{ left: `calc(${left(marker)} + ${100 / span / 2}%)` }} />}
    </div>
    {!hidden && <div className="mc-map__ticks" aria-hidden="true">{ticks.map((tick) => <span key={tick} style={{ left: `calc(${left(tick)} + ${tick === level.max ? 100 / span : 0}%)` }}>{tick}</span>)}</div>}
  </div>
}
