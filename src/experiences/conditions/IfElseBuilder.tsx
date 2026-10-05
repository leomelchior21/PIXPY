import { ArrowLeft, ArrowRight, Binary, Check, Code2, Film, Gamepad2, GraduationCap, KeyRound, Lightbulb, LockKeyhole, Play, RotateCcw, ShieldCheck, Sparkles, Truck, Trophy, Undo2, Vote, Wind } from 'lucide-react'
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
  const scene = sceneDetails[index]
  const SceneIcon = scene.icon
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

  return <main className={`ieb-screen ${passed ? 'ieb-screen--success' : ''} ${interactive ? 'ieb-screen--interactive' : ''}`} style={{ '--ieb-scene': scene.color } as React.CSSProperties}>
    <header className="ieb-toolbar">
      <button className="ieb-back" onClick={onBack}><ArrowLeft size={18} /><span>Conditions</span></button>
      <div className="ieb-brand"><span><Code2 size={20} /></span><div><b>IF / ELSE</b><small>THE CODE BUILDER</small></div></div>
      <div className="ieb-counter"><span>{finished ? <Trophy size={19} /> : <Sparkles size={18} />}</span><b>{finished ? 'Complete!' : `Challenge ${String(index + 1).padStart(2, '0')}`}<small> / 10</small></b></div>
    </header>
    <div className="ieb-progress" role="progressbar" aria-label="Problems completed" aria-valuenow={finished ? 10 : index} aria-valuemin={0} aria-valuemax={10}>{ifElseProblems.map((_, i) => <span key={i} className={finished || i < index ? 'is-done' : i === index ? 'is-current' : ''}><i /></span>)}</div>
    {finished ? <section className="ieb-finish"><div className="ieb-trophy"><Trophy size={64} /><Sparkles size={28} /></div><p className="ieb-kicker">ALL 10 PROGRAMS COMPLETE</p><h1>You built both paths.</h1><p>You arranged real Python code, chose the right conditions, and tested your own values.</p><div><button className="ieb-primary" onClick={() => { setIndex(0); reset(); setFinished(false) }}><RotateCcw size={18} /> PLAY AGAIN</button><button onClick={onBack}>BACK TO CONDITIONS <ArrowRight size={18} /></button></div></section> : <>
      <section className="ieb-layout">
        <div className="ieb-problem" key={index}>
          <div className="ieb-mission-label"><span className="ieb-kicker">YOUR MISSION</span><span>{interactive ? 'BUILD + TEST' : 'BUILD THE CODE'}</span></div>
          <h1>{problem.title}<span aria-hidden="true">.</span></h1>
          <div className="ieb-scene" aria-label={`${scene.label}: ${interactive ? 'choose your input' : `${problem.variable} equals ${problem.initial}`}`}>
            <div className="ieb-ticket"><div className="ieb-ticket__main"><span>{scene.label}</span><SceneIcon size={42} strokeWidth={1.6} /><small>{scene.caption}</small></div><div className="ieb-ticket__stub"><span>{interactive ? 'YOU CHOOSE' : problem.variable.replaceAll('_', ' ').toUpperCase()}</span><b>{interactive ? '?' : problem.initial}</b><div className="ieb-barcode" aria-hidden="true" /></div></div>
            <Sparkles className="ieb-scene-star ieb-scene-star--one" aria-hidden="true" size={22} /><Sparkles className="ieb-scene-star ieb-scene-star--two" aria-hidden="true" size={14} />
          </div>
          <p className="ieb-scenario">{problem.scenario}</p>
          {!interactive && <>
          <div className="ieb-brief"><div><b>IF <ArrowRight size={13} /></b><code>{problem.trueOutput}</code></div><div><b>ELSE <ArrowRight size={13} /></b><code>{problem.falseOutput}</code></div></div>
          <aside><Lightbulb size={19} /><p>{interactive ? 'Your turn to experiment. Build it, enter a value, and try both paths.' : 'Tap the pieces in order. One condition is a decoy. Can you spot it?'}</p></aside>
          </>}
          {interactive && <label className="ieb-input"><span><span className="ieb-section-number">02</span> Try your own value <code>{problem.variable}</code></span><div><input type="text" inputMode={problem.decimal ? 'decimal' : 'text'} value={draft} disabled={busy} onChange={(event) => { setDraft(event.target.value); clearResult() }} placeholder="Type a value..." aria-label={`${problem.variable} input`} /><span><ArrowRight size={18} /></span></div><small>{problem.inputHint}{draft.trim() !== '' && value === null ? ' - Enter a valid value in this range.' : ''}</small></label>}
        </div>
        <div className="ieb-workspace">
          <div className={`ieb-editor ${passed ? 'is-correct' : status === 'wrong' ? 'is-wrong' : ''}`}>
            <header><div className="ieb-window-dots" aria-hidden="true"><i /><i /><i /></div><span>your_program.py</span><button onClick={reset} disabled={busy} aria-label="Clear program"><RotateCcw size={15} /><span>Reset</span></button></header>
            <div className="ieb-editor-label"><span><Code2 size={15} /> YOUR PROGRAM</span><b>{selected.length}<span> / 5 lines</span>{full && <Check size={14} />}</b></div>
            <div className="ieb-code" aria-label="Built Python program">{lines.map((_, position) => <div key={position} className={selected[position] === undefined ? `is-empty ${position === selected.length ? 'is-next' : ''}` : 'is-filled'}><span>{position + 1}</span>{selected[position] === undefined ? <span className="ieb-placeholder">{position === selected.length ? <><span>+</span> Tap a piece to add your next line</> : <i />}</span> : <button disabled={busy} onClick={() => { setSelected(selected.filter((__, i) => i !== position)); clearResult() }} aria-label={`Remove line ${position + 1}`}><PythonCode code={chunks[selected[position]]} /><Undo2 size={16} /></button>}</div>)}</div>
            {output && <div className={`ieb-output ${status === 'error' ? 'is-error' : ''}`}><span><span /> {status === 'error' ? 'RUN ERROR' : 'OUTPUT'}</span><pre>{output}</pre></div>}
          </div>
          <div className="ieb-bank"><header><div><span className="ieb-section-number">01</span><div><h2>Pick your pieces</h2><p>Tap to add. Tap a line above to take it back.</p></div></div><span className="ieb-spare">1 DECOY</span></header><div>{bankOrder.map((id) => <button key={id} disabled={busy || full || selected.includes(id)} className={`ieb-piece ieb-piece--${id === 0 ? 'value' : id === 1 || id === 5 ? 'condition' : id === 3 ? 'else' : 'print'} ${selected.includes(id) ? 'is-used' : ''}`} onClick={() => { setSelected([...selected, id]); clearResult() }} aria-label={`Add ${chunks[id].trim()}`}><PythonCode code={chunks[id]} />{selected.includes(id) && <Check size={13} />}</button>)}</div></div>

        </div>
      </section>
      <footer className={`ieb-feedback ieb-feedback--${status}`}><div role="status"><span className="ieb-feedback-icon">{passed ? <Check size={23} /> : status === 'wrong' || status === 'error' ? <Lightbulb size={23} /> : <Code2 size={23} />}</span>{passed ? <p><b>Nice build!</b> {problem.explanation}{interactive && ' Try another input or move on.'}</p> : status === 'wrong' ? <p><b>Try another order or condition.</b> {problem.explanation} Tap a line to remove it, then rebuild.</p> : <p><b>{busy ? "Let's see what happens..." : full ? 'Ready when you are.' : "You've got this."}</b>{busy ? 'Running your Python program...' : status === 'error' ? 'Try running again.' : !full ? 'Build a decision, one piece at a time.' : interactive && value === null ? 'Enter a value before running your program.' : 'Check your code and discover its path.'}</p>}</div>{passed ? <button className="ieb-primary" onClick={next}>{index === 9 ? 'FINISH ACTIVITY' : 'NEXT PROBLEM'} <ArrowRight size={19} /></button> : <button className="ieb-primary" disabled={!full || value === null || busy} onClick={() => void check()}><Play size={18} fill="currentColor" /> {busy ? 'RUNNING...' : interactive ? 'CHECK + RUN' : 'CHECK CODE'}</button>}</footer>
    </>}
  </main>
}
