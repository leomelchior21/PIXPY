import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherDashboard } from './TeacherDashboard'
import { createSession } from '../session/progressSession'
import type { SessionProgress } from '../types'

const cloud = vi.hoisted(() => ({
  loadClassProgress: vi.fn(async () => [
    { username: 'adaa', displayName: 'Ada A.', className: 'A', team: 'white', progress: { completed: ['if-else', 'backroom-run'], backroomRunGates: 3, choiceMachineXp: 40 } as SessionProgress, updatedAt: null, lastLoginAt: null },
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

  it('switches the dashboard between the Variables and Conditions worlds', async () => {
    const user = userEvent.setup()
    render(<TeacherDashboard username="leleomaker" />)
    await screen.findByRole('heading', { name: '4 students in view' })

    expect(screen.getByRole('button', { name: 'Variables' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('columnheader', { name: 'Final missions' })).toBeInTheDocument()
    expect(screen.getByText('MISSIONS')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Conditions' }))

    expect(screen.getByRole('button', { name: 'Conditions' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('columnheader', { name: 'Backroom gates' })).toBeInTheDocument()
    expect(screen.getByText('GATES')).toBeInTheDocument()
    expect(screen.getByText('backroom gates')).toBeInTheDocument()
    expect(screen.getByLabelText('2 of 3 activities complete')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Choice lab' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'IF/ELSE reasoning' })).toBeInTheDocument()
    expect(screen.getByText('3 gates')).toBeInTheDocument()
    expect(screen.getByText('10 / 10 levels solved')).toBeInTheDocument()
    expect(screen.getByText(/Choice XP 40 \/ 200/)).toBeInTheDocument()
  })

  it('counts only available activities and reports steps, reasoning, and endless run totals', async () => {
    const progress = { ...createSession('Ada'), completed: ['backroom-run', 'choice-machine', 'if-else', 'make-it-work', 'if-else'] as SessionProgress['completed'], backroomRunGates: 18, backroomRunBest: 12, backroomRunXp: 450, choiceMachineXp: 200, ifElseLearning: [
      { level: 7, mode: 'debug', kind: 'check' as const, attempt: 1, value: 12, prediction: null, actualOutput: 'Wrong branch', conditionResult: false, errorKind: 'logic' as const, at: 1 },
      { level: 10, mode: 'independent', kind: 'prediction' as const, attempt: 0, value: 12, prediction: 'TRUE', actualOutput: null, conditionResult: null, errorKind: null, at: 2 },
      { level: 10, mode: 'independent', kind: 'check' as const, attempt: 1, value: 12, prediction: 'TRUE', actualOutput: 'Correct output', conditionResult: true, errorKind: null, at: 3 },
    ] }
    cloud.loadClassProgress.mockResolvedValueOnce([{ username: 'adaa', displayName: 'Ada A.', className: 'A', team: 'white', progress, updatedAt: null, lastLoginAt: null }])
    const user = userEvent.setup()
    render(<TeacherDashboard username="leleomaker" />)
    await screen.findByRole('heading', { name: '1 student in view' })
    await user.click(screen.getByRole('button', { name: 'Conditions' }))
    expect(screen.getByLabelText('3 of 3 activities complete')).toBeInTheDocument()
    expect(screen.getByText('18 gates')).toBeInTheDocument()
    expect(screen.getByText('Best run: 12 · 450 XP')).toBeInTheDocument()
    expect(screen.getByText('20 / 20 quiz questions')).toBeInTheDocument()
    expect(screen.getByText('COMPLETE')).toBeInTheDocument()
    expect(screen.getByText('1 / 1 matched Python', { exact: false })).toBeInTheDocument()
    expect(screen.getByTitle('Intro: complete')).toBeInTheDocument()
    expect(screen.getByTitle('Live flow: complete')).toBeInTheDocument()
    expect(screen.queryByTitle('MAKE IT WORK')).not.toBeInTheDocument()
    expect(screen.queryByText('Last check: Logic error')).not.toBeInTheDocument()
  })
})
