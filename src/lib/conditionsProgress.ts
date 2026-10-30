import { CHOICE_QUIZ_LENGTH, CHOICE_XP_PER_QUESTION } from '../data/choiceMachine'
import { conditionBosses } from '../data/conditionBosses'
import { ifElsePedagogy } from '../data/ifElsePedagogy'
import { moreChoiceLevels } from '../data/moreChoices'
import { repairTickets } from '../data/repairShop'
import { levelCount } from '../experiences/conditions/backroom/backroomLevels'
import { completedIfElseLevels } from './ifElseProgress'
import { fighterBases } from '../data/bossFighters'
import type { BossAttackEvent, BossFighter, IfElseLearningEvent, MoreChoiceEvent, RepairLogEntry, SessionProgress } from '../types'

export const learningErrorLabels: Record<NonNullable<IfElseLearningEvent['errorKind']>, string> = {
  structure: 'Structure error', condition: 'Condition error', logic: 'Logic error', output: 'Output error', runtime: 'Run error',
}

function count(value: unknown, maximum = Infinity): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : 0
}

function ids(value: unknown, maximum: number): number[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is number => Number.isInteger(item) && item >= 1 && item <= maximum))] : []
}

function records<T>(value: unknown, valid: (item: Partial<T>) => boolean): T[] {
  return Array.isArray(value) ? value.filter((item): item is T => Boolean(item) && typeof item === 'object' && valid(item as Partial<T>)) : []
}

const repairSteps = [['locateMisses', 'Finding the line'], ['fixMisses', 'Rebuilding the line'], ['verifyFails', 'Passing every test']] as const

/** Repair Shop: tickets fixed and the step that caused the most retries. */
export function repairProgress(progress: SessionProgress | null) {
  const fixed = ids(progress?.repairTickets, repairTickets.length)
  const log = records<RepairLogEntry>(progress?.repairLog, (entry) => Number.isInteger(entry.ticket) && typeof entry.at === 'number')
  const misses = repairSteps.map(([key, label]) => ({ label, total: log.reduce((sum, entry) => sum + count(entry[key]), 0) }))
  const hardest = misses.reduce((best, item) => item.total > best.total ? item : best, { label: '', total: 0 })
  const last = log.at(-1)
  return {
    fixed: fixed.length, total: repairTickets.length,
    linesFirstTry: log.filter((entry) => count(entry.locateMisses) === 0).length, repairsLogged: log.length,
    hardestStep: hardest.total > 0 ? hardest.label : null,
    runs: log.reduce((sum, entry) => sum + count(entry.runs), 0),
    hints: log.reduce((sum, entry) => sum + count(entry.hints), 0),
    lastTicket: last ? repairTickets.find((ticket) => ticket.id === last.ticket)?.title ?? null : null,
    guideSeen: progress?.repairTutorialSeen === true,
  }
}

/** More than one choice: levels solved, prediction accuracy, and failed builds. */
export function moreChoiceProgress(progress: SessionProgress | null) {
  const solved = ids(progress?.moreChoiceLevels, moreChoiceLevels.length)
  const log = records<MoreChoiceEvent>(progress?.moreChoiceLog, (event) => Number.isInteger(event.level) && typeof event.ok === 'boolean')
  const predictions = log.filter((event) => event.kind === 'prediction')
  const checks = log.filter((event) => event.kind === 'check')
  const last = log.at(-1)
  return {
    solved: solved.length, total: moreChoiceLevels.length,
    predictions: predictions.length, predictionsRight: predictions.filter((event) => event.ok).length,
    checks: checks.length, failedChecks: checks.filter((event) => !event.ok).length,
    drops: log.filter((event) => event.kind === 'drop').length,
    hints: log.filter((event) => event.kind === 'hint').length,
    lastLevel: last ? moreChoiceLevels.find((level) => level.id === last.level) ?? null : null,
    guideSeen: progress?.moreChoiceTutorialSeen === true,
  }
}

/** Final bosses: defeated bosses, attacks, and the boss that needed the most attacks. */
export function bossProgress(progress: SessionProgress | null) {
  const defeated = ids(progress?.conditionBosses, conditionBosses.length)
  const log = records<BossAttackEvent>(progress?.conditionBossLog, (event) => Number.isInteger(event.boss) && Number.isInteger(event.total))
  const attacks = new Map<number, number>()
  for (const event of log) attacks.set(event.boss, (attacks.get(event.boss) ?? 0) + 1)
  const [toughestId, toughestAttacks] = [...attacks.entries()].reduce((best, entry) => entry[1] > best[1] ? entry : best, [0, 0])
  const last = log.at(-1)
  return {
    defeated: defeated.length, total: conditionBosses.length, attacks: log.length,
    hints: log.reduce((sum, event) => sum + count(event.hints, 3), 0),
    toughest: toughestAttacks > 1 ? { name: conditionBosses.find((boss) => boss.id === toughestId)?.name ?? '', attacks: toughestAttacks } : null,
    lastBoss: last ? conditionBosses.find((boss) => boss.id === last.boss)?.name ?? null : null,
    lastHits: last ? `${count(last.hits)} / ${count(last.total)}` : null,
    // One badge per defeated boss.
    badges: defeated.length,
    fighter: fighterSummary(progress?.bossFighter),
    guideSeen: progress?.bossTutorialSeen === true,
  }
}

/** "Merlin · Wizard", from the fighter a student built in the arena intro. */
function fighterSummary(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const fighter = value as Partial<BossFighter>
  const base = fighterBases.find((item) => item.id === fighter.base)
  const name = typeof fighter.name === 'string' ? fighter.name.trim().slice(0, 12) : ''
  return base ? `${name || 'Coder'} · ${base.label}` : null
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
  const solved = new Set(completedIfElseLevels(progress))
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
    tapes: Array.isArray(progress?.backroomLevelStars) ? progress.backroomLevelStars.slice(0, levelCount).filter((stars) => count(stars) > 0).length : 0, tapeCount: levelCount,
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
