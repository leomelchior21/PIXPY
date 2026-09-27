import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TeacherLiveView } from './TeacherLiveView'
import type { LiveCodeRow } from '../lib/liveCode'

const api = vi.hoisted(() => ({ fetchLiveCode: vi.fn() }))

vi.mock('../lib/liveCode', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/liveCode')>(),
  fetchLiveCode: api.fetchLiveCode,
}))

function row(overrides: Partial<LiveCodeRow> & { login: string }): LiveCodeRow {
  return {
    displayName: overrides.login,
    className: 'A',
    team: 'white',
    module: 'stop',
    detail: 'STOP · String Sheet',
    code: 'name = "Ada"\nprint(name)',
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('TeacherLiveView', () => {
  beforeEach(() => { api.fetchLiveCode.mockReset() })
  afterEach(cleanup)

  it('loads the grid, counts active students and shows module labels', async () => {
    api.fetchLiveCode.mockResolvedValue([
      row({ login: 'adaa', displayName: 'Ada A.' }),
      row({ login: 'abeb', displayName: 'Abe B.', className: 'B', team: 'yellow', detail: 'Boss 03 · Difference', module: 'final-bosses' }),
      row({ login: 'beab', displayName: 'Bea B.', className: 'B', team: null, updatedAt: new Date(Date.now() - 4 * 60_000).toISOString() }),
    ])
    render(<TeacherLiveView username="leleomaker" onBack={() => undefined} />)

    expect(await screen.findByText('Ada A.')).toBeInTheDocument()
    expect(screen.getByText('Abe B.')).toBeInTheDocument()
    expect(screen.getByText('Bea B.')).toBeInTheDocument()
    expect(screen.getByText('2 ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('LIVE')).toBeInTheDocument()
    expect(screen.getAllByText('STOP · String Sheet')).toHaveLength(2)
    expect(screen.getByText('Boss 03 · Difference')).toBeInTheDocument()
    expect(api.fetchLiveCode).toHaveBeenCalledWith('leleomaker', null)
  })

  it('filters by class, team and search with live rows', async () => {
    const user = userEvent.setup()
    api.fetchLiveCode.mockResolvedValue([
      row({ login: 'adaa', displayName: 'Ada A.' }),
      row({ login: 'abeb', displayName: 'Abe B.', className: 'B', team: 'yellow' }),
    ])
    render(<TeacherLiveView username="leleomaker" onBack={() => undefined} />)
    await screen.findByText('Ada A.')

    await user.click(screen.getByRole('button', { name: 'B' }))
    await waitFor(() => expect(screen.queryByText('Ada A.')).not.toBeInTheDocument())
    expect(screen.getByText('Abe B.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Yellow' }))
    expect(screen.getByText('Abe B.')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search a student'), 'ada')
    expect(await screen.findByText('No students match these filters.')).toBeInTheDocument()
  })

  it('opens the full code modal and closes it with Escape', async () => {
    const user = userEvent.setup()
    api.fetchLiveCode.mockResolvedValue([row({ login: 'adaa', displayName: 'Ada A.', code: 'name = "Ada"\nprint("hello")' })])
    render(<TeacherLiveView username="leleomaker" onBack={() => undefined} />)
    await screen.findByText('Ada A.')

    await user.click(screen.getByRole('button', { name: /Open Ada A\.'s code/ }))
    const dialog = screen.getByRole('dialog', { name: 'Ada A. code' })
    expect(dialog).toHaveTextContent('print("hello")')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the empty state when nobody is typing and the error state with a retry', async () => {
    api.fetchLiveCode.mockResolvedValue([])
    render(<TeacherLiveView username="leleomaker" onBack={() => undefined} />)
    expect(await screen.findByText('No students typing right now.')).toBeInTheDocument()

    cleanup()
    api.fetchLiveCode.mockRejectedValue(new Error('Live view could not connect. Apply the pixpy_live_code migration if it has not run yet.'))
    render(<TeacherLiveView username="leleomaker" onBack={() => undefined} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('pixpy_live_code migration')
    expect(screen.getByRole('button', { name: 'TRY AGAIN' })).toBeInTheDocument()
  })

  it('renders many cards in a stable order', async () => {
    const students = Array.from({ length: 40 }, (_, index) => row({
      login: `student${String(index).padStart(2, '0')}`,
      displayName: `Student ${String(index).padStart(2, '0')}`,
      className: index % 3 === 0 ? 'B' : 'A',
    }))
    api.fetchLiveCode.mockResolvedValue(students)
    render(<TeacherLiveView username="leleomaker" onBack={() => undefined} />)
    await screen.findByText('Student 00')

    const cards = screen.getAllByRole('button', { name: /Open Student/ })
    expect(cards).toHaveLength(40)
    const grid = screen.getByRole('main')
    expect(within(grid).getByText('40 ACTIVE')).toBeInTheDocument()
  })
})
