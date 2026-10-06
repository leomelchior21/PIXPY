import { completedIfElseLevels, nextIfElseLevel } from './ifElseProgress'
import { createSession } from '../session/progressSession'
import type { IfElseLearningEvent } from '../types'

const success: IfElseLearningEvent = { level: 4, mode: 'prediction', kind: 'check', attempt: 1, value: 75, prediction: 'Level unlocked', actualOutput: 'Keep playing', conditionResult: false, errorKind: null, at: 123 }

describe('saved IF/ELSE levels', () => {
  it('starts a new student at the first level', () => {
    expect(completedIfElseLevels(null)).toEqual([])
    expect(nextIfElseLevel(createSession('Maya'))).toBe(0)
  })

  it('keeps unique valid levels and resumes the first unsolved level', () => {
    const progress = { ...createSession('Maya'), ifElseLevels: [3, 1, 2, 3, 0, 11, 1.5], ifElseLearning: [success] }
    expect(completedIfElseLevels(progress)).toEqual([1, 2, 3, 4])
    expect(nextIfElseLevel(progress)).toBe(4)
  })

  it('recovers earlier levels from legacy success records without counting predictions or errors', () => {
    expect(completedIfElseLevels({ ifElseLearning: [success] })).toEqual([1, 2, 3, 4])
    expect(completedIfElseLevels({ ifElseLearning: [{ ...success, kind: 'prediction', actualOutput: null }] })).toEqual([])
    expect(completedIfElseLevels({ ifElseLearning: [{ ...success, errorKind: 'condition' }] })).toEqual([])
    expect(completedIfElseLevels({ ifElseLearning: [{ ...success, actualOutput: null }] })).toEqual([])
  })

  it('keeps saved levels when old checks have left the limited learning history', () => {
    const progress = { ...createSession('Maya'), ifElseLevels: [1, 2, 3, 4], ifElseLearning: Array.from({ length: 200 }, () => ({ ...success, level: 5, kind: 'hint' as const, actualOutput: null })) }
    expect(completedIfElseLevels(progress)).toEqual([1, 2, 3, 4])
  })

  it('preserves legacy full completion and recognises a finished saved run', () => {
    expect(completedIfElseLevels({ completed: ['if-else'] })).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(nextIfElseLevel({ ifElseLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })).toBe(-1)
  })
})
