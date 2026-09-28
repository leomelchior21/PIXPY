// Creates or updates the single teacher Supabase Auth account used by the
// realtime live view. The service role key is read from the environment and is
// never written to disk or logged.
//
//   PowerShell:
//     $env:SUPABASE_SERVICE_ROLE_KEY = '...'
//     $env:LIVE_TEACHER_PASSWORD = 'choose-a-password'
//     npm run setup:live-teacher
//
// Get the service role key from Supabase -> Project Settings -> API. Do not
// commit it and do not put it in client code.

const url = 'https://imodobxbarcsjylvitxt.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = (process.env.LIVE_TEACHER_EMAIL ?? 'leleomaker@pixpy.local').toLowerCase()
const password = process.env.LIVE_TEACHER_PASSWORD

if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Set it in this shell only, then rerun.')
  process.exit(1)
}

if (!password || password.length < 8) {
  console.error('Set LIVE_TEACHER_PASSWORD (at least 8 characters), then rerun.')
  process.exit(1)
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

async function findUser() {
  const response = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers })
  if (!response.ok) throw new Error(`Listing users failed (${response.status}).`)
  const body = await response.json()
  const users = Array.isArray(body.users) ? body.users : []
  return users.find((user) => (user.email ?? '').toLowerCase() === email) ?? null
}

async function main() {
  const existing = await findUser()
  const payload = { email, password, email_confirm: true }
  const response = existing
    ? await fetch(`${url}/auth/v1/admin/users/${existing.id}`, { method: 'PUT', headers, body: JSON.stringify(payload) })
    : await fetch(`${url}/auth/v1/admin/users`, { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!response.ok) throw new Error(`Saving the teacher account failed (${response.status}).`)

  console.log(`${existing ? 'Updated' : 'Created'} teacher account: ${email}`)
  console.log('Now open Dashboard -> Live view -> REALTIME and sign in once with that password.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
