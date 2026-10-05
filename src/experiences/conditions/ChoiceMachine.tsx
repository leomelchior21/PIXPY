import { ArrowDown, ArrowLeft, ArrowRight, Binary, Check, CloudRain, DoorOpen, GraduationCap, GitBranch, IdCard, Lightbulb, Lock, Play, RotateCcw, ShieldX, Sparkles, Sun, Trophy, Umbrella, UmbrellaOff, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { PythonCode } from '../../components/PythonCode'
import { CHOICE_QUIZ_LENGTH, CHOICE_XP_PER_QUESTION, everydayChoices, flowStories, makeChoiceQuizQuestion } from '../../data/choiceMachine'
import { completeActivity } from '../../session/progressSession'
import type { AppRoute, SessionProgress } from '../../types'
import { ChoiceScene } from './ChoiceScenes'
import './choiceMachine.css'
import './choiceSituations.css'

interface Props {
  progress: SessionProgress
  onProgress: (progress: SessionProgress) => void
  onBack: () => void
  onNext: (route: AppRoute) => void
}

type Phase = 'steps' | 'intro' | 'choices' | 'storyIntro' | 'stories' | 'quizIntro' | 'quiz' | 'complete'
type SeenPaths = Record<string, { yes: boolean; no: boolean }>
type CoachKind = 'type' | 'press' | 'another' | 'fix'

const storyBriefingIcons: Record<string, typeof GraduationCap> = {
  grade: GraduationCap,
  'even-odd': Binary,
  adult: IdCard,
}

const situationIcons = { rain: CloudRain, password: Lock, grade: GraduationCap }
const answerIcons = { rain: [Umbrella, UmbrellaOff], password: [DoorOpen, ShieldX], grade: [GraduationCap, RotateCcw] }

function StepDots({ current, total }: { current: number; total: number }) {
  return <div className="cm-step-dots" aria-label={`Step ${current + 1} of ${total}`}>
    {Array.from({ length: total }, (_, index) => <span key={index} className={index <= current ? 'is-on' : ''} />)}
  </div>
}

const confettiColors = ['#b9f352', '#72dcff', '#ffcb47', '#a994ff', '#ff855e']

export function ChoiceMachine({ progress, onProgress, onBack, onNext }: Props) {
  const screenRef = useRef<HTMLElement>(null)
  const [phase, setPhase] = useState<Phase>('steps')
  const [returning] = useState(() => progress.choiceMachineVisited || progress.choiceMachineStoriesComplete || progress.choiceMachineQuizIndex > 0)
  const [quizIndex, setQuizIndex] = useState(0)
  const [lessonIndex, setLessonIndex] = useState(0)
  const [lessonAnswer, setLessonAnswer] = useState<number | null>(null)
  const [storyIndex, setStoryIndex] = useState(0)
  const [draft, setDraft] = useState('4.5')
  const [runValue, setRunValue] = useState<number | null>(null)
  const [flowStep, setFlowStep] = useState(0)
  const [seenPaths, setSeenPaths] = useState<SeenPaths>({})
  const [quizRetry, setQuizRetry] = useState(0)
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null)

  const lesson = everydayChoices[lessonIndex]
  const SituationIcon = situationIcons[lesson.id]

  useEffect(() => {
    if (phase !== 'choices') return
    screenRef.current?.scrollTo?.({ top: 0 })
    screenRef.current?.closest<HTMLElement>('.app-content')?.scrollTo?.({ top: 0 })
  }, [lessonIndex, phase])
  const story = flowStories[storyIndex]
  const isGrade = story.id === 'grade'
  const BriefingIcon = storyBriefingIcons[story.id] ?? Sparkles
  const parsedDraft = story.input.parse(draft)
  const seen = seenPaths[story.id] ?? { yes: false, no: false }
  const bothPathsSeen = seen.yes && seen.no
  const outcome = runValue === null ? null : story.decide(runValue)
  const quiz = phase === 'quiz' && quizIndex < CHOICE_QUIZ_LENGTH ? makeChoiceQuizQuestion(quizIndex, quizRetry) : null
  const quizCorrect = quiz !== null && quizAnswer === quiz.answer

  useEffect(() => {
    if (!progress.choiceMachineVisited) onProgress({ ...progress, choiceMachineVisited: true })
  }, [progress, onProgress])

  useEffect(() => {
    if (phase !== 'stories' || flowStep === 0 || flowStep >= 4) return
    const timer = window.setTimeout(() => setFlowStep((step) => Math.min(step + 1, 4)), flowStep === 1 ? 900 : 1000)
    return () => window.clearTimeout(timer)
  }, [phase, flowStep])

  useEffect(() => {
    if (phase !== 'stories' || flowStep !== 4 || runValue === null) return
    const path = story.decide(runValue) ? 'yes' : 'no'
    setSeenPaths((current) => {
      const previous = current[story.id] ?? { yes: false, no: false }
      if (previous[path]) return current
      return { ...current, [story.id]: { ...previous, [path]: true } }
    })
  }, [phase, flowStep, runValue, story])

  const confetti = useMemo(() => Array.from({ length: 22 }, (_, index) => {
    const angle = (index / 22) * Math.PI * 2
    const distance = 110 + (index % 5) * 30
    return {
      '--x': `${Math.round(Math.cos(angle) * distance)}px`,
      '--y': `${Math.round(Math.sin(angle) * distance * 0.72 + 110)}px`,
      '--r': `${(index % 8) * 95 - 320}deg`,
      '--d': `${(index % 7) * 30}ms`,
      '--c': confettiColors[index % confettiColors.length],
    } as CSSProperties
  }), [])

  const begin = () => setPhase('choices')

  const startOver = () => setPhase('steps')

  const openBriefing = () => {
    setDraft('')
    setRunValue(null)
    setFlowStep(0)
    setPhase('storyIntro')
  }

  const nextLesson = () => {
    if (lessonAnswer !== lesson.answer) return
    if (lessonIndex + 1 === everydayChoices.length) {
      onProgress({ ...progress, choiceMachineIntroComplete: true })
      setPhase('steps')
    }
    else { setLessonIndex(lessonIndex + 1); setLessonAnswer(null) }
  }

  const reviewStories = () => {
    setStoryIndex(0)
    setSeenPaths({})
    openBriefing()
  }

  const openQuiz = () => {
    setQuizIndex(progress.choiceMachineQuizIndex < CHOICE_QUIZ_LENGTH ? progress.choiceMachineQuizIndex : 0)
    setQuizAnswer(null)
    setQuizRetry(0)
    setPhase('quizIntro')
  }

  const startStory = () => {
    setDraft(isGrade ? '4.5' : '')
    setRunValue(null)
    setFlowStep(0)
    setPhase('stories')
  }

  const startFlow = () => {
    if (parsedDraft === null) return
    setRunValue(parsedDraft)
    setFlowStep(1)
  }

  const changeDraft = (value: string | ((current: string) => string)) => {
    setDraft(value)
    if (flowStep === 4) { setFlowStep(0); setRunValue(null) }
  }

  const nextRunOrStory = () => {
    if (!bothPathsSeen) { setDraft(isGrade ? draft : ''); setRunValue(null); setFlowStep(0); return }
    if (storyIndex + 1 === flowStories.length) {
      onProgress({ ...progress, choiceMachineStoriesComplete: true })
      openQuiz()
      setPhase('quiz')
    } else {
      setStoryIndex(storyIndex + 1)
      openBriefing()
    }
  }

  const nextQuiz = () => {
    if (!quizCorrect) return
    const nextIndex = quizIndex + 1
    const savedIndex = Math.max(nextIndex, progress.choiceMachineQuizIndex)
    let nextProgress = { ...progress, choiceMachineQuizIndex: savedIndex, choiceMachineXp: savedIndex * CHOICE_XP_PER_QUESTION }
    if (nextIndex === CHOICE_QUIZ_LENGTH) nextProgress = completeActivity(nextProgress, 'choice-machine')
    onProgress(nextProgress)
    setQuizIndex(nextIndex)
    setQuizRetry(0)
    setQuizAnswer(null)
    if (nextIndex === CHOICE_QUIZ_LENGTH) setPhase('complete')
  }

  const otherPathHint = seen.yes ? story.input.below : story.input.above
  const coach: { kind: CoachKind; title: string; copy: string } | null = phase !== 'stories' ? null
    : flowStep === 0
      ? parsedDraft === null
        ? draft.trim() !== ''
          ? { kind: 'fix', title: 'WHOLE NUMBERS ONLY', copy: 'Letters and symbols cannot be compared. Erase it and type digits like 8 or 15.' }
          : { kind: 'type', title: 'YOUR TURN', copy: seen.yes || seen.no ? `Good. Now type a value that is ${otherPathHint}.` : story.input.hint }
        : { kind: 'press', title: 'NOW PRESS START FLOW', copy: isGrade ? `Tap the arrows to choose a grade. Python will compare ${story.format(parsedDraft)} with 7.` : `Python will read ${story.variable} = ${story.format(parsedDraft)} and walk the flow below.` }
      : flowStep === 4 && !bothPathsSeen
        ? { kind: 'another', title: 'TRY ANOTHER VALUE', copy: `You saw the ${outcome ? 'TRUE' : 'FALSE'} path. ${isGrade ? 'Tap the arrows to choose' : 'Type'} a value that is ${otherPathHint} to see the other one.` }
        : null

  const flowLines = [
    `${story.variable} = ${isGrade ? 'float' : 'int'}(input())`,
    `if ${story.condition}:`,
    `    print("${story.trueOutput}")`,
    'else:',
    `    print("${story.falseOutput}")`,
  ]
  const shownValue = flowStep >= 1 ? runValue : parsedDraft
  const lineActive = (index: number) => (flowStep === 1 && index === 0) || (flowStep === 2 && index === 1) || (flowStep >= 3 && index === (outcome ? 2 : 4))

  const phaseLabel = phase === 'steps' ? 'YOUR THREE STEPS' : phase === 'intro' ? 'INTRO' : phase === 'choices' ? 'REAL LIFE CHOICES' : phase === 'storyIntro' ? 'PRE-EXPERIMENT' : phase === 'stories' ? 'LIVE FLOW' : phase === 'quizIntro' ? 'QUIZ READY' : phase === 'quiz' ? 'XP QUIZ' : 'COMPLETE'

  const stepOptions = [
    { title: 'Intro', copy: 'Explore three everyday choices.', icon: Lightbulb, enabled: true, done: progress.choiceMachineIntroComplete, action: () => { setLessonIndex(0); setLessonAnswer(null); setPhase('intro') } },
    { title: 'Live flow', copy: 'Send a value through both paths.', icon: GitBranch, enabled: returning || progress.choiceMachineIntroComplete, done: progress.choiceMachineStoriesComplete, action: reviewStories },
    { title: 'Final quiz', copy: '20 questions. Put your decisions to the test.', icon: Trophy, enabled: returning || progress.choiceMachineStoriesComplete, done: progress.completed.includes('choice-machine'), action: openQuiz },
  ]

  return <main ref={screenRef} className={`cm-screen cm-screen--${phase}`} style={{ '--cm-accent': '#b9f352' } as CSSProperties}>
    <div className="cm-toolbar">
      <button className="cm-back-chip" onClick={onBack}><ArrowLeft size={14} /> CONDITIONS</button>
      {phase !== 'steps' && <button className="cm-back-chip" onClick={() => setPhase('steps')}>THREE STEPS</button>}
      <span className="cm-phase-label"><span />{phaseLabel}</span>
    </div>

    {phase === 'steps' && <section className="cm-steps cm-panel">
      <div className="cm-steps-heading">
        <div><span className="cm-kicker"><Sparkles size={15} /> THE DECISION LAB</span>
          <h1>How the computer <span>makes a choice</span></h1>
          <p>{returning ? 'Welcome back. Choose any step to practice again.' : 'Start with the intro. Each finished step opens the next.'}</p></div>
        <div className="cm-journey-stamp" aria-hidden="true"><GitBranch /><span>ONE QUESTION.<br />TWO PATHS.</span></div>
      </div>
      <div className="cm-step-cards">{stepOptions.map((option, index) => {
        const Icon = option.icon
        return <button key={option.title} className={`cm-step-card cm-step-card--${index + 1} ${option.done ? 'is-done' : ''}`} disabled={!option.enabled} onClick={option.action} aria-label={option.title}>
          <span className="cm-step-card__top"><span className="cm-step-card__number">0{index + 1}</span><span>{!option.enabled ? <><Lock size={12} /> LOCKED</> : option.done ? <><Check size={12} /> COMPLETE</> : index === 0 && !returning ? 'START HERE' : 'READY'}</span></span>
          <span className="cm-step-art" aria-hidden="true">
            <span className="cm-step-art__orbit" /><span className="cm-step-art__icon"><Icon /></span>
            {index === 0 ? <><span className="cm-step-art__chip cm-step-art__chip--left">IF <b>YES</b></span><span className="cm-step-art__chip cm-step-art__chip--right">ELSE <b>NO</b></span></>
              : index === 1 ? <><span className="cm-step-art__chip cm-step-art__chip--left"><Zap size={14} /> VALUE</span><span className="cm-step-art__chip cm-step-art__chip--right">TRUE <ArrowRight size={14} /></span><span className="cm-step-art__signal" /></>
                : <><span className="cm-step-art__chip cm-step-art__chip--left"><Check size={16} /> TRUE?</span><span className="cm-step-art__chip cm-step-art__chip--right">20 <b>QUESTIONS</b></span></>}
          </span>
          <span className="cm-step-card__copy"><small>{['NOTICE THE DECISION', 'FOLLOW THE VALUE', 'TEST YOUR REASONING'][index]}</small><h2>{option.title}</h2><p>{option.copy}</p></span>
          <span className="cm-step-card__state">{!option.enabled ? <><Lock size={16} /> Finish the previous step</> : option.done ? <><RotateCcw size={16} /> Practice again</> : <>Start this step <ArrowRight size={16} /></>}</span>
        </button>
      })}</div>
      <div className="cm-journey-footer"><span><Lightbulb size={15} /> Look for the question. Follow the path.</span><span>OBSERVE <ArrowRight size={13} /> EXPERIMENT <ArrowRight size={13} /> UNDERSTAND</span></div>
    </section>}

    {phase === 'intro' && <section className="cm-intro cm-panel">
      <div className="cm-intro-copy">
        <span className="cm-kicker"><Lightbulb size={15} /> INTRO / EVERYDAY DECISIONS</span>
        <h2>Every choice starts with <em>a question.</em></h2>
        <p>Every day you choose what happens next. Look at three real situations: rain outside, a locked door, and a school result. Then type your own values and watch a computer make the same kinds of decisions.</p>
        <div className="cm-intro-examples" aria-label="Three everyday situations"><span><CloudRain size={16} /> Rain outside</span><span><Lock size={16} /> A locked door</span><span><GraduationCap size={16} /> A school result</span></div>
        <div className="cm-intro-rules"><div className="cm-intro-rule"><b>IF</b><span>the answer is YES</span><ArrowRight size={18} /><strong>do this</strong></div>
          <div className="cm-intro-rule cm-intro-rule--no"><b>ELSE</b><span>the answer is NO</span><ArrowRight size={18} /><strong>do that</strong></div></div>
        <button className="cm-primary" onClick={begin}>START LEARNING <ArrowRight size={19} /></button>
        <span className="cm-intro-note">3 situations. One idea: the answer chooses the action.</span>
      </div>
      <div className="cm-intro-art" aria-label="A question splits into a yes path and a no path">
        <span className="cm-intro-art__spark cm-intro-art__spark--one">✦</span><span className="cm-intro-art__spark cm-intro-art__spark--two">✦</span>
        <div className="cm-intro-monitor">
          <div className="cm-intro-monitor__bar"><span><i /><i /><i /></span><small>DECISION.PY</small><span className="cm-intro-monitor__live">LIVE</span></div>
          <div className="cm-intro-weather"><CloudRain size={58} /><span>LOOK AT THE VALUE<small>Rain outside</small></span></div>
          <ArrowDown className="cm-intro-connector" size={22} />
          <div className="cm-intro-art__terminal"><span>ASK A QUESTION</span><strong>Is it raining?</strong></div>
          <div className="cm-intro-art__split"><span>TRUE / YES</span><GitBranch size={32} /><span>FALSE / NO</span></div>
          <div className="cm-intro-art__outcomes"><div><Umbrella size={34} /><small>IF</small><strong>Take an umbrella</strong></div><div><Sun size={34} /><small>ELSE</small><strong>Leave the umbrella</strong></div></div>
          <div className="cm-intro-monitor__footer"><span /><small>One answer. One action.</small></div>
        </div>
      </div>
    </section>}

    {phase === 'choices' && <section className={`cm-lesson cm-life-choice cm-life-choice--${lesson.id} ${lessonAnswer === lesson.answer ? 'is-solved' : ''} cm-panel`} key={lessonIndex}>
      <div className="cm-lesson-visual">
        <div className="cm-situation-progress"><span>SITUATION 0{lessonIndex + 1} / 03</span><StepDots current={lessonIndex} total={everydayChoices.length} /></div>
        <div className="cm-situation-stage"><span className="cm-case-label">{lesson.visualLabel}</span><ChoiceScene id={lesson.id} revealed={lessonAnswer === lesson.answer} /><span className="cm-scene-spark cm-scene-spark--one" aria-hidden="true">✦</span><span className="cm-scene-spark cm-scene-spark--two" aria-hidden="true">✦</span></div>
        <div className="cm-life-caption"><small>WHAT YOU KNOW</small><p>{lesson.situation}</p></div>
        <div className={`cm-life-condition ${lessonAnswer === lesson.answer ? 'is-revealed' : ''}`}><small>THE QUESTION</small><strong>{lesson.condition}</strong>{lessonAnswer === lesson.answer && <span className="cm-situation-result"><b>{lesson.path}</b><ArrowRight size={14} /><b>{lesson.path === 'TRUE' ? 'IF' : 'ELSE'}</b><ArrowRight size={14} />{lesson.result}</span>}</div>
      </div>
      <div className="cm-lesson-content">
        <div className="cm-situation-heading"><span className="cm-situation-icon"><SituationIcon size={24} /></span><span className="cm-kicker">{lesson.eyebrow}</span><span className="cm-situation-tag">LOOK → DECIDE</span></div>
        <h2>{lesson.title}</h2><p>{lesson.explanation}</p>
        <div className="cm-lesson-question"><small>YOUR DECISION</small><strong>{lesson.question}</strong>
          <div className="cm-choice-buttons">{lesson.options.map((option, index) => {
            const Icon = answerIcons[lesson.id][index]
            return <button key={option} aria-label={option} aria-pressed={lessonAnswer === index} className={lessonAnswer === index ? index === lesson.answer ? 'is-correct' : 'is-wrong' : ''} onClick={() => setLessonAnswer(index)}><span className="cm-answer-letter">{String.fromCharCode(65 + index)}</span><span className="cm-answer-art" aria-hidden="true"><Icon size={32} /></span><strong>{option}</strong>{lessonAnswer === index && <span className="cm-answer-mark" aria-hidden="true">{index === lesson.answer ? <Check size={16} /> : <RotateCcw size={16} />}</span>}</button>
          })}</div>
        </div>
        <div className={`cm-feedback ${lessonAnswer !== null ? `is-visible ${lessonAnswer === lesson.answer ? 'is-correct' : 'is-wrong'}` : ''}`} role="status">{lessonAnswer === null ? 'Look at the picture, then choose what should happen.' : <><b>{lessonAnswer === lesson.answer ? <><Check size={18} /> GOOD EYE!</> : <><RotateCcw size={18} /> LOOK AGAIN</>}</b><span>{lessonAnswer === lesson.answer ? lesson.feedback : `Check the picture once more. ${lesson.condition}`}</span></>}</div>
        <button className="cm-primary" disabled={lessonAnswer !== lesson.answer} onClick={nextLesson}>{lessonIndex + 1 === everydayChoices.length ? 'FINISH INTRO' : 'NEXT SITUATION'} <ArrowRight size={18} /></button>
      </div>
    </section>}

    {phase === 'storyIntro' && <section className="cm-briefing cm-panel" key={story.id}>
      <div className="cm-briefing-copy">
        <span className="cm-kicker"><BriefingIcon size={15} /> PRE-EXPERIMENT · STORY {storyIndex + 1} OF {flowStories.length}</span>
        <StepDots current={storyIndex} total={flowStories.length} />
        <h2>{story.title}</h2>
        <p>{story.briefing.lead}</p>
        <ul className="cm-briefing-steps">
          {story.briefing.watch.map((step, index) => <li key={step}><b>{index + 1}</b>{step}</li>)}
        </ul>
        <div className="cm-briefing-actions">
          <button className="cm-primary" onClick={startStory}><Play size={17} fill="currentColor" /> START LIVE FLOW</button>
          {progress.choiceMachineStoriesComplete && <button className="cm-text-button" onClick={openQuiz}>Go to the quiz <ArrowRight size={14} /></button>}
        </div>
      </div>
      <div className="cm-briefing-art">
        <span className="cm-briefing-art__spark cm-briefing-art__spark--one">✦</span>
        <span className="cm-briefing-art__spark cm-briefing-art__spark--two">✦</span>
        <span className="cm-briefing-art__badge"><BriefingIcon size={34} /></span>
        <div className="cm-briefing-art__input"><small>{isGrade ? 'YOU CHOOSE' : 'YOU TYPE'}</small><b>{story.variable} = ?</b></div>
        <span className="cm-briefing-art__arrow" aria-hidden="true" />
        <div className="cm-briefing-art__question"><small>PYTHON ASKS</small><strong>{story.question}</strong><code>{story.condition}</code></div>
        <div className="cm-briefing-art__paths">
          <div><small>TRUE</small><b>{story.trueOutput}</b></div>
          <div><small>FALSE</small><b>{story.falseOutput}</b></div>
        </div>
      </div>
    </section>}

    {phase === 'stories' && <section className="cm-story cm-panel" key={story.id}>
      <div className="cm-story-top"><div><span className="cm-kicker">LIVE FLOW / STORY {storyIndex + 1} OF {flowStories.length}</span><h2>{story.title}</h2><p>{story.narrative}</p></div><div className="cm-story-seen"><span className={seen.yes ? 'is-seen' : ''}>✓ TRUE PATH</span><span className={seen.no ? 'is-seen' : ''}>✓ FALSE PATH</span></div></div>
      <div className="cm-story-grid">
        <div className="cm-story-code">
          <header><span>PYTHON CODE</span><small>{flowStep > 0 && flowStep < 4 ? `RUNNING ${flowStep} / 4` : 'FOLLOW THE GLOW'}</small></header>
          <div className="cm-story-lines">
            {flowLines.map((line, index) => {
              const active = lineActive(index)
              return <div key={index} className={active ? 'is-active' : ''}><span>{index + 1}</span><PythonCode code={line} />
                {index === 0 && flowStep >= 1 && shownValue !== null && <b className="cm-value-chip">{story.variable} = {story.format(shownValue)}</b>}
              </div>
            })}
          </div>
          <div className={`cm-value-picker ${coach && coach.kind !== 'press' ? 'needs-attention' : ''} ${coach?.kind === 'press' ? 'is-ready' : ''}`}>
            <strong>{isGrade ? 'CHOOSE A GRADE' : `TYPE A VALUE FOR ${story.variable.toUpperCase()}`}</strong>
            {isGrade ? <div className="cm-value-field cm-grade-picker">
              <span>grade =</span>
              <button aria-label="Decrease grade" disabled={(flowStep > 0 && flowStep < 4) || Number(draft) <= 0} onClick={() => changeDraft((current) => String(Math.max(0, Number(current) - 0.25)))}><ArrowLeft size={22} /></button>
              <output aria-label="grade value" aria-live="polite">{Number(draft)}</output>
              <button aria-label="Increase grade" disabled={(flowStep > 0 && flowStep < 4) || Number(draft) >= 10} onClick={() => changeDraft((current) => String(Math.min(10, Number(current) + 0.25)))}><ArrowRight size={22} /></button>
            </div> : <label className="cm-value-field">
              <span>{story.variable} =</span>
              <input value={draft} onChange={(event) => changeDraft(event.target.value)} disabled={flowStep > 0 && flowStep < 4} inputMode="numeric" placeholder={story.input.placeholder} aria-label={`${story.variable} value`} />
            </label>}
            <small>{story.input.typeHint} · then press the green button</small>
            {coach && coach.kind !== 'press' && <aside className={`cm-try-popup cm-try-popup--${coach.kind}`} role="status"><Lightbulb /><div><strong>{coach.title}</strong><p>{coach.copy}</p></div></aside>}
          </div>
        </div>
        <div className="cm-flow-stage">
          <span className="cm-flow-step" aria-hidden="true"><i className={flowStep > 0 && flowStep < 4 ? 'is-live' : ''} />{flowStep === 0 ? 'READY' : `STEP ${flowStep} / 4`}</span>
          <div className="cm-flowchart" aria-label="Decision flowchart">
            <div className={`cm-node cm-node--terminal ${flowStep >= 1 ? 'is-active' : ''}`}>START</div>
            <span className={`cm-arrow ${flowStep >= 1 ? 'is-active' : ''}`} aria-hidden="true" />
            <div className={`cm-node cm-node--action ${flowStep === 1 ? 'is-active' : flowStep > 1 ? 'is-visited' : ''}`}><small>READ INPUT</small><b>{story.variable} = {shownValue === null ? '?' : story.format(shownValue)}</b></div>
            <span className={`cm-arrow ${flowStep >= 2 ? 'is-active' : ''}`} aria-hidden="true" />
            <div className={`cm-node cm-node--decision ${flowStep === 2 ? 'is-active' : flowStep > 2 ? 'is-visited' : ''}`}>
              <svg viewBox="0 0 224 130" preserveAspectRatio="none" aria-hidden="true"><polygon points="112,3 221,65 112,127 3,65" vectorEffect="non-scaling-stroke" /></svg>
              <span>{story.question}
                {flowStep >= 2 && runValue !== null && <em className="cm-calc">{story.calc(runValue).map((line, index, lines) => <b key={index} className={index === lines.length - 1 ? outcome ? 'is-true' : 'is-false' : ''} style={{ animationDelay: `${index * 0.3}s` }}>{line}</b>)}</em>}
              </span>
            </div>
            <div className="cm-branch">
              <svg className="cm-branch-links" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden="true">
                <path className={`cm-link cm-link--yes ${flowStep >= 3 && outcome ? 'is-active' : ''}`} d="M200 0 C200 27 96 22 96 64" vectorEffect="non-scaling-stroke" />
                <path className={`cm-link cm-link--no ${flowStep >= 3 && outcome === false ? 'is-active' : ''}`} d="M200 0 C200 27 304 22 304 64" vectorEffect="non-scaling-stroke" />
              </svg>
              <span className={`cm-branch__label cm-branch__label--yes ${flowStep >= 3 && outcome ? 'is-active' : ''}`}>TRUE</span>
              <span className={`cm-branch__label cm-branch__label--no ${flowStep >= 3 && outcome === false ? 'is-active' : ''}`}>FALSE</span>
              <div className="cm-branch__results">
                <div className={flowStep >= 3 && outcome ? 'is-active' : ''}><small>PRINT</small>{story.trueOutput}</div>
                <div className={flowStep >= 3 && outcome === false ? 'is-active' : ''}><small>PRINT</small>{story.falseOutput}</div>
              </div>
            </div>
            <div className={`cm-merge ${flowStep >= 4 ? 'is-active' : ''}`} aria-hidden="true"><span /><span /></div>
            <div className={`cm-node cm-node--terminal cm-node--end ${flowStep >= 4 ? 'is-active' : ''}`}>END</div>
          </div>
        </div>
      </div>
      <div className="cm-story-bottom"><div className="cm-story-status" role="status"><b>{flowStep === 0 ? parsedDraft === null ? 'WAITING FOR A VALUE' : 'VALUE READY' : flowStep === 1 ? 'READING INPUT' : flowStep === 2 ? 'TESTING THE CONDITION' : flowStep === 3 ? 'FOLLOWING THE PATH' : 'FLOW FINISHED'}</b><span>{flowStep === 0 ? parsedDraft === null ? `Type a ${story.variable} value (${story.input.typeHint.toLowerCase()}) and press START FLOW.` : `Python will read ${story.variable} = ${story.format(parsedDraft)}. Press the green button to start.` : flowStep === 1 ? `input() captures ${shownValue} and Python stores it in ${story.variable}.` : flowStep === 2 ? `${story.question} The answer is ${outcome ? 'True' : 'False'}.` : flowStep === 3 ? `Python follows the ${outcome ? 'TRUE' : 'FALSE'} path and prints “${outcome ? story.trueOutput : story.falseOutput}”.` : bothPathsSeen ? 'You discovered both paths. Ready for the next story!' : `You saw the ${outcome ? 'TRUE' : 'FALSE'} path. Now send a value on the other side.`}</span></div>
        <div className="cm-story-cta">
          {coach?.kind === 'press' && <aside className="cm-try-popup cm-try-popup--press" role="status"><Lightbulb /><div><strong>{coach.title}</strong><p>{coach.copy}</p></div></aside>}
          {flowStep === 0
            ? <button className={`cm-primary cm-run ${coach?.kind === 'press' ? 'needs-attention' : ''}`} disabled={parsedDraft === null} onClick={startFlow}><Play size={17} fill="currentColor" /> START FLOW</button>
            : flowStep < 4
              ? <button className="cm-primary" disabled><i className="cm-run-dot" /> WATCH THE FLOW</button>
              : <button className="cm-primary" onClick={nextRunOrStory}>{bothPathsSeen ? storyIndex + 1 === flowStories.length ? 'OPEN THE QUIZ' : 'NEXT STORY' : 'TRY ANOTHER VALUE'} <ArrowRight size={18} /></button>}
        </div>
      </div>
    </section>}

    {phase === 'quizIntro' && <section className="cm-quiz-intro cm-panel"><span className="cm-quiz-intro-icon"><Trophy size={62} /></span><span className="cm-kicker">FINAL QUIZ</span><h2>Ready to choose on your own?</h2><p>20 questions. One decision at a time. Each correct answer earns <b>10 XP</b>. If you miss one, try the same idea with new values.</p><div className="cm-quiz-intro-stats"><span><b>20</b> QUESTIONS</span><span><b>200</b> XP POSSIBLE</span><span><b>∞</b> TRIES</span></div><button className="cm-primary" onClick={() => setPhase('quiz')}>START THE XP QUIZ <ArrowRight size={19} /></button></section>}

    {phase === 'quiz' && quiz && <section className={`cm-quiz cm-panel ${quizAnswer !== null ? quizCorrect ? 'is-right' : 'is-wrong' : ''}`} key={quizIndex}>
      {quizCorrect && <div className="cm-burst" aria-hidden="true">{confetti.map((style, index) => <i key={index} style={style} />)}</div>}
      {quizAnswer !== null && !quizCorrect && <div className="cm-crash" aria-hidden="true"><span>X</span><b>NOT YET</b><span>X</span></div>}
      <div className="cm-quiz-heading"><div><span className="cm-kicker">QUESTION {quizIndex + 1} / {CHOICE_QUIZ_LENGTH}</span><h2>{quiz.prompt}</h2></div><div className={`cm-xp ${quizCorrect ? 'is-kicked' : ''}`}><Zap size={20} fill="currentColor" /><b key={`${quizIndex}-${progress.choiceMachineXp}`}>{(quizIndex + (quizCorrect ? 1 : 0)) * CHOICE_XP_PER_QUESTION}</b><span>XP</span>{quizCorrect && <em className="cm-xp-pop">+10</em>}</div></div>
      <div className="cm-quiz-progress" role="progressbar" aria-label="Quiz progress" aria-valuenow={quizIndex} aria-valuemin={0} aria-valuemax={CHOICE_QUIZ_LENGTH}><span style={{ width: `${(quizIndex / CHOICE_QUIZ_LENGTH) * 100}%` }} /></div>
      <div className="cm-quiz-grid"><div className="cm-quiz-code"><span>READ THE CODE</span><pre><PythonCode code={quiz.code} /></pre><small>Read line by line before choosing.</small></div><div className="cm-quiz-answer"><span>CHOOSE ONE ANSWER</span><div>{quiz.options.map((option, index) => <button key={option} disabled={quizAnswer !== null} className={quizAnswer === index ? quizCorrect ? 'is-correct' : 'is-wrong' : ''} onClick={() => setQuizAnswer(index)} aria-label={`${String.fromCharCode(65 + index)} ${option.replace(/\n/g, ' then ')}`}><b>{String.fromCharCode(65 + index)}</b><code>{option}</code>{quizAnswer === index && <i aria-hidden="true">{quizCorrect ? '✓' : '✗'}</i>}</button>)}</div></div></div>
      <div className="cm-quiz-bottom"><div className="cm-quiz-feedback" role="status">{quizAnswer === null ? <span>Choose the result to earn 10 XP.</span> : quizCorrect ? <><Check size={24} /><span><b>+10 XP!</b> {quiz.explanation}</span></> : <><RotateCcw size={24} /><span><b>Not yet.</b> {quiz.explanation} Try the same idea with new values.</span></>}</div>{quizAnswer !== null && <button className="cm-primary" onClick={quizCorrect ? nextQuiz : () => { setQuizRetry(quizRetry + 1); setQuizAnswer(null) }}>{quizCorrect ? quizIndex + 1 === CHOICE_QUIZ_LENGTH ? 'SEE YOUR RESULT' : 'NEXT QUESTION' : 'TRY NEW VALUES'} <ArrowRight size={18} /></button>}</div>
    </section>}

    {phase === 'complete' && <section className="cm-complete cm-panel"><div className="cm-complete-orbit"><Trophy size={72} /></div><span className="cm-kicker">ACTIVITY 02 COMPLETE</span><h2>You know how Python chooses.</h2><p>You followed True and False paths through three stories and solved all 20 quiz questions.</p><div className="cm-complete-xp"><Zap size={27} fill="currentColor" /><b>{progress.choiceMachineXp}</b><span>XP EARNED</span></div><div className="cm-complete-actions"><button className="cm-primary" onClick={() => onNext('if-else')}>NEXT: IF/ELSE <ArrowRight size={18} /></button><button className="cm-secondary" onClick={startOver}><RotateCcw size={17} /> PLAY AGAIN</button></div></section>}
  </main>
}
