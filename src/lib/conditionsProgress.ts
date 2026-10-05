import { CHOICE_QUIZ_LENGTH, CHOICE_XP_PER_QUESTION } from '../data/choiceMachine'
import { ifElsePedagogy } from '../data/ifElsePedagogy'
import type { IfElseLearningEvent, SessionProgress } from '../types'

export const learningErrorLabels: Record<NonNullable<IfElseLearningEvent['errorKind']>, string> = {
  structure: 'Structure error', condition: 'Condition error', logic: 'Logic error', output: 'Output error', runtime: 'Run error',
}

function count(value: unknown, maximum = Infinity): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : 0
}

export function conditionsProgress(progress: SessionProgress | null) {
  const complete = Array.isArray(progress?.completed) ? progress.completed : []
  const quizComplete = complete.includes('choice-machine')
  const quizIndex = quizComplete ? CHOICE_QUIZ_LENGTH : count(progress?.choiceMachineQuizIndex, CHOICE_QUIZ_LENGTH)
  const liveComplete = Boolean(progress?.choiceMachineStoriesComplete || quizIndex > 0 || quizComplete)
  const introComplete = Boolean(progress?.choiceMachineIntroComplete || liveComplete)
  const events = (Array.isArray(progress?.ifElseLearning) ? progress.ifElseLearning : []).filter((event) =>
    event && Number.isInteger(event.level) && event.level >= 1 && event.level <= ifElsePedagogy.length
    && ['check', 'prediction', 'hint'].includes(event.kind))
  const checks = events.filter((event) => event.kind === 'check')
  const solved = new Set(checks.filter((event) => event.errorKind === null && typeof event.actualOutput === 'string').map((event) => event.level))
  const lastCheck = checks.at(-1)
  const lastEvent = events.at(-1)
  const pendingPredictions = new Map<number, IfElseLearningEvent>()
  let testedPredictions = 0
  let matchedPredictions = 0
  for (const event of events) {
    if (event.kind === 'prediction') pendingPredictions.set(event.level, event)
    if (event.kind !== 'check' || typeof event.actualOutput !== 'string') continue
    const prediction = pendingPredictions.get(event.level)
    if (!prediction || prediction.value !== event.value) continue
    pendingPredictions.delete(event.level)
    const expected = ifElsePedagogy[event.level - 1].requirePrediction === 'truth'
      ? event.conditionResult === null ? null : event.conditionResult ? 'TRUE' : 'FALSE'
      : event.actualOutput?.trim()
    if (expected === null || typeof prediction.prediction !== 'string') continue
    testedPredictions += 1
    if (prediction.prediction.trim() === expected) matchedPredictions += 1
  }

  return {
    gates: count(progress?.backroomRunGates), bestRun: count(progress?.backroomRunBest), runXp: count(progress?.backroomRunXp),
    introComplete, liveComplete, quizIndex, quizComplete,
    choiceXp: count(progress?.choiceMachineXp, CHOICE_QUIZ_LENGTH * CHOICE_XP_PER_QUESTION),
    ifElseComplete: complete.includes('if-else'),
    solvedLevels: complete.includes('if-else') ? ifElsePedagogy.length : solved.size,
    lastLevel: lastEvent?.level ?? null,
    lastMode: lastEvent ? ifElsePedagogy[lastEvent.level - 1].title : null,
    lastError: lastCheck?.errorKind ? learningErrorLabels[lastCheck.errorKind] ?? 'Run error' : null,
    checkCount: checks.length, hints: events.filter((event) => event.kind === 'hint').length,
    testedPredictions, matchedPredictions,
  }
}
