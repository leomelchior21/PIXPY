import { createClient } from '@supabase/supabase-js'
import type { DinoConfig, RankingEntry, StudentProfile } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseKey!, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null

interface IdentifyRow {
  student_id: string
  display_name: string
  avatar_id: string | null
  xp: number
  completed_missions: string[] | null
  badges: string[] | null
  session_token: string
}

export async function identifyStudent(accessId: string): Promise<StudentProfile> {
  if (!supabase) throw new Error('PixPy cloud is not configured yet.')

  const { data, error } = await supabase.rpc('pixpy_identify_student', { p_access_id: accessId })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('PixPy cloud setup is waiting for the database migration.')
    }
    throw new Error(error.message)
  }

  const row = (Array.isArray(data) ? data[0] : data) as IdentifyRow | undefined
  if (!row) throw new Error('That access ID is not on the class list. Check the spelling and try again.')

  return {
    id: row.student_id,
    accessId,
    displayName: row.display_name,
    avatarId: row.avatar_id,
    xp: row.xp ?? 0,
    completedMissions: row.completed_missions ?? [],
    badges: row.badges ?? [],
    sessionToken: row.session_token,
    isTeacher: false,
    lastActiveAt: new Date().toISOString(),
  }
}

export async function saveCloudProfile(profile: StudentProfile): Promise<void> {
  if (!supabase || !profile.sessionToken || profile.isTeacher) return
  const { error } = await supabase.rpc('pixpy_update_avatar', {
    p_session_token: profile.sessionToken,
    p_avatar_id: profile.avatarId,
  })
  if (error) throw error
}

export async function saveCloudProgress(
  profile: StudentProfile,
  code: string,
  config: DinoConfig,
): Promise<void> {
  if (!supabase || !profile.sessionToken || profile.isTeacher) return
  const { error } = await supabase.rpc('pixpy_save_dino_progress', {
    p_session_token: profile.sessionToken,
    p_code: code,
    p_config: config,
    p_completed_missions: profile.completedMissions,
  })
  if (error) throw error
}

export async function fetchRanking(profile: StudentProfile): Promise<RankingEntry[]> {
  if (!supabase || !profile.sessionToken || profile.isTeacher) return []
  const { data, error } = await supabase.rpc('pixpy_get_ranking', {
    p_session_token: profile.sessionToken,
  })
  if (error) throw error
  return ((data ?? []) as Array<{
    rank: number
    display_name: string
    avatar_id: string
    xp: number
    progress: number
    badges: number
    is_current: boolean
  }>).map((row) => ({
    rank: row.rank,
    displayName: row.display_name,
    avatarId: row.avatar_id,
    xp: row.xp,
    progress: row.progress,
    badges: row.badges,
    isCurrent: row.is_current,
  }))
}
