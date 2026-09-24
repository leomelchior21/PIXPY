import { cleanUsername, completeActivity, createSession, emptyProgress, loadSession, resetActivityProgress, restoreProgress, saveSession } from './progressSession'
import type { SessionProgress } from '../types'

describe('session-only progress', () => {
  beforeEach(() => sessionStorage.clear())

  it('stores progress in sessionStorage', () => {
    const progress = completeActivity(createSession('Leo'), 'dino-variables')
    saveSession(progress)
    expect(loadSession()?.name).toBe('Leo')
    expect(loadSession()?.completed).toEqual(['dino-variables'])
    expect(localStorage.length).toBe(0)
  })

  it('normalizes roster logins and restores cloud progress with the current identity', () => {
    expect(cleanUsername(' João-Da Silva ')).toBe('joaodasilva')
    const restored = restoreProgress('joaosilva', 'João Silva', { ...createSession('Old Name'), bossProgress: [1, 2, 3] })
    expect(restored).toMatchObject({ username: 'joaosilva', name: 'João Silva', isTeacher: false, bossProgress: [1, 2, 3] })
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

  it('restores the choice quiz checkpoint and requires all 20 questions for completion', () => {
    const progress = createSession('Leo')
    saveSession({ ...progress, choiceMachineStoriesComplete: true, choiceMachineQuizIndex: 8, choiceMachineXp: 80, completed: ['choice-machine'] })
    expect(loadSession()).toMatchObject({ choiceMachineStoriesComplete: true, choiceMachineQuizIndex: 8, choiceMachineXp: 80, completed: [] })

    saveSession({ ...progress, choiceMachineStoriesComplete: true, choiceMachineQuizIndex: 20, choiceMachineXp: 200, completed: ['choice-machine'] })
    expect(loadSession()?.completed).toContain('choice-machine')
  })

  it('resets only the selected activity and removes its completion mark', () => {
    const progress: SessionProgress = {
      ...createSession('Leo'),
      completed: ['dino-variables', 'black-box', 'input-machine', 'memory-machine', 'final-bosses'],
      blackBoxLevels: [0, 1, 2],
      blackBoxQuizAnswers: [1, 2],
      blackBoxQuizStartedAt: 123,
      blackBoxQuizElapsedMs: 456,
      blackBoxQuizSeed: 99,
      blackBoxQuizResults: [{ score: 8, total: 10, elapsedMs: 456 }],
      inputModes: ['echo'],
      memoryExamples: ['create'],
      memoryQuizAnswers: [2],
      memoryQuizCompleted: true,
      bossProgress: [1],
    }

    const blackBox = resetActivityProgress(progress, 'black-box')
    expect(blackBox).toMatchObject({ blackBoxLevels: [], blackBoxQuizAnswers: [], blackBoxQuizStartedAt: null, blackBoxQuizElapsedMs: null, blackBoxQuizSeed: emptyProgress.blackBoxQuizSeed, blackBoxQuizResults: [] })
    expect(blackBox.completed).toEqual(['dino-variables', 'input-machine', 'memory-machine', 'final-bosses'])
    expect(resetActivityProgress(progress, 'input-machine').inputModes).toEqual([])
    expect(resetActivityProgress(progress, 'memory-machine')).toMatchObject({ memoryExamples: [], memoryQuizAnswers: [], memoryQuizCompleted: false })
    expect(resetActivityProgress(progress, 'final-bosses').bossProgress).toEqual([])
  })
})
