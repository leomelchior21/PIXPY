import {
  activityIds,
  printActivityIds,
  printCoreActivityIds,
  type ActivityId,
  type PrintActivityId,
  type PrintActivityOutputState,
  type SessionProgress,
} from '../types'

const SESSION_KEY = 'pixpy.session.v2'

export const emptyProgress: Omit<SessionProgress, 'name'> = {
  completed: [],
  blackBoxLevels: [],
  blackBoxQuizAnswers: [],
  inputModes: [],
  memoryExamples: [],
  memoryQuizAnswers: [],
  bossProgress: [],
  blackBoxCode: 'number = int(input())\n\nresult =  # type an operation here: number * 2\n\nprint(result)',
  blackBoxTests: [],
  interestingValues: [],
  printPlaygroundActivity: 'morning-chat',
  printPlaygroundCode: {},
  printPlaygroundOutputs: {},
  printPlaygroundVisited: [],
  printPlaygroundCompleted: [],
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
    const blackBoxQuizAnswers = cleanQuizAnswers(parsed.blackBoxQuizAnswers)
    const printPlaygroundCompleted = cleanPrintActivityIds(parsed.printPlaygroundCompleted)
    const completed = cleanActivityIds(parsed.completed)
    const quizCompleted = completed.filter((activity) => {
      if (activity === 'memory-machine') return memoryQuizAnswers.length === 10
      if (activity === 'black-box') return blackBoxQuizAnswers.length === 10
      if (activity === 'print-playground') return printCoreActivityIds.every((id) => printPlaygroundCompleted.includes(id))
      return true
    })
    return {
      ...createSession(parsed.name),
      ...parsed,
      name: cleanName(parsed.name),
      completed: quizCompleted,
      blackBoxQuizAnswers,
      memoryQuizAnswers,
      blackBoxCode: migrateBlackBoxCode(parsed.blackBoxCode),
      printPlaygroundActivity: cleanPrintActivityId(parsed.printPlaygroundActivity),
      printPlaygroundCode: cleanPrintCode(parsed.printPlaygroundCode),
      printPlaygroundOutputs: cleanPrintOutputs(parsed.printPlaygroundOutputs),
      printPlaygroundVisited: cleanPrintActivityIds(parsed.printPlaygroundVisited),
      printPlaygroundCompleted,
    }
  } catch {
    return null
  }
}

function migrateBlackBoxCode(value: unknown): string {
  const legacy = 'number = int(input())\n\nresult = number * 2\n\nprint(result)'
  if (typeof value !== 'string' || value === legacy) return emptyProgress.blackBoxCode
  return value
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

function cleanPrintActivityId(value: unknown): PrintActivityId {
  return printActivityIds.includes(value as PrintActivityId) ? value as PrintActivityId : 'morning-chat'
}

function cleanPrintActivityIds(value: unknown): PrintActivityId[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is PrintActivityId => printActivityIds.includes(item as PrintActivityId)))]
}

function cleanPrintCode(value: unknown): Partial<Record<PrintActivityId, string>> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(printActivityIds.flatMap((id) => typeof (value as Record<string, unknown>)[id] === 'string' ? [[id, (value as Record<string, string>)[id]]] : []))
}

function cleanPrintOutputs(value: unknown): Partial<Record<PrintActivityId, PrintActivityOutputState>> {
  if (!value || typeof value !== 'object') return {}
  const source = value as Record<string, unknown>
  return Object.fromEntries(printActivityIds.flatMap((id) => {
    const state = source[id] as Partial<PrintActivityOutputState> | undefined
    return state && typeof state.text === 'string' && ['output', 'error', 'success'].includes(state.kind ?? '')
      ? [[id, { text: state.text, kind: state.kind }]]
      : []
  }))
}
