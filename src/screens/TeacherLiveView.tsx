import { ArrowLeft, CircleAlert, KeyRound, LoaderCircle, Radio, RefreshCcw, Search, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { fetchLiveCode, filterLiveCode, isLiveCode, latestUpdatedAt, liveAgeLabel, mergeLiveCode, type LiveCodeClass, type LiveCodeRow, type LiveCodeTeam } from '../lib/liveCode'
import { LIVE_TEACHER_EMAIL, getLiveTeacherSession, signInLiveTeacher, subscribeLiveCode, type LiveRealtimeStatus } from '../lib/liveRealtime'
import { highlightPythonLines, type HighlightSpan } from '../lib/pythonHighlight'
import './teacherLive.css'

interface Props {
  username: string
  onBack: () => void
}

type ClassFilter = 'all' | LiveCodeClass
type TeamFilter = 'all' | LiveCodeTeam | 'unassigned'
type Connection = 'connecting' | 'live' | 'error'

const REFRESH_MS = 2000
const PREVIEW_LINES = 12

const classOptions: Array<{ value: ClassFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
]

const teamOptions: Array<{ value: TeamFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'white', label: 'White' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'unassigned', label: 'No team' },
]

function CodeLines({ lines, limit }: { lines: HighlightSpan[][]; limit?: number }) {
  const visible = limit ? lines.slice(0, limit) : lines
  return (
    <pre className="live-code">
      {visible.map((line, index) => (
        <span key={index} className="live-code__line">
          {line.length === 0 ? '\u00a0' : line.map((span, spanIndex) => <span key={spanIndex} className={span.className ?? undefined}>{span.text}</span>)}
        </span>
      ))}
    </pre>
  )
}

const LiveCodeCard = memo(function LiveCodeCard({ row, now, onOpen }: { row: LiveCodeRow; now: number; onOpen: (row: LiveCodeRow) => void }) {
  const lines = useMemo(() => highlightPythonLines(row.code), [row.code])
  const live = isLiveCode(row, now)
  const faded = lines.length > PREVIEW_LINES
  return (
    <button className={`live-card ${live ? 'is-live' : ''}`} onClick={() => onOpen(row)} aria-label={`Open ${row.displayName}'s code`}>
      <header className="live-card__head">
        <strong>{row.displayName}</strong>
        <span>{row.className ? `CLASS ${row.className}` : 'CLASS —'} · {row.team ?? 'No team'}</span>
      </header>
      <div className="live-card__meta">
        <em>{row.detail ?? row.module}</em>
        <small>{liveAgeLabel(row.updatedAt, now)}</small>
      </div>
      {row.code.trim()
        ? <div className={`live-card__preview ${faded ? 'is-faded' : ''}`}><CodeLines lines={lines} limit={PREVIEW_LINES} /></div>
        : <p className="live-card__empty">Empty editor</p>}
      {faded && <span className="live-card__more">+{lines.length - PREVIEW_LINES} more lines</span>}
    </button>
  )
})

