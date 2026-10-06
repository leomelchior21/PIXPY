import { conditionsProgress } from './conditionsProgress'
import { createSession } from '../session/progressSession'
import type { IfElseLearningEvent } from '../types'

function event(extra: Partial<IfElseLearningEvent>): IfElseLearningEvent {
  return { level: 4, mode: 'prediction', kind: 'check', attempt: 1, value: 12, prediction: null, actualOutput: 'An output', conditionResult: true, errorKind: null, at: 1, ...extra }
}

describe('conditionsProgress', () => {
  it('reports a safe empty state for a student with no saved progress', () => {
    expect(conditionsProgress(null)).toMatchObject({ gates: 0, bestRun: 0, introComplete: false, liveComplete: false, quizIndex: 0, solvedLevels: 0, lastLevel: null, testedPredictions: 0 })
  })

  it('keeps endless run totals and derives earlier choice steps from legacy completion', () => {
    expect(conditionsProgress({ ...createSession('Ada'), completed: ['choice-machine', 'if-else'], backroomRunGates: 42, backroomRunBest: 17, choiceMachineXp: 400 })).toMatchObject({ gates: 42, bestRun: 17, choiceXp: 200, introComplete: true, liveComplete: true, quizIndex: 20, quizComplete: true, solvedLevels: 10 })
  })

  it('counts successful levels once and keeps the most recent error separate from hints', () => {
    const result = conditionsProgress({ ...createSession('Ada'), ifElseLearning: [event({ level: 1 }), event({ level: 1 }), event({ level: 7, errorKind: 'condition' }), event({ level: 7, kind: 'hint', errorKind: null }), event({ level: 40 })] })
    expect(result).toMatchObject({ solvedLevels: 1, checkCount: 3, hints: 1, lastLevel: 7, lastMode: 'Debug the logic', lastError: 'Condition error' })
  })

  it('compares each prediction to its first execution without counting retries as new predictions', () => {
    const result = conditionsProgress({ ...createSession('Ada'), ifElseLearning: [
      event({ kind: 'prediction', prediction: 'An output', actualOutput: null }),
      event({ prediction: 'An output' }), event({ prediction: 'An output', attempt: 2 }),
      event({ level: 10, kind: 'prediction', prediction: 'FALSE', actualOutput: null }),
      event({ level: 10, prediction: 'FALSE', conditionResult: true }),
    ] })
    expect(result).toMatchObject({ testedPredictions: 2, matchedPredictions: 1 })
  })

  it('does not score an untested prediction or a check using a different input', () => {
    const result = conditionsProgress({ ...createSession('Ada'), ifElseLearning: [event({ kind: 'prediction', prediction: 'An output', actualOutput: null }), event({ value: 15 }), event({ actualOutput: null, errorKind: 'structure' })] })
    expect(result).toMatchObject({ testedPredictions: 0, matchedPredictions: 0, solvedLevels: 1 })
  })

  it('reports durable solved levels even after their analytics checks are no longer stored', () => {
    expect(conditionsProgress({ ...createSession('Ada'), ifElseLevels: [1, 2, 3, 4], ifElseLearning: [] }).solvedLevels).toBe(4)
  })
})
