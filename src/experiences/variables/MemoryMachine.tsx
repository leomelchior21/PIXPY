import { ArrowRight, Check, Play, RotateCcw, Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ExperienceShell } from '../../components/ExperienceShell'
import { completeActivity } from '../../session/progressSession'
import type { SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void }
interface Step { line: number; memory: Record<string, string>; output?: string; note: string }
interface Example { id: string; label: string; code: string[]; steps: Step[] }
interface QuizQuestion { code: string; options: string[]; answer: number; explanation: string }

const examples: Example[] = [
  { id: 'create', label: 'CREATE', code: ['x = 3', 'print(x)'], steps: [{ line: 0, memory: { x: '3' }, note: 'Python brings 3 into a memory space named x.' }, { line: 1, memory: { x: '3' }, output: '3', note: 'print(x) brings the remembered value to the output.' }] },
  { id: 'change', label: 'CHANGE', code: ['x = 10', 'x = 7', 'print(x)'], steps: [{ line: 0, memory: { x: '10' }, note: 'x starts with 10.' }, { line: 1, memory: { x: '7' }, note: '7 moves in and replaces the old value.' }, { line: 2, memory: { x: '7' }, output: '7', note: 'The newest value travels to the output.' }] },
  { id: 'two', label: 'TWO VALUES', code: ['x = 5', 'y = 8', 'print(x)', 'print(y)'], steps: [{ line: 0, memory: { x: '5' }, note: 'First, Python creates x.' }, { line: 1, memory: { x: '5', y: '8' }, note: 'Now Python remembers two separate values.' }, { line: 2, memory: { x: '5', y: '8' }, output: '5', note: 'x travels to the output.' }, { line: 3, memory: { x: '5', y: '8' }, output: '5\n8', note: 'Then y joins it.' }] },
  { id: 'reuse', label: 'REUSE', code: ['score = 10', 'bonus = score + 5', 'print(bonus)'], steps: [{ line: 0, memory: { score: '10' }, note: 'Remember the score.' }, { line: 1, memory: { score: '10', bonus: '15' }, note: 'score is reused to create bonus.' }, { line: 2, memory: { score: '10', bonus: '15' }, output: '15', note: 'bonus travels to the output.' }] },
  { id: 'input', label: 'INPUT', code: ['age = int(input())', 'print(age)'], steps: [{ line: 0, memory: { age: '12' }, note: 'Your input travels into memory and gets the name age.' }, { line: 1, memory: { age: '12' }, output: '12', note: 'The stored input travels back to you.' }] },
]

const quizQuestions: QuizQuestion[] = [
  { code: 'x = 3\nprint(x)', options: ['1', '2', '3', 'x'], answer: 2, explanation: 'x remembers 3, so print(x) outputs 3.' },
  { code: 'x = 10\nx = 7\nprint(x)', options: ['10', '7', '17', 'x'], answer: 1, explanation: 'The second assignment replaces 10 with 7.' },
  { code: 'x = 5\ny = 8\nprint(y)', options: ['5', '8', '13', 'y'], answer: 1, explanation: 'print(y) uses the value stored in y.' },
  { code: 'score = 10\nbonus = score + 5\nprint(bonus)', options: ['5', '10', '15', 'score'], answer: 2, explanation: 'bonus receives 10 + 5, which is 15.' },
  { code: 'age = 12\nprint(age)', options: ['age', '10', '12', '24'], answer: 2, explanation: 'age remembers the value 12.' },
  { code: 'a = 9\nprint(a - 4)', options: ['5', '4', '9', '13'], answer: 0, explanation: 'Python reads a as 9 and calculates 9 - 4.' },
  { code: 'a = 8\nprint(a / 2)', options: ['8', '6', '4', '4.0'], answer: 3, explanation: 'The / operator returns the decimal value 4.0.' },
  { code: 'a = 6\nprint(a // 3)', options: ['3', '6', '2', '2.0'], answer: 2, explanation: '// performs whole-number division.' },
  { code: 'x = 4\nx = x + 3\nprint(x)', options: ['3', '4', '7', '43'], answer: 2, explanation: 'The new value of x becomes its old value plus 3.' },
  { code: 'name = "PixPy"\nprint(name)', options: ['name', 'PixPy', '"name"', 'Nothing'], answer: 1, explanation: 'The variable name stores and prints the text PixPy.' },
]

