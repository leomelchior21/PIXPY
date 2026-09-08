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

  it('restores the selected print activity, saved code, output, visits, and completions', () => {
    const progress = createSession('Leo')
    saveSession({
      ...progress,
      printPlaygroundActivity: 'draw-frame',
      printPlaygroundCode: { 'draw-frame': 'print("###")' },
      printPlaygroundOutputs: { 'draw-frame': { text: '###', kind: 'output' } },
      printPlaygroundVisited: ['morning-chat', 'draw-frame'],
      printPlaygroundCompleted: ['morning-chat'],
    })

    expect(loadSession()).toMatchObject({
      printPlaygroundActivity: 'draw-frame',
      printPlaygroundCode: { 'draw-frame': 'print("###")' },
      printPlaygroundOutputs: { 'draw-frame': { text: '###', kind: 'output' } },
      printPlaygroundVisited: ['morning-chat', 'draw-frame'],
      printPlaygroundCompleted: ['morning-chat'],
    })
  })

  it('keeps Print Playground incomplete until all five core activities are done', () => {
    const progress = createSession('Leo')
    saveSession({
      ...progress,
      completed: ['print-playground'],
      printPlaygroundCompleted: ['player-id-card', 'crack-code', 'launch-countdown'],
    })
    expect(loadSession()?.completed).not.toContain('print-playground')

    saveSession({
      ...progress,
      completed: ['print-playground'],
      printPlaygroundCompleted: ['morning-chat', 'introduce-yourself', 'blank-line', 'draw-frame', 'initials-banner'],
    })
    expect(loadSession()?.completed).toContain('print-playground')
  })
})
