import { AlertTriangle, ArrowLeft, ArrowRight, Binary, Check, Code2, Film, Gamepad2, GraduationCap, KeyRound, Lightbulb, LockKeyhole, Play, RotateCcw, ShieldCheck, Sparkles, Truck, Trophy, Undo2, Vote, Wind, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PythonCode } from '../../components/PythonCode'
import { ifElseProblems, parseProblemInput, problemLines, type IfElseProblem } from '../../data/ifElseBuilder'
import { ifElsePedagogy, type IfElsePedagogy } from '../../data/ifElsePedagogy'
import { codePieces, diagnoseProgram, executionTrace, initialExpression, initialProgram, learningFeedback, structureLabels, type Diagnosis, type ExecutionTrace, type LearningError } from '../../lib/ifElseLearning'
import { PythonRunError, pythonRunner } from '../../lib/pythonRunner'
import { completeActivity } from '../../session/progressSession'
import { completedIfElseLevels, nextIfElseLevel } from '../../lib/ifElseProgress'
import type { IfElseLearningEvent, SessionProgress } from '../../types'
import { BranchEditor, ExpressionEditor, PredictionCard, PredictionComparison, ProvidedCode, TracePanel, TwoPaths } from './IfElseLearningPanels'
import './ifElseBuilder.css'

interface Props {
  progress: SessionProgress
  onProgress: (progress: SessionProgress) => void
  onBack: () => void
}

const sceneDetails = [
  { icon: Film, label: 'PYTHON PICTURES', caption: 'ADMIT ONE', color: '#ffd6ac' },
  { icon: KeyRound, label: 'SECURITY CHECK', caption: 'CHARACTERS', color: '#e4d9ff' },
  { icon: Wind, label: 'WEATHER STATION', caption: 'DEGREES', color: '#ffe4a3' },
  { icon: Gamepad2, label: 'PLAYER ONE', caption: 'POINTS', color: '#c9f1dc' },
  { icon: LockKeyhole, label: 'CLASSIFIED', caption: 'SECRET CODE', color: '#d4e6ff' },
  { icon: GraduationCap, label: 'REPORT CARD', caption: 'YOUR GRADE', color: '#ffe0d4' },
  { icon: Vote, label: 'YOUR VOICE', caption: 'YOUR AGE', color: '#d9e7ff' },
  { icon: ShieldCheck, label: 'SECURITY LAB', caption: 'PASSWORD LENGTH', color: '#e4d9ff' },
  { icon: Binary, label: 'NUMBER LAB', caption: 'YOUR NUMBER', color: '#c9f1dc' },
  { icon: Truck, label: 'SPECIAL DELIVERY', caption: 'ORDER TOTAL', color: '#ffe4a3' },
]

function revealLearningControl(control: HTMLElement | null | undefined) {
  const panel = control?.closest<HTMLElement>('.ieb-layout')
  if (!panel || !control) return
  const viewport = panel.getBoundingClientRect()
  const target = control.getBoundingClientRect()
  if (target.top >= viewport.top && target.bottom <= viewport.bottom) return
  // Scroll only the learning panel. scrollIntoView also centers every outer
  // container, moving the app header and bottom banner on scaled screens.
  const scale = viewport.height / panel.offsetHeight || 1
  panel.scrollTop += (target.top - viewport.top - (viewport.height - target.height) / 2) / scale
}

