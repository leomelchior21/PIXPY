import { baseRunSpeed, type BackroomGate, type Clause, type ComparisonOperator } from './backroomEngine'

export type CoachMoment = 'energy' | 'steer' | 'fork' | 'jump' | 'saw' | 'hole' | 'drill'
export const coachMoments: CoachMoment[] = ['energy', 'steer', 'fork', 'jump', 'saw', 'hole', 'drill']

export interface BackroomLevel {
  id: number
  title: string
  focus: string
  lead: string
  examples: Array<{ code: string; result: boolean }>
  speed: number
  // Guided pauses shown only until the student has cleared this level once.
  coach: CoachMoment[]
  gates: BackroomGate[]
}

export const maxBatteries = 3

const cmp = (operator: ComparisonOperator, threshold: number): Clause => ({ type: 'compare', operator, threshold })

function set(level: number, index: number, clauses: Clause[], energy: number, value = false, liveTruth = true): BackroomGate {
  return { id: `tape-${level}-${index}`, kind: 'set', clauses, start: { energy, flag: value }, liveTruth }
}

function fork(level: number, index: number, clauses: Clause[], energy: number, value = false): BackroomGate {
  return { id: `tape-${level}-${index}`, kind: 'fork', clauses, start: { energy, flag: value }, liveTruth: false }
}

export const backroomLevels: BackroomLevel[] = [
  {
    id: 1,
    title: 'LIGHTS ON',
    focus: '>  <',
    lead: 'A gate only opens when its condition is TRUE. Change energy until it is. The light shows TRUE or FALSE while you change it.',
    examples: [{ code: '70 > 50', result: true }, { code: '30 < 30', result: false }],
    speed: baseRunSpeed * 0.82,
    coach: ['energy', 'steer'],
    gates: [
      set(1, 1, [cmp('>', 50)], 20),
      set(1, 2, [cmp('<', 30)], 30),
      set(1, 3, [cmp('>', 75)], 75),
      set(1, 4, [cmp('<', 15)], 16),
    ],
  },
  {
    id: 2,
    title: 'TWO DOORS',
    focus: 'TRUE | FALSE',
    lead: 'Now the code sets energy. Read the condition, decide TRUE or FALSE, and steer into that door. Barriers appear: jump them.',
    examples: [{ code: '70 > 50', result: true }, { code: '60 > 60', result: false }],
    speed: baseRunSpeed * 0.9,
    coach: ['fork', 'jump'],
    gates: [
      fork(2, 1, [cmp('>', 50)], 70),
      fork(2, 2, [cmp('<', 30)], 45),
      fork(2, 3, [cmp('>', 60)], 60),
      fork(2, 4, [cmp('<', 25)], 24),
      fork(2, 5, [cmp('>', 80)], 79),
      fork(2, 6, [cmp('<', 40)], 12),
    ],
  },
  {
    id: 3,
    title: 'THE EDGE',
    focus: '>=  <=  ==  !=',
    lead: '>= and <= include the edge; > and < do not. == needs the exact same number; != is TRUE for every number except one. The light helps only on the first gate.',
    examples: [{ code: '40 >= 40', result: true }, { code: '50 != 50', result: false }],
    speed: baseRunSpeed * 0.95,
    coach: ['saw', 'hole'],
    gates: [
      set(3, 1, [cmp('>=', 40)], 39),
      fork(3, 2, [cmp('>=', 45)], 45),
      set(3, 3, [cmp('<=', 60)], 61, false, false),
      fork(3, 4, [cmp('==', 25)], 25),
      set(3, 5, [cmp('==', 80)], 81, false, false),
      fork(3, 6, [cmp('!=', 50)], 50),
      fork(3, 7, [cmp('<=', 30)], 31),
    ],
  },
  {
    id: 4,
    title: 'FINAL CUT',
    focus: 'everything',
    lead: 'Every operator, gates and doors mixed, faster, every hazard in the building, and no light says TRUE or FALSE. Read the condition and trust your reading.',
    examples: [{ code: '60 >= 60', result: true }, { code: '75 != 75', result: false }],
    speed: baseRunSpeed * 1.02,
    coach: ['drill'],
    gates: [
      set(4, 1, [cmp('>=', 60)], 59, false, false),
      fork(4, 2, [cmp('<', 35)], 35),
      set(4, 3, [cmp('!=', 20)], 20, false, false),
      fork(4, 4, [cmp('>', 70)], 71),
      fork(4, 5, [cmp('!=', 55)], 56),
      set(4, 6, [cmp('<=', 15)], 16, false, false),
      fork(4, 7, [cmp('==', 90)], 91),
      set(4, 8, [cmp('<', 50)], 50, false, false),
    ],
  },
]

