import { validateDinoConfig } from './dinoValidation'
import type { DinoConfig, PythonRunResult } from '../types'

type RuntimeState = 'booting' | 'ready' | 'unavailable'
type StateListener = (state: RuntimeState) => void

interface PendingRun {
  resolve: (value: PythonRunResult) => void
  reject: (reason: Error) => void
  timeout: number
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
          pending.reject(new Error(cleanPythonError(message.error ?? 'Python could not run that code.')))
        } else {
          try {
            const parsed = JSON.parse(message.result ?? '{}') as DinoConfig
            pending.resolve(validateDinoConfig(parsed))
          } catch (error) {
            pending.reject(error instanceof Error ? error : new Error('The result was not valid.'))
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
    return () => {
      this.listeners.delete(listener)
    }
  }

  run(code: string): Promise<PythonRunResult> {
    if (!this.worker || this.state === 'unavailable') {
      return Promise.reject(new Error('The Python engine is offline. Check the connection and try again.'))
    }
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(id)
        this.worker?.terminate()
        this.setState('booting')
        this.createWorker()
        reject(new Error('That code took too long, so PixPy stopped it safely.'))
      }, 6000)
      this.pending.set(id, { resolve, reject, timeout })
      this.worker?.postMessage({ type: 'run', id, code })
    })
  }
}

function cleanPythonError(error: string): string {
  const lines = error.split('\n').map((line) => line.trim()).filter(Boolean)
  const useful = [...lines].reverse().find((line) => /(?:Error|missing|number)/.test(line))
  return useful?.replace(/^PythonError:\s*/, '') ?? 'Python could not understand that yet.'
}

export const pythonRunner = new PythonRunner()
