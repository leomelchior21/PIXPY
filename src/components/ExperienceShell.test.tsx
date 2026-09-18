import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExperienceShell } from './ExperienceShell'

const baseProps = {
  order: '03',
  title: 'Black Box',
  question: 'How can a value go through a calculation?',
  accent: '#fe6f8f',
  hints: ['First hint'],
  completed: false,
  objective: 'Crack the box.',
  onBack: () => undefined,
}

describe('ExperienceShell banner', () => {
  afterEach(cleanup)

  it('shows the experiment metadata as a three-line title block', () => {
    const { container } = render(<ExperienceShell {...baseProps}><p>Activity</p></ExperienceShell>)
    const title = container.querySelector('.experience-title')
    expect(title).toHaveTextContent('EXPERIMENT 03 / 06')
    expect(title).toHaveTextContent('Black Box')
    expect(title).toHaveTextContent('How can a value go through a calculation?')
  })

  it('offers reset only when the activity provides it', async () => {
    const onReset = vi.fn()
    const { rerender } = render(<ExperienceShell {...baseProps} onReset={onReset}><p>Activity</p></ExperienceShell>)
    await userEvent.click(screen.getByRole('button', { name: /reset level/i }))
    expect(onReset).toHaveBeenCalledOnce()

    rerender(<ExperienceShell {...baseProps}><p>Activity</p></ExperienceShell>)
    expect(screen.queryByRole('button', { name: /reset level/i })).not.toBeInTheDocument()
  })
})
