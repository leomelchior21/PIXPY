import {
  activityIds,
  printActivityIds,
  printCoreActivityIds,
  type ActivityId,
  type PrintActivityId,
  type PrintActivityOutputState,
  type SessionProgress,
} from '../types'

const SESSION_KEY = 'pixpy.session.v3'

export const emptyProgress: Omit<SessionProgress, 'name' | 'username' | 'isTeacher'> = {
  completed: [],
  backroomRunXp: 0,
  backroomRunBest: 0,
  backroomRunGates: 0,
  backroomRunOperators: [],
  choiceMachineStoriesComplete: false,
  choiceMachineQuizIndex: 0,
  choiceMachineXp: 0,
  blackBoxLevels: [],
  blackBoxQuizAnswers: [],
  blackBoxQuizStartedAt: null,
  blackBoxQuizElapsedMs: null,
  blackBoxQuizSeed: 11,
  blackBoxQuizResults: [],
  inputModes: [],
  memoryExamples: [],
  memoryQuizAnswers: [],
  memoryQuizCompleted: false,
  bossProgress: [],
  interestingValues: [],
  printPlaygroundActivity: 'morning-chat',
  printPlaygroundCode: {},
  printPlaygroundOutputs: {},
  printPlaygroundVisited: [],
  printPlaygroundCompleted: [],
}

export function createSession(name: string, username = cleanUsername(name), isTeacher = false): SessionProgress {
  return { name: cleanName(name), username: cleanUsername(username), isTeacher, ...structuredClone(emptyProgress) }
}

export function loadSession(): SessionProgress | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SessionProgress>
    return normalizeProgress(parsed)
  } catch {
    return null
  }
}

export function restoreProgress(username: string, displayName: string, value: unknown): SessionProgress {
  const stored = value && typeof value === 'object' ? value as Partial<SessionProgress> : {}
  return normalizeProgress({ ...stored, name: displayName, username, isTeacher: false }) ?? createSession(displayName, username)
}

function normalizeProgress(parsed: Partial<SessionProgress>): SessionProgress | null {
  if (!parsed.name || typeof parsed.name !== 'string') return null
  const username = cleanUsername(typeof parsed.username === 'string' ? parsed.username : parsed.name)
  if (!username) return null
  const memoryQuizAnswers = cleanQuizAnswers(parsed.memoryQuizAnswers)
  const blackBoxQuizAnswers = cleanQuizAnswers(parsed.blackBoxQuizAnswers)
  const blackBoxQuizResults = cleanBlackBoxQuizResults(parsed.blackBoxQuizResults)
  const printPlaygroundCompleted = cleanPrintActivityIds(parsed.printPlaygroundCompleted)
  const completed = cleanActivityIds(parsed.completed)
  const quizCompleted = completed.filter((activity) => {
    if (activity === 'memory-machine') return memoryQuizAnswers.length === 10 || parsed.memoryQuizCompleted === true
    if (activity === 'black-box') return blackBoxQuizAnswers.length === 10 || blackBoxQuizResults.length > 0
    if (activity === 'print-playground') return printCoreActivityIds.every((id) => printPlaygroundCompleted.includes(id))
    if (activity === 'choice-machine') return parsed.choiceMachineQuizIndex === 20
    return true
  })
  return {
    ...createSession(parsed.name, username, parsed.isTeacher === true),
    ...parsed,
    name: cleanName(parsed.name),
    username,
    isTeacher: parsed.isTeacher === true,
    completed: quizCompleted,
    backroomRunXp: cleanWholeNumber(parsed.backroomRunXp, 0, 100000),
    backroomRunBest: cleanWholeNumber(parsed.backroomRunBest, 0, 10000),
    backroomRunGates: cleanWholeNumber(parsed.backroomRunGates, 0, 100000),
    backroomRunOperators: cleanOperatorList(parsed.backroomRunOperators),
    choiceMachineStoriesComplete: parsed.choiceMachineStoriesComplete === true,
    choiceMachineQuizIndex: cleanChoiceQuizIndex(parsed.choiceMachineQuizIndex),
    choiceMachineXp: cleanChoiceXp(parsed.choiceMachineXp),
    blackBoxQuizAnswers,
    blackBoxQuizStartedAt: cleanTimestamp(parsed.blackBoxQuizStartedAt),
    blackBoxQuizElapsedMs: cleanElapsed(parsed.blackBoxQuizElapsedMs),
    blackBoxQuizSeed: cleanQuizSeed(parsed.blackBoxQuizSeed),
    blackBoxQuizResults,
    memoryQuizAnswers,
    memoryQuizCompleted: parsed.memoryQuizCompleted === true || memoryQuizAnswers.length === 10,
    printPlaygroundActivity: cleanPrintActivityId(parsed.printPlaygroundActivity),
    printPlaygroundCode: cleanPrintCode(parsed.printPlaygroundCode),
    printPlaygroundOutputs: cleanPrintOutputs(parsed.printPlaygroundOutputs),
    printPlaygroundVisited: cleanPrintActivityIds(parsed.printPlaygroundVisited),
    printPlaygroundCompleted,
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

type ResettableActivityId = 'black-box' | 'input-machine' | 'memory-machine' | 'final-bosses'

export function resetActivityProgress(progress: SessionProgress, activity: ResettableActivityId): SessionProgress {
  const reset = { ...progress, completed: progress.completed.filter((id) => id !== activity) }

  if (activity === 'black-box') {
    return {
      ...reset,
      blackBoxLevels: [],
      blackBoxQuizAnswers: [],
      blackBoxQuizStartedAt: null,
      blackBoxQuizElapsedMs: null,
      blackBoxQuizSeed: emptyProgress.blackBoxQuizSeed,
      blackBoxQuizResults: [],
    }
  }
  if (activity === 'input-machine') return { ...reset, inputModes: [] }
  if (activity === 'memory-machine') {
    return { ...reset, memoryExamples: [], memoryQuizAnswers: [], memoryQuizCompleted: false }
  }
  return { ...reset, bossProgress: [] }
}

export function cleanName(value: string): string {
  return value
    .replace(/[^\p{L}\p{M}' -]/gu, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, 28)
}

export function cleanUsername(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 40)
}

function cleanActivityIds(value: unknown): ActivityId[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ActivityId => activityIds.includes(item as ActivityId))
}

function cleanQuizAnswers(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((answer) => Number.isInteger(answer) && answer >= 0 && answer <= 3).slice(0, 10)
}

const comparisonOperators = ['>', '<', '>=', '<=', '==', '!='] as const

function cleanOperatorList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && comparisonOperators.includes(item as typeof comparisonOperators[number])))]
}

function cleanWholeNumber(value: unknown, min: number, max: number): number {
  return typeof value === 'number' && Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : min
}

function cleanChoiceQuizIndex(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? Math.max(0, Math.min(20, value)) : 0
}

function cleanChoiceXp(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? Math.max(0, Math.min(200, value)) : 0
}

function cleanTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function cleanElapsed(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function cleanQuizSeed(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : emptyProgress.blackBoxQuizSeed
}

function cleanBlackBoxQuizResults(value: unknown): SessionProgress['blackBoxQuizResults'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((result) => {
    const item = result as Partial<SessionProgress['blackBoxQuizResults'][number]>
    const { score, total, elapsedMs } = item
    return typeof score === 'number' && Number.isInteger(score) && typeof total === 'number' && Number.isInteger(total) && typeof elapsedMs === 'number' && Number.isFinite(elapsedMs)
      ? [{ score, total, elapsedMs: Math.max(0, elapsedMs) }]
      : []
  }).slice(-5)
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
