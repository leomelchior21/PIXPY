import { Eye, EyeOff, LoaderCircle, Play, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { ExperienceShell } from '../../components/ExperienceShell'
import { pythonRunner } from '../../lib/pythonRunner'
import { completeActivity, emptyProgress } from '../../session/progressSession'
import type { SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void }

const codeRecipes = [
  { label: '+', name: 'ADD', expression: 'number + 5' },
  { label: '−', name: 'SUBTRACT', expression: 'number - 5' },
  { label: '×', name: 'MULTIPLY', expression: 'number * 2' },
  { label: '÷', name: 'DIVIDE', expression: 'number / 2' },
]

export function BuildBlackBox({ progress, onProgress, onBack }: Props) {
  const [code, setCode] = useState(progress.blackBoxCode)
  const [input, setInput] = useState('10')
  const version = useRef(0)
  useEffect(() => () => { version.current += 1 }, [])
  const [lastOutput, setLastOutput] = useState<number | null>(null)
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Build a rule. Then test it with different numbers.')
  const completed = progress.completed.includes('build-black-box')
  const tests = useMemo(() => progress.blackBoxTests.slice(-4), [progress.blackBoxTests])
  const waitingForOperator = code.includes('result =  # type an operation here')

  const run = async () => {
    if (busy) return
    const inputNumber = Number(input)
    if (!input.trim() || !Number.isSafeInteger(inputNumber)) { setMessage('Enter a whole number to test your rule.'); return }
    const request = ++version.current
    setBusy(true)
    try {
      const result = await pythonRunner.runScript(code, [String(input)])
      if (request !== version.current) return
      const printed = result.stdout.trim()
      if (!printed || printed.includes('\n')) throw new Error('Use print(result) to send one number out of your box.')
      const output = Number(printed)
      if (!Number.isFinite(output)) throw new Error('Print one number so the machine can show it.')
      const nextTests = [...progress.blackBoxTests.filter((test) => test.input !== inputNumber), { input: inputNumber, output }].slice(-6)
      let next = { ...progress, blackBoxCode: code, blackBoxTests: nextTests }
      if (nextTests.length >= 2) next = completeActivity(next, 'build-black-box')
      onProgress(next)
      setLastOutput(output)
      setMessage('YOUR MACHINE WORKS. Test another input—or hide the code.')
    } catch (error) {
      if (request !== version.current) return
      setMessage(error instanceof Error ? error.message : 'The machine could not read that rule.')
    } finally {
      if (request === version.current) setBusy(false)
    }
  }

  const reset = () => {
    setCode(emptyProgress.blackBoxCode)
    setLastOutput(null)
    setHidden(false)
    setMessage('Starter machine restored.')
    onProgress({ ...progress, blackBoxCode: emptyProgress.blackBoxCode, blackBoxTests: [] })
  }

  const editCode = (value: string) => {
    version.current += 1
    setCode(value)
    setLastOutput(null)
    setMessage('Rule changed. Test two different inputs to collect fresh clues.')
    onProgress({ ...progress, blackBoxCode: value, blackBoxTests: [] })
  }

  return (
    <ExperienceShell order="06" title="Build a Black Box" question="Can I make my own transformation?" accent="#54e3bd" hints={['Change only the result line first.', 'Use number with +, -, *, /, //, %, or **.', 'Try result = number * 5 + 3.']} completed={completed} objective="Create a rule, test at least two inputs, then hide your code for a classmate." onBack={onBack} onComplete={() => onProgress(completeActivity(progress, 'build-black-box'))} className="buildbox-experience">
      <section className="build-workspace">
        <header className="build-machine-strip">
          <div className="custom-machine">
            <span><small>INPUT</small><input aria-label="Test input" type="number" step="1" value={input} disabled={busy} onChange={(event) => { setInput(event.target.value); setLastOutput(null) }} onKeyDown={(event) => { if (event.key === 'Enter') void run() }} /></span>
            <i>→</i>
            <div className={hidden ? 'is-secret' : ''}><strong>{hidden ? '?' : 'PY'}</strong><small>{progress.name.toUpperCase()}'S BOX</small></div>
            <i>→</i>
            <span><small>OUTPUT</small><strong>{lastOutput ?? '?'}</strong></span>
          </div>
          <div className="build-run-stack">
            <button className="primary-action machine-run" onClick={run} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />} TEST {input}</button>
            <p role="status">{message}</p>
          </div>
        </header>

        <div className="build-lower-grid">
          <aside className="build-reference-panel panel-surface">
            <header><small>{hidden ? 'CLASSMATE CHALLENGE' : 'REAL PYTHON REFERENCE'}</small><h2>{hidden ? 'Can you crack the rule?' : 'Try these operators'}</h2><p>{hidden ? 'Enter a number above and test the box. Compare the clues, then tell your classmate your guess.' : 'Write an operation on line 3. Change the number to make it yours.'}</p></header>
            <div className="code-recipes">
              {codeRecipes.map((recipe) => <article key={recipe.name}><span><b>{recipe.label}</b>{recipe.name}</span><code>result = {recipe.expression}</code></article>)}
            </div>
            <div className="test-history"><small>CLUES FOR A CLASSMATE</small>{tests.length ? tests.map((test, index) => <span key={`${test.input}-${index}`}>{test.input} <i>→</i> <b>{test.output}</b></span>) : <p>Run two inputs to create clues.</p>}</div>
          </aside>

          <section className="build-editor-panel panel-surface">
            <div className="hide-code-bar"><button onClick={() => setHidden((value) => !value)}>{hidden ? <Eye /> : <EyeOff />} {hidden ? 'SHOW MY CODE' : 'HIDE MY CODE'}</button><span>{hidden ? 'CLASSMATE MODE' : 'BUILDER MODE'}</span></div>
            {hidden ? <div className="secret-code"><EyeOff size={38} /><strong>CODE HIDDEN</strong><p>Test. Compare. Make a guess.<br />Show the code when you’re ready to reveal the rule.</p></div> : <div className={`build-editor-attention ${waitingForOperator ? 'is-waiting' : ''}`}><CodeEditor value={code} readOnly={busy} onChange={editCode} minHeight="180px" /><span className="operator-invitation">TYPE YOUR OPERATOR ON LINE 3</span></div>}
            <button className="text-action" onClick={reset} disabled={busy}><RotateCcw size={15} /> Reset machine</button>
          </section>
        </div>
      </section>
    </ExperienceShell>
  )
}
