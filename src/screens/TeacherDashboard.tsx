import { Check, Circle, Cloud, LoaderCircle, RefreshCcw, Search, Trophy, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { variableExperiences } from '../data/variables'
import { loadClassProgress, type ClassProgressRow, type RosterClass, type RosterTeam } from '../lib/classroomCloud'
import type { ActivityId } from '../types'

interface TeacherDashboardProps { username: string }
type ClassFilter = 'all' | RosterClass
type TeamFilter = 'all' | RosterTeam | 'unassigned'

const classOptions: Array<{ value: ClassFilter; label: string }> = [
  { value: 'all', label: 'All classes' },
  { value: 'A', label: 'Class A' },
  { value: 'B', label: 'Class B' },
  { value: 'C', label: 'Class C' },
]

const teamOptions: Array<{ value: TeamFilter; label: string }> = [
  { value: 'all', label: 'All teams' },
  { value: 'white', label: 'White' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'unassigned', label: 'No team' },
]

export function TeacherDashboard({ username }: TeacherDashboardProps) {
  const [students, setStudents] = useState<ClassProgressRow[]>([])
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState<ClassFilter>('all')
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setStudents(await loadClassProgress(username))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Class progress could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => { void refresh() }, [refresh])

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()
    return students.filter((student) => {
      const matchesClass = classFilter === 'all' || student.className === classFilter
      const matchesTeam = teamFilter === 'all'
        || (teamFilter === 'unassigned' ? student.team === null : student.team === teamFilter)
      const matchesSearch = !clean || `${student.displayName} ${student.username}`.toLowerCase().includes(clean)
      return matchesClass && matchesTeam && matchesSearch
    })
  }, [classFilter, query, students, teamFilter])

  const started = students.filter((student) => student.progress || student.lastLoginAt).length
  const finished = students.filter((student) => completedActivities(student).length === variableExperiences.length).length
  const missions = students.reduce((total, student) => total + completedBosses(student), 0)
  const countClass = (value: ClassFilter) => value === 'all' ? students.length : students.filter((student) => student.className === value).length
  const countTeam = (value: TeamFilter) => value === 'all'
    ? students.length
    : students.filter((student) => value === 'unassigned' ? student.team === null : student.team === value).length

  return (
    <main className="teacher-dashboard">
      <header className="teacher-header">
        <div><small>TEACHER DASHBOARD</small><h1>Class progress</h1><p>Live progress across every PixPy class and team.</p></div>
        <button className="teacher-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCcw className={loading ? 'spin' : ''} /> Refresh</button>
      </header>

      <section className="teacher-summary" aria-label="Class summary">
        <article><span><Users /></span><div><small>ROSTER</small><strong>{students.length || '—'}</strong><p>students</p></div></article>
        <article><span><Cloud /></span><div><small>STARTED</small><strong>{started}</strong><p>profiles active</p></div></article>
        <article><span><Trophy /></span><div><small>MISSIONS</small><strong>{missions}</strong><p>bosses cleared</p></div></article>
        <article><span><Check /></span><div><small>FINISHED</small><strong>{finished}</strong><p>all activities</p></div></article>
      </section>

      <section className="teacher-cohorts panel-surface" aria-label="Roster groups">
        <div className="teacher-filter-group">
          <span>CLASSES</span>
          <div>{classOptions.map((option) => <button key={option.value} className={classFilter === option.value ? 'is-active' : ''} aria-pressed={classFilter === option.value} onClick={() => setClassFilter(option.value)}>{option.label}<b>{countClass(option.value)}</b></button>)}</div>
        </div>
        <div className="teacher-filter-group teacher-filter-group--teams">
          <span>TEAMS</span>
          <div>{teamOptions.map((option) => <button key={option.value} className={`${teamFilter === option.value ? 'is-active' : ''} team-${option.value}`} aria-pressed={teamFilter === option.value} onClick={() => setTeamFilter(option.value)}>{option.label}<b>{countTeam(option.value)}</b></button>)}</div>
        </div>
      </section>

      <section className="teacher-roster panel-surface">
        <header>
          <div><small>STUDENT PROGRESS</small><h2>{filtered.length} {filtered.length === 1 ? 'student' : 'students'} in view</h2></div>
          <label className="teacher-search"><Search /><span className="sr-only">Search students</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a student" /></label>
        </header>

        {error ? <div className="teacher-state is-error" role="alert"><p>{error}</p><button onClick={() => void refresh()}>TRY AGAIN</button></div> : loading && students.length === 0 ? <div className="teacher-state"><LoaderCircle className="spin" /><p>Loading classroom progress…</p></div> : (
          <div className="teacher-table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Group</th><th>Activities</th><th>Final missions</th><th>Last update</th></tr></thead>
              <tbody>
                {filtered.map((student) => {
                  const completed = completedActivities(student)
                  const bossCount = completedBosses(student)
                  return (
                    <tr key={student.username}>
                      <td><strong>{student.displayName}</strong><small>{student.username}</small></td>
                      <td><div className="teacher-group-badges"><span>CLASS {student.className ?? '—'}</span><span className={`team-${student.team ?? 'unassigned'}`}>{student.team ?? 'No team'}</span></div></td>
                      <td><div className="teacher-activity-dots" aria-label={`${completed.length} of ${variableExperiences.length} activities complete`}>{variableExperiences.map((activity) => <span key={activity.id} className={completed.includes(activity.id) ? 'is-done' : ''} title={activity.title}>{completed.includes(activity.id) ? <Check /> : <Circle />}</span>)}</div><small>{completed.length} / {variableExperiences.length} complete</small></td>
                      <td><div className="teacher-boss-progress"><i style={{ width: `${(bossCount / 15) * 100}%` }} /></div><strong>{bossCount} / 15</strong></td>
                      <td><span className={student.progress ? 'teacher-status is-active' : 'teacher-status'}>{student.progress ? 'IN PROGRESS' : student.lastLoginAt ? 'SIGNED IN' : 'NOT STARTED'}</span><small>{formatUpdate(student.updatedAt ?? student.lastLoginAt)}</small></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="teacher-empty">No students match these filters.</div>}
          </div>
        )}
      </section>
    </main>
  )
}

function completedActivities(student: ClassProgressRow): ActivityId[] {
  const value = student.progress?.completed
  return Array.isArray(value) ? value.filter((item): item is ActivityId => variableExperiences.some((activity) => activity.id === item)) : []
}

function completedBosses(student: ClassProgressRow): number {
  const value = student.progress?.bossProgress
  return Array.isArray(value) ? new Set(value.filter((item) => Number.isInteger(item) && item >= 1 && item <= 15)).size : 0
}

function formatUpdate(value: string | null): string {
  if (!value) return 'No activity yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}
