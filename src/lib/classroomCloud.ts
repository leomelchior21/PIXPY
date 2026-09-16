import { createClient } from '@supabase/supabase-js'
import type { SessionProgress } from '../types'
import { cleanUsername } from '../session/progressSession'

const supabaseUrl = 'https://imodobxbarcsjylvitxt.supabase.co'
const supabasePublishableKey = 'sb_publishable_jkHrLZkNR4Zh3XtHEgpTMA_JnMMpG6w'

const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
let progressSaveQueue: Promise<void> = Promise.resolve()

export interface ClassroomLogin {
  username: string
  displayName: string
  isTeacher: boolean
  progress: unknown
}

export interface ClassProgressRow {
  username: string
  displayName: string
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

export function saveClassroomProgress(progress: SessionProgress): Promise<void> {
  if (progress.isTeacher) return Promise.resolve()
  const snapshot = structuredClone(progress)
  const save = async () => {
    const { data, error } = await supabase.rpc('pixpy_save_progress', {
      p_username: snapshot.username,
      p_progress: snapshot,
    })
    if (error || data !== true) throw new Error('Progress is saved on this device, but cloud sync is waiting.')
  }
  progressSaveQueue = progressSaveQueue.catch(() => undefined).then(save)
  return progressSaveQueue
}

export async function loadClassProgress(teacherUsername: string): Promise<ClassProgressRow[]> {
  const { data, error } = await supabase.rpc('pixpy_class_progress', { p_teacher_username: cleanUsername(teacherUsername) })
  if (error || !Array.isArray(data)) throw new Error('Class progress could not be loaded.')
  return (data as ProgressPayload[]).flatMap((row) => row.username && row.display_name ? [{
    username: cleanUsername(row.username),
    displayName: row.display_name,
    progress: row.progress && typeof row.progress === 'object' ? row.progress : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    lastLoginAt: typeof row.last_login_at === 'string' ? row.last_login_at : null,
  }] : [])
}
