export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '!='

export const comparisonOperators: ComparisonOperator[] = ['>', '<', '>=', '<=', '==', '!=']

export const energyRange = { min: 0, max: 100 } as const

export const championGates = 670

export type BoolName = 'has_key' | 'lights_on' | 'door_locked' | 'has_map' | 'is_safe' | 'has_flashlight'
export const boolNames: BoolName[] = ['has_key', 'lights_on', 'door_locked', 'has_map', 'is_safe', 'has_flashlight']

// A gate condition is one or two clauses joined by and: at most one energy
// comparison and at most one bool, so a gate never needs more than two inputs.
export type Clause =
  | { type: 'compare'; operator: ComparisonOperator; threshold: number }
  | { type: 'bool'; name: BoolName; form: 'plain' | 'true' | 'false' }

export interface GateValues {
  energy: number
  flag: boolean
}

export type GateKind = 'set' | 'fork'

export interface BackroomGate {
  id: string
  // set: the player edits the variables until the condition is TRUE.
  // fork: the values are given and the player steers into the TRUE or FALSE door.
  kind: GateKind
  clauses: Clause[]
  start: GateValues
  liveTruth: boolean
}

export type SkillKey = ComparisonOperator | 'bool' | 'and'
export const skillKeys: SkillKey[] = ['>', '<', '>=', '<=', '==', '!=', 'bool', 'and']

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

export function evaluateClause(clause: Clause, values: GateValues): boolean {
  if (clause.type === 'compare') return evaluateCondition(values.energy, clause.operator, clause.threshold)
  return clause.form === 'false' ? values.flag === false : values.flag === true
}

export function evaluateGate(gate: Pick<BackroomGate, 'clauses'>, values: GateValues): boolean {
  return gate.clauses.every((clause) => evaluateClause(clause, values))
}

export function gateBool(gate: Pick<BackroomGate, 'clauses'>): BoolName | null {
  const clause = gate.clauses.find((item) => item.type === 'bool')
  return clause?.type === 'bool' ? clause.name : null
}

export function gateUsesEnergy(gate: Pick<BackroomGate, 'clauses'>): boolean {
  return gate.clauses.some((clause) => clause.type === 'compare')
}

export function gateOperators(gate: Pick<BackroomGate, 'clauses'>): ComparisonOperator[] {
  return gate.clauses.flatMap((clause) => clause.type === 'compare' ? [clause.operator] : [])
}

export function gateSkills(gate: Pick<BackroomGate, 'clauses'>): SkillKey[] {
  const skills: SkillKey[] = [...gateOperators(gate)]
  if (gateBool(gate)) skills.push('bool')
  if (gate.clauses.length > 1) skills.push('and')
  return skills
}

// Python spells the bool values True and False.
export function pythonBool(value: boolean): string {
  return value ? 'True' : 'False'
}

export function clauseCode(clause: Clause): string {
  if (clause.type === 'compare') return `energy ${clause.operator} ${clause.threshold}`
  if (clause.form === 'plain') return clause.name
  return `${clause.name} == ${pythonBool(clause.form === 'true')}`
}