export function IfElseBuilder({ progress, onProgress, onBack }: Props) {
  const [index, setIndex] = useState(() => Math.max(0, nextIfElseLevel(progress)))
  const [finished, setFinished] = useState(() => nextIfElseLevel(progress) === -1)
  const progressRef = useRef(progress)
  useEffect(() => { progressRef.current = progress }, [progress])
  const completedLevels = completedIfElseLevels(progress)
  const nextLevel = nextIfElseLevel(progress)
  const accessibleLevels = progress.isTeacher ? ifElseProblems.map((_, i) => i + 1) : [...completedLevels, ...(nextLevel >= 0 ? [nextLevel + 1] : [])]
  const selectLevel = (levelIndex: number) => {
    if (!accessibleLevels.includes(levelIndex + 1)) return
    setIndex(levelIndex)
    setFinished(false)
  }
  const record = (event: IfElseLearningEvent) => {
    const previous = progressRef.current
    const levels = completedIfElseLevels(previous)
    if (event.kind === 'check' && event.errorKind === null && event.actualOutput !== null && !levels.includes(event.level)) levels.push(event.level)
    let updated: SessionProgress = { ...previous, ifElseLevels: levels.sort((a, b) => a - b), ifElseLearning: [...(previous.ifElseLearning ?? []), event].slice(-200) }
    if (levels.length === ifElseProblems.length) updated = completeActivity(updated, 'if-else')
    progressRef.current = updated
    onProgress(updated)
  }
  const next = () => {
    if (!completedIfElseLevels(progressRef.current).includes(index + 1)) return
    if (index === ifElseProblems.length - 1) {
      if (completedIfElseLevels(progressRef.current).length === ifElseProblems.length) setFinished(true)
      else onBack()
    } else { setIndex(index + 1) }
  }
  if (finished) return <main className="ieb-screen">
    <header className="ieb-toolbar"><button className="ieb-back" onClick={onBack}><ArrowLeft size={18} /> Conditions</button><div className="ieb-brand"><Code2 size={20} /><b>IF / ELSE</b></div><div className="ieb-counter"><Trophy size={19} /> Complete!</div></header>
    <LevelNavigation index={10} completedLevels={completedLevels} accessibleLevels={accessibleLevels} onSelect={selectLevel} />
    <section className="ieb-finish"><div className="ieb-trophy"><Trophy size={64} /><Sparkles size={28} /></div><p className="ieb-kicker">ALL 10 PROGRAMS COMPLETE</p><h1>You built both paths.</h1><p>You predicted decisions, tested comparisons, repaired logic, and translated a rule into IF/ELSE.</p><div><button className="ieb-primary" onClick={() => { setIndex(0); setFinished(false) }}><RotateCcw size={18} /> PLAY AGAIN</button><button onClick={onBack}>BACK TO CONDITIONS <ArrowRight size={18} /></button></div></section>
  </main>
  return <IfElseLevel key={index} index={index} completedLevels={completedLevels} accessibleLevels={accessibleLevels} onSelect={selectLevel} problem={ifElseProblems[index]} pedagogy={ifElsePedagogy[index]} onBack={onBack} onNext={next} onRecord={record} />
}

function LevelNavigation({ index, completedLevels, accessibleLevels, onSelect, disabled = false, inert = false }: { index: number; completedLevels: number[]; accessibleLevels: number[]; onSelect: (index: number) => void; disabled?: boolean; inert?: boolean }) {
  return <nav className="ieb-progress" aria-label="IF/ELSE levels" inert={inert}>
    <div className="ieb-progress-count sr-only" role="progressbar" aria-label="Problems completed" aria-valuenow={completedLevels.length} aria-valuemin={0} aria-valuemax={10} />
    {ifElseProblems.map((problem, i) => {
      const done = completedLevels.includes(i + 1)
      const available = accessibleLevels.includes(i + 1)
      return <button key={i} type="button" className={`ieb-level-button ${done ? 'is-done' : ''} ${i === index ? 'is-current' : ''}`} disabled={disabled || !available} aria-label={`Level ${i + 1}: ${problem.title}${done ? ' - passed' : available ? '' : ' - locked'}`} aria-current={i === index ? 'step' : undefined} onClick={() => onSelect(i)}><span className="ieb-level-number">{i + 1}{done && <Check size={12} />}</span><span className="ieb-level-track"><i /></span></button>
    })}
  </nav>
}

const errorLabels: Record<LearningError, string> = { structure: 'STRUCTURE ERROR', condition: 'CONDITION ERROR', logic: 'LOGIC ERROR', output: 'OUTPUT ERROR', runtime: 'RUN INTERRUPTED' }
const errorTitles: Record<LearningError, string> = { structure: 'Check the structure.', condition: 'Check the condition.', logic: 'The logic needs fixing.', output: 'Check the branch action.', runtime: 'Run paused.' }

