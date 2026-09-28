// One-command setup for the realtime live view.
//
// It applies both live-code migrations, fetches the project service_role key,
// creates/updates the teacher auth account, and verifies RLS end to end.
//
// Credentials (never committed, never printed):
//   SUPABASE_ACCESS_TOKEN   Personal access token: https://supabase.com/dashboard/account/tokens
//   LIVE_TEACHER_PASSWORD   Optional. A random one is generated and printed if omitted.
//
// Provide them in this order of preference:
//   1. environment variables,
//   2. .env.local in the repo root (gitignored),
//   3. %TEMP%\opencode\supabase-access-token.txt / live-teacher-password.txt
//
// Then: npm run setup:live

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

const projectRef = 'imodobxbarcsjylvitxt'
const managementApi = 'https://api.supabase.com/v1'
const projectUrl = `https://${projectRef}.supabase.co`
const publishableKey = 'sb_publishable_jkHrLZkNR4Zh3XtHEgpTMA_JnMMpG6w'
const teacherEmail = (process.env.LIVE_TEACHER_EMAIL ?? 'leleomaker@pixpy.local').toLowerCase()

const migrations = [
  'supabase/migrations/20260919090000_pixpy_live_code.sql',
  'supabase/migrations/20260919100000_pixpy_live_realtime.sql',
]

function envFileValue(name) {
  const file = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return null
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((item) => item.trim().startsWith(`${name}=`))
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : null
}

function secret(name, tempFile) {
  if (process.env[name]) return process.env[name].trim()
  const fromFile = envFileValue(name)
  if (fromFile) return fromFile
  const fallback = path.join(os.tmpdir(), 'opencode', tempFile)
  if (fs.existsSync(fallback)) return fs.readFileSync(fallback, 'utf8').trim()
  return null
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

async function fetchServiceRoleKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
  const keys = await api(`/projects/${projectRef}/api-keys?reveal=true`)
  const key = Array.isArray(keys)
    ? keys.find((item) => item.name === 'service_role' || item.type === 'secret')
    : null
  if (!key?.api_key) throw new Error('Could not read the service_role key. Set SUPABASE_SERVICE_ROLE_KEY explicitly.')
  return key.api_key
}

async function upsertTeacher(serviceRoleKey, password) {
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' }
  const listResponse = await fetch(`${projectUrl}/auth/v1/admin/users?per_page=1000`, { headers })
  const list = listResponse.ok ? await listResponse.json() : { users: [] }
  const existing = (list.users ?? []).find((user) => (user.email ?? '').toLowerCase() === teacherEmail)
  const body = JSON.stringify({ email: teacherEmail, password, email_confirm: true })
  const response = existing
    ? await fetch(`${projectUrl}/auth/v1/admin/users/${existing.id}`, { method: 'PUT', headers, body })
    : await fetch(`${projectUrl}/auth/v1/admin/users`, { method: 'POST', headers, body })
  if (!response.ok) throw new Error(`Creating the teacher account failed (${response.status}): ${(await response.text()).slice(0, 300)}`)
  return existing ? 'updated' : 'created'
}

async function verify(password) {
  const signIn = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: teacherEmail, password }),
  })
  if (!signIn.ok) throw new Error(`Teacher sign-in failed (${signIn.status}).`)
  const session = await signIn.json()
  const authHeaders = { apikey: publishableKey, Authorization: `Bearer ${session.access_token}` }

  const claim = await fetch(`${projectUrl}/rest/v1/rpc/pixpy_claim_live_teacher`, { method: 'POST', headers: authHeaders })
  const claimed = claim.ok ? await claim.json() : false

  const teacherRead = await fetch(`${projectUrl}/rest/v1/pixpy_live_code?select=username&limit=1`, { headers: authHeaders })
  const anonRead = await fetch(`${projectUrl}/rest/v1/pixpy_live_code?select=username&limit=1`, { headers: { apikey: publishableKey } })

  return {
    signIn: signIn.status,
    claim: claim.status,
    claimed,
    teacherRead: teacherRead.status,
    anonRead: anonRead.status,
    anonBlocked: anonRead.status >= 400,
  }
}

const accessToken = secret('SUPABASE_ACCESS_TOKEN', 'supabase-access-token.txt')
if (!accessToken) {
  console.error([
    'Missing SUPABASE_ACCESS_TOKEN.',
    '',
    'Create one at https://supabase.com/dashboard/account/tokens and put it in .env.local:',
    '  SUPABASE_ACCESS_TOKEN=sbp_...',
    '  LIVE_TEACHER_PASSWORD=your-password   (optional; a random one is generated)',
    '',
    'Then run: npm run setup:live',
  ].join('\n'))
  process.exit(1)
}

async function main() {
  const generated = !secret('LIVE_TEACHER_PASSWORD', 'live-teacher-password.txt')
  const password = secret('LIVE_TEACHER_PASSWORD', 'live-teacher-password.txt')
    ?? `PixPy-${crypto.randomBytes(9).toString('base64url')}`

  await applyMigrations()
  const serviceRoleKey = await fetchServiceRoleKey()
  const account = await upsertTeacher(serviceRoleKey, password)
  const checks = await verify(password)

  console.log(`Teacher account ${account}: ${teacherEmail}`)
  console.log(`Verification: sign-in ${checks.signIn}, claim ${checks.claim} (${checks.claimed}), teacher read ${checks.teacherRead}, student read ${checks.anonRead}${checks.anonBlocked ? ' (blocked)' : ' (NOT blocked!)'}`)
  if (generated) console.log(`Password: ${password}`)
  if (!generated) console.log('Password: (kept from LIVE_TEACHER_PASSWORD)')
  if (!checks.claimed || !checks.anonBlocked) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