export function conditionCode(gate: Pick<BackroomGate, 'clauses'>): string {
  return gate.clauses.map(clauseCode).join(' and ')
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

export interface GateStep {
  code: string
  result: boolean
}

export interface GateExplanation {
  steps: GateStep[]
  result: boolean
  tip: string
}

function clauseTip(clause: Clause, values: GateValues): string {
  if (clause.type === 'bool') {
    if (clause.form === 'false') return `${clause.name} == False is TRUE only when ${clause.name} is False.`
    return `A bool is only True or False. ${clause.name} must be True here.`
  }
  const { operator, threshold } = clause
  const value = values.energy
  if (value === threshold) {
    if (operator === '>' || operator === '<') return `The edge does not count: ${value} ${operator} ${threshold} is False.`
    if (operator === '>=' || operator === '<=') return `The edge counts: ${value} ${operator} ${threshold} is True.`
  }
  switch (operator) {
    case '>': return `> needs a number above ${threshold}.`
    case '<': return `< needs a number below ${threshold}.`
    case '>=': return `>= means ${threshold} or more.`
    case '<=': return `<= means ${threshold} or less.`
    case '==': return `== needs exactly ${threshold}. Nothing else.`
    case '!=': return `!= is True for every number except ${threshold}.`
  }
}

// Builds the evaluation trace a student sees after a mistake: each clause
// with its values substituted, then the and combination when there are two.
export function explainGate(gate: Pick<BackroomGate, 'clauses'>, values: GateValues): GateExplanation {
  const steps = gate.clauses.map((clause) => ({
    code: clause.type === 'compare'
      ? `${values.energy} ${clause.operator} ${clause.threshold}`
      : clause.form === 'plain' ? `${clause.name} is ${pythonBool(values.flag)}` : `${pythonBool(values.flag)} == ${pythonBool(clause.form === 'true')}`,
    result: evaluateClause(clause, values),
  }))
  const result = steps.every((step) => step.result)
  if (steps.length > 1) steps.push({ code: steps.map((step) => pythonBool(step.result)).join(' and '), result })
  const tip = gate.clauses.length > 1
    ? result ? 'and is True because BOTH sides are True.' : 'and is True only when BOTH sides are True.'
    : clauseTip(gate.clauses[0], values)
  return { steps, result, tip }
}

// XP for one cleared gate: a steady base, plus a bonus for a clean streak.
// The value closest to the edge that still makes a comparison TRUE (!= accepts either neighbour).
export function edgeValues(operator: ComparisonOperator, threshold: number): number[] {
  switch (operator) {
    case '>': return [threshold + 1]
    case '>=': return [threshold]
    case '<': return [threshold - 1]
    case '<=': return [threshold]
    case '==': return [threshold]
    case '!=': return [threshold - 1, threshold + 1]
  }
}

export function gateXp(combo: number): number {
  return 10 + (combo >= 6 ? 10 : combo >= 3 ? 5 : 0)
}

export function comboMultiplierLabel(combo: number): string {
  return combo >= 6 ? 'x3' : combo >= 3 ? 'x2' : 'x1'
}

export const baseRunSpeed = 0.95 * 1.2 * 1.3

export const paceStep = 0.11 * 1.2

// Endless pace: grows with every gate and never caps.
export function speedForGate(gateNumber: number): number {
  return baseRunSpeed + Math.max(0, gateNumber - 1) * paceStep
}

// Tapes start at their own pace and also speed up after every gate.
export function speedForLevelGate(levelSpeed: number, gateNumber: number): number {
  return levelSpeed + Math.max(0, gateNumber - 1) * paceStep
}

export const jumpSeconds = 0.78
export const jumpHeight = 0.36
// Above this height the player clears chairs, bins and barriers.
export const clearHeight = 0.12

export function jumpOffset(elapsed: number): number {
  if (elapsed < 0 || elapsed >= jumpSeconds) return 0
  const t = elapsed / jumpSeconds
  return 4 * jumpHeight * t * (1 - t)
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
  pickups: CorridorPickup[]
  nextGateZ: number
  nextGateCenter: number
  activationZ: number
}

export interface CorridorObstacle {
  z: number
  x: number
  side: -1 | 1
  // A barrier or a hole spans the whole corridor and can only be jumped.
  // A saw comes out of the wall on `side` and covers that half: dodge to the other side.
  // A drill strikes one lane (x), down from the ceiling (side 1) or up from the floor (side -1).
  kind: 'chair' | 'trash' | 'barrier' | 'hole' | 'saw' | 'drill'
}

// A spare camcorder battery lying on the carpet.
export interface CorridorPickup {
  z: number
  x: number
}

export type JumpHazard = 'barrier' | 'hole'
export type DrillLane = 'left' | 'middle' | 'right'
export type CorridorHazard = JumpHazard | 'saw-left' | 'saw-right' | `drill-${'ceiling' | 'floor'}-${DrillLane}`
export const holeHalfLength = 0.26
// A saw's blade reaches this far past the middle of the corridor.
export const sawReach = 0.08
// The blade starts coming out of the wall this far ahead, and is fully out at sawOut.
export const sawEmerge = 7
export const sawOut = 4.5
// A drill marks its lane from drillWarn ahead, strikes at drillStrike and is fully out at drillOut.
export const drillWarn = 9
export const drillStrike = 6.5
export const drillOut = 5.2
export const drillLane = 0.4
export const drillHit = 0.3

const bendLength = 8
const bendSpacing = 12
const gateClearance = 26
export const gateApproach = 16
const turnShift = 1.15

export function planCorridor(gateZ: number, gateCenter: number, tiles: CourseTile[], jumps: boolean | CorridorHazard | Array<CorridorHazard | null> = false, battery = false): CorridorPlan {
  let center = gateCenter
  const bends = tiles.filter((tile) => tile.kind === 'curve').map((tile, index) => {
    const dir = tile.dir as -1 | 1
    const startZ = gateZ + 7 + index * bendSpacing
    const bend = { startZ, endZ: startZ + bendLength, from: center, to: center + dir * turnShift, dir }
    center = bend.to
    return bend
  })
  const nextGateZ = (bends[bends.length - 1]?.endZ ?? gateZ + 12) + gateClearance
  const lastBend = bends[bends.length - 1]
  const side = ((Math.abs(Math.round(gateZ * 7 + center * 13)) % 2 === 0 ? -1 : 1) as -1 | 1)
  const obstacles: CorridorObstacle[] = lastBend ? [{
    z: lastBend.endZ + 6,
    x: center + side * 0.43,
    side,
    kind: Math.abs(Math.round(gateZ + center * 5)) % 2 === 0 ? 'chair' : 'trash',
  }] : []
  // Hazards fill up to two slots: the straight after the first bend, then the straight after the
  // second. With two bends the second slot sits just past the last bend, before the battery and the
  // chair, so there is always room to line up for the chair after a saw or a drill.
  const wanted = Array.isArray(jumps) ? jumps : jumps ? [jumps === true ? 'barrier' : jumps] : []
  const slots = bends.length >= 3 ? [bends[0].endZ + 2, bends[1].endZ + 2] : bends.length === 2 ? [bends[0].endZ + 2, bends[1].endZ + 1.5] : []
  wanted.forEach((kind, index) => {
    const z = slots[index]
    if (!kind || z === undefined) return
    const x = corridorCenterAt(gateCenter, bends, z)
    if (kind === 'saw-left' || kind === 'saw-right') obstacles.push({ z, x, side: kind === 'saw-left' ? -1 : 1, kind: 'saw' })
    else if (kind.startsWith('drill-')) {
      const [, from, lane] = kind.split('-')
      obstacles.push({ z, x: x + (lane === 'left' ? -drillLane : lane === 'right' ? drillLane : 0), side: from === 'ceiling' ? 1 : -1, kind: 'drill' })
    } else obstacles.push({ z, x, side: 1, kind: kind as JumpHazard })
  })
  obstacles.sort((a, b) => a.z - b.z)
  // A battery waits on the last straight, on the side away from the chair or bin.
  const pickups: CorridorPickup[] = battery && lastBend ? [{ z: lastBend.endZ + 3, x: center - side * 0.22 }] : []
  return { bends, obstacles, pickups, nextGateZ, nextGateCenter: center, activationZ: nextGateZ - gateApproach }
}

export function hitsObstacle(previousDepth: number, depth: number, playerX: number, obstacle: CorridorObstacle, airborne = false): boolean {
  // A drill fills its lane from floor to ceiling: steer into another lane.
  if (obstacle.kind === 'drill') return previousDepth <= obstacle.z + 0.25 && depth >= obstacle.z - 0.25 && Math.abs(playerX - obstacle.x) < drillHit
  // A saw cannot be jumped: only the far half of the corridor is safe.
  if (obstacle.kind === 'saw') return previousDepth <= obstacle.z + 0.2 && depth >= obstacle.z - 0.2 && obstacle.side * (playerX - obstacle.x) > -sawReach
  if (airborne) return false
  // Anyone on the ground over the hole falls: the whole crossing must be in the air.
  if (obstacle.kind === 'hole') return previousDepth <= obstacle.z + holeHalfLength && depth >= obstacle.z - holeHalfLength
  const crossing = obstacle.kind === 'barrier'
    ? previousDepth <= obstacle.z + 0.06 && depth >= obstacle.z - 0.06
    : previousDepth <= obstacle.z + 0.35 && depth >= obstacle.z - 0.35
  return crossing && (obstacle.kind === 'barrier' || Math.abs(playerX - obstacle.x) < 0.27)
}

export function picksUp(previousDepth: number, depth: number, playerX: number, pickup: CorridorPickup): boolean {
  return previousDepth <= pickup.z + 0.2 && depth >= pickup.z - 0.2 && Math.abs(playerX - pickup.x) < 0.32
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
  return bends[bends.length - 1]?.to ?? baseCenter
}

// Fork doors split the gate in two lanes around a centre pillar.
export const forkLaneOffset = 0.38
const pillarHalfWidth = 0.07

export function forkSide(playerX: number, gateCenter: number): -1 | 0 | 1 {
  const offset = playerX - gateCenter
  if (Math.abs(offset) <= pillarHalfWidth) return 0
  return offset < 0 ? -1 : 1
}

// The side of the door a correct player walks through.
export function correctForkSide(truth: boolean, trueSide: -1 | 1): -1 | 1 {
  return truth ? trueSide : (-trueSide as -1 | 1)
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] ?? items[0]
}

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

