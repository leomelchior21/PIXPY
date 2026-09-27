import { supabase } from './classroomCloud'
import { cleanUsername } from '../session/progressSession'

export type LiveCodeClass = 'A' | 'B' | 'C'
export type LiveCodeTeam = 'white' | 'yellow'

export const LIVE_ACTIVE_WINDOW_MS = 90_000
export const LIVE_PREVIEW_MAX_CODE = 20_000

export interface LiveCodeRow {
  login: string
  displayName: string
  className: LiveCodeClass | null
  team: LiveCodeTeam | null
  module: string
  detail: string | null
  code: string
  updatedAt: string
}

export interface LiveCodeFilters {
  className: 'all' | LiveCodeClass
  team: 'all' | LiveCodeTeam | 'unassigned'
  query: string
}

function classroomClient() {
  if (!supabase || typeof supabase.rpc !== 'function') throw new Error('Live view could not reach the classroom cloud.')
  return supabase
}

export async function publishLiveCode(username: string, module: string, detail: string | null, code: string): Promise<boolean> {
  const login = cleanUsername(username)
  if (!login) return false
  const { data, error } = await classroomClient().rpc('pixpy_publish_live_code', {
    p_username: login,
    p_module: module,
    p_detail: detail,
    p_code: code.slice(0, LIVE_PREVIEW_MAX_CODE),
  })
  if (error) throw new Error('Live code could not be published.')
  return data === true
}

export async function fetchLiveCode(teacherUsername: string, after: string | null = null): Promise<LiveCodeRow[]> {
  const { data, error } = await classroomClient().rpc('pixpy_live_code', {
    p_teacher_username: cleanUsername(teacherUsername),
    p_after: after,
  })
  if (error) throw new Error('Live view could not connect. Apply the pixpy_live_code migration if it has not run yet.')
  if (!Array.isArray(data)) return []
  return data.flatMap((item) => {
    const row = toLiveCodeRow(item)
    return row ? [row] : []
  })
}

export function mergeLiveCode(current: LiveCodeRow[], incoming: LiveCodeRow[]): LiveCodeRow[] {
  if (!incoming.length) return current
  const byLogin = new Map(current.map((row) => [row.login, row]))
  let changed = false
  for (const row of incoming) {
    const existing = byLogin.get(row.login)
    if (existing && existing.updatedAt === row.updatedAt && existing.code === row.code) continue
    byLogin.set(row.login, row)
    changed = true
  }
  return changed ? sortLiveCode([...byLogin.values()]) : current
}

export function sortLiveCode(rows: LiveCodeRow[]): LiveCodeRow[] {
  return [...rows].sort((a, b) => {
    const classA = a.className ?? 'Z'
    const classB = b.className ?? 'Z'
    if (classA !== classB) return classA < classB ? -1 : 1
    const nameA = a.displayName.toLowerCase()
    const nameB = b.displayName.toLowerCase()
    if (nameA !== nameB) return nameA < nameB ? -1 : 1
    return a.login < b.login ? -1 : a.login > b.login ? 1 : 0
  })
}

export function filterLiveCode(rows: LiveCodeRow[], filters: LiveCodeFilters): LiveCodeRow[] {
  const query = filters.query.trim().toLowerCase()
  return rows.filter((row) => {
    const matchesClass = filters.className === 'all' || row.className === filters.className
    const matchesTeam = filters.team === 'all'
      || (filters.team === 'unassigned' ? row.team === null : row.team === filters.team)
    const matchesQuery = !query || `${row.displayName} ${row.login}`.toLowerCase().includes(query)
    return matchesClass && matchesTeam && matchesQuery
  })
}

export function liveAgeLabel(updatedAt: string, now: number): string {
  const timestamp = Date.parse(updatedAt)
  if (!Number.isFinite(timestamp)) return 'unknown'
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

export function isLiveCode(row: LiveCodeRow, now: number, windowMs = LIVE_ACTIVE_WINDOW_MS): boolean {
  const timestamp = Date.parse(row.updatedAt)
  return Number.isFinite(timestamp) && now - timestamp <= windowMs
}

export function latestUpdatedAt(rows: LiveCodeRow[]): string | null {
  let latest = Number.NEGATIVE_INFINITY
  let value: string | null = null
  for (const row of rows) {
    const timestamp = Date.parse(row.updatedAt)
    if (Number.isFinite(timestamp) && timestamp > latest) {
      latest = timestamp
      value = row.updatedAt
    }
  }
  return value
}

function toLiveCodeRow(item: unknown): LiveCodeRow | null {
  if (!item || typeof item !== 'object') return null
  const payload = item as Record<string, unknown>
  if (typeof payload.login !== 'string' || typeof payload.display_name !== 'string') return null
  const className = payload.class_name === 'A' || payload.class_name === 'B' || payload.class_name === 'C' ? payload.class_name : null
  const team = payload.group_name === 'white' || payload.group_name === 'yellow' ? payload.group_name : null
  return {
    login: cleanUsername(payload.login),
    displayName: payload.display_name,
    className,
    team,
    module: typeof payload.module === 'string' ? payload.module : 'stop',
    detail: typeof payload.detail === 'string' ? payload.detail : null,
    code: typeof payload.code === 'string' ? payload.code : '',
    updatedAt: typeof payload.updated_at === 'string' ? payload.updated_at : new Date(0).toISOString(),
  }
}
