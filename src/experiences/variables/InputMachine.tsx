import { Check, LoaderCircle, Play, RotateCcw, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { ExperienceShell } from '../../components/ExperienceShell'
import { pythonRunner } from '../../lib/pythonRunner'
import { completeActivity } from '../../session/progressSession'
import type { SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void }

const modes = [
  { id: 'echo', label: 'RAW INPUT', starter: 'message = input()\nprint(message)', value: 'hello pixel', note: 'Send anything. Python sends it back.' },
  { id: 'double', label: 'DOUBLE', starter: 'number = int(input())\nresult = number * 2\nprint(result)', value: '8', note: 'Turn 8 into 16.' },
  { id: 'ten-more', label: 'TEN MORE', starter: 'number = int(input())\nresult = number + 10\nprint(result)', value: '7', note: 'Turn 7 into 17.' },
  { id: 'age', label: 'AGE MACHINE', starter: 'age = int(input())\nfuture_age = age + 10\nprint("IN 10 YEARS:")\nprint(future_age)', value: '12', note: 'How old in ten years?' },
]

export function InputMachine({ progress, onProgress, onBack }: Props) {
  const [modeIndex, setModeIndex] = useState(0)
  const mode = modes[modeIndex]
  const [code, setCode] = useState(mode.starter)
  const [input, setInput] = useState(mode.value)
  const [output, setOutput] = useState('Your output will appear here.')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [sentInput, setSentInput] = useState('')
  const version = useRef(0)
  const drafts = useRef<Record<string, { code: string; input: string }>>({})
  const [busy, setBusy] = useState(false)
  const completed = progress.completed.includes('input-machine')

  useEffect(() => () => { version.current += 1 }, [])
  const clearOutput = () => { version.current += 1; setBusy(false); setStatus('idle'); setOutput('Your output will appear here.') }
  const choose = (index: number) => {
    drafts.current[mode.id] = { code, input }
    const next = modes[index]
    setModeIndex(index)
    setCode(drafts.current[next.id]?.code ?? next.starter)
    setInput(drafts.current[next.id]?.input ?? next.value)
    clearOutput()
  }
  const reset = () => { setCode(mode.starter); setInput(mode.value); clearOutput() }

  const run = async () => {
    if (busy) return
    const request = ++version.current
    setBusy(true)
    try {
      const result = await pythonRunner.runScript(code, [input])
      if (request !== version.current) return
      const doneModes = [...new Set([...progress.inputModes, mode.id])]
      let next = { ...progress, inputModes: doneModes }
      if (doneModes.length === modes.length) next = completeActivity(next, 'input-machine')
      onProgress(next)
      setOutput(result.stdout || '(nothing came out)')
      setStatus('success')
      setSentInput(input)
    } catch (error) {
      if (request !== version.current) return
      setOutput(error instanceof Error ? error.message : 'The machine jammed.')
      setStatus('error')
    } finally {
      if (request === version.current) setBusy(false)
    }
  }

  return (
    <ExperienceShell order="04" title="Input Machine" question="How can a program receive something from me?" accent="#72dcff" hints={['The value starts with you.', 'input() waits for something you type.', 'For number math, wrap it in int(input()).']} completed={completed} objective="Send a value through every machine. Change the code if you want a different result." onBack={onBack} onComplete={() => onProgress(completeActivity(progress, 'input-machine'))} className="input-experience">
      <section className="input-stage panel-surface">
        <div className="mode-tabs" aria-label="Choose a machine">{modes.map((item, index) => <button aria-pressed={modeIndex === index} disabled={busy} className={modeIndex === index ? 'is-active' : ''} onClick={() => choose(index)} key={item.id}>{progress.inputModes.includes(item.id) && <Check size={12} />}{item.label}</button>)}</div>
        <form className={`vending-machine ${busy ? 'is-processing' : ''} ${status === 'error' ? 'has-error' : ''}`} onSubmit={(event) => { event.preventDefault(); void run() }}>
          <span className="machine-lights"><i /><i /><i /></span>
          <div className="machine-heading"><span>01 / YOUR TURN</span><h2>{modeIndex === 0 ? 'Say something to Python.' : 'Give Python a number.'}</h2><p>{mode.note}</p></div>
          <label htmlFor="machine-input">{modeIndex === 0 ? 'YOUR MESSAGE' : 'YOUR NUMBER'}</label>
          <input id="machine-input" inputMode={modeIndex === 0 ? 'text' : 'numeric'} value={input} disabled={busy} onChange={(event) => { setInput(event.target.value); clearOutput() }} />
          <button type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />} SEND</button>
          <div className="machine-transfer" aria-hidden="true"><span /> input() → Python → print() <span /></div>
          <div className="machine-output" role="status" aria-live="polite"><small>{status === 'error' ? 'LET’S FIX THE CODE' : '02 / PYTHON SAYS'}</small><strong>{busy ? 'Running your code…' : output}</strong></div>
        </form>
        <p className="input-learning-note">{status === 'success' ? `You sent “${sentInput}”. Python used your code to make the output.` : modeIndex === 0 ? 'input() receives text. Try a different message and send again.' : 'int(input()) turns your text into a whole number for math.'}</p>
      </section>
      <section className="code-workbench panel-surface">
        <header className="workbench-heading"><span>INSIDE THE MACHINE</span><h2>Your Python recipe</h2><p>Change the code. Send the same input. What changes?</p></header>
        <CodeEditor value={code} readOnly={busy} onChange={(value) => { setCode(value); clearOutput() }} minHeight="180px" />
        <div className="run-row"><button className="secondary-action" onClick={reset} disabled={busy}><RotateCcw /> Reset</button><button className="primary-action full-action" onClick={run} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />} RUN CODE</button></div>
        <div className="flow-legend"><span>{progress.inputModes.length} / 4 MACHINES EXPLORED</span></div>
      </section>
    </ExperienceShell>
  )
}
