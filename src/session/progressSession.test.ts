import { beforeEach, describe, expect, it } from 'vitest'
import { completeActivity, createSession, loadSession, saveSession } from './progressSession'

describe('session-only progress', () => {
  beforeEach(() => sessionStorage.clear())

  it('stores progress in sessionStorage', () => {
    const progress = completeActivity(createSession('Leo'), 'dino-variables')
    saveSession(progress)
    expect(loadSession()?.name).toBe('Leo')
    expect(loadSession()?.completed).toEqual(['dino-variables'])
    expect(localStorage.length).toBe(0)
  })
})
