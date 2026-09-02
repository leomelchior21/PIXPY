import { activityIds, type ActivityId, type SessionProgress } from '../types'

const SESSION_KEY = 'pixpy.session.v2'

export const emptyProgress: Omit<SessionProgress, 'name'> = {
  completed: [],
  blackBoxLevels: [],
  inputModes: [],
  memoryExamples: [],
  memoryQuizAnswers: [],
  bossProgress: [],
  blackBoxCode: 'number = int(input())\n\nresult = number * 2\n\nprint(result)',
  blackBoxTests: [],
  interestingValues: [],
}

export function createSession(name: string): SessionProgress {
  return { name: cleanName(name), ...structuredClone(emptyProgress) }
}

export function loadSession(): SessionProgress | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SessionProgress>
    if (!parsed.name || typeof parsed.name !== 'string') return null
    const memoryQuizAnswers = cleanQuizAnswers(parsed.memoryQuizAnswers)
    const completed = cleanActivityIds(parsed.completed)
    return {
      ...createSession(parsed.name),
      ...parsed,
      name: cleanName(parsed.name),
      completed: memoryQuizAnswers.length === 10 ? completed : completed.filter((activity) => activity !== 'memory-machine'),
      memoryQuizAnswers,
    }
  } catch {
    return null
  }
}

export function saveSession(progress: SessionProgress): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(progress))
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

export function completeActivity(progress: SessionProgress, activity: ActivityId): SessionProgress {
  if (progress.completed.includes(activity)) return progress
  return { ...progress, completed: [...progress.completed, activity] }
}

export function cleanName(value: string): string {
  return value
    .replace(/[^\p{L}\p{M}' -]/gu, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, 28)
}

function cleanActivityIds(value: unknown): ActivityId[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ActivityId => activityIds.includes(item as ActivityId))
}

function cleanQuizAnswers(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((answer) => Number.isInteger(answer) && answer >= 0 && answer <= 3).slice(0, 10)
}
