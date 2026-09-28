// One-command setup for the realtime live view.
//
// It applies the live-code migrations, enables anonymous sign-ins (all the
// teacher needs is the PixPy username "leleomaker"), and verifies the whole
// path: anonymous sign-in, teacher claim, teacher read, student blocked.
//
// The Supabase access token (never committed, never printed) is read from:
//   1. the SUPABASE_ACCESS_TOKEN environment variable,
//   2. .env.local in the repo root (gitignored),
//   3. %TEMP%\opencode\supabase-access-token.txt
//
// Create one at https://supabase.com/dashboard/account/tokens, then:
//   npm run setup:live

const fs = require('fs')
const os = require('os')
const path = require('path')

const projectRef = 'imodobxbarcsjylvitxt'
const managementApi = 'https://api.supabase.com/v1'
const projectUrl = `https://${projectRef}.supabase.co`
const publishableKey = 'sb_publishable_jkHrLZkNR4Zh3XtHEgpTMA_JnMMpG6w'
const teacherUsername = 'leleomaker'

const migrations = [
  'supabase/migrations/20260919090000_pixpy_live_code.sql',
  'supabase/migrations/20260919100000_pixpy_live_realtime.sql',
  'supabase/migrations/20260919110000_pixpy_live_teacher_claim.sql',
]

function envFileValue(name) {
  const file = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return null
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((item) => item.trim().startsWith(`${name}=`))
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : null
}

const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  ?? envFileValue('SUPABASE_ACCESS_TOKEN')
  ?? (fs.existsSync(path.join(os.tmpdir(), 'opencode', 'supabase-access-token.txt'))
    ? fs.readFileSync(path.join(os.tmpdir(), 'opencode', 'supabase-access-token.txt'), 'utf8').trim()
    : null)

if (!accessToken) {
  console.error([
    'Missing SUPABASE_ACCESS_TOKEN.',
    '',
    'Create one at https://supabase.com/dashboard/account/tokens and put it in .env.local:',
    '  SUPABASE_ACCESS_TOKEN=sbp_...',
    '',
    'Then run: npm run setup:live',
  ].join('\n'))
  process.exit(1)
}

async function api(pathname, options = {}) {
  const response = await fetch(`${managementApi}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${pathname} failed (${response.status}): ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function applyMigrations() {
  for (const file of migrations) {
    const sql = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
    await api(`/projects/${projectRef}/database/query`, { method: 'POST', body: JSON.stringify({ query: sql }) })
    console.log(`Applied ${path.basename(file)}`)
  }
}

async function enableAnonymousSignIns() {
  try {
    await api(`/projects/${projectRef}/config/auth`, {
      method: 'PATCH',
      body: JSON.stringify({ external_anonymous_users_enabled: true }),
    })
    console.log('Enabled anonymous sign-ins')
  } catch (error) {
    console.warn(`Could not enable anonymous sign-ins automatically (${error.message}).`)
    console.warn('Enable Authentication -> Sign In / Providers -> Anonymous sign-ins in the dashboard.')
  }
}

async function verify() {
  const anonSignIn = await fetch(`${projectUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: {}, gotrue_meta_security: {} }),
  })
  if (!anonSignIn.ok) throw new Error(`Anonymous sign-in failed (${anonSignIn.status}). Is anonymous sign-in enabled?`)
  const session = await anonSignIn.json()
  const authHeaders = { apikey: publishableKey, Authorization: `Bearer ${session.access_token}` }

  const claimResponse = await fetch(`${projectUrl}/rest/v1/rpc/pixpy_claim_live_teacher`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ p_username: teacherUsername }),
  })
  const claimed = claimResponse.ok ? await claimResponse.json() : false

  const teacherRead = await fetch(`${projectUrl}/rest/v1/pixpy_live_code?select=username&limit=1`, { headers: authHeaders })
  const studentRead = await fetch(`${projectUrl}/rest/v1/pixpy_live_code?select=username&limit=1`, { headers: { apikey: publishableKey } })

  return {
    anonymousSignIn: anonSignIn.status,
    claim: claimResponse.status,
    claimed,
    teacherRead: teacherRead.status,
    studentRead: studentRead.status,
    studentBlocked: studentRead.status >= 400,
  }
}

async function main() {
  await applyMigrations()
  await enableAnonymousSignIns()
  const checks = await verify()

  console.log(`Verification: anonymous sign-in ${checks.anonymousSignIn}, claim ${checks.claim} (${checks.claimed}), teacher read ${checks.teacherRead}, student read ${checks.studentRead}${checks.studentBlocked ? ' (blocked)' : ' (NOT blocked!)'}`)
  if (!checks.claimed || !checks.studentBlocked) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
