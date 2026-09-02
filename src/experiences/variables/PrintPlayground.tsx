import { LoaderCircle, Play, RotateCcw, TerminalSquare } from 'lucide-react'
import { useState } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { ExperienceShell } from '../../components/ExperienceShell'
import { pythonRunner } from '../../lib/pythonRunner'
import { completeActivity } from '../../session/progressSession'
import type { SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void }

const starter = 'print("MAKE SOME NOISE")'

export function PrintPlayground({ progress, onProgress, onBack }: Props) {
  const [code, setCode] = useState(starter)
  const [output, setOutput] = useState('Your output appears here.')
  const [busy, setBusy] = useState(false)
  const completed = progress.completed.includes('print-playground')

  const run = async () => {
    setBusy(true)
    try {
      const result = await pythonRunner.runScript(code)
      setOutput(result.stdout || '(Python printed an empty line.)')
      onProgress(completeActivity({ ...progress, interestingValues: [...progress.interestingValues, `Printed: ${result.stdout.slice(0, 40)}`].slice(-8) }, 'print-playground'))
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'Python got tangled. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ExperienceShell order="02" title="Print Playground" question="How can Python put something on screen?" accent="#ffcb47" hints={['Type what Python should say.', 'Put the message inside print().', 'Try several print() lines to draw with text.']} completed={completed} objective="Write anything inside print(). Run it and watch the terminal answer." onBack={onBack} onComplete={() => onProgress(completeActivity(progress, 'print-playground'))} className="print-experience">
      <section className="terminal-stage panel-surface">
        <header className="simple-instruction"><span>1</span><div><strong>WRITE SOMETHING</strong><p>Use one or more <code>print()</code> lines.</p></div></header>
        <div className="terminal-screen"><div><TerminalSquare /> PIXPY OUTPUT</div><pre>{output}</pre><span className="terminal-cursor" /></div>
      </section>
      <section className="code-workbench panel-surface">
        <CodeEditor value={code} onChange={setCode} minHeight="260px" />
        <div className="run-row"><button className="secondary-action" onClick={() => { setCode(starter); setOutput('Your output appears here.') }}><RotateCcw /> Reset</button><button className="primary-action" onClick={run} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />} RUN IT</button></div>
        <p className="concept-line"><code>print()</code> sends something to the output.</p>
      </section>
    </ExperienceShell>
  )
}
