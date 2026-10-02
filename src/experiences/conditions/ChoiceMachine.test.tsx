import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHOICE_QUIZ_LENGTH, makeChoiceQuizQuestion } from '../../data/choiceMachine'
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

  it('teaches three real situations, two typed paths per story, then opens the 20-question XP quiz', () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { name: /every choice starts with a question/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /start learning/i }))

    expect(screen.getByRole('heading', { name: 'A rainy day' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /rain falling/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Leave the umbrella' }))
    expect(screen.getByRole('button', { name: /next situation/i })).toBeDisabled()
    expect(screen.getByText('LOOK AGAIN')).toBeInTheDocument()

    for (const answer of ['Take an umbrella', 'Show an error', 'Approved']) {
      fireEvent.click(screen.getByRole('button', { name: answer }))
      fireEvent.click(screen.getByRole('button', { name: /next situation|open the live flow/i }))
    }

    expect(screen.getByRole('heading', { name: 'The school result' })).toBeInTheDocument()
    expect(screen.getByText('PRE-EXPERIMENT · STORY 1 OF 3')).toBeInTheDocument()
    expect(screen.getByText(/is the grade at least 7/i)).toBeInTheDocument()
    const storyValues = [['4', '7'], ['3', '8'], ['15', '18']]
    storyValues.forEach(([first, second], index) => {
      fireEvent.click(screen.getByRole('button', { name: /start live flow/i }))
      expect(screen.getByText('YOUR TURN')).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText(/value$/), { target: { value: first } })
      runFlow()
      expect(screen.getByRole('button', { name: /try another value/i })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /try another value/i }))
      fireEvent.change(screen.getByLabelText(/value$/), { target: { value: second } })
      runFlow()
      fireEvent.click(screen.getByRole('button', { name: /next story|open the quiz/i }))
      if (index < storyValues.length - 1) expect(screen.getByText(`PRE-EXPERIMENT · STORY ${index + 2} OF 3`)).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: /ready to choose on your own/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /start the xp quiz/i }))

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

  it('lets a returning student open the quiz directly from the intro', () => {
    render(<Harness initial={{ ...createSession('Maya'), choiceMachineStoriesComplete: true }} />)
    expect(screen.getByRole('button', { name: /open the quiz/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /review the live flows/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /open the quiz/i }))
    expect(screen.getByRole('heading', { name: /ready to choose on your own/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /start the xp quiz/i }))
    expect(screen.getByText(/question 1 \/ 20/i)).toBeInTheDocument()
  })

  it('resumes a started quiz and lets the briefing jump to the quiz', () => {
    const returning: SessionProgress = { ...createSession('Maya'), choiceMachineStoriesComplete: true, choiceMachineQuizIndex: 4, choiceMachineXp: 40 }
    render(<Harness initial={returning} />)
    fireEvent.click(screen.getByRole('button', { name: /continue quiz/i }))
    expect(screen.getByText(/question 5 \/ 20/i)).toBeInTheDocument()
  })

  it('shows the pre-experiment briefing for every story with a start button', () => {
    render(<Harness initial={{ ...createSession('Maya'), choiceMachineStoriesComplete: true }} />)
    fireEvent.click(screen.getByRole('button', { name: /review the live flows/i }))
    expect(screen.getByText('PRE-EXPERIMENT · STORY 1 OF 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start live flow/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go to the quiz/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /go to the quiz/i }))
    expect(screen.getByRole('heading', { name: /ready to choose on your own/i })).toBeInTheDocument()
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
