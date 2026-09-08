import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('PixPy classroom session', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('asks only for a name and opens every Variables experience', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Your playground is ready!' })).toBeInTheDocument()
    expect(screen.queryByText('PYTHON, BUT PLAYFUL.')).not.toBeInTheDocument()
    expect(screen.queryByText('YOUR FIRST VARIABLE')).not.toBeInTheDocument()
    expect(screen.queryByText('Your progress stays in this browser.')).not.toBeInTheDocument()
    const input = screen.getByLabelText('What should we call you?')
    expect(input).toHaveAttribute('placeholder', 'insert your name')
    await user.type(input, 'Leo')
    await user.click(screen.getByRole('button', { name: /let's go/i }))

    expect(await screen.findByRole('heading', { name: /ready, leo.*let's get to work/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /conditionals coming soon/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /functions coming soon/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Open Variables' }))

    expect(await screen.findByRole('heading', { name: 'Variables' })).toBeInTheDocument()
    for (const [index, title] of ['Dino Variables', 'Print Playground', 'Black Box', 'Input Machine', 'Memory Machine', 'Build a Black Box', 'Final Bosses'].entries()) {
      const number = String(index + 1).padStart(2, '0')
      expect(screen.getByRole('button', { name: new RegExp(`^${number} ${title}:`, 'i') })).toBeEnabled()
    }
    await user.click(screen.getByRole('button', { name: 'Open Variables activity list' }))
    expect(screen.getByRole('complementary', { name: 'Variables activities' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /print my progress/i })).not.toBeInTheDocument()
  })

  it('keeps the student name in sessionStorage after a refresh-style remount', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await user.type(screen.getByLabelText('What should we call you?'), 'Maya')
    await user.click(screen.getByRole('button', { name: /let's go/i }))
    expect(await screen.findByText('Maya', { selector: '.student-chip strong' })).toBeInTheDocument()
    first.unmount()

    render(<App />)
    expect(await screen.findByText('Maya', { selector: '.student-chip strong' })).toBeInTheDocument()
    expect(screen.queryByLabelText("WHAT'S YOUR NAME?")).not.toBeInTheDocument()
  })
})
