import { useEffect } from 'react'

interface Props {
  /** The corridor has drawn its first frame. */
  done: boolean
  onGone: () => void
}

/**
 * The loading tape shown while the corridor is built. Building it blocks the page for a few
 * seconds, so everything here moves with transform and opacity only: those animations keep
 * running on the compositor while the main thread is busy.
 */
export function BackroomBoot({ done, onGone }: Props) {
  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(onGone, 650)
    return () => window.clearTimeout(timer)
  }, [done, onGone])

  return <div className={`br-boot ${done ? 'is-done' : ''}`} role="status" aria-label={done ? 'Tape loaded' : 'Loading Backrooms Run'}>
    <div className="br-boot__noise" aria-hidden="true"><i /><i /></div>
    <div className="br-boot__cassette" aria-hidden="true">
      <div className="br-boot__label"><b>BACKROOMS RUN</b><small>PIXPY HOME VIDEO · SP</small></div>
      <div className="br-boot__window">
        <span className="br-boot__reel"><i /><i /><i /></span>
        <span className="br-boot__tape" />
        <span className="br-boot__reel"><i /><i /><i /></span>
      </div>
    </div>
    <p className="br-boot__status"><span className="br-boot__dot" />{done ? 'PLAY ▶' : 'LOADING TAPE'}</p>
    <div className="br-boot__bar" aria-hidden="true"><span /></div>
    <small className="br-boot__hint">Building the corridor…</small>
  </div>
}
