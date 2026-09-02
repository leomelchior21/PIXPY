import { Check, LoaderCircle, Play, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
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
  const [output, setOutput] = useState('WAITING FOR INPUT')
  const [busy, setBusy] = useState(false)
  const completed = progress.completed.includes('input-machine')

  useEffect(() => { setCode(mode.starter); setInput(mode.value); setOutput('WAITING FOR INPUT') }, [mode])

  const run = async () => {
    setBusy(true)
    try {
      const result = await pythonRunner.runScript(code, [input])
      const doneModes = [...new Set([...progress.inputModes, mode.id])]
      let next = { ...progress, inputModes: doneModes }
      if (doneModes.length === modes.length) next = completeActivity(next, 'input-machine')
      onProgress(next)
      setOutput(result.stdout || '(nothing came out)')
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'The machine jammed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ExperienceShell order="04" title="Input Machine" question="How can a program receive something from me?" accent="#72dcff" hints={['The value starts with you.', 'input() waits for something you type.', 'For number math, wrap it in int(input()).']} completed={completed} objective="Send a value through every machine. Change the code if you want a different result." onBack={onBack} onComplete={() => onProgress(completeActivity(progress, 'input-machine'))} className="input-experience">
      <section className="input-stage panel-surface">
        <div className="mode-tabs">{modes.map((item, index) => <button className={modeIndex === index ? 'is-active' : ''} onClick={() => setModeIndex(index)} key={item.id}>{progress.inputModes.includes(item.id) && <Check size={12} />}{item.label}</button>)}</div>
        <div className="vending-machine">
          <span className="machine-lights"><i /><i /><i /></span>
          <label htmlFor="machine-input">ENTER SOMETHING</label>
          <input id="machine-input" value={input} onChange={(event) => setInput(event.target.value)} />
          <button onClick={run} disabled={busy}><Send size={18} /> SEND</button>
          <div className="machine-output"><small>PYTHON SAYS</small><strong>{busy ? 'THINKING...' : output}</strong></div>
        </div>
        <p>{mode.note}</p>
      </section>
      <section className="code-workbench panel-surface">
        <CodeEditor value={code} onChange={setCode} minHeight="250px" />
        <button className="primary-action full-action" onClick={run} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />} RUN WITH “{input || '...'}”</button>
        <div className="flow-legend"><span>YOU</span><i>→</i><code>input()</code><i>→</i><span>VARIABLE</span><i>→</i><code>print()</code></div>
      </section>
    </ExperienceShell>
  )
}
