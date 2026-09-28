import { createClient, type Session } from '@supabase/supabase-js'
import { supabasePublishableKey, supabaseUrl } from './classroomCloud'
import { toLiveCodeRow, type LiveCodeRow } from './liveCode'

export type LiveRealtimeStatus = 'off' | 'connecting' | 'live' | 'error'

/**
 * Realtime needs a Supabase Auth JWT so Postgres Changes can evaluate RLS. The
 * app signs the teacher in with the username only, so the live view signs in
 * anonymously and claims the teacher identity by username. No password, and the
 * PixPy login flow is untouched.
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

export async function unlockLiveTeacher(username: string): Promise<void> {
  let session = (await liveClient.auth.getSession()).data.session
  if (!session) {
    const anonymous = await liveClient.auth.signInAnonymously()
    if (anonymous.error || !anonymous.data.session) {
      throw new Error('Realtime needs anonymous sign-ins enabled in the Supabase project.')
    }
    session = anonymous.data.session
  }

  const { data, error } = await liveClient.rpc('pixpy_claim_live_teacher', { p_username: username })
  if (error) throw new Error('Realtime is not ready yet. Apply the pixpy_live_realtime migration.')
  if (data !== true) throw new Error('Live view is reserved for the teacher account.')

  await liveClient.realtime.setAuth(session.access_token)
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
