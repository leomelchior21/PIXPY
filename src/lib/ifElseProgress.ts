import { ifElseProblems } from '../data/ifElseBuilder'
import type { SessionProgress } from '../types'

export function completedIfElseLevels(progress: Partial<SessionProgress> | null): number[] {
  const all = ifElseProblems.map((_, index) => index + 1)
  if (Array.isArray(progress?.completed) && progress.completed.includes('if-else')) return all
  const saved = Array.isArray(progress?.ifElseLevels) ? progress.ifElseLevels : []
  const checks = Array.isArray(progress?.ifElseLearning) ? progress.ifElseLearning : []
  const successful = checks.filter((event) => event?.kind === 'check' && event.errorKind === null && typeof event.actualOutput === 'string').map((event) => event.level)
  const valid = [...new Set([...saved, ...successful].filter((level) => Number.isInteger(level) && level >= 1 && level <= all.length))].sort((a, b) => a - b)
  // Older versions required every earlier level to reach a successful check.
  // Recover those levels even if their events fell out of the analytics history.
  if (!Array.isArray(progress?.ifElseLevels) && valid.length) return all.slice(0, valid.at(-1))
  return valid
}

export function nextIfElseLevel(progress: Partial<SessionProgress> | null): number {
  const completed = completedIfElseLevels(progress)
  return ifElseProblems.findIndex((_, index) => !completed.includes(index + 1))
}
