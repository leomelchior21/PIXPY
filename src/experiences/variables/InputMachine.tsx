import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleUserRound,
  Keyboard,
  LoaderCircle,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { ExperienceShell } from '../../components/ExperienceShell'
import { pythonRunner } from '../../lib/pythonRunner'
import { completeActivity, resetActivityProgress } from '../../session/progressSession'
import type { SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void; onNext: () => void }

const rawInput = {
  id: 'echo',
  label: 'RAW INPUT',
  introTitle: 'First, let Python listen.',
  introCopy: 'You send a message. input() catches it and stores it in a variable.',
  formula: 'hello → hello',
  starter: '# Try replacing input() with your name in quotes\nmessage = input()\nprint(message)',
  placeholder: 'Type any message',
  runLines: [2, 3],
  editLine: 2,
  inputLabel: 'YOUR MESSAGE',
  phonePrompt: 'Say something. I’ll send it back!',
  mission: 'Replace input() with your name in quotes. Then run again.',
  catchCopy: 'The program stopped listening because input() is gone. Put input() back so it can catch a new message.',
  quiz: [
    { question: 'What is the variable name?', answers: ['input', 'message', 'print'], correct: 1, feedback: 'message is the box that stores the input.' },
    { question: 'If the input is "rocket", what prints?', answers: ['message', 'rocket', 'input()'], correct: 1, feedback: 'The value inside message is rocket.' },
    { question: 'Which line listens to the student?', answers: ['message = input()', 'print(message)', 'message = "rocket"'], correct: 0, feedback: 'input() pauses and listens.' },
  ],
} as const

type RunStatus = 'idle' | 'success' | 'error'

