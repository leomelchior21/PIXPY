import { useEffect, useRef } from 'react'
import { publishLiveCode } from '../lib/liveCode'
import { loadSession } from '../session/progressSession'

const LIVE_DEBOUNCE_MS = 600
const LIVE_HEARTBEAT_MS = 4000

/**
 * Passive observation hook: publishes the current editor content so the
 * teacher live view can show it. Never blocks typing, never reports errors,
 * and does nothing for teachers or signed-out visitors.
 */
export function useLiveCode(module: string, code: string, detail?: string): void {
  const moduleRef = useRef(module)
  const codeRef = useRef(code)
  const detailRef = useRef<string | null>(detail ?? null)
  const lastPublishedRef = useRef<string | null>(null)

  moduleRef.current = module
  codeRef.current = code
  detailRef.current = detail ?? null

  const publishRef = useRef<() => void>(() => undefined)
  publishRef.current = () => {
    try {
      const session = loadSession()
      if (!session || session.isTeacher) return
      const current = codeRef.current
      if (current === lastPublishedRef.current) return
      lastPublishedRef.current = current
      void publishLiveCode(session.username, moduleRef.current, detailRef.current, current).catch(() => {
        if (lastPublishedRef.current === current) lastPublishedRef.current = null
      })
    } catch {
      // Observation must never interrupt the editor.
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => publishRef.current(), LIVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [module, code, detail])

  useEffect(() => {
    const session = loadSession()
    if (!session || session.isTeacher) return
    const heartbeat = window.setInterval(() => publishRef.current(), LIVE_HEARTBEAT_MS)
    return () => {
      window.clearInterval(heartbeat)
      publishRef.current()
    }
  }, [])
}