function thresholdFor(random: () => number, operator: ComparisonOperator): number {
  switch (operator) {
    case '>': return randomInt(random, 20, 90)
    case '<': return randomInt(random, 10, 80)
    case '>=': return randomInt(random, 15, 90)
    case '<=': return randomInt(random, 10, 85)
    default: return randomInt(random, 12, 88)
  }
}

// A starting value that makes the comparison FALSE but is close enough to fix.
export function falseStart(random: () => number, operator: ComparisonOperator, threshold: number): number {
  const gap = randomInt(random, 6, 18)
  switch (operator) {
    case '>': return Math.max(energyRange.min, threshold - gap + 1)
    case '>=': return Math.max(energyRange.min, threshold - gap)
    case '<': return Math.min(energyRange.max, threshold + gap - 1)
    case '<=': return Math.min(energyRange.max, threshold + gap)
    case '==': return Math.max(energyRange.min, Math.min(energyRange.max, threshold + pick(random, [-1, 1]) * gap))
    case '!=': return threshold
  }
}

// Given values for a fork: edge values are common because they are where
// students most often misread an operator.
function forkEnergy(random: () => number, threshold: number): number {
  const roll = random()
  if (roll < 0.35) return threshold
  const near = randomInt(random, 1, 3) * (random() < 0.5 ? -1 : 1)
  if (roll < 0.65) return Math.max(energyRange.min, Math.min(energyRange.max, threshold + near))
  return Math.max(energyRange.min, Math.min(energyRange.max, threshold + randomInt(random, 8, 30) * (random() < 0.5 ? -1 : 1)))
}

