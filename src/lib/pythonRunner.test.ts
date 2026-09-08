import { runGuidedPython } from './guidedPython'

vi.mock('./guidedPython', () => ({ runGuidedPython: vi.fn() }))

class ClassroomWorker {
  static latest: ClassroomWorker
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { ClassroomWorker.latest = this }
  message(data: unknown) { this.onmessage?.({ data } as MessageEvent) }
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.stubGlobal('Worker', ClassroomWorker)
  vi.mocked(runGuidedPython).mockReset()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('answers a slow first load locally while keeping the Python download alive', async () => {
  vi.mocked(runGuidedPython).mockReturnValue({ stdout: '18', variables: {} })
  const { pythonRunner } = await import('./pythonRunner')
  const worker = ClassroomWorker.latest
  const request = pythonRunner.runScript('print(9 * 2)')
  await vi.advanceTimersByTimeAsync(6000)
  await expect(request).resolves.toMatchObject({ stdout: '18' })
  expect(worker.terminate).not.toHaveBeenCalled()
  worker.message({ type: 'ready' })
  expect(pythonRunner.getState()).toBe('ready')
})

it('rejects a fallback syntax error instead of leaving a run permanently pending', async () => {
  vi.mocked(runGuidedPython).mockImplementation(() => { throw new Error('Check your formula.') })
  const { pythonRunner } = await import('./pythonRunner')
  const request = pythonRunner.runScript('result =')
  const rejection = expect(request).rejects.toThrow('Check your formula.')
  ClassroomWorker.latest.message({ type: 'boot-error' })
  ClassroomWorker.latest.message({ type: 'error', id: 1, error: 'Network load failed' })
  await rejection
})
