import { createSession, loadSession, saveSession } from './progressSession'

it('keeps earned Memory completion after refresh during a replay', () => {
  sessionStorage.clear()
  saveSession({ ...createSession('Maya'), completed: ['memory-machine'], memoryQuizAnswers: [1, 2], memoryQuizCompleted: true })
  expect(loadSession()?.completed).toContain('memory-machine')
  expect(loadSession()?.memoryQuizAnswers).toEqual([1, 2])
  sessionStorage.clear()
})
