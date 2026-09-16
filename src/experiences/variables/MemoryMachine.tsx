import { ArrowLeft, ArrowRight, Check, Code2, Lightbulb, MonitorUp, Play, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { ExperienceShell } from '../../components/ExperienceShell'
import { pythonRunner } from '../../lib/pythonRunner'
import { completeActivity, resetActivityProgress } from '../../session/progressSession'
import type { SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void }
interface QuizQuestion { question: string; code?: string; options: string[]; answer: number; explanation: string }
interface MemoryMode {
  id: string
  label: string
  title: string
  intro: string
  formula: string
  starter: string
  editLine: number
  mission: string
  input?: { label: string; placeholder: string }
  quiz: QuizQuestion[]
}

const modes: MemoryMode[] = [
  {
    id: 'create', label: 'CREATE', title: 'Give a value a name',
    intro: 'A variable is a named spot in Python\'s memory. Put a value in. Ask for it later.',
    formula: 'x = 3  →  memory holds x: 3',
    starter: 'x = 3  # Try another number\nprint(x)', editLine: 1,
    mission: 'Change 3 to any number. Run it and watch the Memory window.',
    quiz: [
      { question: 'What is the variable name?', code: 'x = 3', options: ['x', '3', '='], answer: 0, explanation: 'x is the name of this memory spot.' },
      { question: 'What value is stored in x?', code: 'x = 3', options: ['x', '3', 'Nothing'], answer: 1, explanation: 'The value on the right, 3, goes into x.' },
      { question: 'What will Python print?', code: 'x = 9\nprint(x)', options: ['x', '3', '9'], answer: 2, explanation: 'print(x) gets the current value from memory: 9.' },
    ],
  },
  {
    id: 'change', label: 'CHANGE', title: 'Memory can change',
    intro: 'Using the same name again replaces its old value. Python remembers the newest one.',
    formula: 'x = 10  →  x = 7  →  memory holds x: 7',
    starter: 'x = 10\nx = 7  # Replace the old value\nprint(x)', editLine: 2,
    mission: 'Change the newest value, 7. Which x reaches output?',
    quiz: [
      { question: 'Which line changes x?', code: 'x = 10\nx = 7', options: ['Line 1', 'Line 2', 'Neither'], answer: 1, explanation: 'Line 2 uses the same name and replaces its value.' },
      { question: 'What does x remember at the end?', code: 'x = 10\nx = 7', options: ['10', '7', '17'], answer: 1, explanation: 'The newest value under x is 7.' },
      { question: 'What will Python print?', code: 'x = 4\nx = 12\nprint(x)', options: ['4', '12', '16'], answer: 1, explanation: '12 replaced 4 before print(x) ran.' },
    ],
  },
  {
    id: 'two', label: 'TWO VALUES', title: 'Two names, two spots',
    intro: 'Python can remember many values. Each variable name points to its own spot.',
    formula: 'x holds 5  +  y holds 8',
    starter: 'x = 5\ny = 8  # Give y a new value\nprint(x)\nprint(y)', editLine: 2,
    mission: 'Change only y. Run it and see which memory spot moves.',
    quiz: [
      { question: 'How many variables are here?', code: 'x = 5\ny = 8', options: ['One', 'Two', 'Eight'], answer: 1, explanation: 'x and y are two different variable names.' },
      { question: 'Which value belongs to y?', code: 'x = 5\ny = 8', options: ['5', '8', 'x'], answer: 1, explanation: 'The assignment y = 8 stores 8 under y.' },
      { question: 'What prints last?', code: 'x = 5\ny = 20\nprint(x)\nprint(y)', options: ['5', '20', '25'], answer: 1, explanation: 'The last line asks for y, so 20 prints last.' },
    ],
  },
  {
    id: 'reuse', label: 'REUSE', title: 'Use memory to make more',
    intro: 'A stored value can become part of a new calculation. Python looks it up for you.',
    formula: 'score: 10  →  score + 5  →  bonus: 15',
    starter: 'score = 10\nbonus = score + 5  # Change the bonus\nprint(bonus)', editLine: 2,
    mission: 'Change + 5 to + 20. What does bonus remember now?',
    quiz: [
      { question: 'Which variable gets reused?', code: 'score = 10\nbonus = score + 5', options: ['score', 'bonus', '5'], answer: 0, explanation: 'Python looks up score while creating bonus.' },
      { question: 'What value is stored in bonus?', code: 'score = 10\nbonus = score + 5', options: ['5', '10', '15'], answer: 2, explanation: 'bonus receives 10 + 5, which is 15.' },
      { question: 'What will Python print?', code: 'stars = 4\ntotal = stars * 2\nprint(total)', options: ['4', '6', '8'], answer: 2, explanation: 'total stores 4 × 2, so Python prints 8.' },
    ],
  },
  {
    id: 'input', label: 'INPUT MEMORY', title: 'Remember what someone types',
    intro: 'input() can bring a value from a person straight into a named memory spot.',
    formula: 'you type 12  →  age remembers 12  →  output shows 12',
    starter: 'age = int(input())\nprint(age)  # Try age + 1', editLine: 2,
    mission: 'Change age to age + 1 on line 2. Run with your age.',
    input: { label: 'VALUE FOR INPUT()', placeholder: 'Type your age' },
    quiz: [
      { question: 'What is the variable name?', code: 'age = int(input())', options: ['age', 'input', 'int'], answer: 0, explanation: 'The typed number is stored under the name age.' },
      { question: 'Someone types 14. What does age remember?', code: 'age = int(input())', options: ['input', '14', 'age'], answer: 1, explanation: 'input() receives 14, and age remembers it.' },
      { question: 'Someone types 14. What prints?', code: 'age = int(input())\nprint(age + 1)', options: ['14', '15', '141'], answer: 1, explanation: 'Python gets 14 from memory, adds 1, and prints 15.' },
    ],
  },
]

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

function StoryProgress({ page }: { page: number }) {
  return <div className="memory-story-progress" aria-label={`Intro page ${page + 1} of 3`}>{[0, 1, 2].map((step) => <i className={step <= page ? 'is-active' : ''} key={step} />)}</div>
}

function MemoryStory({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0)
  const [demoValue, setDemoValue] = useState<number | null>(null)
  return <section className={`memory-story memory-story--${page}`}>
    <StoryProgress page={page} />
    {page === 0 && <div className="memory-story-page">
      <span className="memory-story-kicker">YOU ALREADY KNOW PRINT()</span>
      <h2>Now give Python<br /><em>a memory.</em></h2>
      <div className="memory-recap-visual" aria-hidden="true"><code>score = 10</code><ArrowRight /><span><Lightbulb />10</span></div>
      <p>A variable gives a value a name, so your code can use it again.</p>
    </div>}
    {page === 1 && <div className="memory-story-page memory-story-page--demo">
      <span className="memory-story-kicker">TRY THE MEMORY</span>
      <h2>What should <em>x</em> remember?</h2>
      <div className={`memory-demo-bulb ${demoValue !== null ? 'is-lit' : ''}`}><Lightbulb /><strong>{demoValue === null ? '?' : `x = ${demoValue}`}</strong></div>
      <div className="memory-value-choices">{[3, 9, 42].map((value) => <button className={demoValue === value ? 'is-active' : ''} onClick={() => setDemoValue(value)} key={value}><code>x = {value}</code></button>)}</div>
      <p>{demoValue === null ? 'Tap one line to send its value into memory.' : `There it is. Python now remembers x as ${demoValue}.`}</p>
    </div>}
    {page === 2 && <div className="memory-story-page memory-story-page--map">
      <span className="memory-story-kicker">FOLLOW THE VALUE</span>
      <h2>Code sends it.<br />Memory keeps it.<br /><em>Output reveals it.</em></h2>
      <div className="memory-story-flow" aria-label="Code flows to memory, then output"><span><Code2 /><b>CODE</b></span><ArrowRight /><span className="is-memory"><Lightbulb /><b>MEMORY</b></span><ArrowRight /><span><MonitorUp /><b>OUTPUT</b></span></div>
      <p>You will watch Python travel one line at a time.</p>
    </div>}
    <div className="memory-story-actions">
      {page > 0 && <button className="memory-story-back" onClick={() => setPage(page - 1)}><ArrowLeft /> BACK</button>}
      <button className={`story-next memory-story-next ${page === 1 && demoValue === null ? '' : 'is-ready'}`} disabled={page === 1 && demoValue === null} onClick={() => page === 2 ? onDone() : setPage(page + 1)}>{page === 2 ? 'START THE MACHINE' : 'NEXT'} <ArrowRight /></button>
    </div>
  </section>
}

function ModeIntro({ mode, index, done, onBack, onStart }: { mode: MemoryMode; index: number; done: boolean; onBack: () => void; onStart: () => void }) {
  return <section className="memory-mode-intro">
    <div className="memory-mode-count"><span>{String(index + 1).padStart(2, '0')}</span><i /><small>{modes.length}</small></div>
    <div className="memory-mode-copy"><span className="memory-story-kicker">{done ? 'READY TO REVISIT' : `MEMORY MOVE ${index + 1}`}</span><h2>{mode.title}</h2><p>{mode.intro}</p><code>{mode.formula}</code></div>
    <div className="memory-mode-intro-bulb"><Lightbulb /><i /><i /><i /></div>
    <div className="memory-story-actions"><button className="memory-story-back" onClick={onBack}><ArrowLeft /> BACK</button><button className="story-next memory-story-next is-ready" onClick={onStart}>SEE IT MOVE <ArrowRight /></button></div>
  </section>
}

function MemoryQuiz({ mode, index, onBack, onFinish }: { mode: MemoryMode; index: number; onBack: () => void; onFinish: () => void }) {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const question = mode.quiz[questionIndex]
  if (!question) return <section className="input-chapter-quiz memory-chapter-quiz memory-quiz-finish">
    <div className="chapter-quiz-progress"><span style={{ width: '100%' }} /></div><span className="chapter-quiz-kicker"><Sparkles /> CHECKPOINT COMPLETE</span>
    <div className="memory-quiz-bulb"><Lightbulb /><Check /></div><h2>{score} / {mode.quiz.length}</h2><p>{score === mode.quiz.length ? 'Bright work. You followed every value.' : 'Nice tracing. Memory is holding the idea.'}</p>
    <button className="chapter-quiz-next is-ready" onClick={onFinish}>{index === modes.length - 1 ? 'FINISH MEMORY MACHINE' : `NEXT: ${modes[index + 1].label}`} <ArrowRight /></button>
  </section>
  return <section className="input-chapter-quiz memory-chapter-quiz">
    <div className="chapter-quiz-progress"><span style={{ width: `${(questionIndex / mode.quiz.length) * 100}%` }} /></div>
    <header><button onClick={onBack}><ArrowLeft /> BACK TO MACHINE</button><strong>{questionIndex + 1}<span>/{mode.quiz.length}</span></strong></header>
    <div className="chapter-quiz-card"><span className="chapter-quiz-kicker">QUICK MEMORY CHECK</span><h2>{question.question}</h2>{question.code && <pre><code>{question.code}</code></pre>}
      <div className="chapter-quiz-options">{question.options.map((option, optionIndex) => {
        const state = selected === null ? '' : optionIndex === question.answer ? 'is-correct' : optionIndex === selected ? 'is-wrong' : ''
        return <button className={state} disabled={selected !== null} onClick={() => { setSelected(optionIndex); if (optionIndex === question.answer) setScore((value) => value + 1) }} key={option}><span>{String.fromCharCode(65 + optionIndex)}</span><code>{option}</code></button>
      })}</div>
      <div className={`chapter-quiz-feedback ${selected !== null ? 'is-visible' : ''}`} role="status"><b>{selected === question.answer ? 'YES!' : 'LOOK AGAIN'}</b><p>{selected === null ? 'Pick one answer.' : question.explanation}</p></div>
    </div>
    <button className={`chapter-quiz-next ${selected !== null ? 'is-ready' : ''}`} disabled={selected === null} onClick={() => { setQuestionIndex(questionIndex + 1); setSelected(null) }}>{questionIndex === mode.quiz.length - 1 ? 'SEE CHECKPOINT' : 'NEXT QUESTION'} <ArrowRight /></button>
  </section>
}

export function MemoryMachine({ progress, onProgress, onBack }: Props) {
  const [storyOpen, setStoryOpen] = useState(true)
  const [modeIndex, setModeIndex] = useState(0)
  const [introOpen, setIntroOpen] = useState(true)
  const [quizOpen, setQuizOpen] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(modes.map((mode) => [mode.id, mode.starter])))
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [memory, setMemory] = useState<Record<string, string>>({})
  const [output, setOutput] = useState('')
  const [activeLine, setActiveLine] = useState<number | null>(null)
  const [phase, setPhase] = useState<'idle' | 'memory' | 'output'>('idle')
  const [running, setRunning] = useState(false)
  const [ranModes, setRanModes] = useState<string[]>([])
  const [testedModes, setTestedModes] = useState<string[]>([])
  const [error, setError] = useState('')
  const runVersion = useRef(0)
  const mode = modes[modeIndex]
  const code = drafts[mode.id]
  const input = inputs[mode.id] ?? ''
  const hasRun = ranModes.includes(mode.id)
  const tested = testedModes.includes(mode.id)
  const completed = progress.completed.includes('memory-machine')

  useEffect(() => () => { runVersion.current += 1 }, [])

  const clearStage = () => { runVersion.current += 1; setRunning(false); setActiveLine(null); setPhase('idle'); setMemory({}); setOutput(''); setError('') }
  const openMode = (index: number) => { clearStage(); setModeIndex(index); setQuizOpen(false); setIntroOpen(true) }
  const resetCurrent = () => { clearStage(); setDrafts((current) => ({ ...current, [mode.id]: mode.starter })); setInputs((current) => ({ ...current, [mode.id]: '' })) }
  const resetLevel = () => {
    clearStage(); setStoryOpen(true); setModeIndex(0); setIntroOpen(true); setQuizOpen(false)
    setDrafts(Object.fromEntries(modes.map((item) => [item.id, item.starter]))); setInputs({}); setRanModes([]); setTestedModes([])
    onProgress(resetActivityProgress(progress, 'memory-machine'))
  }

  const runCode = async () => {
    if (running) return
    if (mode.input && !input.trim()) { setError('Type a value first. Python is waiting for you.'); return }
    const version = ++runVersion.current
    const lines = code.split('\n')
    setRunning(true); setError(''); setMemory({}); setOutput('')
    try {
      for (let index = 0; index < lines.length; index += 1) {
        if (version !== runVersion.current) return
        const line = lines[index].trim()
        setActiveLine(index + 1); setPhase(line.startsWith('print(') ? 'output' : 'memory')
        const result = await pythonRunner.runScript(lines.slice(0, index + 1).join('\n'), mode.input ? [input] : [])
        if (version !== runVersion.current) return
        setMemory(Object.fromEntries(Object.entries(result.variables).map(([name, value]) => [name, String(value)]))); setOutput(result.stdout)
        await wait(560)
      }
      if (version !== runVersion.current) return
      setRanModes((current) => current.includes(mode.id) ? current : [...current, mode.id])
      if (code !== mode.starter) setTestedModes((current) => current.includes(mode.id) ? current : [...current, mode.id])
    } catch (caught) {
      if (version === runVersion.current) setError(caught instanceof Error ? caught.message : 'Python could not run that code.')
    } finally {
      if (version === runVersion.current) { setRunning(false); setActiveLine(null); setPhase('idle') }
    }
  }

  const finishQuiz = () => {
    const done = [...new Set([...progress.memoryExamples, mode.id])]
    let nextProgress = { ...progress, memoryExamples: done }
    if (modeIndex === modes.length - 1) nextProgress = completeActivity(nextProgress, 'memory-machine')
    onProgress(nextProgress)
    if (modeIndex === modes.length - 1) { setQuizOpen(false); onBack() } else openMode(modeIndex + 1)
  }

  const coach = !hasRun ? (mode.input && !input.trim() ? 'input' : 'run') : !tested ? 'code' : !running ? 'quiz' : null

  return <ExperienceShell order="05" title="Memory Machine" question="Where does a variable's value go?" accent="#a994ff" hints={['Watch the glowing code line.', 'The middle window shows what Python remembers now.', 'print() sends a remembered value to output.']} completed={completed} objective="Send values from code to memory, then reveal them in output." onBack={onBack} onReset={resetLevel} className="memory-experience memory-story-experience">
    {storyOpen ? <MemoryStory onDone={() => { setStoryOpen(false); setIntroOpen(true) }} /> : quizOpen ? <MemoryQuiz mode={mode} index={modeIndex} onBack={() => setQuizOpen(false)} onFinish={finishQuiz} /> : introOpen ? <ModeIntro mode={mode} index={modeIndex} done={progress.memoryExamples.includes(mode.id)} onBack={() => modeIndex === 0 ? setStoryOpen(true) : openMode(modeIndex - 1)} onStart={() => setIntroOpen(false)} /> :
      <section className={`memory-lab memory-lab--${phase} ${running ? 'is-running' : ''}`}>
        <div className="memory-lab-nav"><span>MEMORY MOVE {modeIndex + 1} / {modes.length}</span><button onClick={() => modeIndex === 0 ? setStoryOpen(true) : openMode(modeIndex - 1)}><ArrowLeft /> BACK</button><button onClick={() => setIntroOpen(true)}>VIEW INTRO</button></div>
        <div className="memory-desktop">
          <section className="memory-desktop-window memory-code-window">
            <header><span><Code2 /> CODE</span><small>REAL PYTHON</small></header>
            <div className="memory-editor-wrap"><CodeEditor value={code} onChange={(value) => { setDrafts((current) => ({ ...current, [mode.id]: value })); setError('') }} label={`${mode.label} Python code`} activeLine={activeLine} attentionLine={coach === 'code' ? mode.editLine : null} /></div>
            {coach === 'code' && <aside className="memory-try-popup memory-try-panel" role="status"><Sparkles /><div><strong>TRY THIS</strong><p>{mode.mission}</p></div></aside>}
            {mode.input && <label className={`memory-input-control memory-input-control--new ${coach === 'input' ? 'needs-attention' : ''}`}>{mode.input.label}<div><input type="number" value={input} placeholder={mode.input.placeholder} onChange={(event) => { setInputs((current) => ({ ...current, [mode.id]: event.target.value })); setError('') }} />{coach === 'input' && <span>TYPE HERE FIRST</span>}</div></label>}
            {error && <p className="memory-run-error" role="alert">{error}</p>}
            <div className="memory-run-actions"><button className="secondary-action" onClick={resetCurrent}><RotateCcw /> RESET</button><button className={`primary-action memory-run ${coach === 'run' || (hasRun && code !== mode.starter && !tested) ? 'needs-attention' : ''}`} disabled={running} onClick={runCode}>{running ? <><i /> RUNNING LINE {activeLine}</> : <><Play fill="currentColor" /> RUN CODE</>}</button></div>
          </section>

          <div className={`memory-transfer memory-transfer--store ${phase === 'memory' ? 'is-active' : ''}`} aria-hidden="true"><small>STORE</small><span><i /><i /><i /><ArrowRight /></span></div>

          <section className={`memory-desktop-window memory-memory-window ${Object.keys(memory).length ? 'has-value' : ''} ${phase === 'memory' ? 'is-receiving' : ''}`}>
            <header><span><Lightbulb /> MEMORY</span><small>WHAT PYTHON KNOWS</small></header>
            <div className="memory-value-screen">{Object.keys(memory).length ? Object.entries(memory).map(([name, value]) => <article key={name}><small>NAME</small><b>{name}</b><i>=</i><small>VALUE</small><strong>{value}</strong></article>) : <div className="memory-empty"><Lightbulb /><b>EMPTY</b><span>Run an assignment.</span></div>}</div>
            <footer><i />{phase === 'memory' ? 'STORING NOW…' : Object.keys(memory).length ? 'VALUE REMEMBERED' : 'WAITING FOR CODE'}</footer>
          </section>

          <div className={`memory-transfer memory-transfer--show ${phase === 'output' ? 'is-active' : ''}`} aria-hidden="true"><small>SHOW</small><span><i /><i /><i /><ArrowRight /></span></div>

          <section className={`memory-desktop-window memory-output-window ${phase === 'output' ? 'is-receiving' : ''}`}><header><span><MonitorUp /> OUTPUT</span><small>WHAT PYTHON SHOWS</small></header><pre>{output || 'Nothing printed yet.'}</pre><p>{tested ? 'You changed the code and traced the new value.' : hasRun ? 'Now change the highlighted line in the code.' : 'Run the code to wake up the machine.'}</p><button className={`memory-quiz-call ${coach === 'quiz' ? 'is-ready' : ''}`} disabled={!tested || running} onClick={() => setQuizOpen(true)}>{tested ? 'QUICK QUIZ' : 'EXPERIMENT FIRST'} <ArrowRight /></button></section>
        </div>
      </section>}
  </ExperienceShell>
}
