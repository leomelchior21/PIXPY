import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherDashboard } from './TeacherDashboard'

const cloud = vi.hoisted(() => ({
  loadClassProgress: vi.fn(async () => [
    { username: 'adaa', displayName: 'Ada A.', className: 'A', team: 'white', progress: { completed: ['if-else', 'backroom-run'], backroomRunGates: 3, choiceMachineXp: 40 }, updatedAt: null, lastLoginAt: null },
    { username: 'abeb', displayName: 'Abe B.', className: 'A', team: 'yellow', progress: null, updatedAt: null, lastLoginAt: null },
    { username: 'beab', displayName: 'Bea B.', className: 'B', team: 'white', progress: null, updatedAt: null, lastLoginAt: null },
    { username: 'calec', displayName: 'Cale C.', className: 'C', team: null, progress: null, updatedAt: null, lastLoginAt: null },
  ]),
}))

vi.mock('../lib/classroomCloud', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/classroomCloud')>(),
  loadClassProgress: cloud.loadClassProgress,
}))

describe('TeacherDashboard', () => {
  it('filters the roster by class and team without hiding unassigned students', async () => {
    const user = userEvent.setup()
    render(<TeacherDashboard username="leleomaker" onOpenLive={() => undefined} />)

    expect(await screen.findByRole('heading', { name: '4 students in view' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Class A.*2/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /White.*2/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /No team.*1/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Class A.*2/ }))
    expect(await screen.findByRole('heading', { name: '2 students in view' })).toBeInTheDocument()
    expect(screen.getByText('Ada A.')).toBeInTheDocument()
    expect(screen.getByText('Abe B.')).toBeInTheDocument()
    expect(screen.queryByText('Bea B.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /White.*2/ }))
    expect(await screen.findByRole('heading', { name: '1 student in view' })).toBeInTheDocument()
    expect(screen.getByText('Ada A.')).toBeInTheDocument()
    expect(screen.queryByText('Abe B.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /No team.*1/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: '0 students in view' })).toBeInTheDocument())
    expect(screen.getByText('No students match these filters.')).toBeInTheDocument()
  })

  it('switches the dashboard between the Variables and Conditions worlds', async () => {
    const user = userEvent.setup()
    render(<TeacherDashboard username="leleomaker" onOpenLive={() => undefined} />)
    await screen.findByRole('heading', { name: '4 students in view' })

    expect(screen.getByRole('button', { name: 'Variables' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('columnheader', { name: 'Final missions' })).toBeInTheDocument()
    expect(screen.getByText('MISSIONS')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Conditions' }))

    expect(screen.getByRole('button', { name: 'Conditions' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('columnheader', { name: 'Backroom gates' })).toBeInTheDocument()
    expect(screen.getByText('GATES')).toBeInTheDocument()
    expect(screen.getByText('backroom gates')).toBeInTheDocument()
    expect(screen.getByLabelText('2 of 6 activities complete')).toBeInTheDocument()
    expect(screen.getByText('3 / 5 gates')).toBeInTheDocument()
    expect(screen.getByText(/Choice XP 40 \/ 200/)).toBeInTheDocument()
  })
})