export function InputMachine({ progress, onProgress, onBack, onNext }: Props) {
  const [inLab, setInLab] = useState(false)
  const [code, setCode] = useState<string>(rawInput.starter)
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState<RunStatus>('idle')
  const [sentInput, setSentInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeLine, setActiveLine] = useState<number | null>(null)
  const [changeTested, setChangeTested] = useState(false)
  const [fixTested, setFixTested] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const [quizFinished, setQuizFinished] = useState(false)
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null)
  const version = useRef(0)
  const completed = progress.completed.includes('input-machine')
  const hasRun = progress.inputModes.includes(rawInput.id)
  const codeChanged = code !== rawInput.starter

  useEffect(() => () => { version.current += 1 }, [])

  const clearOutput = () => {
    version.current += 1
    setBusy(false)
    setStatus('idle')
    setOutput('')
    setSentInput('')
    setActiveLine(null)
  }

  const resetMode = () => {
    setCode(rawInput.starter)
    setInput('')
    clearOutput()
  }

  const resetLevel = () => {
    version.current += 1
    setInLab(false)
    setCode(rawInput.starter)
    setInput('')
    setOutput('')
    setSentInput('')
    setBusy(false)
    setStatus('idle')
    setActiveLine(null)
    setChangeTested(false)
    setFixTested(false)
    setQuizOpen(false)
    setQuizFinished(false)
    setQuizIndex(0)
    setQuizAnswer(null)
    onProgress(resetActivityProgress(progress, 'input-machine'))
  }

  const run = async () => {
    if (busy) return
    if (!input.trim()) {
      setSentInput('')
      setOutput('Type something in the message field first.')
      setStatus('error')
      setActiveLine(null)
      return
    }
    const request = ++version.current
    setBusy(true)
    setStatus('idle')
    setOutput('')
    setSentInput(input)
    setActiveLine(rawInput.runLines[0])
    try {
      const resultPromise = pythonRunner.runScript(code, [input])
      const lineAnimation = (async () => {
        for (const line of rawInput.runLines) {
          if (request !== version.current) return
          setActiveLine(line)
          await new Promise((resolve) => window.setTimeout(resolve, 380))
        }
      })()
      const [result] = await Promise.all([resultPromise, lineAnimation])
      if (request !== version.current) return
      onProgress({ ...progress, inputModes: [...new Set([...progress.inputModes, rawInput.id])] })
      setOutput(result.stdout || '(nothing came out)')
      setStatus('success')
      if (codeChanged) setChangeTested(true)
      else if (changeTested) setFixTested(true)
    } catch (error) {
      if (request !== version.current) return
      setOutput(error instanceof Error ? error.message : 'The machine jammed. Try one small change.')
      setStatus('error')
    } finally {
      if (request === version.current) {
        setBusy(false)
        setActiveLine(null)
      }
    }
  }

  const advanceQuiz = () => {
    if (quizAnswer === null) return
    if (quizIndex < rawInput.quiz.length - 1) {
      setQuizIndex((index) => index + 1)
      setQuizAnswer(null)
      return
    }
    setQuizFinished(true)
    onProgress(completeActivity(progress, 'input-machine'))
  }

  const goBack = () => {
    clearOutput()
    setInLab(false)
  }

  return (
    <ExperienceShell
      order="04"
      title="Input Machine"
      question="What if your program could listen and reply?"
      accent="#72dcff"
      hints={['input() pauses and listens for a value.', 'Whatever you type becomes the value inside input().', 'A variable keeps the input ready for the next line.']}
      completed={completed}
      objective="Send a message into the code, then change the code and run it again."
      onBack={onBack}
      onReset={resetLevel}
      onComplete={() => onProgress(completeActivity(progress, 'input-machine'))}
      className="input-experience"
    >
      {!inLab ? (
        <ModeIntro onNext={() => setInLab(true)} />
      ) : (
        <section className="input-lab-shell">
          {quizOpen ? (
            quizFinished ? (
              <QuizFinish onNext={onNext} onBack={onBack} />
            ) : (
              <ModeQuiz
                questionIndex={quizIndex}
                answer={quizAnswer}
                onAnswer={setQuizAnswer}
                onNext={advanceQuiz}
                onBack={() => setQuizOpen(false)}
              />
            )
          ) : (
            <div className="input-workspace">
              <PhoneMachine
                input={input}
                inputLabel={rawInput.inputLabel}
                placeholder={rawInput.placeholder}
                prompt={rawInput.phonePrompt}
                output={output}
                sentInput={sentInput}
                status={status}
                busy={busy}
                hasRun={hasRun}
                onInputChange={(value) => { setInput(value); clearOutput() }}
                onRun={run}
              />

              <section className="input-code-panel panel-surface">
                <header className="input-lab-heading">
                  <h2>{rawInput.label}</h2>
                  <div className="input-lab-actions">
                    <button onClick={goBack}><ArrowLeft size={14} /> BACK</button>
                  </div>
                </header>
                <CodeEditor
                  value={code}
                  readOnly={busy}
                  activeLine={activeLine}
                  attentionLine={hasRun && !fixTested && ((!changeTested && !codeChanged) || (changeTested && codeChanged)) ? rawInput.editLine : null}
                  onChange={(value) => { setCode(value); clearOutput() }}
                  minHeight="150px"
                />
                {hasRun && !fixTested && (
                  <aside className={`input-coachmark input-coachmark--line-${rawInput.editLine} ${(!changeTested && codeChanged) || (changeTested && !codeChanged) ? 'is-test' : ''} ${changeTested && codeChanged ? 'is-catch' : ''}`} role="status" aria-live="polite">
                    <Sparkles size={22} />
                    <div>
                      <strong>{!changeTested ? (codeChanged ? 'TEST YOUR CHANGE' : 'TRY THIS') : (codeChanged ? 'DID YOU NOTICE?' : 'FIX READY')}</strong>
                      <p>{!changeTested ? (codeChanged ? 'Run your new recipe and see what changes.' : rawInput.mission) : (codeChanged ? rawInput.catchCopy : 'Run the code once more to check the fix.')}</p>
                    </div>
                  </aside>
                )}
                <div className="run-row input-run-row">
                  <button className="secondary-action" onClick={resetMode} disabled={busy}><RotateCcw size={17} /> Reset</button>
                  <button className={`primary-action input-run ${(hasRun && codeChanged && !changeTested) || (changeTested && !codeChanged && !fixTested) ? 'is-guided' : ''}`} onClick={run} disabled={busy}>
                    {busy ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />} RUN CODE
                  </button>
                </div>
                <button className={`input-next ${fixTested ? 'is-ready' : ''}`} onClick={() => setQuizOpen(true)} disabled={!fixTested}>
                  <span>QUICK QUIZ</span>
                  <ArrowRight size={22} />
                </button>
              </section>
            </div>
          )}
        </section>
      )}
    </ExperienceShell>
  )
}

function ModeIntro({ onNext }: { onNext: () => void }) {
  const pieces = rawInput.formula.split('→')
  return (
    <section className="mode-intro panel-surface">
      <div className="mode-intro-count"><Keyboard size={46} /><small>RAW INPUT</small></div>
      <div className="mode-intro-copy"><span>THE BIG IDEA</span><h2>{rawInput.introTitle}</h2><p>{rawInput.introCopy}</p></div>
      <div className="mode-intro-flow" aria-label={rawInput.formula}>{pieces.map((piece, index) => <span key={piece}>{piece.trim()}{index < pieces.length - 1 && <ChevronRight />}</span>)}</div>
      <button className="story-next is-glowing" onClick={onNext}><span>OPEN THE LAB</span><ArrowRight /></button>
    </section>
  )
}

