import { ArrowLeft, ArrowRight, Check, CloudRain, GitBranch, GraduationCap, LockKeyhole, Play, RotateCcw, Sparkles, Trophy, Zap } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { CHOICE_QUIZ_LENGTH, CHOICE_XP_PER_QUESTION, everydayChoices, flowStories, makeChoiceQuizQuestion } from '../../data/choiceMachine'
import { completeActivity } from '../../session/progressSession'
import type { AppRoute, SessionProgress } from '../../types'
import './choiceMachine.css'

interface Props {
  progress: SessionProgress
  onProgress: (progress: SessionProgress) => void
  onBack: () => void
  onNext: (route: AppRoute) => void
}

type Phase = 'intro' | 'choices' | 'stories' | 'quizIntro' | 'quiz' | 'complete'
type SeenPaths = Record<string, { yes: boolean; no: boolean }>

function StepDots({ current, total }: { current: number; total: number }) {
  return <div className="cm-step-dots" aria-label={`Step ${current + 1} of ${total}`}>
    {Array.from({ length: total }, (_, index) => <span key={index} className={index <= current ? 'is-on' : ''} />)}
  </div>
}

export function ChoiceMachine({ progress, onProgress, onBack, onNext }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [lessonIndex, setLessonIndex] = useState(0)
  const [lessonAnswer, setLessonAnswer] = useState<number | null>(null)
  const [storyIndex, setStoryIndex] = useState(0)
  const [chosenValue, setChosenValue] = useState<number | boolean | null>(null)
  const [flowStep, setFlowStep] = useState(0)
  const [seenPaths, setSeenPaths] = useState<SeenPaths>({})
  const [quizRetry, setQuizRetry] = useState(0)
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null)

  const lesson = everydayChoices[lessonIndex]
  const SceneIcon = lesson.id === 'rain' ? CloudRain : lesson.id === 'password' ? LockKeyhole : GraduationCap
  const story = flowStories[storyIndex]
  const outcome = chosenValue === null ? null : story.decide(chosenValue)
  const seen = seenPaths[story.id] ?? { yes: false, no: false }
  const bothPathsSeen = seen.yes && seen.no
  const quizIndex = progress.choiceMachineQuizIndex
  const quiz = phase === 'quiz' && quizIndex < CHOICE_QUIZ_LENGTH ? makeChoiceQuizQuestion(quizIndex, quizRetry) : null
  const quizCorrect = quiz !== null && quizAnswer === quiz.answer

  const begin = () => {
    if (progress.completed.includes('choice-machine') || quizIndex === CHOICE_QUIZ_LENGTH) setPhase('complete')
    else if (quizIndex > 0) setPhase('quiz')
    else if (progress.choiceMachineStoriesComplete) setPhase('quizIntro')
    else setPhase('choices')
  }

  const startOver = () => {
    onProgress({
      ...progress,
      completed: progress.completed.filter((id) => id !== 'choice-machine'),
      choiceMachineStoriesComplete: false,
      choiceMachineQuizIndex: 0,
      choiceMachineXp: 0,
    })
    setLessonIndex(0)
    setLessonAnswer(null)
    setStoryIndex(0)
    setChosenValue(null)
    setFlowStep(0)
    setSeenPaths({})
    setQuizRetry(0)
    setQuizAnswer(null)
    setPhase('choices')
  }

  const nextLesson = () => {
    if (lessonAnswer !== lesson.answer) return
    if (lessonIndex + 1 === everydayChoices.length) setPhase('stories')
    else { setLessonIndex(lessonIndex + 1); setLessonAnswer(null) }
  }

  const advanceFlow = () => {
    if (chosenValue === null || outcome === null) return
    const nextStep = flowStep + 1
    setFlowStep(nextStep)
    if (nextStep === 4) setSeenPaths((current) => ({ ...current, [story.id]: { yes: seen.yes || outcome, no: seen.no || !outcome } }))
  }

  const nextRunOrStory = () => {
    if (!bothPathsSeen) { setChosenValue(null); setFlowStep(0); return }
    if (storyIndex + 1 === flowStories.length) {
      onProgress({ ...progress, choiceMachineStoriesComplete: true })
      setPhase('quizIntro')
    } else {
      setStoryIndex(storyIndex + 1)
      setChosenValue(null)
      setFlowStep(0)
    }
  }

  const nextQuiz = () => {
    if (!quizCorrect) return
    const nextIndex = quizIndex + 1
    let nextProgress = { ...progress, choiceMachineQuizIndex: nextIndex, choiceMachineXp: nextIndex * CHOICE_XP_PER_QUESTION }
    if (nextIndex === CHOICE_QUIZ_LENGTH) nextProgress = completeActivity(nextProgress, 'choice-machine')
    onProgress(nextProgress)
    setQuizRetry(0)
    setQuizAnswer(null)
    if (nextIndex === CHOICE_QUIZ_LENGTH) setPhase('complete')
  }

  const phaseLabel = phase === 'intro' ? 'INTRO' : phase === 'choices' ? 'REAL LIFE CHOICES' : phase === 'stories' ? 'LIVE FLOW' : phase === 'quizIntro' ? 'QUIZ READY' : phase === 'quiz' ? 'XP QUIZ' : 'COMPLETE'

  return <main className={`cm-screen cm-screen--${phase}`} style={{ '--cm-accent': '#b9f352' } as CSSProperties}>
    <header className="cm-header">
      <button className="cm-back" onClick={onBack}><ArrowLeft size={18} /> CONDITIONS</button>
      <div className="cm-header-title"><small>WORLD 02 / ACTIVITY 01</small><h1>How the computer makes a choice</h1></div>
      <span className="cm-phase-label"><span />{phaseLabel}</span>
    </header>

    {phase === 'intro' && <section className="cm-intro cm-panel">
      <div className="cm-intro-copy">
        <span className="cm-kicker"><Sparkles size={15} /> THE DECISION LAB</span>
        <h2>Every choice starts with <em>a question.</em></h2>
        <p>Every day you choose what happens next. Try three real situations first: rainy weather, a locked door, and a school result. Then watch a computer make the same kinds of decisions.</p>
        <div className="cm-intro-rule"><b>IF</b><span>the answer is YES</span><ArrowRight size={18} /><strong>do this</strong></div>
        <div className="cm-intro-rule cm-intro-rule--no"><b>ELSE</b><span>the answer is NO</span><ArrowRight size={18} /><strong>do that</strong></div>
        <button className="cm-primary" onClick={begin}>{progress.completed.includes('choice-machine') ? 'SEE MY RESULT' : quizIndex > 0 ? 'CONTINUE QUIZ' : progress.choiceMachineStoriesComplete ? 'OPEN THE QUIZ' : 'START LEARNING'} <ArrowRight size={19} /></button>
        {(progress.choiceMachineStoriesComplete || quizIndex > 0) && <button className="cm-text-button" onClick={startOver}>Start from the beginning</button>}
      </div>
      <div className="cm-intro-art" aria-label="A question splits into a yes path and a no path">
        <span className="cm-intro-art__spark cm-intro-art__spark--one">✦</span><span className="cm-intro-art__spark cm-intro-art__spark--two">✦</span>
        <div className="cm-intro-art__terminal"><span>ONE SIMPLE QUESTION</span><strong>Is it raining?</strong></div>
        <div className="cm-intro-art__split"><span>YES</span><GitBranch size={42} /><span>NO</span></div>
        <div className="cm-intro-art__outcomes"><div><b>?</b><small>YOUR CHOICE</small></div><div><b>?</b><small>YOUR CHOICE</small></div></div>
        <div className="cm-intro-art__pulse" />
      </div>
    </section>}

    {phase === 'choices' && <section className={`cm-lesson cm-life-choice cm-life-choice--${lesson.id} cm-panel`} key={lessonIndex}>
      <div className="cm-lesson-visual">
        <StepDots current={lessonIndex} total={everydayChoices.length} />
        <div className="cm-life-scene"><div className="cm-life-scene__orbit"><SceneIcon size={83} strokeWidth={1.7} /></div><strong>{lesson.visualLabel}</strong><p>{lesson.situation}</p></div>
        <div className={`cm-life-condition ${lessonAnswer === lesson.answer ? 'is-revealed' : ''}`}><small>THE QUESTION</small><strong>{lesson.condition}</strong>{lessonAnswer === lesson.answer && <span>{lesson.path} → {lesson.result}</span>}</div>
      </div>
      <div className="cm-lesson-content">
        <span className="cm-kicker">{lesson.eyebrow}</span><h2>{lesson.title}</h2><p>{lesson.explanation}</p>
        <div className="cm-lesson-question"><strong>{lesson.question}</strong>
          <div className="cm-choice-buttons">{lesson.options.map((option, index) => <button key={option} aria-label={option} className={lessonAnswer === index ? index === lesson.answer ? 'is-correct' : 'is-wrong' : ''} onClick={() => setLessonAnswer(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>
        </div>
        <div className={`cm-feedback ${lessonAnswer !== null ? 'is-visible' : ''}`} role="status">{lessonAnswer === null ? 'Choose what should happen.' : <><b>{lessonAnswer === lesson.answer ? 'GOOD CHOICE!' : 'TRY AGAIN'}</b><span>{lessonAnswer === lesson.answer ? lesson.feedback : `Look at the situation again. ${lesson.condition}`}</span></>}</div>
        <button className="cm-primary" disabled={lessonAnswer !== lesson.answer} onClick={nextLesson}>{lessonIndex + 1 === everydayChoices.length ? 'OPEN THE LIVE FLOW' : 'NEXT SITUATION'} <ArrowRight size={18} /></button>
      </div>
    </section>}

    {phase === 'stories' && <section className="cm-story cm-panel" key={story.id}>
      <div className="cm-story-top"><div><span className="cm-kicker">LIVE FLOW / STORY {storyIndex + 1} OF {flowStories.length}</span><h2>{story.title}</h2><p>{story.narrative}</p></div><div className="cm-story-seen"><span className={seen.yes ? 'is-seen' : ''}>✓ TRUE PATH</span><span className={seen.no ? 'is-seen' : ''}>✓ FALSE PATH</span></div></div>
      <div className="cm-story-grid">
        <div className="cm-story-code">
          <header><span>PYTHON CODE</span><small>FOLLOW THE GLOW</small></header>
          <div className="cm-story-lines">
            {[`${story.variable} = ${chosenValue === null ? '?' : story.format(chosenValue)}`, `if ${story.condition}:`, `    print("${story.trueOutput}")`, 'else:', `    print("${story.falseOutput}")`].map((line, index) => {
              const active = (flowStep === 1 && index === 0) || (flowStep === 2 && index === 1) || (flowStep >= 3 && index === (outcome ? 2 : 4))
              return <div key={index} className={active ? 'is-active' : ''}><span>{index + 1}</span><code>{line}</code></div>
            })}
          </div>
          <div className="cm-value-picker"><strong>CHOOSE A VALUE</strong><div>{story.values.map((value) => {
            const path = story.decide(value)
            const unavailable = flowStep > 0 || (seen[path ? 'yes' : 'no'] && !bothPathsSeen)
            return <button key={String(value)} disabled={unavailable} className={chosenValue === value ? 'is-selected' : ''} onClick={() => { setChosenValue(value); setFlowStep(0) }}>{story.variable} = {story.format(value)}</button>
          })}</div></div>
        </div>
        <div className="cm-flow-panel"><header><span>LIVE FLOWCHART</span><small>{flowStep === 0 ? 'WAITING FOR A VALUE' : `STEP ${flowStep} / 4`}</small></header>
          <div className="cm-flowchart" aria-label="Decision flowchart">
            <div className={`cm-flow-node cm-flow-start ${flowStep >= 1 ? 'is-active' : ''}`}>START</div>
            <div className={`cm-flow-line ${flowStep >= 1 ? 'is-active' : ''}`} />
            <div className={`cm-flow-node cm-flow-read ${flowStep === 1 ? 'is-active' : flowStep > 1 ? 'is-visited' : ''}`}>READ <b>{story.variable}</b></div>
            <div className={`cm-flow-line ${flowStep >= 2 ? 'is-active' : ''}`} />
            <div className={`cm-flow-diamond ${flowStep === 2 ? 'is-active' : flowStep > 2 ? 'is-visited' : ''}`}><span>{story.question}</span></div>
            <div className="cm-flow-branches"><span className={flowStep >= 3 && outcome ? 'is-active' : ''}>TRUE ↙</span><span className={flowStep >= 3 && outcome === false ? 'is-active' : ''}>↘ FALSE</span></div>
            <div className="cm-flow-results"><div className={flowStep >= 3 && outcome ? 'is-active' : ''}>{story.trueOutput}</div><div className={flowStep >= 3 && outcome === false ? 'is-active' : ''}>{story.falseOutput}</div></div>
            <div className={`cm-flow-line cm-flow-line--end ${flowStep >= 4 ? 'is-active' : ''}`} />
            <div className={`cm-flow-node cm-flow-end ${flowStep >= 4 ? 'is-active' : ''}`}>END</div>
          </div>
        </div>
      </div>
      <div className="cm-story-bottom"><div className="cm-story-status" role="status"><b>{flowStep === 0 ? 'YOUR TURN' : flowStep === 1 ? 'READ THE VALUE' : flowStep === 2 ? 'TEST THE QUESTION' : flowStep === 3 ? 'FOLLOW THE PATH' : 'THE RESULT'}</b><span>{flowStep === 0 ? `Pick one ${story.variable} value, then start the flow.` : flowStep === 1 ? `Python stores ${story.variable} = ${story.format(chosenValue!)}.` : flowStep === 2 ? `${story.question} The answer is ${outcome ? 'True' : 'False'}.` : flowStep === 3 ? `Python follows the ${outcome ? 'TRUE' : 'FALSE'} path and prints “${outcome ? story.trueOutput : story.falseOutput}”.` : bothPathsSeen ? 'You discovered both paths. Ready for the next story!' : 'Now choose a value that takes the other path.'}</span></div>
        {flowStep < 4 ? <button className="cm-primary" disabled={chosenValue === null} onClick={advanceFlow}>{flowStep === 0 ? <><Play size={17} /> START FLOW</> : <>NEXT STEP <ArrowRight size={18} /></>}</button> : <button className="cm-primary" onClick={nextRunOrStory}>{bothPathsSeen ? storyIndex + 1 === flowStories.length ? 'OPEN THE QUIZ' : 'NEXT STORY' : 'TRY THE OTHER PATH'} <ArrowRight size={18} /></button>}
      </div>
    </section>}

    {phase === 'quizIntro' && <section className="cm-quiz-intro cm-panel"><span className="cm-quiz-intro-icon"><Trophy size={62} /></span><span className="cm-kicker">ALL THREE STORIES COMPLETE</span><h2>Ready to choose on your own?</h2><p>20 questions. One decision at a time. Each correct answer earns <b>10 XP</b>. If you miss one, try the same idea with new values.</p><div className="cm-quiz-intro-stats"><span><b>20</b> QUESTIONS</span><span><b>200</b> XP POSSIBLE</span><span><b>∞</b> TRIES</span></div><button className="cm-primary" onClick={() => setPhase('quiz')}>START THE XP QUIZ <ArrowRight size={19} /></button></section>}

    {phase === 'quiz' && quiz && <section className="cm-quiz cm-panel" key={quizIndex}>
      <div className="cm-quiz-heading"><div><span className="cm-kicker">QUESTION {quizIndex + 1} / {CHOICE_QUIZ_LENGTH}</span><h2>{quiz.prompt}</h2></div><div className="cm-xp"><Zap size={20} fill="currentColor" /><b>{progress.choiceMachineXp}</b><span>XP</span></div></div>
      <div className="cm-quiz-progress" role="progressbar" aria-label="Quiz progress" aria-valuenow={quizIndex} aria-valuemin={0} aria-valuemax={CHOICE_QUIZ_LENGTH}><span style={{ width: `${(quizIndex / CHOICE_QUIZ_LENGTH) * 100}%` }} /></div>
      <div className="cm-quiz-grid"><div className="cm-quiz-code"><span>READ THE CODE</span><pre><code>{quiz.code}</code></pre><small>Read line by line before choosing.</small></div><div className="cm-quiz-answer"><span>CHOOSE ONE ANSWER</span><div>{quiz.options.map((option, index) => <button key={option} disabled={quizAnswer !== null} className={quizAnswer === index ? quizCorrect ? 'is-correct' : 'is-wrong' : ''} onClick={() => setQuizAnswer(index)} aria-label={`${String.fromCharCode(65 + index)} ${option.replace(/\n/g, ' then ')}`}><b>{String.fromCharCode(65 + index)}</b><code>{option}</code></button>)}</div></div></div>
      <div className="cm-quiz-bottom"><div className="cm-quiz-feedback" role="status">{quizAnswer === null ? <span>Choose the result to earn 10 XP.</span> : quizCorrect ? <><Check size={22} /><span><b>+10 XP!</b> {quiz.explanation}</span></> : <><RotateCcw size={22} /><span><b>Not yet.</b> {quiz.explanation} Try the same idea with new values.</span></>}</div>{quizAnswer !== null && <button className="cm-primary" onClick={quizCorrect ? nextQuiz : () => { setQuizRetry(quizRetry + 1); setQuizAnswer(null) }}>{quizCorrect ? quizIndex + 1 === CHOICE_QUIZ_LENGTH ? 'SEE YOUR RESULT' : 'NEXT QUESTION' : 'TRY NEW VALUES'} <ArrowRight size={18} /></button>}</div>
    </section>}

    {phase === 'complete' && <section className="cm-complete cm-panel"><div className="cm-complete-orbit"><Trophy size={72} /></div><span className="cm-kicker">ACTIVITY 01 COMPLETE</span><h2>You know how Python chooses.</h2><p>You followed True and False paths through three stories and solved all 20 quiz questions.</p><div className="cm-complete-xp"><Zap size={27} fill="currentColor" /><b>{progress.choiceMachineXp}</b><span>XP EARNED</span></div><div className="cm-complete-actions"><button className="cm-primary" onClick={() => onNext('if-else')}>NEXT: IF/ELSE <ArrowRight size={18} /></button><button className="cm-secondary" onClick={startOver}><RotateCcw size={17} /> PLAY AGAIN</button></div></section>}
  </main>
}
