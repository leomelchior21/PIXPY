export const activityIds = [
  'dino-variables',
  'print-playground',
  'black-box',
  'input-machine',
  'memory-machine',
  'build-black-box',
  'final-bosses',
] as const

export type ActivityId = (typeof activityIds)[number]

export type AppRoute =
  | 'home'
  | 'variables'
  | 'conditionals'
  | 'functions'
  | ActivityId

export interface SessionProgress {
  name: string
  completed: ActivityId[]
  blackBoxLevels: number[]
  blackBoxQuizAnswers: number[]
  inputModes: string[]
  memoryExamples: string[]
  memoryQuizAnswers: number[]
  bossProgress: number[]
  blackBoxCode: string
  blackBoxTests: Array<{ input: number; output: number }>
  interestingValues: string[]
  printPlaygroundActivity: PrintActivityId
  printPlaygroundCode: Partial<Record<PrintActivityId, string>>
  printPlaygroundOutputs: Partial<Record<PrintActivityId, PrintActivityOutputState>>
  printPlaygroundVisited: PrintActivityId[]
  printPlaygroundCompleted: PrintActivityId[]
}

export interface DinoConfig {
  player_speed: number
  jump_power: number
  gravity: number
  obstacle_speed: number
  obstacle_count: number
  player_size: number
  lives: number
}

export interface DinoValues {
  speed: number
  jump: number
  gravity: number
  obstacles: number
  player_size: number
}

export type DinoValueKey = keyof DinoValues

export interface DinoRunResult {
  values: DinoValues
  config: DinoConfig
  warnings: string[]
}

export interface ScriptRunResult {
  stdout: string
  variables: Record<string, string | number | boolean | null>
}

export type RuntimeState = 'booting' | 'ready' | 'unavailable'

export const printActivityIds = [
  'morning-chat',
  'introduce-yourself',
  'blank-line',
  'draw-frame',
  'initials-banner',
  'player-id-card',
  'launch-countdown',
  'crack-code',
] as const

export const printCoreActivityIds = printActivityIds.slice(0, 5)

export type PrintActivityId = (typeof printActivityIds)[number]

export interface PrintActivityOutputState {
  text: string
  kind: 'output' | 'error' | 'success'
}