export function TeacherLiveView({ username, onBack }: Props) {
  const [rows, setRows] = useState<LiveCodeRow[]>([])
  const [connection, setConnection] = useState<Connection>('connecting')
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [classFilter, setClassFilter] = useState<ClassFilter>('all')
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<LiveCodeRow | null>(null)
  const [reload, setReload] = useState(0)
  const [realtime, setRealtime] = useState<LiveRealtimeStatus>('off')
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [unlockEmail, setUnlockEmail] = useState(LIVE_TEACHER_EMAIL)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [unlockBusy, setUnlockBusy] = useState(false)
  const afterRef = useRef<string | null>(null)
  const busyRef = useRef(false)
  const realtimeRef = useRef<LiveRealtimeStatus>('off')
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const load = useCallback(async (full: boolean) => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      if (full) afterRef.current = null
      const incoming = await fetchLiveCode(username, afterRef.current)
      setRows((current) => mergeLiveCode(current, incoming))
      const latest = latestUpdatedAt(incoming)
      if (latest) afterRef.current = latest
      setConnection('live')
      setError('')
    } catch (reason) {
      setConnection('error')
      setError(reason instanceof Error ? reason.message : 'Live view could not connect.')
    } finally {
      busyRef.current = false
    }
  }, [username])

  const startRealtime = useCallback(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = subscribeLiveCode(
      (row) => {
        setRows((current) => mergeLiveCode(current, [row]))
        if (!afterRef.current || Date.parse(row.updatedAt) > Date.parse(afterRef.current)) afterRef.current = row.updatedAt
        setNow(Date.now())
      },
      (status) => {
        realtimeRef.current = status
        setRealtime(status)
      },
    )
  }, [])

  useEffect(() => {
    let active = true
    void getLiveTeacherSession().then((session) => { if (active && session) startRealtime() })
    return () => {
      active = false
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [startRealtime])

  useEffect(() => {
    void load(true)
    const poller = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || realtimeRef.current === 'live') return
      void load(false)
    }, REFRESH_MS)
    const ticker = window.setInterval(() => setNow(Date.now()), 2000)
    const onVisibility = () => { if (document.visibilityState === 'visible') void load(false) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(poller)
      window.clearInterval(ticker)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load, reload])

  useEffect(() => {
    if (!selected && !unlockOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSelected(null)
      setUnlockOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected, unlockOpen])

  const openRealtime = () => {
    void (async () => {
      const session = await getLiveTeacherSession()
      if (session) startRealtime()
      else {
        setUnlockError('')
        setUnlockEmail(LIVE_TEACHER_EMAIL)
        setUnlockOpen(true)
      }
    })()
  }

  const unlockRealtime = async (event: FormEvent) => {
    event.preventDefault()
    setUnlockBusy(true)
    setUnlockError('')
    try {
      await signInLiveTeacher(unlockEmail, unlockPassword)
      setUnlockOpen(false)
      setUnlockPassword('')
      startRealtime()
    } catch (reason) {
      setUnlockError(reason instanceof Error ? reason.message : 'Unlock failed.')
    } finally {
      setUnlockBusy(false)
    }
  }

  const activeCount = useMemo(() => rows.filter((row) => isLiveCode(row, now)).length, [rows, now])
  const visible = useMemo(() => filterLiveCode(rows, { className: classFilter, team: teamFilter, query }), [rows, classFilter, teamFilter, query])
  const selectedLines = useMemo(() => selected ? highlightPythonLines(selected.code) : [], [selected])

  return (
    <main className="live-screen">
      <header className="live-header">
        <button className="live-back" onClick={onBack}><ArrowLeft size={17} /> DASHBOARD</button>
        <div className="live-title"><small>TEACHER</small><h1>Live view</h1></div>
        <div className="live-actions">
          {realtime === 'live'
            ? <span className="live-realtime is-live" role="status"><i />REALTIME</span>
            : <button className={`live-realtime is-${realtime}`} onClick={openRealtime} aria-label={`Realtime ${realtime}. Unlock streaming`}><KeyRound size={14} /> REALTIME {realtime === 'connecting' ? '…' : 'OFF'}</button>}
          <span className={`live-connection is-${connection}`} role="status"><i />{connection === 'live' ? (realtime === 'live' ? 'STREAMING' : 'LIVE') : connection === 'connecting' ? 'CONNECTING' : 'OFFLINE'}</span>
          <span className="live-counter"><i />{activeCount} ACTIVE</span>
          <button className="live-refresh" onClick={() => setReload((value) => value + 1)} disabled={connection === 'connecting' && rows.length === 0}><RefreshCcw className={connection === 'connecting' ? 'spin' : ''} size={16} /> REFRESH</button>
        </div>
      </header>

      <section className="live-toolbar panel-surface" aria-label="Live view filters">
        <div className="teacher-filter-group">
          <span>CLASSES</span>
          <div>{classOptions.map((option) => <button key={option.value} className={classFilter === option.value ? 'is-active' : ''} aria-pressed={classFilter === option.value} onClick={() => setClassFilter(option.value)}>{option.label}</button>)}</div>
        </div>
        <div className="teacher-filter-group teacher-filter-group--teams">
          <span>TEAMS</span>
          <div>{teamOptions.map((option) => <button key={option.value} className={`${teamFilter === option.value ? 'is-active' : ''} team-${option.value}`} aria-pressed={teamFilter === option.value} onClick={() => setTeamFilter(option.value)}>{option.label}</button>)}</div>
        </div>
        <label className="teacher-search"><Search /><span className="sr-only">Search students</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a student" /></label>
      </section>

      <section className="live-stage">
        {error ? (
          <div className="live-state is-error" role="alert">
            <CircleAlert size={30} />
            <p>{error}</p>
            <button onClick={() => setReload((value) => value + 1)}>TRY AGAIN</button>
          </div>
        ) : rows.length === 0 && connection === 'connecting' ? (
          <div className="live-state"><LoaderCircle className="spin" size={28} /><p>Connecting to the classroom…</p></div>
        ) : rows.length === 0 ? (
          <div className="live-state"><Radio size={30} /><p>No students typing right now.</p><small>As soon as someone edits any PixPy editor, their code appears here.</small></div>
        ) : visible.length === 0 ? (
          <div className="live-state"><p>No students match these filters.</p></div>
        ) : (
          <div className="live-grid">
            {visible.map((row) => <LiveCodeCard key={row.login} row={row} now={now} onOpen={setSelected} />)}
          </div>
        )}
      </section>

      {selected && (
        <div className="live-modal" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
          <section className="live-modal__panel" role="dialog" aria-modal="true" aria-label={`${selected.displayName} code`}>
            <header>
              <div>
                <small>{selected.className ? `CLASS ${selected.className}` : 'CLASS —'} · {selected.team ?? 'No team'}</small>
                <h2>{selected.displayName}</h2>
                <p>{selected.detail ?? selected.module} · {liveAgeLabel(selected.updatedAt, now)}</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close code view"><X size={18} /></button>
            </header>
            {selected.code.trim() ? <CodeLines lines={selectedLines} /> : <p className="live-modal__empty">Empty editor.</p>}
          </section>
        </div>
      )}

      {unlockOpen && (
        <div className="live-modal" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setUnlockOpen(false) }}>
          <form className="live-unlock" role="dialog" aria-modal="true" aria-label="Unlock realtime streaming" onSubmit={(event) => { void unlockRealtime(event) }}>
            <header>
              <div><small>REALTIME</small><h2>Unlock live view</h2><p>Sign in once on this device to stream student code instead of polling.</p></div>
              <button type="button" onClick={() => setUnlockOpen(false)} aria-label="Close unlock"><X size={18} /></button>
            </header>
            <label className="live-unlock__field"><span>Teacher email</span><input type="email" value={unlockEmail} onChange={(event) => setUnlockEmail(event.target.value)} autoComplete="username" required /></label>
            <label className="live-unlock__field"><span>Password</span><input type="password" value={unlockPassword} onChange={(event) => setUnlockPassword(event.target.value)} autoComplete="current-password" required /></label>
            {unlockError && <p className="live-unlock__error" role="alert">{unlockError}</p>}
            <button type="submit" className="live-unlock__submit" disabled={unlockBusy}>{unlockBusy ? <LoaderCircle className="spin" size={16} /> : <KeyRound size={16} />} UNLOCK</button>
          </form>
        </div>
      )}
    </main>
  )
}
