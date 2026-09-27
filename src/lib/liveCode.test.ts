import { liveAgeLabel, LIVE_ACTIVE_WINDOW_MS, filterLiveCode, isLiveCode, latestUpdatedAt, mergeLiveCode, type LiveCodeRow } from './liveCode'

const rpc = vi.hoisted(() => vi.fn())

vi.mock('./classroomCloud', () => ({ supabase: { rpc } }))

function row(overrides: Partial<LiveCodeRow> & { login: string }): LiveCodeRow {
  return {
    displayName: overrides.login,
    className: null,
    team: null,
    module: 'stop',
    detail: 'STOP · String Sheet',
    code: '',
    updatedAt: '2026-09-27T10:00:00.000Z',
    ...overrides,
  }
}

describe('live code merge', () => {
  it('appends new students and replaces existing rows by login', () => {
    const current = [row({ login: 'adaa', displayName: 'Ada' }), row({ login: 'abeb', displayName: 'Abe' })]
    const merged = mergeLiveCode(current, [row({ login: 'abeb', displayName: 'Abe', code: 'print(1)', updatedAt: '2026-09-27T10:00:05.000Z' })])
    expect(merged).toHaveLength(2)
    expect(merged.find((item) => item.login === 'abeb')?.code).toBe('print(1)')

    const added = mergeLiveCode(merged, [row({ login: 'beab', displayName: 'Bea' })])
    expect(added.map((item) => item.login)).toEqual(['abeb', 'adaa', 'beab'])
  })

  it('keeps the same array reference when nothing changed and sorts by class then name', () => {
    const current = [row({ login: 'beab', displayName: 'Bea', className: 'B' }), row({ login: 'adaa', displayName: 'Ada', className: 'A' })]
    expect(mergeLiveCode(current, [])).toBe(current)
    const touched = mergeLiveCode(current, [row({ login: 'zzzz', displayName: 'Zed', className: 'C' })])
    expect(touched.map((item) => item.className)).toEqual(['A', 'B', 'C'])
  })
})

describe('live code filters', () => {
  const rows = [
    row({ login: 'adaa', displayName: 'Ada A.', className: 'A', team: 'white' }),
    row({ login: 'abeb', displayName: 'Abe B.', className: 'A', team: 'yellow' }),
    row({ login: 'beab', displayName: 'Bea B.', className: 'B', team: null }),
  ]

  it('filters by class, team and search text', () => {
    expect(filterLiveCode(rows, { className: 'A', team: 'all', query: '' }).map((item) => item.login)).toEqual(['adaa', 'abeb'])
    expect(filterLiveCode(rows, { className: 'all', team: 'white', query: '' }).map((item) => item.login)).toEqual(['adaa'])
    expect(filterLiveCode(rows, { className: 'all', team: 'unassigned', query: '' }).map((item) => item.login)).toEqual(['beab'])
    expect(filterLiveCode(rows, { className: 'all', team: 'all', query: 'ada' }).map((item) => item.login)).toEqual(['adaa'])
    expect(filterLiveCode(rows, { className: 'C', team: 'all', query: '' })).toEqual([])
  })
})

describe('live age labels', () => {
  const now = Date.parse('2026-09-27T10:00:00.000Z')

  it('formats just now, seconds, minutes and hours', () => {
    expect(liveAgeLabel('2026-09-27T10:00:00.000Z', now)).toBe('just now')
    expect(liveAgeLabel('2026-09-27T09:59:48.000Z', now)).toBe('12s ago')
    expect(liveAgeLabel('2026-09-27T09:57:00.000Z', now)).toBe('3m ago')
    expect(liveAgeLabel('2026-09-27T08:00:00.000Z', now)).toBe('2h ago')
    expect(liveAgeLabel('not-a-date', now)).toBe('unknown')
  })

  it('marks rows active only inside the live window', () => {
    expect(isLiveCode(row({ login: 'adaa', updatedAt: '2026-09-27T09:59:00.000Z' }), now)).toBe(true)
    expect(isLiveCode(row({ login: 'adaa', updatedAt: new Date(now - LIVE_ACTIVE_WINDOW_MS - 1000).toISOString() }), now)).toBe(false)
  })

  it('finds the latest update timestamp', () => {
    expect(latestUpdatedAt([
      row({ login: 'adaa', updatedAt: '2026-09-27T09:00:00.000Z' }),
      row({ login: 'abeb', updatedAt: '2026-09-27T09:30:00.000Z' }),
      row({ login: 'beab', updatedAt: '2026-09-27T09:15:00.000Z' }),
    ])).toBe('2026-09-27T09:30:00.000Z')
    expect(latestUpdatedAt([])).toBeNull()
  })
})

describe('live code transport', () => {
  it('maps teacher rows and rejects with a migration hint on error', async () => {
    const { fetchLiveCode } = await import('./liveCode')
    rpc.mockResolvedValueOnce({
      data: [{
        login: 'adaa',
        display_name: 'Ada A.',
        class_name: 'A',
        group_name: 'white',
        module: 'stop',
        detail: 'STOP · String Sheet',
        code: 'name = "Ada"',
        updated_at: '2026-09-27T10:00:00.000Z',
      }],
      error: null,
    })
    const rows = await fetchLiveCode('leleomaker')
    expect(rows).toEqual([expect.objectContaining({ login: 'adaa', displayName: 'Ada A.', className: 'A', team: 'white' })])
    expect(rpc).toHaveBeenCalledWith('pixpy_live_code', { p_teacher_username: 'leleomaker', p_after: null })

    rpc.mockResolvedValueOnce({ data: null, error: { message: 'missing' } })
    await expect(fetchLiveCode('leleomaker')).rejects.toThrow(/pixpy_live_code migration/)
  })

  it('publishes the student row with a capped code payload', async () => {
    const { publishLiveCode, LIVE_PREVIEW_MAX_CODE } = await import('./liveCode')
    rpc.mockResolvedValueOnce({ data: true, error: null })
    await expect(publishLiveCode('Ada A.', 'stop', 'STOP · String Sheet', 'x'.repeat(LIVE_PREVIEW_MAX_CODE + 500))).resolves.toBe(true)
    const call = rpc.mock.calls.at(-1) as [string, { p_username: string; p_module: string; p_code: string }]
    expect(call[0]).toBe('pixpy_publish_live_code')
    expect(call[1]).toMatchObject({ p_username: 'adaa', p_module: 'stop' })
    expect(call[1].p_code).toHaveLength(LIVE_PREVIEW_MAX_CODE)
  })
})
