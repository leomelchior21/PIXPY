import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { buildStopStarter } from './lib/stopAnalyzer'

vi.mock('./components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label?: string }) => (
    <textarea aria-label={label ?? 'Python code editor'} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))

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
    expect(screen.getByRole('button', { name: 'Open Extras' })).toBeEnabled()
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

  it('opens Conditions with six activities and a world-specific menu', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Enter your PixPy login'), 'MayaStudent')
    await user.click(screen.getByRole('button', { name: /log in to pixpy/i }))
    await user.click(await screen.findByRole('button', { name: 'Open Conditions' }))

    expect(screen.getByRole('heading', { name: 'Conditions' })).toBeInTheDocument()
    for (const [index, title] of ['BACKROOM RUN', 'HOW THE COMPUTER MAKES A CHOICE', 'IF/ELSE', 'MAKE IT WORK', 'MORE THAN ONE CHOICE?', 'Final Bosses'].entries()) {
      const number = String(index + 1).padStart(2, '0')
      expect(screen.getByRole('button', { name: new RegExp(`^${number} ${title.replace('?', '\\?')}:`, 'i') })).toBeEnabled()
    }
    await user.click(screen.getByRole('button', { name: 'Open Conditions activity list' }))
    const list = screen.getByRole('complementary', { name: 'Conditions activities' })
    expect(list).toHaveTextContent('IF/ELSE')
    expect(list).not.toHaveTextContent('Dino Variables')
    await user.click(screen.getByRole('button', { name: /^02 HOW THE COMPUTER MAKES A CHOICE:/i }))
    expect(screen.getByText('INTRO', { selector: '.cm-phase-label' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Conditions activity list' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Every choice starts with a question/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /start learning/i }))
    expect(screen.getByRole('heading', { name: 'A rainy day' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^CONDITIONS$/i }))
    await user.click(screen.getByRole('button', { name: /all worlds/i }))
    expect(screen.queryByRole('button', { name: /open .* activity list/i })).not.toBeInTheDocument()
  }, 15_000)

  it('opens Extras with the STOP string sheet', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Enter your PixPy login'), 'MayaStudent')
    await user.click(screen.getByRole('button', { name: /log in to pixpy/i }))
    await user.click(await screen.findByRole('button', { name: 'Open Extras' }))

    expect(screen.getByRole('heading', { name: 'Extras' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^01 STOP · STRING SHEET:/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /DINO VARIABLES/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /BACKROOM RUN/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^01 STOP · STRING SHEET:/i }))
    expect(await screen.findByRole('heading', { name: 'STOP' }, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.getByText('STOP SHEET')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open extras activity list/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /run/i })).toBeEnabled()
    expect(screen.getByLabelText('STOP sheet code editor')).toHaveValue(buildStopStarter('Mayastudent'))
    await user.click(screen.getByRole('button', { name: /^EXTRAS$/i }))
    expect(await screen.findByRole('heading', { name: 'Extras' })).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: '0 students in view' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('button', { name: /explore/i }))
    expect(await screen.findByRole('heading', { name: /ready, leo/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open Variables' }))
    expect(await screen.findByRole('heading', { name: 'Variables' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /dashboard/i }))
    expect(await screen.findByRole('heading', { name: '0 students in view' })).toBeInTheDocument()
  })
})
