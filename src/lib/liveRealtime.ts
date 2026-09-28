import { createClient, type Session } from '@supabase/supabase-js'
import { supabasePublishableKey, supabaseUrl } from './classroomCloud'
import { toLiveCodeRow, type LiveCodeRow } from './liveCode'

export type LiveRealtimeStatus = 'off' | 'connecting' | 'live' | 'error'

export const LIVE_TEACHER_EMAIL = 'leleomaker@pixpy.local'

/**
 * Realtime needs a Supabase Auth JWT so Postgres Changes can evaluate RLS. The
 * rest of the app deliberately keeps no Supabase session, so the live view uses
 * its own client with persistent storage: the teacher unlocks once per device.
 */
export const liveClient = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'pixpy.live.auth' },
})

export async function getLiveTeacherSession(): Promise<Session | null> {
  try {
    const { data } = await liveClient.auth.getSession()
    return data.session ?? null
  } catch {
    return null
  }
}

export async function signInLiveTeacher(email: string, password: string): Promise<void> {
  const { data, error } = await liveClient.auth.signInWithPassword({ email: email.trim(), password })
  if (error || !data.session) throw new Error('Live view unlock failed. Check the teacher email and password.')
  try {
    await liveClient.rpc('pixpy_claim_live_teacher')
  } catch {
    // The account exists but the migration may not be applied yet; the page
    // keeps its polling fallback in that case.
  }
  await liveClient.realtime.setAuth(data.session.access_token)
}

export async function signOutLiveTeacher(): Promise<void> {
  try {
    await liveClient.auth.signOut()
  } catch {
    // Offline sign-out is harmless.
  }
}

export function subscribeLiveCode(
  onRow: (row: LiveCodeRow) => void,
  onStatus: (status: LiveRealtimeStatus) => void,
): () => void {
  let active = true
  let unsubscribe: (() => void) | null = null
  onStatus('connecting')

  void (async () => {
    const { data } = await liveClient.auth.getSession()
    if (!active) return
    if (data.session) await liveClient.realtime.setAuth(data.session.access_token)
    if (!active) return
    const channel = liveClient
      .channel('pixpy-live-code')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pixpy_live_code' },
        (payload) => {
          const row = toLiveCodeRow((payload as { new?: unknown }).new)
          if (row) onRow(row)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') onStatus('live')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onStatus('error')
        else if (status === 'CLOSED') onStatus('off')
        else onStatus('connecting')
      })
    unsubscribe = () => { void liveClient.removeChannel(channel) }
  })()

  return () => {
    active = false
    unsubscribe?.()
  }
}
