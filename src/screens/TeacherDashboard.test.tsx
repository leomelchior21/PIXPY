import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherDashboard } from './TeacherDashboard'

const cloud = vi.hoisted(() => ({
  loadClassProgress: vi.fn(async () => [
    { username: 'adaa', displayName: 'Ada A.', className: 'A', team: 'white', progress: null, updatedAt: null, lastLoginAt: null },
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
    render(<TeacherDashboard username="leleomaker" />)

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
})
