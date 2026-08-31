import { describe, expect, it } from 'vitest'
import { isTeacherAccess, normalizeAccessId } from './access'

describe('access IDs', () => {
  it('joins and normalizes classroom names safely', () => {
    expect(normalizeAccessId('  João O’Connor  ')).toBe('joaooconnor')
  })

  it('does not grant teacher access to a normal player ID', async () => {
    await expect(isTeacherAccess('anotherplayer')).resolves.toBe(false)
  })
})
