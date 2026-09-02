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

  it('requires both ten-question quizzes before keeping their completion marks', () => {
    const progress = createSession('Leo')
    saveSession({ ...progress, completed: ['black-box', 'memory-machine'], blackBoxQuizAnswers: [1], memoryQuizAnswers: [2] })
    expect(loadSession()?.completed).toEqual([])
  })
})
