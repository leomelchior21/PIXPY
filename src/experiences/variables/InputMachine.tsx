import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleUserRound,
  LoaderCircle,
  Play,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { ExperienceShell } from '../../components/ExperienceShell'
import { pythonRunner } from '../../lib/pythonRunner'
import { completeActivity, resetActivityProgress } from '../../session/progressSession'
import type { SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void }

const modes = [
  {
    id: 'echo',
    label: 'RAW INPUT',
    storyNumber: '01',
    introTitle: 'First, let Python listen.',
    introCopy: 'You send a message. input() catches it and stores it in a variable.',
    formula: 'hello → hello',
    starter: '# Try replacing input() with your name in quotes\nmessage = input()\nprint(message)',
    value: '',
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
  },
  {
    id: 'double',
    label: 'DOUBLE',
    storyNumber: '02',
    introTitle: 'Now make the input grow.',
    introCopy: 'int() turns the input into a number. Then Python can do math with it.',
    formula: '8 → × 2 → 16',
    starter: 'number = int(input())\nresult = number * 2  # Try changing 2 to 3\nprint(result)',
    value: '',
    placeholder: 'Type a number',
    runLines: [1, 2, 3],
    editLine: 2,
    inputLabel: 'YOUR NUMBER',
    phonePrompt: 'Send me a number. I’ll double it.',
    mission: 'Change * 2 to * 3. Then run the code again.',
    catchCopy: 'The DOUBLE machine became a TRIPLE machine. Put * 2 back so its name and rule match again.',
    quiz: [
      { question: 'What is the input variable called?', answers: ['result', 'number', 'double'], correct: 1, feedback: 'number stores what the student sends.' },
      { question: 'If the input is 6, what prints?', answers: ['8', '12', '66'], correct: 1, feedback: '6 × 2 makes 12.' },
      { question: 'Which line doubles the value?', answers: ['number = int(input())', 'result = number * 2', 'print(result)'], correct: 1, feedback: 'The * 2 rule creates the doubled result.' },
    ],
  },
  {
    id: 'ten-more',
    label: 'TEN MORE',
    storyNumber: '03',
    introTitle: 'One input. A new rule.',
    introCopy: 'The same input can lead to a different reply when you change the recipe.',
    formula: '7 → + 10 → 17',
    starter: 'number = int(input())\nresult = number + 10  # Try changing 10 to 100\nprint(result)',
    value: '',
    placeholder: 'Type a number',
    runLines: [1, 2, 3],
    editLine: 2,
    inputLabel: 'YOUR NUMBER',
    phonePrompt: 'Give me a number. I’ll add ten.',
    mission: 'Change + 10 to + 100. Then run the code again.',
    catchCopy: 'The machine added one hundred, not ten. Put + 10 back so the code keeps its promise.',
    quiz: [
      { question: 'What is the new value stored in?', answers: ['number', 'result', 'input'], correct: 1, feedback: 'result stores the number after the rule.' },
      { question: 'If the input is 31, what prints?', answers: ['41', '310', '21'], correct: 0, feedback: '31 + 10 makes 41.' },
      { question: 'Which line makes ten more?', answers: ['print(result)', 'number = int(input())', 'result = number + 10'], correct: 2, feedback: 'The + 10 line transforms the input.' },
    ],
  },
  {
    id: 'age',
    label: 'AGE MACHINE',
    storyNumber: '04',
    introTitle: 'Build the full age machine.',
    introCopy: 'Ask, store, calculate, reply. Your program now has a real conversation.',
    formula: 'age → 2026 − age → year',
    starter: 'age = int(input())\nbirth_year = 2026 - age  # Try another year\nprint("YOU WERE BORN AROUND")\nprint(birth_year)',
    value: '',
    placeholder: 'Type your age',
    runLines: [1, 2, 3, 4],
    editLine: 2,
    inputLabel: 'YOUR AGE',
    phonePrompt: 'How old are you?',
    mission: 'Change 2026 to another year. Then run the code again.',
    catchCopy: 'Changing 2026 sends the calculation to another year. Put 2026 back to estimate the birth year now.',
    quiz: [
      { question: 'What is the input variable called?', answers: ['birth_year', 'age', 'year'], correct: 1, feedback: 'age stores the number the student enters.' },
      { question: 'If age is 14, what year prints?', answers: ['2012', '2040', '14'], correct: 0, feedback: '2026 − 14 makes 2012.' },
      { question: 'Where is the calculated year stored?', answers: ['age', 'input', 'birth_year'], correct: 2, feedback: 'birth_year holds the transformed value.' },
    ],
  },
] as const

