export function normalizeAccessId(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const teacherAccessHash = 'd4ad75b8498aec445c8800b5daa797b8a4f9beb70ee8e40fc215827b580136a8'

export async function isTeacherAccess(value: string): Promise<boolean> {
  return sha256(normalizeAccessId(value)).then((hash) => hash === teacherAccessHash)
}
