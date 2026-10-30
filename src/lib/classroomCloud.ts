import { createClient } from '@supabase/supabase-js'
import type { SessionProgress } from '../types'
import { cleanUsername } from '../session/progressSession'

const supabaseUrl = 'https://imodobxbarcsjylvitxt.supabase.co'
const supabasePublishableKey = 'sb_publishable_jkHrLZkNR4Zh3XtHEgpTMA_JnMMpG6w'

const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

// The Backroom Run class board: each student's best Deep run, read from saved progress.
export async function fetchBackroomScores(): Promise<unknown[]> {
  await flushClassroomProgress().catch(() => undefined)
  const { data, error } = await supabase.rpc('pixpy_backroom_scores')
  if (error || !Array.isArray(data)) throw new Error('Classroom scores could not be loaded.')
  return data
}

export interface ClassroomLogin {
  username: string
  displayName: string
  isTeacher: boolean
  progress: unknown
}

export type RosterClass = 'A' | 'B' | 'C'
export type RosterTeam = 'white' | 'yellow' | 'external'

export interface ClassProgressRow {
  username: string
  displayName: string
  className: RosterClass | null
  team: RosterTeam | null
  progress: SessionProgress | null
  updatedAt: string | null
  lastLoginAt: string | null
}

interface LoginPayload {
  ok?: boolean
  username?: string
  display_name?: string
  is_teacher?: boolean
  progress?: unknown
}

interface ProgressPayload {
  username?: string
  display_name?: string
  class_name?: string | null
  group_name?: string | null
  progress?: SessionProgress | null
  updated_at?: string | null
  last_login_at?: string | null
}

export async function loginToClassroom(value: string): Promise<ClassroomLogin> {
  const username = cleanUsername(value)
  if (username.length < 3) throw new Error('Enter your first name and last name together.')
  const { data, error } = await supabase.rpc('pixpy_login', { p_username: username })
  if (error) throw new Error('PixPy could not reach the classroom. Please try again.')
  const payload = data as LoginPayload | null
  if (!payload?.ok || !payload.username || !payload.display_name) throw new Error('Login not found. Check your first name + last name.')
  return {
    username: cleanUsername(payload.username),
    displayName: payload.display_name,
    isTeacher: payload.is_teacher === true,
    progress: payload.progress,
  }
}

// Progress saves are coalesced: typing or playing changes progress many times a second, and every
// save writes the whole progress row. Only the newest snapshot is sent, after a short pause, one
// request at a time, and never twice for the same content. A stuck database times out and is
// retried with a growing wait instead of piling up requests.
const saveDelayMs = 1500
const saveTimeoutMs = 12_000
const retryDelaysMs = [5_000, 15_000, 30_000, 60_000]

interface Waiter { resolve: () => void; reject: (error: Error) => void }
let pendingProgress: { progress: SessionProgress; json: string } | null = null
let waiters: Waiter[] = []
let lastSavedJson = ''
let saveTimer: ReturnType<typeof setTimeout> | undefined
let draining: Promise<void> | null = null
let failures = 0
const savedListeners = new Set<() => void>()

async function sendProgress(progress: SessionProgress) {
  const { data, error } = await supabase
    .rpc('pixpy_save_progress', { p_username: progress.username, p_progress: progress })
    .abortSignal(AbortSignal.timeout(saveTimeoutMs))
  if (error || data !== true) throw new Error('Progress is saved on this device, but cloud sync is waiting.')
}

function scheduleSave(delay: number) {
  if (saveTimer !== undefined) return
  saveTimer = setTimeout(() => { saveTimer = undefined; void drainSaves() }, delay)
}

function drainSaves(): Promise<void> {
  clearTimeout(saveTimer)
  saveTimer = undefined
  // A save already in flight sends the newest snapshot when it finishes.
  draining ??= (async () => {
    while (pendingProgress) {
      const job = pendingProgress
      const batch = waiters
      pendingProgress = null
      waiters = []
      try {
        await sendProgress(job.progress)
        lastSavedJson = job.json
        failures = 0
        batch.forEach((waiter) => waiter.resolve())
        savedListeners.forEach((listener) => listener())
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause))
        batch.forEach((waiter) => waiter.reject(error))
        pendingProgress ??= job
        scheduleSave(retryDelaysMs[Math.min(failures++, retryDelaysMs.length - 1)])
        return
      }
    }
  })().finally(() => {
    draining = null
    if (pendingProgress) scheduleSave(saveDelayMs)
  })
  return draining
}

export function saveClassroomProgress(progress: SessionProgress): Promise<void> {
  if (progress.isTeacher) return Promise.resolve()
  const json = JSON.stringify(progress)
  if (!pendingProgress && json === lastSavedJson) return Promise.resolve()
  if (pendingProgress?.json !== json) pendingProgress = { progress: structuredClone(progress), json }
  const saved = new Promise<void>((resolve, reject) => { waiters.push({ resolve, reject }) })
  scheduleSave(saveDelayMs)
  return saved
}

/** Tells the app when a save lands, including a retry after the cloud was unreachable. */
export function onProgressSaved(listener: () => void): () => void {
  savedListeners.add(listener)
  return () => { savedListeners.delete(listener) }
}

/** Sends any waiting progress now, for the class board and when the tab is hidden. */
export function flushClassroomProgress(): Promise<void> {
  return pendingProgress || draining ? drainSaves() : Promise.resolve()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushClassroomProgress().catch(() => undefined)
  })
}

export async function loadClassProgress(teacherUsername: string): Promise<ClassProgressRow[]> {
  const { data, error } = await supabase.rpc('pixpy_class_progress', { p_teacher_username: cleanUsername(teacherUsername) })
  if (error || !Array.isArray(data)) throw new Error('Class progress could not be loaded.')
  return (data as ProgressPayload[]).flatMap((row) => row.username && row.display_name ? [{
    username: cleanUsername(row.username),
    displayName: row.display_name,
    className: row.class_name === 'A' || row.class_name === 'B' || row.class_name === 'C' ? row.class_name : null,
    team: row.group_name === 'white' || row.group_name === 'yellow' || row.group_name === 'external' ? row.group_name : null,
    progress: row.progress && typeof row.progress === 'object' ? row.progress : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    lastLoginAt: typeof row.last_login_at === 'string' ? row.last_login_at : null,
  }] : [])
}