type StoryPage = 'recap' | 'age-demo' | 'quiz' | 'reveal'
type DemoStatus = 'idle' | 'thinking' | 'done' | 'error'
type RunStatus = 'idle' | 'success' | 'error'

const storyPages: StoryPage[] = ['recap', 'age-demo', 'quiz', 'reveal']

export function InputMachine({ progress, onProgress, onBack }: Props) {
  const [storyPage, setStoryPage] = useState<StoryPage>('recap')
  const [inLab, setInLab] = useState(false)
  const [showModeIntro, setShowModeIntro] = useState(true)
  const [modeIndex, setModeIndex] = useState(0)
  const mode = modes[modeIndex]
  const [code, setCode] = useState<string>(mode.starter)
  const [input, setInput] = useState<string>(mode.value)
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState<RunStatus>('idle')
  const [sentInput, setSentInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeLine, setActiveLine] = useState<number | null>(null)
  const [testedChanges, setTestedChanges] = useState<Record<string, boolean>>({})
  const [fixedChanges, setFixedChanges] = useState<Record<string, boolean>>({})
  const [chapterQuizOpen, setChapterQuizOpen] = useState(false)
  const [chapterQuizIndex, setChapterQuizIndex] = useState(0)
  const [chapterQuizAnswer, setChapterQuizAnswer] = useState<number | null>(null)
  const [age, setAge] = useState('')
  const [demoStatus, setDemoStatus] = useState<DemoStatus>('idle')
  const [birthYear, setBirthYear] = useState<number | null>(null)
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null)
  const version = useRef(0)
  const demoTimer = useRef<number | null>(null)
  const drafts = useRef<Record<string, { code: string; input: string }>>({})
  const completed = progress.completed.includes('input-machine')
  const hasRun = progress.inputModes.includes(mode.id)
  const codeChanged = code !== mode.starter
  const changeTested = testedChanges[mode.id] === true
  const fixTested = fixedChanges[mode.id] === true

  useEffect(() => () => {
    version.current += 1
    if (demoTimer.current) window.clearTimeout(demoTimer.current)
  }, [])

  const clearOutput = () => {
    version.current += 1
    setBusy(false)
    setStatus('idle')
    setOutput('')
    setSentInput('')
    setActiveLine(null)
  }

  const chooseMode = (index: number) => {
    drafts.current[mode.id] = { code, input }
    const next = modes[index]
    setModeIndex(index)
    setCode(drafts.current[next.id]?.code ?? next.starter)
    setInput(drafts.current[next.id]?.input ?? next.value)
    setShowModeIntro(true)
    setChapterQuizOpen(false)
    setChapterQuizIndex(0)
    setChapterQuizAnswer(null)
    clearOutput()
  }

  const resetMode = () => {
    setCode(mode.starter)
    setInput(mode.value)
    clearOutput()
  }

  const resetLevel = () => {
    version.current += 1
    if (demoTimer.current) window.clearTimeout(demoTimer.current)
    drafts.current = {}
    setStoryPage('recap')
    setInLab(false)
    setShowModeIntro(true)
    setModeIndex(0)
    setCode(modes[0].starter)
    setInput(modes[0].value)
    setOutput('')
    setSentInput('')
    setBusy(false)
    setStatus('idle')
    setActiveLine(null)
    setTestedChanges({})
    setFixedChanges({})
    setChapterQuizOpen(false)
    setChapterQuizIndex(0)
    setChapterQuizAnswer(null)
    setAge('')
    setBirthYear(null)
    setDemoStatus('idle')
    setQuizAnswer(null)
    onProgress(resetActivityProgress(progress, 'input-machine'))
  }

  const revealAge = () => {
    const number = Number(age)
    if (!Number.isInteger(number) || number < 1 || number > 120) {
      setDemoStatus('error')
      setBirthYear(null)
      return
    }
    if (demoTimer.current) window.clearTimeout(demoTimer.current)
    setDemoStatus('thinking')
    setBirthYear(null)
    demoTimer.current = window.setTimeout(() => {
      setBirthYear(2026 - number)
      setDemoStatus('done')
    }, 1200)
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
    setActiveLine(mode.runLines[0])
    try {
      const resultPromise = pythonRunner.runScript(code, [input])
      const lineAnimation = (async () => {
        for (const line of mode.runLines) {
          if (request !== version.current) return
          setActiveLine(line)
          await new Promise((resolve) => window.setTimeout(resolve, 380))
        }
      })()
      const [result] = await Promise.all([resultPromise, lineAnimation])
      if (request !== version.current) return
      const doneModes = [...new Set([...progress.inputModes, mode.id])]
      onProgress({ ...progress, inputModes: doneModes })
      setOutput(result.stdout || '(nothing came out)')
      setStatus('success')
      if (code !== mode.starter) setTestedChanges((current) => ({ ...current, [mode.id]: true }))
      else if (changeTested) setFixedChanges((current) => ({ ...current, [mode.id]: true }))
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

  const nextMode = () => {
    if (modeIndex < modes.length - 1) chooseMode(modeIndex + 1)
    else onProgress(completeActivity(progress, 'input-machine'))
  }

  const openChapterQuiz = () => {
    if (!fixTested) return
    setChapterQuizIndex(0)
    setChapterQuizAnswer(null)
    setChapterQuizOpen(true)
  }

  const advanceChapterQuiz = () => {
    if (chapterQuizAnswer === null) return
    if (chapterQuizIndex < mode.quiz.length - 1) {
      setChapterQuizIndex((index) => index + 1)
      setChapterQuizAnswer(null)
      return
    }
    setChapterQuizOpen(false)
    setChapterQuizIndex(0)
    setChapterQuizAnswer(null)
    nextMode()
  }

  const goBack = () => {
    if (modeIndex > 0) {
      chooseMode(modeIndex - 1)
      return
    }
    drafts.current[mode.id] = { code, input }
    clearOutput()
    setInLab(false)
    setStoryPage('reveal')
  }

  return (
    <ExperienceShell
      order="04"
      title="Input Machine"
      question="What if your program could listen, think, and reply?"
      accent="#72dcff"
      hints={['input() pauses and listens for a value.', 'Use int(input()) when your program needs number math.', 'A variable keeps the input ready for the next line.']}
      completed={completed}
      objective="Send a value through every machine. Change the code and see what changes."
      onBack={onBack}
      onReset={resetLevel}
      onComplete={() => onProgress(completeActivity(progress, 'input-machine'))}
      className="input-experience"
    >
      {!inLab ? (
        <InputStory
          page={storyPage}
          age={age}
          demoStatus={demoStatus}
          birthYear={birthYear}
          quizAnswer={quizAnswer}
          onAgeChange={(value) => { setAge(value); setDemoStatus('idle'); setBirthYear(null) }}
          onRevealAge={revealAge}
          onQuizAnswer={setQuizAnswer}
          onNext={() => {
            const index = storyPages.indexOf(storyPage)
            if (index < storyPages.length - 1) setStoryPage(storyPages[index + 1])
            else setInLab(true)
          }}
        />
      ) : (
        <section className="input-lab-shell">
          {chapterQuizOpen ? (
            <ModeQuiz
              mode={mode}
              questionIndex={chapterQuizIndex}
              answer={chapterQuizAnswer}
              onAnswer={setChapterQuizAnswer}
              onNext={advanceChapterQuiz}
              onBack={() => setChapterQuizOpen(false)}
            />
          ) : showModeIntro ? (
            <ModeIntro mode={mode} onNext={() => setShowModeIntro(false)} />
          ) : (
            <div className="input-workspace">
              <PhoneMachine
                input={input}
                inputLabel={mode.inputLabel}
                placeholder={mode.placeholder}
                prompt={mode.phonePrompt}
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
                  <h2>{mode.label}</h2>
                  <div className="input-lab-actions">
                    <button onClick={goBack}><ArrowLeft size={14} /> BACK</button>
                    <button onClick={() => setShowModeIntro(true)}>VIEW INTRO</button>
                  </div>
                </header>
                <CodeEditor
                  value={code}
                  readOnly={busy}
                  activeLine={activeLine}
                  attentionLine={hasRun && !fixTested && ((!changeTested && !codeChanged) || (changeTested && codeChanged)) ? mode.editLine : null}
                  onChange={(value) => { setCode(value); clearOutput() }}
                  minHeight="150px"
                />
                {hasRun && !fixTested && (
                  <aside className={`input-coachmark input-coachmark--line-${mode.editLine} ${(!changeTested && codeChanged) || (changeTested && !codeChanged) ? 'is-test' : ''} ${changeTested && codeChanged ? 'is-catch' : ''}`} role="status" aria-live="polite">
                    <Sparkles size={22} />
                    <div>
                      <strong>{!changeTested ? (codeChanged ? 'TEST YOUR CHANGE' : 'TRY THIS') : (codeChanged ? 'DID YOU NOTICE?' : 'FIX READY')}</strong>
                      <p>{!changeTested ? (codeChanged ? 'Run your new recipe and see what changes.' : mode.mission) : (codeChanged ? mode.catchCopy : 'Run the code once more to check the fix.')}</p>
                    </div>
                  </aside>
                )}
                <div className="run-row input-run-row">
                  <button className="secondary-action" onClick={resetMode} disabled={busy}><RotateCcw size={17} /> Reset</button>
                  <button className={`primary-action input-run ${(hasRun && codeChanged && !changeTested) || (changeTested && !codeChanged && !fixTested) ? 'is-guided' : ''}`} onClick={run} disabled={busy}>
                    {busy ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />} RUN CODE
                  </button>
                </div>
                <button className={`input-next ${fixTested ? 'is-ready' : ''}`} onClick={openChapterQuiz} disabled={!fixTested}>
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

interface StoryProps {
  page: StoryPage
  age: string
  demoStatus: DemoStatus
  birthYear: number | null
  quizAnswer: number | null
  onAgeChange: (value: string) => void
  onRevealAge: () => void
  onQuizAnswer: (answer: number) => void
  onNext: () => void
}

function StoryProgress({ page }: { page: StoryPage }) {
  const current = storyPages.indexOf(page)
  return <div className="ig-progress" aria-label={`Story ${current + 1} of ${storyPages.length}`}>{storyPages.map((item, index) => <i key={item} className={index <= current ? 'is-filled' : ''} />)}</div>
}

function InputStory({ page, age, demoStatus, birthYear, quizAnswer, onAgeChange, onRevealAge, onQuizAnswer, onNext }: StoryProps) {
  return (
    <section className={`input-story input-story--${page} panel-surface`}>
      <StoryProgress page={page} />
      <div className="story-brand"><span><Bot size={18} /> PIXPY STORY</span><small>{storyPages.indexOf(page) + 1} / {storyPages.length}</small></div>

      {page === 'recap' && (
        <div className="story-page story-recap">
          <div className="story-copy"><span className="story-kicker">YOU ALREADY MADE PYTHON TALK</span><h2>You used <code>print()</code>.<br />You found math.</h2><p>Now your program gets a new power: it can listen to you first.</p></div>
          <div className="recap-visual" aria-label="From printing to a conversation">
            <article><small>BEFORE</small><code>print(6 + 6)</code><strong>12</strong></article>
            <ChevronRight size={34} />
            <article className="is-new"><small>NEXT POWER</small><div><CircleUserRound /><i>?</i><Bot /></div><strong>A CONVERSATION</strong></article>
          </div>
          <button className="story-next" onClick={onNext}><span>LET PYTHON LISTEN</span><ArrowRight /></button>
        </div>
      )}

      {page === 'age-demo' && (
        <div className="story-page age-demo-page">
          <div className="story-copy"><span className="story-kicker">YOUR TURN</span><h2>Give the machine<br />your age.</h2><p>It will use your input to make something new.</p></div>
          <form className={`age-demo-machine is-${demoStatus}`} onSubmit={(event) => { event.preventDefault(); onRevealAge() }}>
            <div className="demo-machine-top"><Bot size={21} /><span>AGE MACHINE</span><i /></div>
            <label htmlFor="story-age">HOW OLD ARE YOU?</label>
            <div className="age-entry"><input id="story-age" aria-label="YOUR AGE" inputMode="numeric" value={age} disabled={demoStatus === 'thinking'} onChange={(event) => onAgeChange(event.target.value)} /><button aria-label="Calculate birth year" disabled={demoStatus === 'thinking'}>{demoStatus === 'thinking' ? <LoaderCircle className="spin" /> : <Send />}</button></div>
            <div className="age-thinking" role="status" aria-live="polite">
              {demoStatus === 'idle' && <><small>WAITING FOR INPUT</small><strong>?</strong></>}
              {demoStatus === 'error' && <><small>TRY A WHOLE AGE FROM 1 TO 120</small><strong>!</strong></>}
              {demoStatus === 'thinking' && <><small>MOVING THE NUMBERS...</small><div className="number-cloud"><i>2026</i><i>−</i><i>{age}</i><i>=</i><i>?</i></div></>}
              {demoStatus === 'done' && <><small>YOU WERE BORN AROUND</small><strong>{birthYear}</strong><p>That is your input, transformed.</p></>}
            </div>
          </form>
          {demoStatus === 'done' && <button className="story-next is-glowing" onClick={onNext}><span>HOW DID IT DO THAT?</span><ArrowRight /></button>}
        </div>
      )}

      {page === 'quiz' && (
        <div className="story-page quiz-story-page">
          <div className="story-copy"><span className="story-kicker">MAKE A PREDICTION</span><h2>What happened<br />inside the machine?</h2><p>Tap your best guess. You can always try again.</p></div>
          <div className="input-quick-quiz">
            {['It picked a random year.', 'It stored my age, then did 2026 − age.', 'It only printed my age again.'].map((answer, index) => (
              <button key={answer} className={quizAnswer === index ? (index === 1 ? 'is-correct' : 'is-wrong') : ''} onClick={() => onQuizAnswer(index)}><span>{String.fromCharCode(65 + index)}</span>{answer}{quizAnswer === index && (index === 1 ? <Check /> : <RotateCcw />)}</button>
            ))}
            {quizAnswer !== null && <p className={quizAnswer === 1 ? 'is-correct' : ''}>{quizAnswer === 1 ? 'YES! Input became a value Python could use.' : 'Good guess. Look for the age in the math.'}</p>}
          </div>
          {quizAnswer !== null && <button className="story-next is-glowing" onClick={onNext}><span>SHOW ME THE CODE</span><ArrowRight /></button>}
        </div>
      )}

      {page === 'reveal' && (
        <div className="story-page reveal-story-page">
          <div className="story-copy"><span className="story-kicker">THE SECRET RECIPE</span><h2>Listen. Store.<br />Use. Reply.</h2><p>Each line moves your answer through the program.</p></div>
          <div className="story-code-reveal">
            <article><b>1</b><code>age = int(input())</code><span>LISTEN + STORE</span></article>
            <article><b>2</b><code>birth_year = 2026 - age</code><span>USE IT</span></article>
            <article><b>3</b><code>print(birth_year)</code><span>REPLY</span></article>
          </div>
          <button className="story-next is-glowing" onClick={onNext}><span>BUILD IT STEP BY STEP</span><ArrowRight /></button>
        </div>
      )}
    </section>
  )
}

function ModeIntro({ mode, onNext }: { mode: typeof modes[number]; onNext: () => void }) {
  const pieces = mode.formula.split('→')
  return (
    <section className="mode-intro panel-surface">
      <div className="mode-intro-count"><span>{mode.storyNumber}</span><small>OF 04</small></div>
      <div className="mode-intro-copy"><span>CHAPTER {mode.storyNumber}</span><h2>{mode.introTitle}</h2><p>{mode.introCopy}</p></div>
      <div className="mode-intro-flow" aria-label={mode.formula}>{pieces.map((piece, index) => <span key={piece}>{piece.trim()}{index < pieces.length - 1 && <ChevronRight />}</span>)}</div>
      <button className="story-next is-glowing" onClick={onNext}><span>OPEN THE LAB</span><ArrowRight /></button>
    </section>
  )
}

function ModeQuiz({ mode, questionIndex, answer, onAnswer, onNext, onBack }: {
  mode: typeof modes[number]
  questionIndex: number
  answer: number | null
  onAnswer: (answer: number) => void
  onNext: () => void
  onBack: () => void
}) {
  const question = mode.quiz[questionIndex]
  const answeredCorrectly = answer === question.correct

  return (
    <section className="input-chapter-quiz panel-surface">
      <div className="chapter-quiz-progress" aria-label={`Question ${questionIndex + 1} of ${mode.quiz.length}`}>
        {mode.quiz.map((item, index) => <i key={item.question} className={index <= questionIndex ? 'is-filled' : ''} />)}
      </div>
      <header>
        <div><span>{mode.label} · QUICK QUIZ</span><strong>{questionIndex + 1} / {mode.quiz.length}</strong></div>
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
        <span>{questionIndex === mode.quiz.length - 1 ? (mode.id === 'age' ? 'FINISH INPUT MACHINE' : 'NEXT CHAPTER') : 'NEXT QUESTION'}</span>
        <ArrowRight />
      </button>
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