type EndlessShape = 'set-compare' | 'fork-compare' | 'set-bool' | 'fork-bool' | 'set-and' | 'fork-and'

// The Deep sticks to comparisons: gates to set and door pairs to choose.
function shapesFor(gateNumber: number): EndlessShape[] {
  if (gateNumber <= 3) return ['set-compare']
  return ['set-compare', 'fork-compare', 'fork-compare']
}

function boolClause(random: () => number): Extract<Clause, { type: 'bool' }> {
  return { type: 'bool', name: pick(random, boolNames), form: pick(random, ['plain', 'true', 'false'] as const) }
}

// Endless gates: every type the levels teach, mixed and unlocked gradually.
// Operators the student often gets wrong come up more often (up to four times as likely).
export function operatorWeight(record: { right: number; wrong: number } | undefined): number {
  if (!record) return 1
  return 1 + 3 * (record.wrong / (record.right + record.wrong + 1))
}

export function generateEndlessGate(gateNumber: number, random: () => number, previous?: BackroomGate, skills: Partial<Record<SkillKey, { right: number; wrong: number }>> = {}): BackroomGate {
  const id = `deep-${gateNumber}`
  const previousOperator = previous ? gateOperators(previous)[0] : undefined
  let shape = pick(random, shapesFor(gateNumber))
  if (previous && previous.kind === 'set' && shape.startsWith('set') && random() < 0.5) shape = shape.replace('set', 'fork') as EndlessShape
  const operators = comparisonOperators.filter((operator) => operator !== previousOperator)
  const weights = operators.map((operator) => operatorWeight(skills[operator]))
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0)
  const operator = operators.find((_, index) => (roll -= weights[index]) < 0) ?? operators[operators.length - 1]
  const threshold = thresholdFor(random, operator)
  const compare: Clause = { type: 'compare', operator, threshold }
  const flag = boolClause(random)
  // The value that makes a bool clause false: the opposite of what it needs.
  const falseFlag = flag.form === 'false'

  switch (shape) {
    case 'set-compare':
      return { id, kind: 'set', clauses: [compare], start: { energy: falseStart(random, operator, threshold), flag: false }, liveTruth: false }
    case 'fork-compare':
      return { id, kind: 'fork', clauses: [compare], start: { energy: forkEnergy(random, threshold), flag: false }, liveTruth: false }
    case 'set-bool':
      return { id, kind: 'set', clauses: [flag], start: { energy: 50, flag: falseFlag }, liveTruth: false }
    case 'fork-bool':
      return { id, kind: 'fork', clauses: [flag], start: { energy: 50, flag: random() < 0.5 }, liveTruth: false }
    case 'set-and':
      return { id, kind: 'set', clauses: [compare, flag], start: { energy: falseStart(random, operator, threshold), flag: random() < 0.5 ? falseFlag : !falseFlag }, liveTruth: false }
    case 'fork-and':
      return { id, kind: 'fork', clauses: [compare, flag], start: { energy: forkEnergy(random, threshold), flag: random() < 0.5 }, liveTruth: false }
  }
}