export function MemoryMachine({ progress, onProgress, onBack }: Props) {
  const [exampleIndex, setExampleIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(-1)
  const [memoryInput, setMemoryInput] = useState('12')
  const [executing, setExecuting] = useState(false)
  const [quizSelected, setQuizSelected] = useState<number | null>(null)
  const timer = useRef<number | null>(null)
  const example = examples[exampleIndex]
  const pendingStep = executing ? example.steps[stepIndex + 1] : null
  const rawStep = stepIndex >= 0 ? example.steps[stepIndex] : null
  const step = rawStep && example.id === 'input' ? { ...rawStep, memory: { age: memoryInput || '?' }, output: rawStep.output ? (memoryInput || '?') : undefined } : rawStep
  const completed = progress.completed.includes('memory-machine')
  const quizReady = progress.memoryExamples.length === examples.length
  const quizIndex = Math.min(progress.memoryQuizAnswers.length, quizQuestions.length)
  const quizFinished = quizIndex === quizQuestions.length
  const quizScore = progress.memoryQuizAnswers.reduce((score, answer, index) => score + (answer === quizQuestions[index]?.answer ? 1 : 0), 0)

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const choose = (index: number) => {
    if (timer.current) window.clearTimeout(timer.current)
    setExampleIndex(index)
    setStepIndex(-1)
    setExecuting(false)
  }
  const executeLine = () => {
    if (executing || stepIndex === example.steps.length - 1) return
    setExecuting(true)
    const nextIndex = stepIndex + 1
    timer.current = window.setTimeout(() => {
      setStepIndex(nextIndex)
      setExecuting(false)
      if (nextIndex === example.steps.length - 1) {
        const done = [...new Set([...progress.memoryExamples, example.id])]
        onProgress({ ...progress, memoryExamples: done })
      }
    }, 420)
  }

  const restart = () => { if (timer.current) window.clearTimeout(timer.current); setExecuting(false); setStepIndex(-1) }

  const answerQuiz = (answer: number) => {
    if (quizSelected !== null || quizFinished) return
    setQuizSelected(answer)
    timer.current = window.setTimeout(() => {
      const answers = [...progress.memoryQuizAnswers, answer]
      let nextProgress = { ...progress, memoryQuizAnswers: answers }
      if (answers.length === quizQuestions.length) nextProgress = completeActivity(nextProgress, 'memory-machine')
      onProgress(nextProgress)
      setQuizSelected(null)
    }, 700)
  }

  if (quizReady) {
    const question = quizQuestions[quizIndex]
    return (
      <ExperienceShell order="05" title="Memory Machine" question="Prove what Python remembers." accent="#a994ff" hints={['Read the code from top to bottom.', 'Track the newest value stored under each name.', 'Only print() creates visible output.']} completed={completed} objective="Complete all ten questions." onBack={onBack} className="memory-experience memory-quiz-experience">
        <section className="memory-quiz panel-surface">
          {quizFinished ? (
            <div className="memory-quiz-finish">
              <span><Trophy /></span><small>MEMORY QUIZ COMPLETE</small><h2>{quizScore} / {quizQuestions.length}</h2>
              <p>{quizScore === quizQuestions.length ? 'Perfect memory. Python has nothing on you.' : 'Nice work. You followed values through ten programs.'}</p>
              <button className="primary-action" onClick={onBack}>BACK TO ACTIVITIES <ArrowRight /></button>
            </div>
          ) : (
            <>
              <header className="memory-quiz-header"><div><small>MEMORY QUIZ</small><h2>What will Python print?</h2></div><strong>{quizIndex + 1}<span>/{quizQuestions.length}</span></strong></header>
              <div className="memory-quiz-progress"><span style={{ width: `${(quizIndex / quizQuestions.length) * 100}%` }} /></div>
              <pre className="memory-quiz-code"><code>{question.code}</code></pre>
              <div className="memory-quiz-options">
                {question.options.map((option, index) => {
                  const state = quizSelected === null ? '' : index === question.answer ? 'is-correct' : index === quizSelected ? 'is-wrong' : ''
                  return <button className={state} key={`${option}-${index}`} onClick={() => answerQuiz(index)} disabled={quizSelected !== null}><span>{String.fromCharCode(65 + index)}</span><code>{option}</code></button>
                })}
              </div>
              <p className={`memory-quiz-feedback ${quizSelected !== null ? 'is-visible' : ''}`}>{quizSelected === null ? 'Choose one answer.' : quizSelected === question.answer ? `Correct. ${question.explanation}` : `Not quite. ${question.explanation}`}</p>
            </>
          )}
        </section>
      </ExperienceShell>
    )
  }

  return (
    <ExperienceShell order="05" title="Memory Machine" question="Where does a variable's value go?" accent="#a994ff" hints={['Press EXECUTE LINE once.', 'Watch the highlighted line travel into memory or output.', 'Reassignment replaces the value already inside the same memory box.']} completed={completed} objective="Execute one line at a time. Follow exactly what that line brings into memory and output." onBack={onBack} onComplete={() => onProgress(completeActivity(progress, 'memory-machine'))} className="memory-experience">
      <section className="memory-code-panel panel-surface">
        <div className="memory-tabs">{examples.map((item, index) => <button key={item.id} className={exampleIndex === index ? 'is-active' : ''} onClick={() => choose(index)}>{progress.memoryExamples.includes(item.id) && <Check />}{item.label}</button>)}</div>
        <header className="blackbox-instruction"><span>1</span><div><strong>READ ONE LINE</strong><p>Python executes from top to bottom.</p></div></header>
        {example.id === 'input' && <label className="memory-input-control">VALUE FOR INPUT() <input type="number" value={memoryInput} onChange={(event) => { setMemoryInput(event.target.value); restart() }} /></label>}
        <pre className="memory-code-lines">{example.code.map((line, index) => <span className={`${executing && stepIndex + 1 === index ? 'is-reading' : ''} ${!executing && step?.line === index ? 'is-running' : ''} ${index < stepIndex ? 'is-past' : ''}`} key={`${line}-${index}`}><i>{index + 1}</i><code>{line}</code>{executing && stepIndex + 1 === index ? <b>READING</b> : !executing && step?.line === index ? <b>NOW</b> : null}</span>)}</pre>
        <div className="memory-execute-actions"><button className="secondary-action" onClick={restart}><RotateCcw /> Restart</button><button className={`primary-action execute-line-button ${executing ? 'is-executing' : ''}`} onClick={executeLine} disabled={executing || stepIndex === example.steps.length - 1}>{executing ? <><span className="execute-pulse" /> EXECUTING...</> : stepIndex === example.steps.length - 1 ? <><Check /> EXAMPLE DONE</> : <><Play fill="currentColor" /> EXECUTE LINE {stepIndex + 2}</>}</button></div>
      </section>

      <section className="memory-result-panel panel-surface">
        <header className="blackbox-instruction"><span>2</span><div><strong>WATCH WHAT IT BRINGS</strong><p>Every executed line creates one visible result.</p></div></header>
        <div className="memory-motion" aria-hidden="true">
          {executing && <i className="memory-dot memory-dot--to-memory" />}
          {executing && pendingStep?.output !== undefined && <i className="memory-dot memory-dot--to-output" />}
        </div>
        <section className="memory-result-row"><header><span>MEMORY</span><small>VALUES PYTHON REMEMBERS</small></header><div className={executing ? 'is-receiving' : ''}>{step ? Object.entries(step.memory).map(([name, value]) => <article key={name}><strong>{name}</strong><b>{value}</b></article>) : <p>No variable yet.</p>}</div></section>
        <section className="memory-result-row memory-result-row--output"><header><span>OUTPUT</span><small>WHAT PRINT() BRINGS BACK</small></header><pre className={executing ? 'is-receiving' : ''}>{step?.output ?? 'Nothing printed yet.'}</pre></section>
      </section>
    </ExperienceShell>
  )
}
