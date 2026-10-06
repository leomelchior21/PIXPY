export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '!='

export const comparisonOperators: ComparisonOperator[] = ['>', '<', '>=', '<=', '==', '!=']

export const energyRange = { min: 0, max: 100 } as const

export const milestoneGates = 5
export const championGates = 670

export interface BackroomChallenge {
  id: string
  variableName: string
  operator: ComparisonOperator
  threshold: number
  startValue: number
  startsTrue: boolean
  difficulty: number
  operatorWords: string
  hint: string
}

export function evaluateCondition(value: number, operator: ComparisonOperator, threshold: number): boolean {
  switch (operator) {
    case '>': return value > threshold
    case '<': return value < threshold
    case '>=': return value >= threshold
    case '<=': return value <= threshold
    case '==': return value === threshold
    case '!=': return value !== threshold
  }
}

export function operatorWords(operator: ComparisonOperator): string {
  switch (operator) {
    case '>': return 'GREATER THAN'
    case '<': return 'LESS THAN'
    case '>=': return 'GREATER THAN OR EQUAL TO'
    case '<=': return 'LESS THAN OR EQUAL TO'
    case '==': return 'EQUAL TO'
    case '!=': return 'NOT EQUAL TO'
  }
}

export function operatorHint(challenge: BackroomChallenge): string {
  const { operator, threshold } = challenge
  switch (operator) {
    case '>': return `Try a number above ${threshold}.`
    case '<': return `Try a number below ${threshold}.`
    case '>=': return `${threshold} is allowed too. Try ${threshold} or more.`
    case '<=': return `${threshold} is allowed too. Try ${threshold} or less.`
    case '==': return `Both values must be exactly the same. Land on ${threshold}.`
    case '!=': return `Almost any number works. Just not ${threshold}.`
  }
}

export function challengeSentence(challenge: BackroomChallenge, value: number): string {
  return `${value} is ${operatorWords(challenge.operator).toLowerCase()} ${challenge.threshold}`
}

export function challengeExpression(challenge: BackroomChallenge, value: number): string {
  return `${challenge.variableName} ${challenge.operator} ${challenge.threshold} → energy = ${value}`
}

export function gateXp(firstTry: boolean): number {
  return firstTry ? 15 : 10
}

// Thirty percent faster than the current starting pace of 0.95 * 1.2.
export const baseRunSpeed = 0.95 * 1.2 * 1.3

export function speedForGate(gateNumber: number): number {
  return baseRunSpeed + Math.max(0, gateNumber - 1) * 0.11 * 1.2
}

export interface CourseTile {
  kind: 'curve' | 'gate'
  dir: -1 | 0 | 1
}

export function planCourse(random: () => number = Math.random, threeCurveChance = 0.45): CourseTile[] {
  const tiles: CourseTile[] = []
  const curves = random() < threeCurveChance ? 3 : 2
  for (let index = 0; index < curves; index += 1) {
    tiles.push({ kind: 'curve', dir: random() < 0.5 ? -1 : 1 })
  }
  tiles.push({ kind: 'gate', dir: 0 })
  return tiles
}

export interface CorridorBend {
  startZ: number
  endZ: number
  from: number
  to: number
  dir: -1 | 1
}

export interface CorridorPlan {
  bends: CorridorBend[]
  obstacles: CorridorObstacle[]
  nextGateZ: number
  nextGateCenter: number
  activationZ: number
}

export interface CorridorObstacle {
  z: number
  x: number
  side: -1 | 1
  kind: 'chair' | 'trash'
}

const bendLength = 8
const bendSpacing = 12
const gateClearance = 26
const gateApproach = 16
const turnShift = 1.15

export function planCorridor(gateZ: number, gateCenter: number, tiles: CourseTile[]): CorridorPlan {
  let center = gateCenter
  const bends = tiles.filter((tile) => tile.kind === 'curve').map((tile, index) => {
    const dir = tile.dir as -1 | 1
    const startZ = gateZ + 7 + index * bendSpacing
    const bend = { startZ, endZ: startZ + bendLength, from: center, to: center + dir * turnShift, dir }
    center = bend.to
    return bend
  })
  const nextGateZ = (bends.at(-1)?.endZ ?? gateZ + 12) + gateClearance
  const lastBend = bends.at(-1)
  const side = ((Math.abs(Math.round(gateZ * 7 + center * 13)) % 2 === 0 ? -1 : 1) as -1 | 1)
  const obstacles: CorridorObstacle[] = lastBend ? [{
    z: lastBend.endZ + 6,
    x: center + side * 0.43,
    side,
    kind: Math.abs(Math.round(gateZ + center * 5)) % 2 === 0 ? 'chair' : 'trash',
  }] : []
  return { bends, obstacles, nextGateZ, nextGateCenter: center, activationZ: nextGateZ - gateApproach }
}

