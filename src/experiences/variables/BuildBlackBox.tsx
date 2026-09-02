import { Eye, EyeOff, LoaderCircle, Play, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
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
  const [input, setInput] = useState(10)
  const [lastOutput, setLastOutput] = useState<number | null>(null)
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Build a rule. Then test it with different numbers.')
  const completed = progress.completed.includes('build-black-box')
  const tests = useMemo(() => progress.blackBoxTests.slice(-4), [progress.blackBoxTests])
  const waitingForOperator = code.includes('result =  # type an operation here')

  const run = async () => {
    setBusy(true)
    try {
      const result = await pythonRunner.runScript(code, [String(input)])
      const output = Number(result.stdout.trim().split('\n').at(-1))
      if (!Number.isFinite(output)) throw new Error('Print one number so the machine can show it.')
      const nextTests = [...progress.blackBoxTests.filter((test) => test.input !== input), { input, output }].slice(-6)
      let next = { ...progress, blackBoxCode: code, blackBoxTests: nextTests }
      if (nextTests.length >= 2) next = completeActivity(next, 'build-black-box')
      onProgress(next)
      setLastOutput(output)
      setMessage('YOUR MACHINE WORKS. Test another input—or hide the code.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The machine could not read that rule.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setCode(emptyProgress.blackBoxCode)
    setLastOutput(null)
    setHidden(false)
    setMessage('Starter machine restored.')
    onProgress({ ...progress, blackBoxCode: emptyProgress.blackBoxCode, blackBoxTests: [] })
  }

  return (
    <ExperienceShell order="06" title="Build a Black Box" question="Can I make my own transformation?" accent="#54e3bd" hints={['Change only the result line first.', 'Use number with +, -, *, /, //, %, or **.', 'Try result = number * 5 + 3.']} completed={completed} objective="Create a rule, test at least two inputs, then hide your code for a classmate." onBack={onBack} onComplete={() => onProgress(completeActivity(progress, 'build-black-box'))} className="buildbox-experience">
      <section className="build-workspace">
        <header className="build-machine-strip">
          <div className="custom-machine">
            <span><small>INPUT</small><input type="number" value={input} onChange={(event) => setInput(Number(event.target.value))} /></span>
            <i>→</i>
            <div className={hidden ? 'is-secret' : ''}><strong>{hidden ? '?' : 'PY'}</strong><small>{progress.name.toUpperCase()}'S BOX</small></div>
            <i>→</i>
            <span><small>OUTPUT</small><strong>{lastOutput ?? '?'}</strong></span>
          </div>
          <div className="build-run-stack">
            <button className="primary-action machine-run" onClick={run} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />} TEST {input}</button>
            <p>{message}</p>
          </div>
        </header>

        <div className="build-lower-grid">
          <aside className="build-reference-panel panel-surface">
            <header><small>REAL PYTHON REFERENCE</small><h2>Try these operators</h2><p>Write one of these operators on the blinking line. Change the number to make it yours.</p></header>
            <div className="code-recipes">
              {codeRecipes.map((recipe) => <article key={recipe.name}><span><b>{recipe.label}</b>{recipe.name}</span><code>result = {recipe.expression}</code></article>)}
            </div>
            <div className="test-history"><small>CLUES FOR A CLASSMATE</small>{tests.length ? tests.map((test, index) => <span key={`${test.input}-${index}`}>{test.input} <i>→</i> <b>{test.output}</b></span>) : <p>Run two inputs to create clues.</p>}</div>
          </aside>

          <section className="build-editor-panel panel-surface">
            <div className="hide-code-bar"><button onClick={() => setHidden((value) => !value)}>{hidden ? <Eye /> : <EyeOff />} {hidden ? 'SHOW MY CODE' : 'HIDE MY CODE'}</button><span>{hidden ? 'CLASSMATE MODE' : 'BUILDER MODE'}</span></div>
            {hidden ? <div className="secret-code"><EyeOff size={38} /><strong>CODE HIDDEN</strong><p>Can your classmate crack the rule from the clues?</p></div> : <div className={`build-editor-attention ${waitingForOperator ? 'is-waiting' : ''}`}><CodeEditor value={code} onChange={(value) => { setCode(value); onProgress({ ...progress, blackBoxCode: value }) }} minHeight="230px" /><span className="operator-invitation">TYPE YOUR OPERATOR ON LINE 3</span></div>}
            <button className="text-action" onClick={reset}><RotateCcw size={15} /> Reset machine</button>
          </section>
        </div>
      </section>
    </ExperienceShell>
  )
}
