import { Check, Circle, LoaderCircle, RefreshCcw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { variableExperiences } from '../data/variables'
import { conditionExperiences } from '../data/conditions'
import { CHOICE_QUIZ_LENGTH, CHOICE_XP_PER_QUESTION } from '../data/choiceMachine'
import { ifElsePedagogy } from '../data/ifElsePedagogy'
import { milestoneGates } from '../lib/backroomEngine'
import { conditionsProgress } from '../lib/conditionsProgress'
import { loadClassProgress, type ClassProgressRow, type RosterClass, type RosterTeam } from '../lib/classroomCloud'
import type { ActivityId } from '../types'
import './teacherDashboard.css'

interface TeacherDashboardProps { username: string }
type ClassFilter = 'all' | RosterClass
type TeamFilter = 'all' | RosterTeam | 'unassigned'
type WorldId = 'variables' | 'conditions'

interface WorldExperience { id: ActivityId; title: string }

const availableConditions = conditionExperiences.filter((activity) => !activity.disabled)
const upcomingConditions = conditionExperiences.filter((activity) => activity.disabled).length

const worldOptions: Array<{ id: WorldId; label: string; experiences: WorldExperience[] }> = [
  { id: 'variables', label: 'Variables', experiences: variableExperiences },
  { id: 'conditions', label: 'Conditions', experiences: availableConditions },
]

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
  { value: 'external', label: 'External users' },
  { value: 'unassigned', label: 'No team' },
]

