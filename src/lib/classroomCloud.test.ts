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
})
