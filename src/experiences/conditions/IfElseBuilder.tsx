import { ArrowLeft, ArrowRight, Check, Lightbulb, Play, RotateCcw, Trophy, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PythonCode } from '../../components/PythonCode'
import { ifElseProblems, parseProblemInput, problemLines } from '../../data/ifElseBuilder'
import { pythonRunner } from '../../lib/pythonRunner'
import { completeActivity } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import './ifElseBuilder.css'

interface Props {
  progress: SessionProgress
  onProgress: (progress: SessionProgress) => void
  onBack: () => void
}

export function IfElseBuilder({ progress, onProgress, onBack }: Props) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number[]>([])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<'idle' | 'wrong' | 'running' | 'correct' | 'error'>('idle')
  const [output, setOutput] = useState('')
  const [finished, setFinished] = useState(false)
  const runVersion = useRef(0)
  useEffect(() => () => { runVersion.current += 1 }, [])

  const problem = ifElseProblems[index]
  const interactive = index >= 5
  const lines = problemLines(problem, interactive)
  const chunks = [...lines, `if ${problem.wrongCondition}:`]
  // Mix the bank without changing the identity of each removable chunk.
  const bankOrder = index % 2 === 0 ? [4, 1, 3, 0, 5, 2] : [3, 2, 5, 4, 0, 1]
  const full = selected.length === lines.length
  const busy = status === 'running'
  const passed = status === 'correct'
  const value = interactive ? parseProblemInput(problem, draft) : problem.initial
  const code = selected.map((id) => chunks[id]).join('\n')

  const clearResult = () => { setStatus('idle'); setOutput('') }
  const reset = () => { runVersion.current += 1; setSelected([]); setDraft(''); clearResult() }

  const check = async () => {
    if (!full || value === null || busy) return
    if (selected.some((id, position) => id !== position)) {
      setStatus('wrong')
      setOutput('')
      return
    }
    const version = ++runVersion.current
    setStatus('running')
    try {
      const result = await pythonRunner.runScript(code, interactive ? [draft.trim()] : [])
      if (version !== runVersion.current) return
      setOutput(result.stdout)
      setStatus('correct')
    } catch (error) {
      if (version !== runVersion.current) return
      setStatus('error')
      setOutput(error instanceof Error ? error.message : 'Could not run the code. Try again.')
    }
  }

  const next = () => {
    if (!passed) return
    if (index === ifElseProblems.length - 1) {
      onProgress(completeActivity(progress, 'if-else'))
      setFinished(true)
    } else { setIndex(index + 1); reset() }
  }

  return <main className="ieb-screen">
    <header className="ieb-toolbar"><button onClick={onBack}><ArrowLeft size={16} /> CONDITIONS</button><span>IF/ELSE · CODE BUILDER</span><b>{finished ? 'COMPLETE' : `${index + 1} / ${ifElseProblems.length}`}</b></header>
    <div className="ieb-progress" role="progressbar" aria-label="Problems completed" aria-valuenow={finished ? 10 : index} aria-valuemin={0} aria-valuemax={10}>{ifElseProblems.map((_, i) => <span key={i} className={finished || i < index ? 'is-done' : i === index ? 'is-current' : ''} />)}</div>
    {finished ? <section className="ieb-finish"><Trophy size={64} /><p>ALL 10 PROGRAMS COMPLETE</p><h1>You built both paths.</h1><p>You arranged real Python code, chose the right conditions, and tested your own values.</p><div><button className="ieb-primary" onClick={() => { setIndex(0); reset(); setFinished(false) }}><RotateCcw size={18} /> PLAY AGAIN</button><button onClick={onBack}>BACK TO CONDITIONS <ArrowRight size={18} /></button></div></section> : <>
      <section className="ieb-layout">
        <div className="ieb-problem"><span className="ieb-kicker">PROBLEM {String(index + 1).padStart(2, '0')} · {interactive ? 'BUILD + TEST' : 'BUILD THE CODE'}</span><h1>{problem.title}</h1><p>{problem.scenario}</p>
          <div className="ieb-brief"><span>THE TWO PATHS</span><div><b>IF</b><code>{problem.trueOutput}</code></div><div><b>ELSE</b><code>{problem.falseOutput}</code></div></div>
          <aside><Lightbulb size={21} /><p>{interactive ? 'New challenge! Build the program, then type your own input. Change it after running to explore the other path.' : `The starting value is ${problem.variable} = ${problem.initial}. Pick the chunks in the order Python should read them.`}</p></aside>
          <p className="ieb-tip">Assign a value → test a condition → indent the IF action → ELSE → indent the ELSE action.</p>
        </div>
        <div className="ieb-workspace"><header><span>YOUR PROGRAM</span><button onClick={reset} disabled={busy} aria-label="Clear program"><RotateCcw size={15} /> CLEAR</button></header>
          <div className="ieb-code" aria-label="Built Python program">{lines.map((_, position) => <div key={position} className={selected[position] === undefined ? 'is-empty' : ''}><span>{position + 1}</span>{selected[position] === undefined ? <span className="ieb-placeholder">{position === selected.length ? 'Tap a chunk below to add the next line' : '···'}</span> : <button disabled={busy} onClick={() => { setSelected(selected.filter((__, i) => i !== position)); clearResult() }} aria-label={`Remove line ${position + 1}`}><PythonCode code={chunks[selected[position]]} /><Undo2 size={13} /></button>}</div>)}</div>
          <div className="ieb-bank"><span>TAP TO BUILD · ONE CHUNK WILL BE LEFT OVER</span><div>{bankOrder.map((id) => <button key={id} disabled={busy || full || selected.includes(id)} className={selected.includes(id) ? 'is-used' : ''} onClick={() => { setSelected([...selected, id]); clearResult() }} aria-label={`Add ${chunks[id].trim()}`}><PythonCode code={chunks[id]} /></button>)}</div></div>
          {interactive && <label className="ieb-input"><span>YOUR INPUT · {problem.variable}</span><input type="text" inputMode={problem.decimal ? 'decimal' : 'text'} value={draft} disabled={busy} onChange={(event) => { setDraft(event.target.value); clearResult() }} placeholder={problem.inputHint} aria-label={`${problem.variable} input`} /><small>{problem.inputHint}{draft.trim() !== '' && value === null ? ' · Enter a valid value in this range.' : ''}</small></label>}
          {output && <div className={`ieb-output ${status === 'error' ? 'is-error' : ''}`}><span>{status === 'error' ? 'RUN ERROR' : 'CONSOLE OUTPUT'}</span><pre>{output}</pre></div>}
        </div>
      </section>
      <footer className={`ieb-feedback ieb-feedback--${status}`}><div role="status">{passed ? <><Check size={24} /><p><b>Nice build!</b> {problem.explanation}{interactive && ' You can try another input or move on.'}</p></> : status === 'wrong' ? <><Lightbulb size={24} /><p><b>Try another order or condition.</b> {problem.explanation} Tap a line to remove it, then rebuild.</p></> : <p>{busy ? 'Running your Python program…' : status === 'error' ? 'Try running again.' : !full ? 'Tap the chunks in order. Tap an inserted line to remove it.' : interactive && value === null ? 'Enter a value before running your program.' : 'All five lines are in. Ready to check your program?'}</p>}</div>{passed ? <button className="ieb-primary" onClick={next}>{index === 9 ? 'FINISH ACTIVITY' : 'NEXT PROBLEM'} <ArrowRight size={18} /></button> : <button className="ieb-primary" disabled={!full || value === null || busy} onClick={() => void check()}><Play size={17} /> {busy ? 'RUNNING…' : interactive ? 'CHECK + RUN' : 'CHECK CODE'}</button>}</footer>
    </>}
  </main>
}
