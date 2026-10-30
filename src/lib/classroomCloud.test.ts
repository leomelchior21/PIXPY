import { loadClassProgress } from './classroomCloud'
import { createSession } from '../session/progressSession'

const cloud = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => cloud }))

it('preserves the external users group without assigning a seventh-grade class', async () => {
  cloud.rpc.mockResolvedValueOnce({
    data: [{ username: 'gueststudent', display_name: 'Guest Student', class_name: null, group_name: 'external' }],
    error: null,
  })

  expect(await loadClassProgress('leleomaker')).toEqual([{
    username: 'gueststudent',
    displayName: 'Guest Student',
    className: null,
    team: 'external',
    progress: null,
    updatedAt: null,
    lastLoginAt: null,
  }])
})

describe('progress saving', () => {
  const ok = () => ({ abortSignal: () => Promise.resolve({ data: true, error: null }) })
  const down = () => ({ abortSignal: () => Promise.resolve({ data: null, error: { message: 'timeout' } }) })
  const saved = () => cloud.rpc.mock.calls.filter(([name]) => name === 'pixpy_save_progress').map(([, args]) => args.p_progress.stopCode)

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    cloud.rpc.mockReset()
  })
  afterEach(() => { vi.useRealTimers() })

  it('sends only the newest snapshot after a burst of typing, and skips unchanged progress', async () => {
    const { saveClassroomProgress } = await import('./classroomCloud')
    cloud.rpc.mockImplementation(ok)
    const base = createSession('Maya')
    const saves = ['p', 'pr', 'pri', 'prin', 'print'].map((stopCode) => saveClassroomProgress({ ...base, stopCode }))
    expect(saved()).toEqual([])
    await vi.advanceTimersByTimeAsync(1500)
    await Promise.all(saves)
    expect(saved()).toEqual(['print'])

    await saveClassroomProgress({ ...base, stopCode: 'print' })
    await vi.advanceTimersByTimeAsync(5000)
    expect(saved()).toEqual(['print'])
  })

  it('retries with the latest progress after the cloud fails, and reports the late save', async () => {
    const { saveClassroomProgress, onProgressSaved } = await import('./classroomCloud')
    const listener = vi.fn()
    onProgressSaved(listener)
    cloud.rpc.mockImplementation(down)
    const base = createSession('Maya')
    const first = saveClassroomProgress({ ...base, stopCode: 'a' })
    const failed = expect(first).rejects.toThrow(/cloud sync is waiting/)
    await vi.advanceTimersByTimeAsync(1500)
    await failed
    void saveClassroomProgress({ ...base, stopCode: 'ab' }).catch(() => undefined)
    // The newer change waits for the retry instead of hitting the stuck database again.
    await vi.advanceTimersByTimeAsync(1500)
    expect(saved()).toEqual(['a'])

    cloud.rpc.mockImplementation(ok)
    await vi.advanceTimersByTimeAsync(5000)
    expect(saved()).toEqual(['a', 'ab'])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('saves Backroom tape stars, keeps run stats on the device until the tab is hidden', async () => {
    const { saveClassroomProgress, flushClassroomProgress } = await import('./classroomCloud')
    cloud.rpc.mockImplementation(ok)
    const sent = () => cloud.rpc.mock.calls.map(([, args]) => [args.p_progress.backroomRunGates, args.p_progress.backroomLevelStars[0]])
    const base = createSession('Maya')
    await Promise.all([saveClassroomProgress(base), vi.advanceTimersByTimeAsync(1500)])
    for (let gates = 1; gates <= 30; gates++) void saveClassroomProgress({ ...base, backroomRunGates: gates, backroomRunXp: gates * 10 })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(sent()).toEqual([[0, 0]])

    void saveClassroomProgress({ ...base, backroomRunGates: 31, backroomLevelStars: [3, ...base.backroomLevelStars.slice(1)] })
    await vi.advanceTimersByTimeAsync(1500)
    expect(sent()).toEqual([[0, 0], [31, 3]])

    void saveClassroomProgress({ ...base, backroomRunGates: 40, backroomLevelStars: [3, ...base.backroomLevelStars.slice(1)] })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(sent()).toHaveLength(2)
    await flushClassroomProgress()
    expect(sent()).toEqual([[0, 0], [31, 3], [40, 3]])
    await flushClassroomProgress()
    expect(sent()).toHaveLength(3)
  })

  it('keeps a full pause between saves while the student keeps changing things', async () => {
    const { saveClassroomProgress } = await import('./classroomCloud')
    let finish = () => {}
    cloud.rpc.mockImplementation(() => ({ abortSignal: () => new Promise((resolve) => { finish = () => resolve({ data: true, error: null }) }) }))
    const base = createSession('Maya')
    void saveClassroomProgress({ ...base, stopCode: 'a' })
    await vi.advanceTimersByTimeAsync(1500)
    void saveClassroomProgress({ ...base, stopCode: 'ab' })
    finish()
    await vi.advanceTimersByTimeAsync(1400)
    expect(saved()).toEqual(['a'])
    await vi.advanceTimersByTimeAsync(100)
    expect(saved()).toEqual(['a', 'ab'])
  })
})
