import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { emptyProgress } from '../../session/progressSession'
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
    expect(container.querySelector('.hypothesis-panel')?.children).toHaveLength(2)
    expect(screen.getByRole('button', { name: /test a hypothesis/i })).toBeEnabled()
  })

  it('opens the four-operations quiz after all boxes are solved', () => {
    const { container } = render(<BlackBox progress={{ ...emptyProgress, name: 'Leo', blackBoxLevels: [0, 1, 2] }} onProgress={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('OPERATIONS QUIZ')).toBeInTheDocument()
    expect(container.querySelectorAll('.memory-quiz-options button')).toHaveLength(4)
    expect(screen.getByText('print(8 + 3)')).toBeInTheDocument()
  })
})
