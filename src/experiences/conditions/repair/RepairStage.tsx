import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { RepairMachineId } from '../../../data/repairShop'
import type { RepairSceneHandle, StageStyle, StageView } from './repairScene'

export type { StageStyle, StageView } from './repairScene'

interface Props {
  machine: RepairMachineId
  view: StageView
  /** ASCII art or the plain 3D render. */
  style: StageStyle
  label: string
  /** Drawn instead of the 3D machine where WebGL is missing. */
  fallback: ReactNode
  /** Labels laid over the 3D machine. */
  overlay: ReactNode
}

function supportsWebGL(): boolean {
  try {
    const probe = document.createElement('canvas')
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}

/** The machine on the workbench: a 3D scene, loaded as its own chunk, or a flat drawing without WebGL. */
export function RepairStage({ machine, view, style, label, fallback, overlay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handle = useRef<RepairSceneHandle | null>(null)
  const viewRef = useRef(view)
  const styleRef = useRef(style)
  const [webgl] = useState(supportsWebGL)
  const [mode, setMode] = useState<'loading' | '3d' | 'flat'>(webgl ? 'loading' : 'flat')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!webgl || !canvas) return
    let disposed = false
    import('./repairScene')
      .then((module) => {
        if (disposed) return
        const scene = module.createRepairScene(canvas, machine, styleRef.current)
        if (!scene) { setMode('flat'); return }
        handle.current = scene
        scene.update(viewRef.current)
        setMode('3d')
      })
      .catch(() => { if (!disposed) setMode('flat') })
    const observer = new ResizeObserver(() => handle.current?.resize())
    observer.observe(canvas)
    return () => {
      disposed = true
      observer.disconnect()
      handle.current?.dispose()
      handle.current = null
    }
  }, [machine, webgl])

  useEffect(() => {
    viewRef.current = view
    handle.current?.update(view)
  }, [view])

  useEffect(() => {
    styleRef.current = style
    handle.current?.setStyle(style)
  }, [style])

  return <div className={`rs-stage rs-stage--${mode} rs-stage--${style}`} role="img" aria-label={label}>
    {mode !== 'flat' && <canvas ref={canvasRef} className="rs-stage__canvas" />}
    {mode === 'loading' && <p className="rs-stage__loading">Wheeling the machine in…</p>}
    {mode === 'flat' ? fallback : overlay}
  </div>
}
