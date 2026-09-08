import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { emptyProgress } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { BlackBox } from './BlackBox'

describe('Black Box activity', () => {
  it('puts a clean physical box between random numbers and keeps clues only below it', async () => {
    const user = userEvent.setup()
    const { container } = render(<BlackBox progress={{ ...emptyProgress, name: 'Leo' }} onProgress={vi.fn()} onBack={vi.fn()} />)

    expect(container.querySelector('.physical-black-box')).toHaveTextContent('UNKNOWN RULE')
    expect(container.querySelector('.box-bolts')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /touch the black box/i }))
    await user.click(screen.getByRole('button', { name: /touch the black box/i }))

    const pairs = [...container.querySelectorAll('.sample-rack > div > span')]
    expect(pairs).toHaveLength(2)
    pairs.forEach((pair) => {
      const numbers = pair.textContent?.match(/\d+/g)?.map(Number) ?? []
      expect(numbers[1]).toBe(numbers[0] * 6)
    })
    expect(container.querySelector('.hypothesis-panel')?.children).toHaveLength(3)
    expect(screen.getByRole('button', { name: /test a hypothesis/i })).toBeEnabled()
  })

  it('preserves the evidence when a hypothesis misses so the learner can revise it', async () => {
    const user = userEvent.setup()
    const { container } = render(<BlackBox progress={{ ...emptyProgress, name: 'Leo' }} onProgress={vi.fn()} onBack={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /touch the black box/i }))
    await user.click(screen.getByRole('button', { name: /touch the black box/i }))
    await user.click(screen.getByRole('button', { name: /test a hypothesis/i }))
    await user.click(screen.getByRole('button', { name: /number \+ 6/i }))
    await user.click(screen.getByRole('button', { name: /run my rule/i }))

    expect(container.querySelectorAll('.sample-rack > div > span')).toHaveLength(2)
    expect(screen.getByText(/check the clue/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /run my rule/i })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /number \* 6/i }))
    await user.click(screen.getByRole('button', { name: /run my rule/i }))
    expect(screen.getByText(/you cracked it/i)).toBeInTheDocument()
  })

  it('opens the four-operations quiz behind a start button with a side timer', async () => {
    const user = userEvent.setup()
    let latest: SessionProgress = { ...emptyProgress, name: 'Leo', blackBoxLevels: [0, 1, 2] }

    function Harness() {
      const [progress, setProgress] = useState(latest)
      return <BlackBox progress={progress} onProgress={(next) => { latest = next; setProgress(next) }} onBack={vi.fn()} />
    }

    const { container } = render(<Harness />)
    expect(screen.getByText(/quiz unlocked/i)).toBeInTheDocument()
    expect(screen.getByText(/press start when ready/i)).toBeInTheDocument()
    expect(container.querySelector('.blackbox-quiz-layout')).toBeInTheDocument()
    expect(container.querySelector('.blackbox-quiz-timer')).toHaveTextContent('0:00')

    await user.click(screen.getByRole('button', { name: /start quiz/i }))

    expect(container.querySelectorAll('.memory-quiz-options button')).toHaveLength(4)
    expect(screen.getByText(/print\(\d+ \+ \d+\)/)).toBeInTheDocument()
  })

  it('records score and time after the last quiz answer, then allows a new attempt with new values', async () => {
    vi.useFakeTimers()
    let latest: SessionProgress = { ...emptyProgress, name: 'Leo', blackBoxLevels: [0, 1, 2] }

    function Harness() {
      const [progress, setProgress] = useState(latest)
      return <BlackBox progress={progress} onProgress={(next) => { latest = next; setProgress(next) }} onBack={vi.fn()} />
    }

    try {
      render(<Harness />)
      fireEvent.click(screen.getByRole('button', { name: /start quiz/i }))
      const firstCode = screen.getByText(/print\(\d+ \+ \d+\)/).textContent

      for (let index = 0; index < 10; index += 1) {
        const firstOption = document.querySelector('.memory-quiz-options button:nth-child(1)') as HTMLButtonElement
        fireEvent.click(firstOption)
        await act(async () => vi.advanceTimersByTime(5000))
        expect(document.querySelector('.memory-quiz-header > strong')).toHaveTextContent(`${index + 1}/10`)
        fireEvent.click(screen.getByRole('button', { name: index === 9 ? /see results/i : /next question/i }))
      }

      expect(screen.getByText('BLACK BOX QUIZ COMPLETE')).toBeInTheDocument()
      expect(screen.getByText(/correct in/)).toBeInTheDocument()
      expect(latest.blackBoxQuizResults).toHaveLength(1)
      expect(latest.completed).toContain('black-box')

      fireEvent.click(screen.getByRole('button', { name: /try again/i }))
      fireEvent.click(screen.getByRole('button', { name: /start quiz/i }))
      expect(screen.getByText(/print\(\d+ \+ \d+\)/).textContent).not.toBe(firstCode)
    } finally {
      vi.useRealTimers()
    }
  })
})
