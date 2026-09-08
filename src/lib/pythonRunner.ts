import { validateDinoValues } from './dinoValidation'
import { runGuidedPython } from './guidedPython'
import type { DinoRunResult, DinoValues, RuntimeState, ScriptRunResult } from '../types'

type StateListener = (state: RuntimeState) => void

interface PendingRun {
  resolve: (value: ScriptRunResult) => void
  reject: (reason: Error) => void
  timeout: number
  code: string
  inputs: string[]
}

class PythonRunner {
  private worker: Worker | null = null
  private state: RuntimeState = 'booting'
  private nextId = 1
  private pending = new Map<number, PendingRun>()
  private listeners = new Set<StateListener>()

  constructor() {
    if (typeof Worker !== 'undefined') this.createWorker()
    else this.state = 'unavailable'
  }

  private createWorker() {
    this.worker = new Worker(new URL('../workers/python.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent) => {
      const message = event.data as { type: string; id?: number; result?: string; error?: string }
      if (message.type === 'ready') this.setState('ready')
      if (message.type === 'boot-error') this.setState('unavailable')
      if ((message.type === 'result' || message.type === 'error') && message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        window.clearTimeout(pending.timeout)
        this.pending.delete(message.id)
        if (message.type === 'error') {
          if (this.state === 'unavailable' || /fetch|network|load/i.test(message.error ?? '')) {
            try { pending.resolve(runGuidedPython(pending.code, pending.inputs)) }
            catch (error) { pending.reject(error instanceof Error ? error : new Error(String(error))) }
          } else {
            pending.reject(new Error(cleanPythonError(message.error ?? 'Python could not run that code.')))
          }
        } else {
          try {
            pending.resolve(JSON.parse(message.result ?? '{}') as ScriptRunResult)
          } catch {
            pending.reject(new Error('Python returned something PixPy could not read.'))
          }
        }
      }
    }
    this.worker.onerror = () => this.setState('unavailable')
  }

  private setState(next: RuntimeState) {
    this.state = next
    this.listeners.forEach((listener) => listener(next))
  }

  getState() {
    return this.state
  }

  subscribe(listener: StateListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  runScript(code: string, inputs: string[] = []): Promise<ScriptRunResult> {
    if (!this.worker || this.state === 'unavailable') {
      return Promise.resolve(runGuidedPython(code, inputs))
    }
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(id)
        // A first download can be slow on classroom Wi-Fi. Keep loading Python
        // while the small-program runner answers this request locally.
        if (this.state === 'booting' || this.state === 'unavailable') {
          try { resolve(runGuidedPython(code, inputs)) }
          catch (error) { reject(error instanceof Error ? error : new Error(String(error))) }
          return
        }
        this.worker?.terminate()
        this.setState('booting')
        this.createWorker()
        reject(new Error('That code took too long, so PixPy stopped it safely.'))
      }, 6000)
      this.pending.set(id, { resolve, reject, timeout, code, inputs })
      this.worker?.postMessage({ type: 'run', id, code, inputs })
    })
  }

  async runDino(code: string): Promise<DinoRunResult> {
    const result = await this.runScript(code)
    return validateDinoValues(result.variables as Partial<Record<keyof DinoValues, unknown>>)
  }
}

function cleanPythonError(error: string): string {
  const lines = error.split('\n').map((line) => line.trim()).filter(Boolean)
  const useful = [...lines].reverse().find((line) => /(?:Error|missing|number|input|available)/i.test(line))
  return useful?.replace(/^PythonError:\s*/, '') ?? 'Python could not understand that yet.'
}

export const pythonRunner = new PythonRunner()
