import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const cloud = vi.hoisted(() => ({
  loginToClassroom: vi.fn(async (username: string) => ({
    username,
    displayName: username === 'leleomaker' ? 'Leo' : `${username[0].toUpperCase()}${username.slice(1)}`,
    isTeacher: username === 'leleomaker',
    progress: null,
  })),
  saveClassroomProgress: vi.fn(async () => {}),
  loadClassProgress: vi.fn(async () => []),
}))
vi.mock('./lib/classroomCloud', () => cloud)

describe('PixPy classroom session', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('logs in with a roster username and opens every Variables experience', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Your playground is ready!' })).toBeInTheDocument()
    expect(screen.queryByText('PYTHON, BUT PLAYFUL.')).not.toBeInTheDocument()
    expect(screen.queryByText('YOUR FIRST VARIABLE')).not.toBeInTheDocument()
    expect(screen.queryByText('Your progress stays in this browser.')).not.toBeInTheDocument()
    const input = screen.getByLabelText('Enter your PixPy login')
    expect(input).toHaveAttribute('placeholder', 'firstnamelastname')
    await user.type(input, 'LeoStudent')
    await user.click(screen.getByRole('button', { name: /log in to pixpy/i }))

    expect(await screen.findByRole('heading', { name: /ready, leostudent.*let's get to work/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Conditions' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /functions coming soon/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /open .* activity list/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open Variables' }))

    expect(await screen.findByRole('heading', { name: 'Variables' })).toBeInTheDocument()
    for (const [index, title] of ['Dino Variables', 'Print Playground', 'Black Box', 'Memory Machine', 'Input Machine', 'Final Bosses'].entries()) {
      const number = String(index + 1).padStart(2, '0')
      expect(screen.getByRole('button', { name: new RegExp(`^${number} ${title}:`, 'i') })).toBeEnabled()
    }
    await user.click(screen.getByRole('button', { name: 'Open Variables activity list' }))
    expect(screen.getByRole('complementary', { name: 'Variables activities' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /print my progress/i })).not.toBeInTheDocument()
  })

  it('opens Conditions with five activities and a world-specific menu', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Enter your PixPy login'), 'MayaStudent')
    await user.click(screen.getByRole('button', { name: /log in to pixpy/i }))
    await user.click(await screen.findByRole('button', { name: 'Open Conditions' }))

    expect(screen.getByRole('heading', { name: 'Conditions' })).toBeInTheDocument()
    for (const [index, title] of ['HOW THE COMPUTER MAKES A CHOICE', 'IF/ELSE', 'MAKE IT WORK', 'MORE THAN ONE CHOICE?', 'Final Bosses'].entries()) {
      const number = String(index + 1).padStart(2, '0')
      expect(screen.getByRole('button', { name: new RegExp(`^${number} ${title.replace('?', '\\?')}:`, 'i') })).toBeEnabled()
    }
    await user.click(screen.getByRole('button', { name: 'Open Conditions activity list' }))
    const list = screen.getByRole('complementary', { name: 'Conditions activities' })
    expect(list).toHaveTextContent('IF/ELSE')
    expect(list).not.toHaveTextContent('Dino Variables')
    await user.click(screen.getByRole('button', { name: /^01 HOW THE COMPUTER MAKES A CHOICE:/i }))
    expect(screen.getByRole('heading', { name: /how the computer makes a choice/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Conditions activity list' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Every choice starts with a question/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /start learning/i }))
    expect(screen.getByRole('heading', { name: 'A rainy day' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^CONDITIONS$/i }))
    await user.click(screen.getByRole('button', { name: /all worlds/i }))
    expect(screen.queryByRole('button', { name: /open .* activity list/i })).not.toBeInTheDocument()
  }, 15_000)

  it('keeps the student name in sessionStorage after a refresh-style remount', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await user.type(screen.getByLabelText('Enter your PixPy login'), 'MayaStudent')
    await user.click(screen.getByRole('button', { name: /log in to pixpy/i }))
    expect(await screen.findByText('Mayastudent', { selector: '.student-chip strong' })).toBeInTheDocument()
    first.unmount()

    render(<App />)
    expect(await screen.findByText('Mayastudent', { selector: '.student-chip strong' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Enter your PixPy login')).not.toBeInTheDocument()
  })

  it('gives the teacher both the progress dashboard and the complete PixPy site', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Enter your PixPy login'), 'leleomaker')
    await user.click(screen.getByRole('button', { name: /log in to pixpy/i }))
    expect(await screen.findByRole('heading', { name: 'Class progress' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('button', { name: /explore/i }))
    expect(await screen.findByRole('heading', { name: /ready, leo/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open Variables' }))
    expect(await screen.findByRole('heading', { name: 'Variables' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /dashboard/i }))
    expect(await screen.findByRole('heading', { name: 'Class progress' })).toBeInTheDocument()
  })
})
