import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { emptyProgress } from '../../session/progressSession'
import { BlackBox } from './BlackBox'

describe('Black Box activity', () => {
  it('puts a physical box between the numbers and keeps clues only below it', async () => {
    const user = userEvent.setup()
    const { container } = render(<BlackBox progress={{ ...emptyProgress, name: 'Leo' }} onProgress={vi.fn()} onBack={vi.fn()} />)

    expect(container.querySelector('.physical-black-box')).toHaveTextContent('UNKNOWN RULE')
    await user.click(screen.getByRole('button', { name: /touch the black box/i }))
    await user.click(screen.getByRole('button', { name: /touch the black box/i }))

    expect(container.querySelector('.sample-rack')).toHaveTextContent('2 → 12')
    expect(container.querySelector('.sample-rack')).toHaveTextContent('7 → 42')
    expect(container.querySelector('.hypothesis-panel')).not.toHaveTextContent('2 → 12')
    expect(container.querySelector('.hypothesis-panel')?.children).toHaveLength(2)
    expect(screen.getByRole('button', { name: /test a hypothesis/i })).toBeEnabled()
  })
})
