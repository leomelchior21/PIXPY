import { ArrowLeft, ArrowRight, Check, Eye, Hand, Play, RotateCcw, Timer, Trophy } from 'lucide-react'
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

const MAX_QUIZ_ATTEMPTS = 5

function variant(seed: number, offset: number, min: number, range: number): number {
  return min + ((seed * (offset + 5) + offset * 11) % range)
}

function makeOptions(correct: string, distractors: Array<string | number>, answer: number): Pick<QuizQuestion, 'options' | 'answer'> {
  const choices = [...new Set(distractors.map(String).filter((item) => item !== correct))]
  let filler = Number.parseFloat(correct) || 1
  while (choices.length < 3) {
    filler += choices.length + 2
    const next = String(Number.isInteger(Number(correct)) ? Math.round(filler) : `${Math.round(filler)}.0`)
    if (next !== correct && !choices.includes(next)) choices.push(next)
  }
  const options = choices.slice(0, 3)
  options.splice(answer, 0, correct)
  return { options, answer }
}

function buildQuestion(code: string, correct: string | number, distractors: Array<string | number>, answer: number, explanation: string): QuizQuestion {
  return { code, explanation, ...makeOptions(String(correct), distractors, answer) }
}

function buildOperationQuiz(seed: number): QuizQuestion[] {
  const addA = variant(seed, 1, 5, 13)
  const addB = variant(seed, 2, 3, 14)
  const subA = variant(seed, 3, 14, 18)
  const subB = variant(seed, 4, 2, subA - 2)
  const mulA = variant(seed, 5, 3, 8)
  const mulB = variant(seed, 6, 4, 6)
  const divB = variant(seed, 7, 2, 7)
  const divAnswer = variant(seed, 8, 3, 8)
  const plusC = variant(seed, 9, 7, 15)
  const plusD = variant(seed, 10, 8, 14)
  const subC = variant(seed, 11, 20, 18)
  const subD = variant(seed, 12, 5, subC - 5)
  const square = variant(seed, 13, 4, 7)
  const divD = variant(seed, 14, 2, 6)
  const divQ = variant(seed, 15, 4, 7)
  const numberValue = variant(seed, 16, 5, 10)
  const numberMultiplier = variant(seed, 17, 2, 6)
  const varA = variant(seed, 18, 8, 13)
  const varB = variant(seed, 19, 3, 10)

  return [
    buildQuestion(`print(${addA} + ${addB})`, addA + addB, [addA - addB, addA * addB, `${addA}${addB}`], seed % 4, `The + operator adds ${addA} and ${addB}.`),
    buildQuestion(`print(${subA} - ${subB})`, subA - subB, [subA + subB, subB, subA], (seed + 1) % 4, `The - operator subtracts ${subB} from ${subA}.`),
    buildQuestion(`print(${mulA} * ${mulB})`, mulA * mulB, [mulA + mulB, mulA * mulB - mulA, `${mulA}${mulB}`], (seed + 2) % 4, `The * operator multiplies ${mulA} by ${mulB}.`),
    buildQuestion(`print(${divB * divAnswer} / ${divB})`, `${divAnswer}.0`, [divAnswer, divB * divAnswer - divB, divB], (seed + 3) % 4, `Python / divides and prints ${divAnswer}.0.`),
    buildQuestion(`print(${plusC} + ${plusD})`, plusC + plusD, [Math.abs(plusC - plusD), plusC + plusD - 2, `${plusC}${plusD}`], (seed + 4) % 4, `${plusC} plus ${plusD} equals ${plusC + plusD}.`),
    buildQuestion(`print(${subC} - ${subD})`, subC - subD, [subC + subD, subD - 1, subC - subD + 2], (seed + 5) % 4, `${subC} minus ${subD} equals ${subC - subD}.`),
    buildQuestion(`print(${square} * ${square})`, square * square, [square + square, square * square - square, `${square}${square}`], (seed + 6) % 4, `${square} multiplied by ${square} equals ${square * square}.`),
    buildQuestion(`print(${divD * divQ} / ${divD})`, `${divQ}.0`, [divQ, divD * divQ, `${divD}.0`], (seed + 7) % 4, `${divD * divQ} divided by ${divD} prints ${divQ}.0.`),
    buildQuestion(`number = ${numberValue}\nprint(number * ${numberMultiplier})`, numberValue * numberMultiplier, [numberValue + numberMultiplier, `${numberValue}${numberMultiplier}`, numberValue - numberMultiplier], (seed + 8) % 4, `number stores ${numberValue}, then * ${numberMultiplier} makes ${numberValue * numberMultiplier}.`),
    buildQuestion(`a = ${varA}\nb = ${varB}\nprint(a + b)`, varA + varB, [varA - varB, varA * varB, `${varA}${varB}`], (seed + 9) % 4, 'The values in a and b are added.'),
  ]
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function BlackBox({ progress, onProgress, onBack }: Props) {
  const [level, setLevel] = useState(0)
  const [samples, setSamples] = useState<Sample[]>([])
  const [last, setLast] = useState<Sample | null>(null)
  const [testing, setTesting] = useState(false)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState('Touch the Black Box. It will reveal an input and output.')
  const [revealed, setRevealed] = useState(false)
  const [quizSelected, setQuizSelected] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const answerTimer = useRef<number | null>(null)
  const current = levels[level]
  const operationQuiz = buildOperationQuiz(progress.blackBoxQuizSeed)
  const completed = progress.completed.includes('black-box')
  const quizReady = progress.blackBoxLevels.length === levels.length
  const quizIndex = Math.min(progress.blackBoxQuizAnswers.length, operationQuiz.length)
  const quizFinished = quizIndex === operationQuiz.length
  const quizScore = progress.blackBoxQuizAnswers.reduce((score, answer, index) => score + (answer === operationQuiz[index]?.answer ? 1 : 0), 0)
  const quizStarted = progress.blackBoxQuizStartedAt !== null
  const quizElapsed = quizFinished ? progress.blackBoxQuizElapsedMs ?? 0 : quizStarted ? now - (progress.blackBoxQuizStartedAt ?? now) : 0
  const attemptsUsed = progress.blackBoxQuizResults.length
  const canTryAgain = quizFinished && attemptsUsed < MAX_QUIZ_ATTEMPTS
  const displayedAttempt = quizFinished ? Math.max(1, attemptsUsed) : Math.min(attemptsUsed + 1, MAX_QUIZ_ATTEMPTS)

  useEffect(() => () => { if (answerTimer.current) window.clearTimeout(answerTimer.current) }, [])

  useEffect(() => {
    if (!quizReady || !quizStarted || quizFinished) return
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [quizFinished, quizReady, quizStarted])

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
      setSamples([])
      setLast(null)
      setTesting(false)
      setGuess('')
      setRevealed(false)
      setFeedback('That rule missed. The Black Box reset, so start again with fresh clues.')
      return
    }
    const solved = [...new Set([...progress.blackBoxLevels, level])]
    onProgress({ ...progress, blackBoxLevels: solved })
    setFeedback('YOU CRACKED IT. The same rule works for every input.')
    setRevealed(true)
  }

  const startQuiz = () => {
    if (quizStarted || attemptsUsed >= MAX_QUIZ_ATTEMPTS) return
    const startedAt = Date.now()
    setNow(startedAt)
    onProgress({ ...progress, blackBoxQuizStartedAt: startedAt, blackBoxQuizElapsedMs: null })
  }

  const tryQuizAgain = () => {
    if (!canTryAgain) return
    const results = progress.blackBoxQuizResults.length > 0
      ? progress.blackBoxQuizResults
      : [{ score: quizScore, total: operationQuiz.length, elapsedMs: progress.blackBoxQuizElapsedMs ?? 0 }]
    setQuizSelected(null)
    onProgress({
      ...progress,
      blackBoxQuizAnswers: [],
      blackBoxQuizStartedAt: null,
      blackBoxQuizElapsedMs: null,
      blackBoxQuizSeed: progress.blackBoxQuizSeed + 37 + results.length,
      blackBoxQuizResults: results,
    })
  }

  const answerQuiz = (answer: number) => {
    if (!quizStarted || quizSelected !== null || quizFinished) return
    setQuizSelected(answer)
    answerTimer.current = window.setTimeout(() => {
      const answers = [...progress.blackBoxQuizAnswers, answer]
      let next = { ...progress, blackBoxQuizAnswers: answers }
      if (answers.length === operationQuiz.length) {
        const elapsedMs = Date.now() - (progress.blackBoxQuizStartedAt ?? Date.now())
        const score = answers.reduce((total, item, index) => total + (item === operationQuiz[index]?.answer ? 1 : 0), 0)
        next = completeActivity({
          ...next,
          blackBoxQuizElapsedMs: elapsedMs,
          blackBoxQuizResults: [...progress.blackBoxQuizResults, { score, total: operationQuiz.length, elapsedMs }].slice(-MAX_QUIZ_ATTEMPTS),
        }, 'black-box')
      }
      onProgress(next)
      setQuizSelected(null)
    }, 500)
  }

  if (quizReady) {
    const question = operationQuiz[Math.min(quizIndex, operationQuiz.length - 1)]
    return (
      <ExperienceShell order="03" title="Black Box" question="Can you use all four operations?" accent="#fe6f8f" hints={['Read the operator before calculating.', 'Work from left to right.', 'Remember: + add, - subtract, * multiply, / divide.']} completed={completed} objective="Complete all ten operation questions." onBack={onBack} className="blackbox-experience blackbox-quiz-experience">
        <div className="blackbox-quiz-layout">
          <section className="memory-quiz operation-quiz panel-surface">
            {!quizStarted && !quizFinished ? (
              <div className="blackbox-quiz-start">
                <span><Timer /></span><small>BLACK BOX QUIZ</small><h2>Ready for ten questions?</h2>
                <p>The timer starts when you press start. You can try up to five times with new values.</p>
                <button className="primary-action" onClick={startQuiz} disabled={attemptsUsed >= MAX_QUIZ_ATTEMPTS}>START QUIZ <ArrowRight /></button>
              </div>
            ) : quizFinished ? (
              <div className="memory-quiz-finish blackbox-quiz-finish">
                <span><Trophy /></span><small>BLACK BOX QUIZ COMPLETE</small><h2>{quizScore} / {operationQuiz.length}</h2>
                <p>Time: <b>{formatElapsed(quizElapsed)}</b></p>
                <div className="blackbox-quiz-finish-actions">
                  <button className="primary-action" onClick={onBack}>BACK TO ACTIVITIES <ArrowRight /></button>
                  <button className="secondary-action" onClick={tryQuizAgain} disabled={!canTryAgain}><RotateCcw /> TRY AGAIN</button>
                </div>
              </div>
            ) : (
              <>
                <header className="memory-quiz-header"><div><small>BLACK BOX QUIZ</small><h2>What will Python print?</h2></div><strong>{quizIndex + 1}<span>/{operationQuiz.length}</span></strong></header>
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
          <aside className="blackbox-quiz-timer panel-surface">
            <small>ATTEMPT {displayedAttempt} / {MAX_QUIZ_ATTEMPTS}</small>
            <Timer aria-hidden="true" />
            <strong>{formatElapsed(quizElapsed)}</strong>
            {quizFinished ? <p>{quizScore} correct in {formatElapsed(quizElapsed)}</p> : quizStarted ? <p>Timer running</p> : <p>Press start when ready</p>}
            {progress.blackBoxQuizResults.length > 0 && (
              <div>
                {progress.blackBoxQuizResults.map((result, index) => <span key={`${result.elapsedMs}-${index}`}>{index + 1}: {result.score}/{result.total} in {formatElapsed(result.elapsedMs)}</span>)}
              </div>
            )}
          </aside>
        </div>
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
            <p className="machine-message">{feedback}</p>
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
