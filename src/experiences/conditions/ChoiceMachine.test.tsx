import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHOICE_QUIZ_LENGTH, everydayChoices, makeChoiceQuizQuestion } from '../../data/choiceMachine'
import { createSession } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { ChoiceMachine } from './ChoiceMachine'

function Harness({ initial }: { initial?: SessionProgress }) {
  const [progress, setProgress] = useState<SessionProgress>(() => initial ?? createSession('Maya'))
  return <ChoiceMachine progress={progress} onProgress={setProgress} onBack={() => {}} onNext={() => {}} />
}

describe('How the computer makes a choice', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  const runFlow = () => {
    fireEvent.click(screen.getByRole('button', { name: /start flow/i }))
    act(() => { vi.advanceTimersByTime(900) })
    act(() => { vi.advanceTimersByTime(1000) })
    act(() => { vi.advanceTimersByTime(1000) })
  }

  it('teaches nine real situations and both paths per story, then opens the 20-question XP quiz', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Live flow' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Final quiz' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Intro' }))
    expect(screen.getByRole('heading', { name: /every choice starts with a question/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /start learning/i }))

    expect(screen.getByRole('heading', { name: 'A rainy day' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /rain falling/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Leave the umbrella' }))
    expect(screen.getByRole('button', { name: /next situation/i })).toBeDisabled()
    expect(screen.getByText('LOOK AGAIN')).toBeInTheDocument()

    for (const answer of ['Take an umbrella', 'Show an error', 'Approved', 'Wait for green', 'Charge the phone', 'Choose another ride', 'Play the game', 'Keep the light off', 'Turn the fan on']) {
      fireEvent.click(screen.getByRole('button', { name: answer }))
      fireEvent.click(screen.getByRole('button', { name: /next situation|finish intro/i }))
    }

    expect(screen.getByRole('button', { name: 'Live flow' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Final quiz' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Live flow' }))
    expect(screen.getByRole('heading', { name: 'The school result' })).toBeInTheDocument()
    expect(screen.getByText('PRE-EXPERIMENT · STORY 1 OF 3')).toBeInTheDocument()
    expect(screen.getByText(/is the grade at least 7/i)).toBeInTheDocument()
    const storyValues = [['4', '7'], ['3', '8'], ['15', '18']]
    storyValues.forEach(([first, second], index) => {
      fireEvent.click(screen.getByRole('button', { name: /start live flow/i }))
      if (index === 0) {
        expect(screen.getByLabelText('grade value')).toHaveTextContent('4.5')
        fireEvent.click(screen.getByRole('button', { name: 'Decrease grade' }))
        fireEvent.click(screen.getByRole('button', { name: 'Decrease grade' }))
      } else {
        expect(screen.getByText('YOUR TURN')).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText(/value$/), { target: { value: first } })
      }
      runFlow()
      expect(screen.getByRole('button', { name: /try another value/i })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /try another value/i }))
      if (index === 0) {
        const increase = screen.getByRole('button', { name: 'Increase grade' })
        for (let tap = 0; tap < 12; tap += 1) fireEvent.click(increase)
      } else fireEvent.change(screen.getByLabelText(/value$/), { target: { value: second } })
      runFlow()
      fireEvent.click(screen.getByRole('button', { name: /next story|open the quiz/i }))
      if (index < storyValues.length - 1) expect(screen.getByText(`PRE-EXPERIMENT · STORY ${index + 2} OF 3`)).toBeInTheDocument()
    })

    const first = makeChoiceQuizQuestion(0)
    const wrong = (first.answer + 1) % first.options.length
    fireEvent.click(within(document.querySelector('.cm-quiz-answer') as HTMLElement).getAllByRole('button')[wrong])
    expect(screen.getByRole('button', { name: /try new values/i })).toBeInTheDocument()
    expect(screen.getByText('0', { selector: '.cm-xp b' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try new values/i }))
    expect(document.querySelector('.cm-quiz-code')?.textContent).toContain('x = 2')

    for (let index = 0; index < CHOICE_QUIZ_LENGTH; index += 1) {
      const question = makeChoiceQuizQuestion(index, index === 0 ? 1 : 0)
      const buttons = within(document.querySelector('.cm-quiz-answer') as HTMLElement).getAllByRole('button')
      fireEvent.click(buttons[question.answer])
      expect(screen.getByText(`+10 XP!`)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /next question|see your result/i }))
    }

    expect(screen.getByRole('heading', { name: /you know how python chooses/i })).toBeInTheDocument()
    expect(screen.getByText('200', { selector: '.cm-complete-xp b' })).toBeInTheDocument()
  }, 40_000)

  it('requires all nine situations, explains both paths, and permits a complete intro replay', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Intro' }))
    fireEvent.click(screen.getByRole('button', { name: /start learning/i }))
    expect(everydayChoices).toHaveLength(9)
    for (const [index, situation] of everydayChoices.entries()) {
      expect(screen.getByRole('heading', { name: situation.title })).toBeInTheDocument()
      expect(screen.getByText(`SITUATION ${String(index + 1).padStart(2, '0')} / 09`)).toBeInTheDocument()
      expect(screen.getByLabelText(`Step ${index + 1} of 9`).children).toHaveLength(9)
      expect(screen.getByRole('img')).toBeInTheDocument()
      if (index < everydayChoices.length - 1) expect(screen.queryByRole('button', { name: 'FINISH INTRO' })).toBeNull()
      const next = screen.getByRole('button', { name: index === 8 ? /finish intro/i : /next situation/i })
      const wrong = situation.options[(situation.answer + 1) % 2]
      expect(next).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: wrong }))
      expect(next).toBeDisabled()
      expect(screen.getByText('LOOK AGAIN')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: situation.options[situation.answer] }))
      expect(next).toBeEnabled()
      expect(document.querySelector('.cm-situation-result')?.textContent).toContain(`${situation.path}${situation.path === 'TRUE' ? 'IF' : 'ELSE'}${situation.result}`)
      fireEvent.click(next)
    }
    expect(screen.getByRole('button', { name: 'Live flow' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Intro' }))
    fireEvent.click(screen.getByRole('button', { name: /start learning/i }))
    expect(screen.getByRole('heading', { name: 'A rainy day' })).toBeInTheDocument()
    expect(screen.getByText('SITUATION 01 / 09')).toBeInTheDocument()
  }, 40_000)

  it('lets a returning student choose any of the three steps', () => {
    render(<Harness initial={{ ...createSession('Maya'), choiceMachineStoriesComplete: true }} />)
    for (const name of ['Intro', 'Live flow', 'Final quiz']) expect(screen.getByRole('button', { name })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Final quiz' }))
    expect(screen.getByRole('heading', { name: /ready to choose on your own/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /start the xp quiz/i }))
    expect(screen.getByText(/question 1 \/ 20/i)).toBeInTheDocument()
  })

  it('adjusts grades by quarters, clamps at 0 and 10, and locks the arrows during a flow', () => {
    render(<Harness initial={{ ...createSession('Maya'), choiceMachineStoriesComplete: true }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Live flow' }))
    fireEvent.click(screen.getByRole('button', { name: /start live flow/i }))
    const grade = screen.getByLabelText('grade value')
    const less = screen.getByRole('button', { name: 'Decrease grade' })
    const more = screen.getByRole('button', { name: 'Increase grade' })
    expect(grade).toHaveTextContent('4.5')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.click(more)
    expect(grade).toHaveTextContent('4.75')
    fireEvent.click(less)
    expect(grade).toHaveTextContent('4.5')
    for (let tap = 0; tap < 20; tap += 1) fireEvent.click(less)
    expect(grade).toHaveTextContent('0')
    expect(less).toBeDisabled()
    for (let tap = 0; tap < 42; tap += 1) fireEvent.click(more)
    expect(grade).toHaveTextContent('10')
    expect(more).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /start flow/i }))
    expect(less).toBeDisabled()
    expect(more).toBeDisabled()
    expect(document.querySelector('.cm-story-lines')?.textContent).toContain('float(input())')
    act(() => { vi.advanceTimersByTime(900) })
    act(() => { vi.advanceTimersByTime(1000) })
    act(() => { vi.advanceTimersByTime(1000) })
    fireEvent.click(less)
    expect(grade).toHaveTextContent('9.75')
    expect(document.querySelector('.cm-flow-step')).toHaveTextContent('READY')
  }, 40_000)

  it('resumes a started quiz and lets the briefing jump to the quiz', () => {
    const returning: SessionProgress = { ...createSession('Maya'), choiceMachineStoriesComplete: true, choiceMachineQuizIndex: 4, choiceMachineXp: 40 }
    render(<Harness initial={returning} />)
    fireEvent.click(screen.getByRole('button', { name: 'Final quiz' }))
    fireEvent.click(screen.getByRole('button', { name: /start the xp quiz/i }))
    expect(screen.getByText(/question 5 \/ 20/i)).toBeInTheDocument()
  })

  it('shows the pre-experiment briefing for every story with a start button', () => {
    render(<Harness initial={{ ...createSession('Maya'), choiceMachineStoriesComplete: true }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Live flow' }))
    expect(screen.getByText('PRE-EXPERIMENT · STORY 1 OF 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start live flow/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go to the quiz/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /go to the quiz/i }))
    expect(screen.getByRole('heading', { name: /ready to choose on your own/i })).toBeInTheDocument()
  })

  it('unlocks all steps after leaving even an unfinished first visit', () => {
    let saved = createSession('Maya')
    const first = render(<ChoiceMachine progress={saved} onProgress={(value) => { saved = value }} onBack={() => {}} onNext={() => {}} />)
    expect(screen.getByRole('button', { name: 'Live flow' })).toBeDisabled()
    expect(saved.choiceMachineVisited).toBe(true)
    first.unmount()
    render(<Harness initial={saved} />)
    for (const name of ['Intro', 'Live flow', 'Final quiz']) expect(screen.getByRole('button', { name })).toBeEnabled()
  })

  it('replays a completed quiz from question one without clearing earned progress', () => {
    const initial = { ...createSession('Maya'), choiceMachineVisited: true, choiceMachineIntroComplete: true, choiceMachineStoriesComplete: true, choiceMachineQuizIndex: 20, choiceMachineXp: 200, completed: ['choice-machine'] } as SessionProgress
    const onProgress = vi.fn()
    render(<ChoiceMachine progress={initial} onProgress={onProgress} onBack={() => {}} onNext={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Final quiz' }))
    fireEvent.click(screen.getByRole('button', { name: /start the xp quiz/i }))
    expect(screen.getByText(/question 1 \/ 20/i)).toBeInTheDocument()
    const question = makeChoiceQuizQuestion(0)
    fireEvent.click(within(document.querySelector('.cm-quiz-answer') as HTMLElement).getAllByRole('button')[question.answer])
    fireEvent.click(screen.getByRole('button', { name: /next question/i }))
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ choiceMachineQuizIndex: 20, choiceMachineXp: 200, completed: ['choice-machine'] }))
  })

  it('changes values on retries for all 20 questions', () => {
    expect(CHOICE_QUIZ_LENGTH).toBe(20)
    for (let index = 0; index < CHOICE_QUIZ_LENGTH; index += 1) {
      const first = makeChoiceQuizQuestion(index, 0)
      const retry = makeChoiceQuizQuestion(index, 1)
      expect(retry.code).not.toBe(first.code)
      expect(first.answer).toBeGreaterThanOrEqual(0)
      expect(first.answer).toBeLessThan(first.options.length)
      expect(retry.options[retry.answer]).toBeTruthy()
    }
  })
})