export function TeacherDashboard({ username }: TeacherDashboardProps) {
  const [students, setStudents] = useState<ClassProgressRow[]>([])
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState<ClassFilter>('all')
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all')
  const [world, setWorld] = useState<WorldId>('variables')
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

  const activeWorld = worldOptions.find((option) => option.id === world) ?? worldOptions[0]
  const countClass = (value: ClassFilter) => value === 'all' ? students.length : students.filter((student) => student.className === value).length
  const countTeam = (value: TeamFilter) => value === 'all'
    ? students.length
    : students.filter((student) => value === 'unassigned' ? student.team === null : student.team === value).length

  return (
    <main className="teacher-dashboard">
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

      <section className={`teacher-roster panel-surface ${world === 'conditions' ? 'teacher-roster--conditions' : ''}`}>
        <header>
          <div><small>STUDENT PROGRESS</small><h2>{filtered.length} {filtered.length === 1 ? 'student' : 'students'} in view</h2>{world === 'conditions' && <p className="teacher-roster-caption">{availableConditions.length} available activities · {upcomingConditions} coming later · Recent IF/ELSE practice</p>}</div>
          <div className="teacher-roster-tools">
            <button className="teacher-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCcw className={loading ? 'spin' : ''} /> Refresh</button>
            <div className="teacher-world-switch" role="group" aria-label="World progress">
              {worldOptions.map((option) => <button key={option.id} className={world === option.id ? 'is-active' : ''} aria-pressed={world === option.id} onClick={() => setWorld(option.id)}>{option.label}</button>)}
            </div>
            <label className="teacher-search"><Search /><span className="sr-only">Search students</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a student" /></label>
          </div>
        </header>

        {error ? <div className="teacher-state is-error" role="alert"><p>{error}</p><button onClick={() => void refresh()}>TRY AGAIN</button></div> : loading && students.length === 0 ? <div className="teacher-state"><LoaderCircle className="spin" /><p>Loading classroom progress…</p></div> : (
          <div className="teacher-table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Group</th><th>Activities</th><th>{world === 'variables' ? 'Final missions' : 'Backroom gates'}</th>{world === 'conditions' && <><th>Choice lab</th><th>IF/ELSE reasoning</th></>}<th>Last update</th></tr></thead>
              <tbody>
                {filtered.map((student) => {
                  const completed = completedActivities(student, activeWorld.experiences)
                  const bossCount = completedBosses(student)
                  const learning = conditionsProgress(student.progress)
                  const isFinished = completed.length === activeWorld.experiences.length
                  return (
                    <tr key={student.username}>
                      <td><strong>{student.displayName}</strong><small>{student.username}</small></td>
                      <td><div className="teacher-group-badges"><span>{student.team === 'external' ? 'EXTERNAL' : `CLASS ${student.className ?? '—'}`}</span><span className={`team-${student.team ?? 'unassigned'}`}>{student.team === 'external' ? 'External users' : student.team ?? 'No team'}</span></div></td>
                      <td><div className="teacher-activity-dots" aria-label={`${completed.length} of ${activeWorld.experiences.length} activities complete`}>{activeWorld.experiences.map((activity) => <span key={activity.id} className={completed.includes(activity.id) ? 'is-done' : ''} title={activity.title}>{completed.includes(activity.id) ? <Check /> : <Circle />}</span>)}</div><small>{completed.length} / {activeWorld.experiences.length} complete</small></td>
                      <td>
                        {world === 'variables'
                          ? <><div className="teacher-boss-progress"><i style={{ width: `${(bossCount / 15) * 100}%` }} /></div><strong>{bossCount} / 15</strong></>
                          : <div className="teacher-learning-cell"><strong>{learning.gates} gates</strong><small>Best run: {learning.bestRun} · {learning.runXp} XP</small><span className={learning.gates >= milestoneGates ? 'teacher-milestone is-done' : 'teacher-milestone'}>{learning.gates >= milestoneGates ? <><Check size={11} /> {milestoneGates}-gate milestone reached</> : `${learning.gates} / ${milestoneGates} to the first milestone`}</span></div>}
                      </td>
                      {world === 'conditions' && <>
                        <td><div className="teacher-learning-cell"><div className="teacher-choice-steps" aria-label="Choice lab steps">{[{ title: 'Intro', done: learning.introComplete }, { title: 'Live flow', done: learning.liveComplete }, { title: 'Quiz', done: learning.quizComplete }].map((step) => <span key={step.title} className={step.done ? 'is-done' : ''} title={`${step.title}: ${step.done ? 'complete' : 'not complete'}`}>{step.done ? <Check size={10} /> : <Circle size={10} />}{step.title}</span>)}</div><strong>{learning.quizIndex} / {CHOICE_QUIZ_LENGTH} quiz questions</strong><small className="teacher-choice-xp">Choice XP {learning.choiceXp} / {CHOICE_QUIZ_LENGTH * CHOICE_XP_PER_QUESTION}</small></div></td>
                        <td><div className="teacher-learning-cell"><strong>{learning.solvedLevels} / {ifElsePedagogy.length} levels solved</strong><div className="teacher-level-track" aria-hidden="true"><i style={{ width: `${learning.solvedLevels / ifElsePedagogy.length * 100}%` }} /></div><small>{learning.ifElseComplete ? 'Activity complete' : learning.lastLevel ? `L${learning.lastLevel} · ${learning.lastMode}` : 'No practice recorded'}</small>{learning.lastError && <span className="teacher-learning-error">Last check: {learning.lastError}</span>}<small>{learning.checkCount} checks · {learning.hints} hints{learning.testedPredictions > 0 && <><br />Predictions: {learning.matchedPredictions} / {learning.testedPredictions} matched Python</>}</small></div></td>
                      </>}
                      <td><span className={isFinished || student.progress ? 'teacher-status is-active' : 'teacher-status'}>{isFinished ? 'COMPLETE' : student.progress ? 'IN PROGRESS' : student.lastLoginAt ? 'SIGNED IN' : 'NOT STARTED'}</span><small>{formatUpdate(student.updatedAt ?? student.lastLoginAt)}</small></td>
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

function completedActivities(student: ClassProgressRow, experiences: WorldExperience[]): ActivityId[] {
  const value = student.progress?.completed
  return Array.isArray(value) ? [...new Set(value.filter((item): item is ActivityId => experiences.some((activity) => activity.id === item)))] : []
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
