import { bossProgress, conditionsProgress, moreChoiceProgress, repairProgress } from './conditionsProgress'
import { createSession } from '../session/progressSession'
import type { IfElseLearningEvent, SessionProgress } from '../types'

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

describe('new conditions activity analytics', () => {
  it('summarises repair tickets, choice levels, and boss attacks from raw cloud data', () => {
    const progress = {
      ...createSession('Ada'),
      repairTickets: [1, 2, 2, 99],
      repairLog: [
        { ticket: 1, runs: 3, stampMisses: 0, locateMisses: 2, fixMisses: 0, verifyFails: 1, hints: 1, at: 1 },
        { ticket: 2, runs: 1, stampMisses: 1, locateMisses: 0, fixMisses: 0, verifyFails: 0, hints: 0, at: 2 },
        { ticket: 'x' },
      ],
      moreChoiceLevels: [1, 2, 3],
      moreChoiceLog: [
        { level: 4, kind: 'prediction', ok: true, at: 1 }, { level: 4, kind: 'prediction', ok: false, at: 2 },
        { level: 6, kind: 'check', ok: false, at: 3 }, { level: 6, kind: 'drop', ok: true, at: 4 },
      ],
      conditionBosses: [1],
      conditionBossLog: [{ boss: 1, hits: 6, total: 6, hints: 0, at: 1 }, { boss: 2, hits: 2, total: 6, hints: 1, at: 2 }, { boss: 2, hits: 5, total: 6, hints: 2, at: 3 }],
    } as unknown as SessionProgress
    expect(repairProgress(progress)).toMatchObject({ fixed: 2, linesFirstTry: 1, repairsLogged: 2, hardestStep: 'Finding the line', runs: 4, hints: 1, lastTicket: 'The safe door' })
    expect(moreChoiceProgress(progress)).toMatchObject({ solved: 3, predictions: 2, predictionsRight: 1, checks: 1, failedChecks: 1, drops: 1, lastLevel: { title: 'Ticket booth' } })
    expect(bossProgress(progress)).toMatchObject({ defeated: 1, attacks: 3, hints: 3, toughest: { name: 'Fan Golem', attacks: 2 }, lastBoss: 'Fan Golem', lastHits: '5 / 6' })
  })

  it('reports empty states for students who have not started', () => {
    expect(repairProgress(null)).toMatchObject({ fixed: 0, hardestStep: null, lastTicket: null })
    expect(moreChoiceProgress(null)).toMatchObject({ solved: 0, lastLevel: null })
    expect(bossProgress(null)).toMatchObject({ defeated: 0, toughest: null, lastBoss: null })
  })
})