function IfElseLevel({ index, completedLevels, accessibleLevels, onSelect, problem, pedagogy, onBack, onNext, onRecord }: { index: number; completedLevels: number[]; accessibleLevels: number[]; onSelect: (index: number) => void; problem: IfElseProblem; pedagogy: IfElsePedagogy; onBack: () => void; onNext: () => void; onRecord: (event: IfElseLearningEvent) => void }) {
  const [program, setProgram] = useState(() => initialProgram(problem, pedagogy))
  const [codeExpanded, setCodeExpanded] = useState(pedagogy.showProgramByDefault !== false)
  const [expression, setExpression] = useState(() => initialExpression(problem, pedagogy.construction === 'operator', pedagogy.requireDebugRun))
  const [draft, setDraft] = useState('')
  const [prediction, setPrediction] = useState<{ text: string; kind: 'output' | 'truth' } | null>(null)
  const [pathsExpanded, setPathsExpanded] = useState(false)
  const [debugRan, setDebugRan] = useState(false)
  const [status, setStatus] = useState<'idle' | 'wrong' | 'running' | 'correct' | 'error'>('idle')
  const [output, setOutput] = useState('')
  const [trace, setTrace] = useState<ExecutionTrace | null>(null)
  const [traceStep, setTraceStep] = useState(-1)
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const [attempts, setAttempts] = useState<Partial<Record<LearningError, number>>>({})
  const [checks, setChecks] = useState(0)
  const [showOutcome, setShowOutcome] = useState(false)
  const [showModel, setShowModel] = useState(false)
  const outcomeRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const predictionRef = useRef<HTMLDivElement>(null)
  const runVersion = useRef(0)
  const traceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { runVersion.current += 1; if (traceTimer.current) clearTimeout(traceTimer.current) }, [])

  const scene = sceneDetails[index]
  const SceneIcon = scene.icon
  const expressionMode = ['operator', 'expression', 'independent'].includes(pedagogy.construction)
  const expressionComplete = Boolean(expression.left && expression.operator && expression.right)
  const lines = [...program]
  if (expressionMode) lines[1] = expressionComplete ? `if ${expression.left} ${expression.operator} ${expression.right}:` : null
  const pieces = codePieces(problem, pedagogy)
  const pieceIsUsed = (code: string) => program.some((line, i) => line === code && (pedagogy.construction !== 'slot' || !pedagogy.prefilledLines.includes(i)))
  const full = lines.every((line) => line !== null)
  const busy = status === 'running'
  const passed = status === 'correct'
  const nextLabel = index === ifElseProblems.length - 1 ? completedLevels.length === ifElseProblems.length ? 'FINISH ACTIVITY' : 'BACK TO CONDITIONS' : 'NEXT PROBLEM'
  const predictionLocksBuild = pedagogy.requirePrediction === 'output' && prediction === null
  const debugLocksEdit = pedagogy.requireDebugRun && !debugRan
  const value = pedagogy.useInput ? parseProblemInput(problem, draft) : problem.initial
  const needsPrediction = Boolean(pedagogy.requirePrediction && !prediction)
  const ready = full && value !== null && !busy && !needsPrediction
  const predictionAction = predictionLocksBuild || needsPrediction && full && value !== null
  const errorAttempt = diagnosis ? attempts[diagnosis.kind] ?? 0 : 0
  const feedback = diagnosis ? learningFeedback(problem, diagnosis, errorAttempt, value ?? problem.initial) : ''
  const record = (kind: IfElseLearningEvent['kind'], extra: Partial<IfElseLearningEvent> = {}) => onRecord({ level: index + 1, mode: pedagogy.mode, kind, attempt: checks, value, prediction: prediction?.text ?? null, actualOutput: null, conditionResult: null, errorKind: null, at: Date.now(), ...extra })

  useEffect(() => {
    if (pedagogy.requirePrediction !== 'output' || predictionLocksBuild) return
    const firstPiece = workspaceRef.current?.querySelector<HTMLButtonElement>('.ieb-bank button:not(:disabled)')
    revealLearningControl(firstPiece)
    firstPiece?.focus({ preventScroll: true })
  }, [pedagogy.requirePrediction, predictionLocksBuild])

  useEffect(() => {
    if (!showOutcome) return
    const workspace = workspaceRef.current
    const buttons = outcomeRef.current?.querySelectorAll<HTMLButtonElement>('button')
    buttons?.[0]?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setShowOutcome(false) }
      if (event.key === 'Tab' && buttons?.length) {
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      const target = diagnosis && workspace?.querySelector<HTMLButtonElement>(`[data-line-edit="${diagnosis.line}"]:not(:disabled)`)
      const fallback = workspace?.querySelector<HTMLButtonElement>('[aria-label="Clear program"]')
      ;(target || fallback)?.focus()
    }
  }, [showOutcome, diagnosis, showModel])

  const clearResult = () => { setStatus('idle'); setOutput(''); setTrace(null); setTraceStep(-1); setDiagnosis(null); setShowOutcome(false); setShowModel(false) }
  const reset = () => { runVersion.current += 1; setProgram(initialProgram(problem, pedagogy)); setExpression(initialExpression(problem, pedagogy.construction === 'operator', pedagogy.requireDebugRun)); clearResult(); if (pedagogy.requirePrediction === 'truth') setPrediction(null) }
  const changeExpression = (next: typeof expression) => { setExpression(next); clearResult(); if (pedagogy.requirePrediction === 'truth') setPrediction(null) }
  const setInput = (next: string) => { setDraft(next); clearResult(); if (pedagogy.requirePrediction === 'truth') setPrediction(null) }
  const addPiece = (code: string) => {
    if (busy || predictionLocksBuild) return
    const slot = program.findIndex((line) => line === null)
    if (slot >= 0) { setProgram(program.map((line, i) => i === slot ? code : line)); clearResult() }
  }
  const removeLine = (line: number) => {
    if (expressionMode && line === 1) { changeExpression({ ...expression, operator: '' }); return }
    setProgram(program.map((code, i) => i === line ? null : code)); clearResult()
  }
  const predict = (text: string) => {
    const kind = pedagogy.requirePrediction
    if (!kind || value === null) return
    clearResult(); setPrediction({ kind, text })
    record('prediction', { prediction: text })
  }
  const revealPaths = () => { setPathsExpanded(true); record('hint') }
  const goToPrediction = () => {
    const choice = predictionRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')
    revealLearningControl(choice)
    choice?.focus({ preventScroll: true })
  }
  const displayResult = (issue: Diagnosis | null, stdout: string, nextTrace: ExecutionTrace | null, attempt: number, recorded = false) => {
    setOutput(stdout); setDiagnosis(issue); setDebugRan(true)
    if (issue) setAttempts((previous) => ({ ...previous, [issue.kind]: (previous[issue.kind] ?? 0) + 1 }))
    setStatus(issue ? issue.kind === 'runtime' ? 'error' : 'wrong' : 'correct')
    setShowOutcome(true)
    if (!recorded) record('check', { attempt, errorKind: issue?.kind ?? null, actualOutput: nextTrace ? stdout : null, conditionResult: nextTrace?.truth ?? null })
  }
  const check = async () => {
    if (!ready || value === null) return
    const built = lines as string[]
    setCodeExpanded(true)
    const issue = diagnoseProgram(problem, pedagogy, built, value)
    const attempt = checks + 1
    setChecks(attempt); setShowModel(false)
    // A structural problem cannot be executed meaningfully. Logically wrong
    // but valid Python always runs before it is assessed against the mission.
    if (issue?.kind === 'structure') { setTrace(null); displayResult(issue, '', null, attempt); return }
    const version = ++runVersion.current
    setStatus('running'); setDiagnosis(null); setTrace(null); setTraceStep(-1)
    try {
      const result = await pythonRunner.runScript(built.join('\n'), pedagogy.useInput ? [draft.trim()] : [])
      if (version !== runVersion.current) return
      const nextTrace = executionTrace(problem, built, value, result.stdout)
      setOutput(result.stdout); setTrace(nextTrace)
      // Save the assessed run now; closing or refreshing during the animation
      // must not discard a level the student has already solved.
      record('check', { attempt, errorKind: issue?.kind ?? null, actualOutput: result.stdout, conditionResult: nextTrace.truth })
      const reducedMotion = typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const animate = (step: number) => {
        if (version !== runVersion.current) return
        setTraceStep(step)
        if (step < nextTrace.steps.length - 1 && pedagogy.executionVisualization && !reducedMotion) traceTimer.current = setTimeout(() => animate(step + 1), 320)
        else if (step < nextTrace.steps.length - 1) animate(nextTrace.steps.length - 1)
        else { traceTimer.current = null; displayResult(issue, result.stdout, nextTrace, attempt, true) }
      }
      animate(0)
    } catch (error) {
      if (version !== runVersion.current) return
      const line = error instanceof PythonRunError && error.line ? error.line - 1 : 1
      displayResult({ kind: 'runtime', line }, error instanceof Error ? error.message : 'Could not run the code. Try again.', null, attempt)
    }
  }

  const nextInstruction = predictionLocksBuild ? 'Choose a prediction to unlock the build.' : debugLocksEdit ? 'Choose an input and run the program before editing.' : !full ? pedagogy.requirePrediction === 'output' ? 'Prediction saved. Place the five code pieces, then run your program.' : pedagogy.instruction : value === null ? 'Choose a valid input value, then run the code.' : needsPrediction ? 'Predict TRUE or FALSE for your input, then test it.' : 'Run the program and follow the decision.'

  return <main className={`ieb-screen ieb-mode--${pedagogy.mode} ${passed ? 'ieb-screen--success' : ''} ${pedagogy.useInput ? 'ieb-screen--interactive' : ''}`} style={{ '--ieb-scene': scene.color } as React.CSSProperties}>
    <header className="ieb-toolbar" inert={showOutcome}><button className="ieb-back" onClick={onBack}><ArrowLeft size={18} /><span>Conditions</span></button><div className="ieb-brand"><span><Code2 size={20} /></span><div><b>IF / ELSE</b><small>THE CODE BUILDER</small></div></div><div className="ieb-counter"><span><Sparkles size={18} /></span><b>Challenge {String(index + 1).padStart(2, '0')}<small> / 10</small></b></div></header>
    <LevelNavigation index={index} completedLevels={completedLevels} accessibleLevels={accessibleLevels} onSelect={onSelect} disabled={busy} inert={showOutcome} />
    <section className="ieb-layout" inert={showOutcome} aria-hidden={showOutcome ? true : undefined}>
      <div className="ieb-problem">
        <div className="ieb-mission-label"><span className="ieb-kicker">YOUR MISSION</span><span>{pedagogy.title.toUpperCase()}</span></div>
        <h1>{problem.title}<span aria-hidden="true">.</span></h1>
        <div className="ieb-scene" aria-label={`${scene.label}: ${problem.variable} starts at ${problem.initial}`}><div className="ieb-ticket"><div className="ieb-ticket__main"><span>{scene.label}</span><SceneIcon size={42} strokeWidth={1.6} /><small>{scene.caption}</small></div><div className="ieb-ticket__stub"><span>{problem.variable.replaceAll('_', ' ').toUpperCase()}</span><b>{pedagogy.useInput ? value ?? problem.initial : problem.initial}</b><div className="ieb-barcode" aria-hidden="true" /></div></div><Sparkles className="ieb-scene-star ieb-scene-star--one" aria-hidden="true" size={22} /><Sparkles className="ieb-scene-star ieb-scene-star--two" aria-hidden="true" size={14} /></div>
        <p className="ieb-scenario">{problem.scenario}</p>
        {pedagogy.showCondition && pedagogy.requirePrediction !== 'output' && <div className="ieb-given-condition"><span>CONDITION</span><code>{problem.condition}</code></div>}
        {pedagogy.useInput && <label className="ieb-input"><span>Choose your input <code>{problem.variable}</code></span><div><input type="text" inputMode={problem.decimal ? 'decimal' : 'numeric'} value={draft} disabled={busy} onChange={(event) => setInput(event.target.value)} placeholder={`Starting value: ${problem.initial}`} aria-label={`${problem.variable} input`} /><span><ArrowRight size={18} /></span></div><small>{problem.inputHint}{draft.trim() !== '' && value === null ? ' - Enter a valid value in this range.' : ''}</small><button type="button" disabled={busy} onClick={() => setInput(String(problem.initial))}>Use starting value ({problem.initial})</button></label>}
        {pedagogy.requirePrediction === 'truth' && <div ref={predictionRef}><PredictionCard problem={problem} kind="truth" value={value} prediction={prediction?.text ?? null} showCondition={pedagogy.showCondition} disabled={busy || value === null || !expressionComplete} onPredict={predict} /></div>}
        <TwoPaths problem={problem} visibility={pedagogy.showTwoPaths} expanded={pathsExpanded} onHint={revealPaths} />
        <aside><Lightbulb size={19} /><p>{pedagogy.instruction}</p></aside>
        <div className="ieb-support" aria-label={`Guidance: ${pedagogy.support} of 10`}><span>GUIDANCE</span><div aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < pedagogy.support ? 'is-on' : ''} />)}</div></div>
      </div>
      <div className="ieb-workspace" ref={workspaceRef}>
        {pedagogy.requirePrediction === 'output' && <div ref={predictionRef} className={predictionLocksBuild ? 'ieb-prediction-first' : 'ieb-prediction-saved'}><span className="ieb-kicker">STEP 1 / PREDICT</span><PredictionCard problem={problem} kind="output" value={value} prediction={prediction?.text ?? null} showCondition={pedagogy.showCondition} disabled={busy} onPredict={predict} /></div>}
        {predictionLocksBuild ? <div className="ieb-build-lock"><Lightbulb size={18} /> Choose either outcome above. Then the code pieces will appear. Your prediction is not graded.</div> : <>
        <div className={`ieb-editor ${passed ? 'is-correct' : diagnosis ? 'is-wrong' : ''}`}>
          <header><div className="ieb-window-dots" aria-hidden="true"><i /><i /><i /></div><span>your_program.py</span>{pedagogy.showProgramByDefault === false && <button disabled={busy} aria-expanded={codeExpanded} aria-controls="ieb-program-code" onClick={() => setCodeExpanded(!codeExpanded)}>{codeExpanded ? 'Hide program' : 'Show program'}</button>}<button onClick={reset} disabled={busy || predictionLocksBuild} aria-label="Clear program"><RotateCcw size={15} /><span>Reset</span></button></header>
          <div className="ieb-editor-label"><span><Code2 size={15} /> YOUR PROGRAM</span><b>{lines.filter(Boolean).length}<span> / 5 lines</span>{full && <Check size={14} />}</b></div>
          <div id="ieb-program-code" className="ieb-code" hidden={!codeExpanded} aria-label="Built Python program">{lines.map((line, position) => {
            const editable = expressionMode && position === 1 || !pedagogy.prefilledLines.includes(position)
            const active = trace?.steps[traceStep]?.line === position
            return <div key={position} className={`${line === null ? 'is-empty' : 'is-filled'} ${diagnosis?.line === position ? 'is-mistake' : ''} ${active ? 'is-executing' : ''}`}><span>{position + 1}</span>{line === null ? <span className="ieb-placeholder">{pedagogy.showOrderLabels ? structureLabels[position] : expressionMode && position === 1 ? 'Build the condition below' : pedagogy.construction === 'independent' ? 'Choose this branch action below' : 'Tap a piece to fill this gap'}</span> : editable ? <button disabled={busy || predictionLocksBuild || debugLocksEdit} onClick={() => removeLine(position)} aria-label={`Remove line ${position + 1}`} data-line-edit={position}><PythonCode code={line} /><Undo2 size={16} /></button> : <ProvidedCode code={line} />}</div>
          })}</div>
          {output && (!busy || traceStep === 4) && <div className={`ieb-output ${status === 'error' ? 'is-error' : ''}`}><span><span /> {status === 'error' ? 'RUN ERROR' : 'OUTPUT'}</span><pre>{output}</pre></div>}
        </div>
        {busy ? null : expressionMode ? <>
          {debugLocksEdit ? <div className="ieb-build-lock"><Play size={18} /> Run the program first. Then you can change its comparison.</div> : <ExpressionEditor problem={problem} expression={expression} operatorOnly={pedagogy.construction === 'operator'} independent={pedagogy.construction === 'independent'} disabled={busy} onChange={changeExpression} />}
          {pedagogy.construction === 'independent' && <BranchEditor problem={problem} lines={lines} disabled={busy} onChange={(line, code) => { setProgram(program.map((current, i) => i === line ? code : current)); clearResult() }} />}
        </> : <div className="ieb-bank"><header><div><span className="ieb-section-number">01</span><div><h2>{pedagogy.construction === 'slot' ? 'Fill the missing piece' : 'Pick your pieces'}</h2><p>{pedagogy.showOrderLabels ? 'All five pieces belong. Use the labels to place them.' : 'Tap to add. Tap an editable line to take it back.'}</p></div></div>{pedagogy.distractorCount > 0 && <span className="ieb-spare">{pedagogy.distractorCount} {pedagogy.distractorCount === 1 ? 'EXTRA' : 'EXTRAS'}</span>}</header><div>{pieces.map((piece) => <button key={piece.id} disabled={busy || predictionLocksBuild || full || pieceIsUsed(piece.code)} className={`ieb-piece ieb-piece--${piece.role} ${pieceIsUsed(piece.code) ? 'is-used' : ''}`} onClick={() => addPiece(piece.code)} aria-label={`Add ${piece.code.trim()}`}><PythonCode code={piece.code} />{pieceIsUsed(piece.code) && <Check size={13} />}</button>)}</div></div>}
        {trace && <TracePanel trace={trace} step={traceStep} />}
        </>}
      </div>
    </section>
    <footer className={`ieb-feedback ieb-feedback--${status}`} inert={showOutcome} aria-hidden={showOutcome ? true : undefined}><div role="status"><span className="ieb-feedback-icon">{passed ? <Check size={23} /> : diagnosis ? <Lightbulb size={23} /> : <Code2 size={23} />}</span><p><b>{passed ? 'Level cleared!' : busy ? 'Follow the decision...' : diagnosis ? errorLabels[diagnosis.kind] : 'What to do next'}</b>{passed ? 'Review the trace, try another value, or move on.' : diagnosis ? feedback : busy ? 'Python reads a value, tests a condition, and follows one path.' : nextInstruction}</p></div>{passed ? <button className="ieb-primary" onClick={onNext}>{nextLabel} <ArrowRight size={19} /></button> : predictionAction ? <button className="ieb-primary" onClick={goToPrediction}>MAKE A PREDICTION <ArrowRight size={19} /></button> : <button className="ieb-primary" disabled={!ready} onClick={() => void check()}><Play size={18} fill="currentColor" /> {busy ? 'RUNNING...' : 'CHECK CODE + RUN'}</button>}</footer>
    {showOutcome && <div className={`ieb-outcome-backdrop ieb-outcome-backdrop--${passed ? 'success' : 'wrong'}`}>
      {passed && <div className="ieb-confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ '--confetti-x': `${(i * 37) % 100}%`, '--confetti-delay': `${(i % 7) * 70}ms`, '--confetti-rotation': `${i * 51}deg`, '--confetti-color': ['#b1e685', '#be9df2', '#ffd379', '#83d6cb'][i % 4] } as React.CSSProperties} />)}</div>}
      <div ref={outcomeRef} className={`ieb-outcome ${trace ? 'ieb-outcome--learning' : ''} ieb-outcome--${passed ? 'success' : 'wrong'}`} role="dialog" aria-modal="true" aria-labelledby="ieb-outcome-title" aria-describedby="ieb-outcome-copy">
        <span className="ieb-outcome-badge">{passed ? <Check size={54} strokeWidth={3} /> : diagnosis?.kind === 'runtime' ? <AlertTriangle size={50} /> : <X size={54} strokeWidth={3} />}</span>
        <span className="ieb-outcome-kicker">{passed ? `CHALLENGE ${String(index + 1).padStart(2, '0')} / 10` : diagnosis ? errorLabels[diagnosis.kind] : 'KEEP GOING'}</span>
        <h2 id="ieb-outcome-title">{passed ? index === 9 ? 'Final level cleared!' : 'Level cleared!' : diagnosis ? errorTitles[diagnosis.kind] : 'Try again.'}</h2>
        <p id="ieb-outcome-copy">{passed ? problem.explanation : diagnosis?.kind === 'runtime' ? output : feedback}</p>
        <div className="ieb-outcome-detail">
          {trace && <>
            {!passed && <p className="ieb-run-distinction">The code runs, but it does not match the mission.{diagnosis?.witness !== undefined && diagnosis.witness !== value ? ' This input can look right even when the rule fails for another value.' : ''}</p>}
            {prediction && <PredictionComparison prediction={prediction} trace={trace} />}
            <TracePanel trace={trace} compact />
          </>}
          {showModel && diagnosis && <div className="ieb-outcome-clue"><span>MODEL FOR THIS PIECE</span><pre><PythonCode code={problemLines(problem, pedagogy.useInput)[diagnosis.line]} /></pre></div>}
        </div>
        <div className="ieb-outcome-actions">{passed ? <><button className="ieb-primary" onClick={() => { setShowOutcome(false); onNext() }}>{nextLabel} <ArrowRight size={20} /></button><button className="ieb-outcome-review" onClick={() => setShowOutcome(false)}>{pedagogy.useInput ? 'TRY ANOTHER VALUE' : 'REVIEW MY CODE'}</button></> : <><button className="ieb-primary" onClick={() => setShowOutcome(false)}><RotateCcw size={19} /> {diagnosis?.kind === 'runtime' ? 'BACK TO MY CODE' : 'TRY AGAIN'}</button>{errorAttempt >= 4 && !showModel && <button className="ieb-outcome-review" onClick={() => { setShowModel(true); record('hint', { errorKind: diagnosis?.kind ?? null }) }}>SHOW A MODEL OF THIS PIECE</button>}</>}</div>
      </div>
    </div>}
  </main>
}
