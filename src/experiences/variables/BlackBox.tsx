import { ArrowLeft, ArrowRight, Check, Eye, Hand, Play } from 'lucide-react'
import { useState } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { ExperienceShell } from '../../components/ExperienceShell'
import { completeActivity } from '../../session/progressSession'
import type { SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void }
interface Sample { input: number; output: number }

const levels = [
  { rule: (x: number) => x * 6, formula: 'number * 6', options: ['number + 6', 'number * 6', 'number ** 2'], inputs: [2, 7, 5, 10] },
  { rule: (x: number) => x * 3 + 2, formula: 'number * 3 + 2', options: ['number * 3 + 2', 'number * 2 + 3', 'number + 5'], inputs: [1, 4, 8, 10] },
  { rule: (x: number) => x * 2 - 1, formula: 'number * 2 - 1', options: ['number - 2', 'number * 2 - 1', 'number ** 2 - 1'], inputs: [3, 6, 9, 12] },
]

export function BlackBox({ progress, onProgress, onBack }: Props) {
  const [level, setLevel] = useState(0)
  const [samples, setSamples] = useState<Sample[]>([])
  const [last, setLast] = useState<Sample | null>(null)
  const [testing, setTesting] = useState(false)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState('Touch the Black Box. It will reveal an input and output.')
  const [revealed, setRevealed] = useState(false)
  const current = levels[level]
  const completed = progress.completed.includes('black-box')

  const touchBox = () => {
    const input = current.inputs[samples.length % current.inputs.length]
    const sample = { input, output: current.rule(input) }
    setLast(sample)
    setSamples((items) => [...items.filter((item) => item.input !== input), sample])
    setFeedback(samples.length < 1 ? 'Good. Touch it again to get another clue.' : 'Compare the pairs. What rule could make both outputs?')
  }

  const chooseLevel = (next: number) => {
    setLevel(next)
    setSamples([])
    setLast(null)
    setTesting(false)
    setGuess('')
    setRevealed(false)
    setFeedback('Touch the Black Box. It will reveal an input and output.')
  }

  const testGuess = () => {
    if (guess !== current.formula) {
      setFeedback('That rule does not match every clue. Go back and touch the box again.')
      return
    }
    const solved = [...new Set([...progress.blackBoxLevels, level])]
    let next = { ...progress, blackBoxLevels: solved }
    if (solved.length === levels.length) next = completeActivity(next, 'black-box')
    onProgress(next)
    setFeedback('YOU CRACKED IT. The same rule works for every input.')
    setRevealed(true)
  }

  const revealCode = last ? `number = ${last.input}\nresult = ${current.formula}\n\nprint(result)` : ''

  return (
    <ExperienceShell order="03" title="Black Box" question="How can a value go through a calculation?" accent="#fe6f8f" hints={['Touch the box at least twice.', 'Compare how each input becomes its output.', `Test a rule that works for every pair—not only one.`]} completed={completed} objective="First collect clues from the box. Only then test a Python hypothesis." onBack={onBack} onComplete={() => onProgress(completeActivity(progress, 'black-box'))} className="blackbox-experience">
      <section className="blackbox-stage panel-surface">
        <div className="level-tabs">{levels.map((_, index) => <button className={level === index ? 'is-active' : ''} onClick={() => chooseLevel(index)} key={index}>BOX {index + 1}{progress.blackBoxLevels.includes(index) && <Check />}</button>)}</div>
        <header className="blackbox-instruction"><span>1</span><div><strong>TOUCH THE BOX</strong><p>Each touch gives you one input → output clue.</p></div></header>
        <button className={`real-black-box ${last ? 'has-result' : ''}`} onClick={touchBox} aria-label="Touch the Black Box to generate a number pair">
          <span className="box-number"><i>INPUT</i><b>{last?.input ?? '?'}</b></span>
          <em>→</em>
          <span className="physical-black-box">
            <span className="box-bolts"><i /><i /><i /><i /></span>
            <small>UNKNOWN RULE</small><b>?</b><strong><Hand /> TOUCH</strong>
          </span>
          <em>→</em>
          <span className="box-number"><i>OUTPUT</i><b>{last?.output ?? '?'}</b></span>
        </button>
        <div className="sample-rack"><small>CLUES COLLECTED</small><div>{samples.length ? samples.map((sample) => <span key={sample.input}>{sample.input} <i>→</i> <b>{sample.output}</b></span>) : <p>No clues yet.</p>}</div></div>
      </section>

      <section className={`hypothesis-panel panel-surface ${testing ? 'is-testing' : 'is-intro'}`}>
        {!testing ? (
          <>
            <header className="blackbox-instruction"><span>2</span><div><strong>LOOK FOR THE PATTERN</strong><p>The hidden rule never changes.</p></div></header>
            <button className="primary-action" onClick={() => setTesting(true)} disabled={samples.length < 2}>TEST A HYPOTHESIS <ArrowRight /></button>
          </>
        ) : (
          <>
            <header className="blackbox-instruction"><span>3</span><div><strong>TEST YOUR HYPOTHESIS</strong><p>Choose one rule that explains every clue.</p></div></header>
            <div className="rule-options">{current.options.map((option) => <button className={guess === option ? 'is-active' : ''} onClick={() => setGuess(option)} key={option}><code>{option}</code></button>)}</div>
            <button className="primary-action" onClick={testGuess} disabled={!guess}><Play fill="currentColor" /> RUN MY RULE</button>
            <p className="machine-message">{feedback}</p>
            {revealed ? <div className="python-reveal"><span><Eye /> THE REAL PYTHON</span><CodeEditor value={revealCode} onChange={() => undefined} readOnly minHeight="135px" /></div> : <button className="text-action" onClick={() => setTesting(false)}><ArrowLeft /> COLLECT MORE CLUES</button>}
          </>
        )}
      </section>
    </ExperienceShell>
  )
}
