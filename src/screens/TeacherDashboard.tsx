import { Check, Circle, Cloud, LoaderCircle, LogOut, RefreshCcw, Search, Trophy, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Brand } from '../components/Brand'
import { variableExperiences } from '../data/variables'
import { loadClassProgress, type ClassProgressRow } from '../lib/classroomCloud'
import type { ActivityId } from '../types'

interface TeacherDashboardProps { username: string; onLogout: () => void }

export function TeacherDashboard({ username, onLogout }: TeacherDashboardProps) {
  const [students, setStudents] = useState<ClassProgressRow[]>([])
  const [query, setQuery] = useState('')
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
    if (!clean) return students
    return students.filter((student) => `${student.displayName} ${student.username}`.toLowerCase().includes(clean))
  }, [query, students])
  const started = students.filter((student) => student.progress || student.lastLoginAt).length
  const finished = students.filter((student) => completedActivities(student).length === variableExperiences.length).length
  const missions = students.reduce((total, student) => total + completedBosses(student), 0)

  return (
    <main className="teacher-dashboard">
      <header className="teacher-header">
        <Brand compact />
        <div><small>TEACHER VIEW</small><h1>Class progress</h1><p>Live PixPy progress for your private roster.</p></div>
        <div className="teacher-header-actions">
          <button onClick={() => void refresh()} disabled={loading}><RefreshCcw className={loading ? 'spin' : ''} /> Refresh</button>
          <button onClick={onLogout}><LogOut /> Log out</button>
        </div>
      </header>

      <section className="teacher-summary" aria-label="Class summary">
        <article><span><Users /></span><div><small>ROSTER</small><strong>{students.length || '—'}</strong><p>students</p></div></article>
        <article><span><Cloud /></span><div><small>STARTED</small><strong>{started}</strong><p>profiles active</p></div></article>
        <article><span><Trophy /></span><div><small>MISSIONS</small><strong>{missions}</strong><p>bosses cleared</p></div></article>
        <article><span><Check /></span><div><small>FINISHED</small><strong>{finished}</strong><p>all activities</p></div></article>
      </section>

      <section className="teacher-roster panel-surface">
        <header>
          <div><small>STUDENT PROGRESS</small><h2>Everyone at a glance</h2></div>
          <label className="teacher-search"><Search /><span className="sr-only">Search students</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a student" /></label>
        </header>

        {error ? <div className="teacher-state is-error" role="alert"><p>{error}</p><button onClick={() => void refresh()}>TRY AGAIN</button></div> : loading && students.length === 0 ? <div className="teacher-state"><LoaderCircle className="spin" /><p>Loading classroom progress…</p></div> : (
          <div className="teacher-table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Activities</th><th>Final missions</th><th>Last update</th></tr></thead>
              <tbody>
                {filtered.map((student) => {
                  const completed = completedActivities(student)
                  const bossCount = completedBosses(student)
                  return (
                    <tr key={student.username}>
                      <td><strong>{student.displayName}</strong><small>{student.username}</small></td>
                      <td><div className="teacher-activity-dots" aria-label={`${completed.length} of ${variableExperiences.length} activities complete`}>{variableExperiences.map((activity) => <span key={activity.id} className={completed.includes(activity.id) ? 'is-done' : ''} title={activity.title}>{completed.includes(activity.id) ? <Check /> : <Circle />}</span>)}</div><small>{completed.length} / {variableExperiences.length} complete</small></td>
                      <td><div className="teacher-boss-progress"><i style={{ width: `${(bossCount / 15) * 100}%` }} /></div><strong>{bossCount} / 15</strong></td>
                      <td><span className={student.progress ? 'teacher-status is-active' : 'teacher-status'}>{student.progress ? 'IN PROGRESS' : student.lastLoginAt ? 'SIGNED IN' : 'NOT STARTED'}</span><small>{formatUpdate(student.updatedAt ?? student.lastLoginAt)}</small></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="teacher-empty">No student matches “{query}”.</div>}
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