function ModeQuiz({ questionIndex, answer, onAnswer, onNext, onBack }: {
  questionIndex: number
  answer: number | null
  onAnswer: (answer: number) => void
  onNext: () => void
  onBack: () => void
}) {
  const question = rawInput.quiz[questionIndex]
  const answeredCorrectly = answer === question.correct
  const lastQuestion = questionIndex === rawInput.quiz.length - 1

  return (
    <section className="input-chapter-quiz panel-surface">
      <div className="chapter-quiz-progress" aria-label={`Question ${questionIndex + 1} of ${rawInput.quiz.length}`}>
        {rawInput.quiz.map((item, index) => <i key={item.question} className={index <= questionIndex ? 'is-filled' : ''} />)}
      </div>
      <header>
        <div><span>{rawInput.label} · QUICK QUIZ</span><strong>{questionIndex + 1} / {rawInput.quiz.length}</strong></div>
        <button onClick={onBack}><ArrowLeft size={15} /> BACK TO CODE</button>
      </header>
      <div className="chapter-quiz-body">
        <div className="chapter-quiz-question">
          <span>YOU RAN IT. NOW READ IT.</span>
          <h2>{question.question}</h2>
          <p>Tap the answer that makes sense.</p>
        </div>
        <div className="chapter-quiz-options">
          {question.answers.map((option, index) => (
            <button
              key={option}
              className={answer === index ? (answeredCorrectly ? 'is-correct' : 'is-wrong') : ''}
              onClick={() => onAnswer(index)}
            >
              <span>{String.fromCharCode(65 + index)}</span>
              <code>{option}</code>
              {answer === index && (answeredCorrectly ? <Check /> : <RotateCcw />)}
            </button>
          ))}
          {answer !== null && (
            <div className={`chapter-quiz-feedback ${answeredCorrectly ? 'is-correct' : ''}`}>
              <strong>{answeredCorrectly ? 'YOU GOT IT' : 'LOOK AGAIN'}</strong>
              <p>{answeredCorrectly ? question.feedback : 'Try another answer, or continue and test it later.'}</p>
            </div>
          )}
        </div>
      </div>
      <button className={`story-next chapter-quiz-next ${answer !== null ? 'is-glowing' : ''}`} disabled={answer === null} onClick={onNext}>
        <span>{lastQuestion ? 'FINISH INPUT MACHINE' : 'NEXT QUESTION'}</span>
        <ArrowRight />
      </button>
    </section>
  )
}

function QuizFinish({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <section className="input-chapter-quiz panel-surface">
      <div className="input-quiz-finish">
        <span><Trophy /></span>
        <small>INPUT MACHINE COMPLETE</small>
        <h2>You made Python listen.</h2>
        <p>input() caught your message and a variable kept it. Next, find out where that value lives.</p>
        <div className="input-quiz-finish-actions">
          <button className="next-experiment-button" onClick={onNext}>NEXT EXPERIMENT: MEMORY MACHINE <ArrowRight /></button>
          <button className="secondary-action" onClick={onBack}><ArrowLeft /> BACK TO ACTIVITIES</button>
        </div>
      </div>
    </section>
  )
}

interface PhoneProps {
  input: string
  inputLabel: string
  placeholder: string
  prompt: string
  output: string
  sentInput: string
  status: RunStatus
  busy: boolean
  hasRun: boolean
  onInputChange: (value: string) => void
  onRun: () => void
}

function PhoneMachine({ input, inputLabel, placeholder, prompt, output, sentInput, status, busy, hasRun, onInputChange, onRun }: PhoneProps) {
  const needsInput = !input.trim()
  return (
    <section className="phone-stage panel-surface">
      <div className={`input-phone is-${status} ${busy ? 'is-thinking' : ''} ${needsInput ? 'needs-input' : ''}`}>
        <div className="phone-speaker" />
        <header><span><Bot size={19} /></span><div><strong>Python</strong><small><i /> READY TO LISTEN</small></div></header>
        <div className="phone-chat" aria-live="polite">
          <div className="chat-day">TODAY</div>
          <div className="chat-message from-python"><Bot size={15} /><p>{prompt}</p></div>
          {(sentInput || busy) && <div className="chat-message from-student"><p>{sentInput}</p><CircleUserRound size={15} /></div>}
          {busy && <div className="chat-message from-python"><Bot size={15} /><p className="typing-dots"><i /><i /><i /></p></div>}
          {!busy && status !== 'idle' && <div className={`chat-message from-python result-${status}`}><Bot size={15} /><p>{output}</p></div>}
          {status === 'idle' && <div className="chat-path"><span>YOU</span><ChevronRight /><code>input()</code><ChevronRight /><span>PYTHON</span></div>}
        </div>
        {needsInput && !hasRun && (
          <aside className="phone-input-coachmark" aria-live="polite">
            <Sparkles size={20} />
            <p><strong>YOUR TURN</strong>{placeholder} here.</p>
          </aside>
        )}
        <form className={`phone-composer ${needsInput ? 'look-here' : ''}`} onSubmit={(event) => { event.preventDefault(); void onRun() }}>
          <label htmlFor="machine-input">{inputLabel}</label>
          <div>
            <input id="machine-input" inputMode={inputLabel === 'YOUR MESSAGE' ? 'text' : 'numeric'} placeholder={placeholder} value={input} disabled={busy} onChange={(event) => onInputChange(event.target.value)} />
            <button type="submit" className={!needsInput && !hasRun ? 'is-guided' : ''} aria-label="Send input" disabled={busy}><Send size={21} /></button>
          </div>
        </form>
      </div>
      <p className="phone-caption"><span>{status === 'success' ? <Check size={13} /> : <Sparkles size={13} />}</span>{status === 'success' ? 'Your input went in. A new answer came out.' : needsInput ? 'Start here: type something for Python.' : 'Now send your input into the code.'}</p>
    </section>
  )
}
