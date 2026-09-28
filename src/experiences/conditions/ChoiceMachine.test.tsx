import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHOICE_QUIZ_LENGTH, makeChoiceQuizQuestion } from '../../data/choiceMachine'
import { createSession } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { ChoiceMachine } from './ChoiceMachine'

function Harness() {
  const [progress, setProgress] = useState<SessionProgress>(() => createSession('Maya'))
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

    expect(screen.getByText(/is the grade at least 7/i)).toBeInTheDocument()
    expect(screen.getByText('YOUR TURN')).toBeInTheDocument()
    for (const [first, second] of [['4', '7'], ['3', '8'], ['15', '18']]) {
      fireEvent.change(screen.getByLabelText(/value$/), { target: { value: first } })
      runFlow()
      expect(screen.getByRole('button', { name: /try another value/i })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /try another value/i }))
      fireEvent.change(screen.getByLabelText(/value$/), { target: { value: second } })
      runFlow()
      fireEvent.click(screen.getByRole('button', { name: /next story|open the quiz/i }))
    }

    expect(screen.getByRole('heading', { name: /ready to choose on your own/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /start the xp quiz/i }))

    const first = makeChoiceQuizQuestion(0)
    const wrong = (first.answer + 1) % first.options.length
    fireEvent.click(within(document.querySelector('.cm-quiz-answer') as HTMLElement).getAllByRole('button')[wrong])
    expect(screen.getByRole('button', { name: /try new values/i })).toBeInTheDocument()
    expect(screen.getByText('0', { selector: '.cm-xp b' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try new values/i }))
    expect(screen.getByText(/x = 2/)).toBeInTheDocument()

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