export const levelCount = backroomLevels.length

// Hazards build up per tape: barriers on 02, saws and holes on 03, drills on 04.
// The Deep opens them one by one as the gates go by.
export type HazardKind = 'barrier' | 'saw' | 'hole' | 'drill'
const tapeHazards: HazardKind[][] = [[], ['barrier'], ['barrier', 'saw', 'hole'], ['barrier', 'saw', 'hole', 'drill']]
const deepHazards: Array<[HazardKind, number]> = [['barrier', 3], ['saw', 5], ['hole', 7], ['drill', 9]]

export function hazardsFor(levelIndex: number | null, gateNumber: number): HazardKind[] {
  if (levelIndex === null) return deepHazards.filter(([, from]) => gateNumber >= from).map(([kind]) => kind)
  return tapeHazards[levelIndex] ?? []
}

// Most corridors get one hazard; later tapes often add a second.
export function hazardChance(levelIndex: number | null, gateNumber: number, slot: 0 | 1): number {
  if (hazardsFor(levelIndex, gateNumber).length === 0) return 0
  if (slot === 0) return 0.85
  if (levelIndex === null) return gateNumber >= 5 ? 0.65 : 0
  return levelIndex >= 2 ? 0.6 : 0.35
}

// Older saves held six tapes. Layout 2 was Lights On, Two Doors, The Edge, Exactly,
// No Light, Final Cut; before that it was Lights On, The Edge, Exactly, Two Doors,
// No Light, Final Cut. Merged tapes keep the best stars of the two they replace.
const sixTapeOrder: Record<1 | 2, number[]> = { 1: [0, 3, 1, 2, 4, 5], 2: [0, 1, 2, 3, 4, 5] }
export function migrateTapeStars(stars: readonly number[], layout: 1 | 2): number[] {
  const six = sixTapeOrder[layout].map((index) => stars[index] ?? 0)
  return normalizeStars([six[0], six[1], Math.max(six[2], six[3]), Math.max(six[4], six[5])])
}

// Spare batteries turn up only when the camcorder is missing charge, and always when it is dead.
export function batteryChance(batteries: number): number {
  return batteries <= 0 ? 1 : batteries < maxBatteries ? 0.4 : 0
}

export function starsFor(mistakes: number): number {
  return mistakes <= 0 ? 3 : mistakes === 1 ? 2 : 1
}

export function normalizeStars(stars: readonly number[] | undefined): number[] {
  return backroomLevels.map((_, index) => {
    const value = stars?.[index]
    return typeof value === 'number' && Number.isInteger(value) ? Math.max(0, Math.min(3, value)) : 0
  })
}

// Tapes open one at a time; unlockAll is the teacher preview.
export function levelUnlocked(index: number, stars: readonly number[], unlockAll: boolean): boolean {
  return unlockAll || index === 0 || (stars[index - 1] ?? 0) > 0
}

export function endlessUnlocked(stars: readonly number[], unlockAll: boolean): boolean {
  return unlockAll || backroomLevels.every((_, index) => (stars[index] ?? 0) > 0)
}

// The next tape to play: the first one not yet cleared, or null when all are done.
export function nextLevelIndex(stars: readonly number[]): number | null {
  const index = backroomLevels.findIndex((_, i) => (stars[i] ?? 0) === 0)
  return index === -1 ? null : index
}
