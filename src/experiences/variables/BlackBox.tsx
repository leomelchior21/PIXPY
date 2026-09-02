import { ArrowLeft, ArrowRight, Check, Eye, Hand, Play, Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { ExperienceShell } from '../../components/ExperienceShell'
import { completeActivity } from '../../session/progressSession'
import type { SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void }
interface Sample { input: number; output: number }
interface QuizQuestion { code: string; options: string[]; answer: number; explanation: string }

const levels = [
  { rule: (x: number) => x * 6, formula: 'number * 6', options: ['number + 6', 'number * 6', 'number ** 2'] },
  { rule: (x: number) => x * 3 + 2, formula: 'number * 3 + 2', options: ['number * 3 + 2', 'number * 2 + 3', 'number + 5'] },
  { rule: (x: number) => x * 2 - 1, formula: 'number * 2 - 1', options: ['number - 2', 'number * 2 - 1', 'number ** 2 - 1'] },
]

const operationQuiz: QuizQuestion[] = [
  { code: 'print(8 + 3)', options: ['5', '11', '24', '83'], answer: 1, explanation: 'The + operator adds 8 and 3.' },
  { code: 'print(14 - 6)', options: ['8', '20', '6', '2'], answer: 0, explanation: 'The - operator subtracts 6 from 14.' },
  { code: 'print(4 * 7)', options: ['11', '21', '28', '47'], answer: 2, explanation: 'The * operator multiplies 4 by 7.' },
  { code: 'print(20 / 5)', options: ['4', '4.0', '15', '100'], answer: 1, explanation: 'The / operator divides and Python prints 4.0.' },
  { code: 'print(9 + 12)', options: ['3', '19', '21', '912'], answer: 2, explanation: '9 plus 12 equals 21.' },
  { code: 'print(18 - 9)', options: ['2', '9', '27', '8'], answer: 1, explanation: '18 minus 9 equals 9.' },
  { code: 'print(6 * 6)', options: ['12', '30', '36', '66'], answer: 2, explanation: '6 multiplied by 6 equals 36.' },
  { code: 'print(15 / 3)', options: ['5.0', '12', '45', '3.0'], answer: 0, explanation: '15 divided by 3 prints 5.0.' },
  { code: 'number = 7\nprint(number * 3)', options: ['10', '21', '73', '4'], answer: 1, explanation: 'number stores 7, then * 3 makes 21.' },
  { code: 'a = 10\nb = 4\nprint(a + b)', options: ['6', '14', '40', '104'], answer: 1, explanation: 'The values in a and b are added.' },
]

export function BlackBox({ progress, onProgress, onBack }: Props) {
  const [level, setLevel] = useState(0)
  const [samples, setSamples] = useState<Sample[]>([])
  const [last, setLast] = useState<Sample | null>(null)
  const [testing, setTesting] = useState(false)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState('Touch the Black Box. It will reveal an input and output.')
  const [revealed, setRevealed] = useState(false)
  const [quizSelected, setQuizSelected] = useState<number | null>(null)
  const timer = useRef<number | null>(null)
  const current = levels[level]
  const completed = progress.completed.includes('black-box')
  const quizReady = progress.blackBoxLevels.length === levels.length
  const quizIndex = Math.min(progress.blackBoxQuizAnswers.length, operationQuiz.length)
  const quizFinished = quizIndex === operationQuiz.length
  const quizScore = progress.blackBoxQuizAnswers.reduce((score, answer, index) => score + (answer === operationQuiz[index]?.answer ? 1 : 0), 0)

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const touchBox = () => {
    const used = new Set(samples.map((sample) => sample.input))
    let input = Math.floor(Math.random() * 20) + 1
    while (used.has(input) && used.size < 20) input = Math.floor(Math.random() * 20) + 1
    const sample = { input, output: current.rule(input) }
    setLast(sample)
    setSamples((items) => [...items, sample].slice(-6))
    setFeedback(samples.length < 1 ? 'Good. Touch it again to get another clue.' : 'Compare the pairs. What rule could make both outputs?')
  }

  const chooseLevel = (next: number) => {
    setLevel(next)
    setSamples([])
    setLast(null)
    setTesting(false)
    setGuess('')
    setRevealed(false)
    setFeedback('Touch the Black Box. It will reveal a fresh random pair.')
  }

  const testGuess = () => {
    if (guess !== current.formula) {
      setFeedback('That rule does not match every clue. Go back and touch the box again.')
      return
    }
    const solved = [...new Set([...progress.blackBoxLevels, level])]
    onProgress({ ...progress, blackBoxLevels: solved })
    setFeedback('YOU CRACKED IT. The same rule works for every input.')
    setRevealed(true)
  }

  const answerQuiz = (answer: number) => {
    if (quizSelected !== null || quizFinished) return
    setQuizSelected(answer)
    timer.current = window.setTimeout(() => {
      const answers = [...progress.blackBoxQuizAnswers, answer]
      let next = { ...progress, blackBoxQuizAnswers: answers }
      if (answers.length === operationQuiz.length) next = completeActivity(next, 'black-box')
      onProgress(next)
      setQuizSelected(null)
    }, 700)
  }

  if (quizReady) {
    const question = operationQuiz[quizIndex]
    return (
      <ExperienceShell order="03" title="Black Box" question="Can you use all four operations?" accent="#fe6f8f" hints={['Read the operator before calculating.', 'Work from left to right.', 'Remember: + add, - subtract, * multiply, / divide.']} completed={completed} objective="Complete all ten operation questions." onBack={onBack} className="blackbox-experience blackbox-quiz-experience">
        <section className="memory-quiz operation-quiz panel-surface">
          {quizFinished ? (
            <div className="memory-quiz-finish">
              <span><Trophy /></span><small>BLACK BOX QUIZ COMPLETE</small><h2>{quizScore} / {operationQuiz.length}</h2>
              <p>You tested addition, subtraction, multiplication, and division.</p>
              <button className="primary-action" onClick={onBack}>BACK TO ACTIVITIES <ArrowRight /></button>
            </div>
          ) : (
            <>
              <header className="memory-quiz-header"><div><small>OPERATIONS QUIZ</small><h2>What will Python print?</h2></div><strong>{quizIndex + 1}<span>/{operationQuiz.length}</span></strong></header>
              <div className="memory-quiz-progress"><span style={{ width: `${(quizIndex / operationQuiz.length) * 100}%` }} /></div>
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

  const revealCode = last ? `number = ${last.input}\nresult = ${current.formula}\n\nprint(result)` : ''

  return (
    <ExperienceShell order="03" title="Black Box" question="How can a value go through a calculation?" accent="#fe6f8f" hints={['Touch the box at least twice.', 'Compare how each input becomes its output.', 'Test a rule that works for every pair—not only one.']} completed={completed} objective="Crack all three random boxes, then complete the operations quiz." onBack={onBack} className="blackbox-experience">
      <section className="blackbox-stage panel-surface">
        <div className="level-tabs">{levels.map((_, index) => <button className={level === index ? 'is-active' : ''} onClick={() => chooseLevel(index)} key={index}>BOX {index + 1}{progress.blackBoxLevels.includes(index) && <Check />}</button>)}</div>
        <header className="blackbox-instruction"><span>1</span><div><strong>TOUCH THE BOX</strong><p>Every touch gives you a fresh random input → output clue.</p></div></header>
        <button className={`real-black-box ${last ? 'has-result' : ''}`} onClick={touchBox} aria-label="Touch the Black Box to generate a random number pair">
          <span className="box-number"><i>INPUT</i><b>{last?.input ?? '?'}</b></span>
          <em>→</em>
          <span className="physical-black-box"><small>UNKNOWN RULE</small><b>?</b><strong><Hand /> TOUCH</strong></span>
          <em>→</em>
          <span className="box-number"><i>OUTPUT</i><b>{last?.output ?? '?'}</b></span>
        </button>
        <div className="sample-rack"><small>CLUES COLLECTED</small><div>{samples.length ? samples.map((sample, index) => <span key={`${sample.input}-${index}`}>{sample.input} <i>→</i> <b>{sample.output}</b></span>) : <p>No clues yet.</p>}</div></div>
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
