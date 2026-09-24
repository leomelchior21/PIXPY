export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '!='

export const comparisonOperators: ComparisonOperator[] = ['>', '<', '>=', '<=', '==', '!=']

export const sliderRange = { min: 0, max: 100 } as const

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
  return `${challenge.variableName} ${challenge.operator} ${challenge.threshold} → ${challenge.variableName} = ${value}`
}

export function gateXp(firstTry: boolean): number {
  return firstTry ? 15 : 10
}

export interface CourseTile {
  kind: 'curve' | 'gate'
  dir: -1 | 0 | 1
}

export function planCourse(random: () => number = Math.random, twoCurveChance = 0.45): CourseTile[] {
  const tiles: CourseTile[] = []
  const curves = random() < twoCurveChance ? 2 : 1
  for (let index = 0; index < curves; index += 1) {
    tiles.push({ kind: 'curve', dir: random() < 0.5 ? -1 : 1 })
  }
  tiles.push({ kind: 'gate', dir: 0 })
  return tiles
}

export function hasSolution(operator: ComparisonOperator, threshold: number): boolean {
  for (let value = sliderRange.min; value <= sliderRange.max; value += 1) {
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

function trueRange(operator: ComparisonOperator, threshold: number): [number, number] {
  switch (operator) {
    case '>': return [threshold + 1, sliderRange.max]
    case '<': return [sliderRange.min, threshold - 1]
    case '>=': return [threshold, sliderRange.max]
    case '<=': return [sliderRange.min, threshold]
    case '==': return [threshold, threshold]
    case '!=': return [sliderRange.min, sliderRange.max]
  }
}

function falseRange(operator: ComparisonOperator, threshold: number): [number, number] {
  switch (operator) {
    case '>': return [sliderRange.min, threshold]
    case '<': return [threshold, sliderRange.max]
    case '>=': return [sliderRange.min, threshold - 1]
    case '<=': return [threshold + 1, sliderRange.max]
    case '==': return [sliderRange.min, sliderRange.max]
    case '!=': return [threshold, threshold]
  }
}

function pickStartValue(random: () => number, operator: ComparisonOperator, threshold: number): { startValue: number; startsTrue: boolean } {
  const startsTrue = random() < 0.3
  if (operator === '!=' && !startsTrue) return { startValue: threshold, startsTrue: false }
  if (operator === '==') {
    const value = pick(random, [randomInt(random, 0, 30), randomInt(random, 70, 100)])
    return { startValue: value === threshold ? (threshold + 20) % 101 : value, startsTrue: false }
  }
  if (startsTrue) {
    const [min, max] = trueRange(operator, threshold)
    return { startValue: randomInt(random, min, max), startsTrue: true }
  }
  const [min, max] = falseRange(operator, threshold)
  if (operator === '>=' || operator === '>') {
    const safeMax = Math.max(min, max - (operator === '>=' ? 4 : 4))
    return { startValue: randomInt(random, min, Math.max(min, safeMax)), startsTrue: false }
  }
  if (operator === '<=' || operator === '<') {
    const safeMin = Math.min(max, min + 4)
    return { startValue: randomInt(random, Math.min(safeMin, max), max), startsTrue: false }
  }
  return { startValue: randomInt(random, min, max), startsTrue: false }
}

function makeChallenge(id: string, operator: ComparisonOperator, threshold: number, startValue: number, difficulty: number): BackroomChallenge {
  const challenge: BackroomChallenge = {
    id,
    variableName: 'energy',
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

  const { startValue } = pickStartValue(random, operator, threshold)
  return makeChallenge(id, operator, threshold, startValue, tier)
}