export function hitsObstacle(previousDepth: number, depth: number, playerX: number, obstacle: CorridorObstacle): boolean {
  return previousDepth <= obstacle.z + 0.35 && depth >= obstacle.z - 0.35 && Math.abs(playerX - obstacle.x) < 0.34
}

export function corridorCenterAt(baseCenter: number, bends: CorridorBend[], worldZ: number): number {
  for (const bend of bends) {
    if (worldZ <= bend.startZ) return bend.from
    if (worldZ < bend.endZ) {
      const t = (worldZ - bend.startZ) / (bend.endZ - bend.startZ)
      const smooth = t * t * (3 - 2 * t)
      return bend.from + (bend.to - bend.from) * smooth
    }
  }
  return bends.at(-1)?.to ?? baseCenter
}

export function gateCrossing(previousDepth: number, depth: number, gateZ: number, conditionTrue: boolean, openAmount: number): 'before' | 'pass' | 'blocked' {
  if (previousDepth >= gateZ || depth < gateZ) return 'before'
  return conditionTrue && openAmount >= 0.95 ? 'pass' : 'blocked'
}

export function hasSolution(operator: ComparisonOperator, threshold: number): boolean {
  for (let value = energyRange.min; value <= energyRange.max; value += 1) {
    if (evaluateCondition(value, operator, threshold)) return true
  }
  return false
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function operatorPool(): ComparisonOperator[] {
  return ['>', '<', '>=', '<=', '==', '!=']
}

function pick<T>(random: () => number, items: T[]): T {
  return items[Math.floor(random() * items.length)] ?? items[0]
}

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

function pickStartValue(random: () => number, operator: ComparisonOperator, threshold: number): number {
  const gap = randomInt(random, 6, 18)
  switch (operator) {
    case '>':
    case '>=': return Math.max(energyRange.min, threshold - gap)
    case '<':
    case '<=': return Math.min(energyRange.max, threshold + gap)
    case '==': return Math.max(energyRange.min, Math.min(energyRange.max, threshold + pick(random, [-1, 1]) * gap))
    case '!=': return threshold
  }
}

function makeChallenge(id: string, operator: ComparisonOperator, threshold: number, startValue: number, difficulty: number): BackroomChallenge {
  const challenge: BackroomChallenge = {
    id,
    variableName: 'required_energy',
    operator,
    threshold,
    startValue,
    startsTrue: evaluateCondition(startValue, operator, threshold),
    difficulty,
    operatorWords: operatorWords(operator),
    hint: '',
  }
  challenge.hint = operatorHint(challenge)
  return challenge
}

export function generateChallenge(runNumber: number, seed: number, difficulty = 1, avoidOperator?: ComparisonOperator): BackroomChallenge {
  const id = `gate-${runNumber}-${seed}`
  if (runNumber <= 1) return makeChallenge(id, '>', 60, 30, 1)

  const random = mulberry32((seed ^ Math.imul(runNumber, 2654435761)) >>> 0)
  const tier = Math.max(1, Math.min(3, Math.round(difficulty)))
  let pool = operatorPool()
  if (avoidOperator) pool = pool.filter((operator) => operator !== avoidOperator)
  const operator = pick(random, pool)

  let threshold: number
  switch (operator) {
    case '>': threshold = randomInt(random, 20, 95); break
    case '<': threshold = randomInt(random, 5, 80); break
    case '>=': threshold = randomInt(random, 15, 90); break
    case '<=': threshold = randomInt(random, 10, 85); break
    default: threshold = randomInt(random, 12, 88)
  }
  if (!hasSolution(operator, threshold)) threshold = operator === '>' ? 90 : operator === '<' ? 10 : threshold

  const startValue = pickStartValue(random, operator, threshold)
  return makeChallenge(id, operator, threshold, startValue, tier)
}
