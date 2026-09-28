import { AlertTriangle, ArrowLeft, Check, HelpCircle, LoaderCircle, Play, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { analyzeStopSheet, buildStopStarter, countStopLines, STOP_COLUMN_COUNT } from '../../lib/stopAnalyzer'
import { PythonRunError, pythonRunner } from '../../lib/pythonRunner'
import { completeActivity } from '../../session/progressSession'
import type { RuntimeState, SessionProgress } from '../../types'
import './stopStringSheet.css'

interface Props {
  progress: SessionProgress
  onProgress: (progress: SessionProgress) => void
  onBack: () => void
}

const ROW_ACCENTS = ['#5c9dff', '#58d7f5', '#a994ff', '#59dfb9', '#ffcb47', '#fe6f8f']

interface RunBanner {
  ok: boolean
  message: string
  note: string
}

interface StopStatus {
  label: string
  tone: 'idle' | 'live' | 'done' | 'check' | 'loading'
}

function friendlyStopError(error: unknown, line: number | null): string {
  const message = error instanceof Error ? error.message : 'Python got tangled. Try again.'
  const prefix = line ? `Line ${line}: ` : ''
  const nameError = message.match(/name ['"](\w+)['"] is not defined/) ?? message.match(/\b(\w+) is not defined/)
  if (nameError) return `${prefix}NameError: Python does not know ${nameError[1]} yet.`
  if (/can only concatenate str|unsupported operand type|must be str/.test(message)) return `${prefix}TypeError: Text and numbers need str() or an f-string.`
  if (/SyntaxError|invalid syntax|unterminated|unexpected EOF/i.test(message)) return `${prefix}SyntaxError: Python could not read that line. Check the quotes and parentheses.`
  const inline = message.match(/^(?:Line (\d+):?\s*)?(.*)$/s)
  return inline && inline[1] ? `Line ${inline[1]}: ${inline[2]}` : message
}

export function StopStringSheet({ progress, onProgress, onBack }: Props) {
  const starter = useMemo(() => buildStopStarter(progress.name), [progress.name])
  const code = progress.stopCode ?? starter
  const sheet = useMemo(() => analyzeStopSheet(code), [code])
  const [busy, setBusy] = useState(false)
  const [lastRun, setLastRun] = useState<RunBanner | null>(null)
  const [attentionLine, setAttentionLine] = useState<number | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [runnerState, setRunnerState] = useState<RuntimeState>(() => pythonRunner.getState())
  const executionVersion = useRef(0)
  const busyRef = useRef(false)
  const runRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    const unsubscribe = pythonRunner.subscribe(setRunnerState)
    return () => { unsubscribe() }
  }, [])

  useEffect(() => {
    if (progress.stopCode !== null) return
    onProgress({ ...progress, stopCode: starter })
  }, [onProgress, progress, starter])

  useEffect(() => {
    if (!sheet.complete || progress.completed.includes('stop') || progress.stopSheetComplete) return
    onProgress(completeActivity({ ...progress, stopCode: code, stopSheetComplete: true }, 'stop'))
  }, [code, onProgress, progress, sheet.complete])

  useEffect(() => {
    if (!helpOpen) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setHelpOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [helpOpen])

  const editCode = (value: string) => {
    executionVersion.current += 1
    busyRef.current = false
    setBusy(false)
    setLastRun(null)
    setAttentionLine(null)
    onProgress({ ...progress, stopCode: value })
  }

  const resetCode = () => {
    executionVersion.current += 1
    busyRef.current = false
    setBusy(false)
    setLastRun(null)
    setAttentionLine(null)
    setResetOpen(false)
    onProgress({ ...progress, stopCode: starter })
  }

  const run = async () => {
    if (busyRef.current || helpOpen) return
    busyRef.current = true
    const requestVersion = ++executionVersion.current
    const runningCode = code
    setBusy(true)
    setLastRun(null)
    setAttentionLine(null)
    try {
      await pythonRunner.runScript(runningCode)
      if (requestVersion !== executionVersion.current) return
      setLastRun({
        ok: true,
        message: 'Python ran your code cleanly.',
        note: sheet.complete ? 'STOP! Sheet complete.' : 'Sheet updated. Add another category to grow the board.',
      })
    } catch (error) {
      if (requestVersion !== executionVersion.current) return
      const line = error instanceof PythonRunError ? error.line : null
      setAttentionLine(line)
      setLastRun({ ok: false, message: friendlyStopError(error, line), note: 'Fix the highlighted line, then run again.' })
    } finally {
      busyRef.current = false
      if (requestVersion === executionVersion.current) setBusy(false)
    }
  }
  runRef.current = () => { void run() }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        runRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const status: StopStatus = lastRun && !lastRun.ok
    ? { label: 'CHECK CODE', tone: 'check' }
    : sheet.syntaxIssue
      ? { label: 'CHECK CODE', tone: 'check' }
      : sheet.complete
        ? { label: 'STOP READY', tone: 'done' }
        : runnerState === 'booting'
          ? { label: 'LOADING PYTHON', tone: 'loading' }
          : sheet.columns.length > 0
            ? { label: 'SHEET LIVE', tone: 'live' }
            : { label: 'PY READY', tone: 'idle' }

  const lineCount = countStopLines(code)
  const completedOnce = progress.completed.includes('stop')

  return (
    <main className={`stop-screen ${sheet.complete ? 'is-complete' : ''}`} data-complete={sheet.complete || undefined}>
      <header className="stop-header">
        <button className="stop-back" onClick={onBack}><ArrowLeft size={17} /> EXTRAS</button>
        <div className="stop-title"><small>EXTRA 03 · STRING SHEET</small><h1>STOP</h1></div>
        <div className="stop-header-actions">
          <span className={`stop-status stop-status--${status.tone}`} role="status"><i />{status.label}</span>
          <button className="stop-help" onClick={() => setHelpOpen(true)}><HelpCircle size={16} /> HELP</button>
        </div>
      </header>

      <div className="stop-body">
        <section className="stop-panel stop-panel--code">
          <header className="stop-panel__head">
            <span className="stop-panel__number">01</span>
            <div><small>WRITE</small><h2>CODE</h2></div>
            <em>PYTHON</em>
            {resetOpen
              ? <span className="stop-reset-confirm"><small>RESET CODE?</small><button onClick={() => setResetOpen(false)}>KEEP MINE</button><button className="is-danger" onClick={resetCode}>RESET</button></span>
              : <button className="stop-reset-button" onClick={() => setResetOpen(true)}><RotateCcw size={13} /> RESET</button>}
          </header>
          <div className="stop-editor">
            <CodeEditor value={code} onChange={editCode} label="STOP sheet code editor" minHeight="100%" attentionLine={attentionLine} />
          </div>
          <footer className="stop-panel__foot">
            <span>{lineCount} LINES</span><span>PYTHON STRINGS</span><span>CTRL/⌘ + ENTER TO RUN</span>
          </footer>
        </section>

        <section className="stop-panel stop-panel--sheet">
          <header className="stop-panel__head">
            <span className="stop-panel__number">02</span>
            <div><small>WATCH</small><h2>STOP SHEET</h2></div>
            <em>{sheet.columns.length}/{STOP_COLUMN_COUNT}</em>
          </header>
          <div className="stop-sheet-body">
            {sheet.complete && <p className="stop-complete-banner" role="status"><Check size={16} /> STOP! SHEET COMPLETE</p>}
            {sheet.syntaxIssue && <p className="stop-syntax" role="status"><AlertTriangle size={14} /> Line {sheet.syntaxIssue.line}: {sheet.syntaxIssue.message}</p>}
            {sheet.columns.length === 0 && !sheet.syntaxIssue && (
              <div className="stop-empty">
                <strong>YOUR STOP SHEET IS WAITING.</strong>
                <p>CREATE A STRING VARIABLE, THEN PRINT IT WITH A LABEL:</p>
                <code>answer1 = "Ada"<br />print("Name: " + answer1)</code>
              </div>
            )}
            <ol className="stop-board" aria-label="Stop sheet rows">
              {Array.from({ length: STOP_COLUMN_COUNT }, (_, index) => {
                const column = sheet.columns[index]
                const number = String(index + 1).padStart(2, '0')
                if (!column) return <li key={`empty-${index}`} className="stop-row is-empty" aria-hidden="true"><span className="stop-row__index">{number}</span><span className="stop-row__empty">EMPTY SLOT</span></li>
                return (
                  <li key={column.label} className="stop-row" style={{ '--stop-row': ROW_ACCENTS[index] ?? ROW_ACCENTS[0], animationDelay: `${index * 45}ms` } as React.CSSProperties}>
                    <span className="stop-row__index">{number}</span>
                    <div className="stop-row__copy"><strong>{column.label}</strong><code>{column.source}</code></div>
                    <output className="stop-row__value">{column.value}</output>
                    <span className={`stop-chip is-${column.chip.toLowerCase()}`}>{column.chip === 'VALID' ? <Check size={13} /> : null}{column.chip}</span>
                  </li>
                )
              })}
            </ol>
            {sheet.tips.length > 0 && (
              <ul className="stop-tips" aria-label="Tips">
                {sheet.tips.map((tip) => (
                  <li key={`${tip.line}-${tip.kind}-${tip.text}`} className={`stop-tip stop-tip--${tip.kind}`}>
                    <HelpCircle size={14} /><span>{tip.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {lastRun && (
            <div className={`stop-validation ${lastRun.ok ? 'is-valid' : 'is-error'}`} role="status">
              {lastRun.ok ? <Check size={18} /> : <AlertTriangle size={18} />}
              <p><strong>{lastRun.ok ? 'VALID.' : 'ERROR.'}</strong> {lastRun.message}</p>
              <small>{lastRun.note}</small>
            </div>
          )}
          <footer className="stop-runbar">
            <div className="stop-run-note">
              {completedOnce && !sheet.complete ? 'Completed before—edit the code or play again.' : 'The sheet updates while you type. RUN validates the real program.'}
            </div>
            <button className="stop-run" onClick={() => { void run() }} disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={17} /> : <Play size={17} fill="currentColor" />} RUN
            </button>
          </footer>
        </section>
      </div>

      {helpOpen && (
        <div className="stop-modal" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false) }}>
          <section className="stop-modal__panel" role="dialog" aria-modal="true" aria-labelledby="stop-help-title">
            <header>
              <div><small>HELP · STOP SHEET</small><h2 id="stop-help-title">One variable, many columns.</h2></div>
              <button onClick={() => setHelpOpen(false)} aria-label="Close help"><X size={18} /></button>
            </header>
            <p>A string stores text. Print it with a label and the sheet grows a row.</p>
            <pre><code>{'answer1 = "Ada"\nprint("Name: " + answer1)'}</code></pre>
            <div className="stop-help-flow"><span>VARIABLE</span><i>+</i><span>LABEL</span><i>→</i><strong>ROW</strong></div>
            <ul>
              <li><code>{'print(f"Name: {answer1}")'}</code> also works.</li>
              <li><code>print("Name:", answer1)</code> also works.</li>
              <li>Reusing a label <b>updates</b> the same row.</li>
              <li><code>answer1 = "Braga"</code> changes the value. Print again to see it.</li>
              <li>Six different labels complete the sheet—not six prints.</li>
            </ul>
            <button className="stop-modal__close" onClick={() => setHelpOpen(false)}>GOT IT</button>
          </section>
        </div>
      )}
    </main>
  )
}
