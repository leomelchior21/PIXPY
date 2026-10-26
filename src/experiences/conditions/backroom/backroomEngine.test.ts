import { describe, expect, it } from "vitest";
import {
  baseRunSpeed, championGates, comparisonOperators, conditionCode, correctForkSide, corridorCenterAt, energyRange, evaluateCondition, evaluateGate,
  explainGate, falseStart, forkSide, gateSkills, gateXp, generateEndlessGate, hitsObstacle, mulberry32, operatorWords, planCorridor, planCourse,
  speedForGate, speedForLevelGate, jumpOffset, jumpSeconds, jumpHeight, type BackroomGate, type Clause, picksUp, edgeValues, operatorWeight,
} from './backroomEngine'

function lcg(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

const gate = (clauses: Clause[], kind: BackroomGate['kind'] = 'set'): BackroomGate => ({ id: 'test', kind, clauses, start: { energy: 0, flag: false }, liveTruth: false })

describe('comparisons', () => {
  it('evaluates every operator, including both edges', () => {
    expect([evaluateCondition(61, '>', 60), evaluateCondition(60, '>', 60)]).toEqual([true, false])
    expect([evaluateCondition(59, '<', 60), evaluateCondition(60, '<', 60)]).toEqual([true, false])
    expect([evaluateCondition(60, '>=', 60), evaluateCondition(59, '>=', 60)]).toEqual([true, false])
    expect([evaluateCondition(60, '<=', 60), evaluateCondition(61, '<=', 60)]).toEqual([true, false])
    expect([evaluateCondition(60, '==', 60), evaluateCondition(61, '==', 60)]).toEqual([true, false])
    expect([evaluateCondition(61, '!=', 60), evaluateCondition(60, '!=', 60)]).toEqual([true, false])
  })

  it('names every operator', () => {
    expect(comparisonOperators.map(operatorWords)).toEqual(['GREATER THAN', 'LESS THAN', 'GREATER THAN OR EQUAL TO', 'LESS THAN OR EQUAL TO', 'EQUAL TO', 'NOT EQUAL TO'])
  })
})

describe('gate conditions', () => {
  it('reads bools in plain, == True and == False form', () => {
    expect(evaluateGate(gate([{ type: 'bool', name: 'has_key', form: 'plain' }]), { energy: 0, flag: true })).toBe(true)
    expect(evaluateGate(gate([{ type: 'bool', name: 'has_key', form: 'true' }]), { energy: 0, flag: false })).toBe(false)
    expect(evaluateGate(gate([{ type: 'bool', name: 'lights_on', form: 'false' }]), { energy: 0, flag: false })).toBe(true)
    expect(evaluateGate(gate([{ type: 'bool', name: 'lights_on', form: 'false' }]), { energy: 0, flag: true })).toBe(false)
  })

  it('needs both sides of and to be True', () => {
    const both = gate([{ type: 'compare', operator: '>', threshold: 40 }, { type: 'bool', name: 'has_key', form: 'plain' }])
    expect(evaluateGate(both, { energy: 41, flag: true })).toBe(true)
    expect(evaluateGate(both, { energy: 41, flag: false })).toBe(false)
    expect(evaluateGate(both, { energy: 40, flag: true })).toBe(false)
  })

  it('writes the Python condition the student reads', () => {
    expect(conditionCode(gate([{ type: 'compare', operator: '>=', threshold: 40 }, { type: 'bool', name: 'door_locked', form: 'false' }]))).toBe('energy >= 40 and door_locked == False')
    expect(conditionCode(gate([{ type: 'bool', name: 'has_key', form: 'plain' }]))).toBe('has_key')
  })

  it('tracks operators, bools and `and` as separate skills', () => {
    expect(gateSkills(gate([{ type: 'compare', operator: '!=', threshold: 4 }, { type: 'bool', name: 'has_map', form: 'true' }]))).toEqual(['!=', 'bool', 'and'])
  })
})

describe('mistake explanations', () => {
  it('substitutes the values and names the edge rule', () => {
    const strict = explainGate(gate([{ type: 'compare', operator: '>', threshold: 40 }]), { energy: 40, flag: false })
    expect(strict.steps).toEqual([{ code: '40 > 40', result: false }])
    expect(strict.tip).toMatch(/edge does not count/)
    const inclusive = explainGate(gate([{ type: 'compare', operator: '<=', threshold: 40 }]), { energy: 40, flag: false })
    expect(inclusive.result).toBe(true)
    expect(inclusive.tip).toMatch(/edge counts/)
  })

  it('adds the and combination as the final step', () => {
    const explanation = explainGate(gate([{ type: 'compare', operator: '>', threshold: 40 }, { type: 'bool', name: 'has_key', form: 'plain' }]), { energy: 70, flag: false })
    expect(explanation.steps.map((step) => step.code)).toEqual(['70 > 40', 'has_key is False', 'True and False'])
    expect(explanation.result).toBe(false)
    expect(explanation.tip).toMatch(/BOTH/)
  })
})

describe('fork doors', () => {
  it('splits lanes around a centre pillar', () => {
    expect(forkSide(-0.38, 0)).toBe(-1)
    expect(forkSide(0.38, 0)).toBe(1)
    expect(forkSide(0.03, 0)).toBe(0)
    expect(forkSide(1.5, 1.15)).toBe(1)
  })

  it('sends a TRUE condition through the TRUE door and a FALSE one through the other', () => {
    expect(correctForkSide(true, -1)).toBe(-1)
    expect(correctForkSide(false, -1)).toBe(1)
    expect(correctForkSide(false, 1)).toBe(-1)
  })
})

describe('endless gates', () => {
  it('starts every editable gate FALSE but solvable within the energy range', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const random = mulberry32(seed)
      let previous: BackroomGate | undefined
      for (let number = 1; number <= 60; number += 1) {
        const next = generateEndlessGate(number, random, previous)
        if (next.kind === 'set') {
          expect(evaluateGate(next, next.start)).toBe(false)
          let solvable = false
          for (let energy = energyRange.min; energy <= energyRange.max && !solvable; energy += 1) {
            for (const flag of [true, false]) if (evaluateGate(next, { energy, flag })) solvable = true
          }
          expect(solvable).toBe(true)
        }
        expect(next.liveTruth).toBe(false)
        previous = next
      }
    }
  })

  it('mixes set gates and door pairs in The Deep, with comparisons only', () => {
    const random = mulberry32(3)
    const early = Array.from({ length: 3 }, (_, index) => generateEndlessGate(index + 1, random))
    expect(early.every((item) => item.kind === 'set' && item.clauses.length === 1 && item.clauses[0].type === 'compare')).toBe(true)
    const late = Array.from({ length: 200 }, (_, index) => generateEndlessGate(20 + index, random))
    expect(late.some((item) => item.kind === 'fork')).toBe(true)
    expect(late.every((item) => item.clauses.length === 1 && item.clauses[0].type === 'compare')).toBe(true)
  })

  it('never repeats the previous comparator', () => {
    const random = mulberry32(9)
    let previous = generateEndlessGate(1, random)
    for (let number = 2; number < 80; number += 1) {
      const next = generateEndlessGate(number, random, previous)
      const before = previous.clauses.find((clause) => clause.type === 'compare')
      const now = next.clauses.find((clause) => clause.type === 'compare')
      if (before?.type === 'compare' && now?.type === 'compare') expect(now.operator).not.toBe(before.operator)
      previous = next
    }
  })

  it('is deterministic for the same seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect(Array.from({ length: 20 }, (_, i) => generateEndlessGate(i + 1, a))).toEqual(Array.from({ length: 20 }, (_, i) => generateEndlessGate(i + 1, b)))
  })

  it('starts false values a few steps away from the edge', () => {
    for (const operator of comparisonOperators) {
      const start = falseStart(() => 0.5, operator, 50)
      expect(evaluateCondition(start, operator, 50)).toBe(false)
      if (operator !== '!=') expect(Math.abs(start - 50)).toBeGreaterThanOrEqual(5)
    }
  })
})

describe('course planner', () => {
  it('places two curves before the gate on a high roll', () => {
    expect(planCourse(() => 0.99)).toEqual([
      { kind: 'curve', dir: 1 },
      { kind: 'curve', dir: 1 },
      { kind: 'gate', dir: 0 },
    ])
  })

  it('always ends on a gate after two or three curves', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const tiles = planCourse(lcg(seed))
      const curves = tiles.filter((tile) => tile.kind === 'curve')
      expect(curves.length).toBeGreaterThanOrEqual(2)
      expect(curves.length).toBeLessThanOrEqual(3)
      expect(tiles[tiles.length - 1]).toEqual({ kind: 'gate', dir: 0 })
    }
  })
})

describe('gate progression', () => {
  it('keeps gates well past the final bend on both route lengths', () => {
    for (const tiles of [planCourse(() => 0.99), planCourse(() => 0.1)]) {
      const plan = planCorridor(9, 0, tiles)
      expect(plan.bends).toHaveLength(tiles.length - 1)
      expect(plan.nextGateZ - plan.bends[plan.bends.length - 1]!.endZ).toBe(26)
      expect(plan.activationZ).toBe(plan.nextGateZ - 16)
      expect(corridorCenterAt(0, plan.bends, plan.nextGateZ)).toBe(plan.nextGateCenter)
      expect(plan.obstacles[0].z).toBeLessThan(plan.activationZ)
    }
  })

  it('hits a floor obstacle only when the player overlaps its lane and depth', () => {
    const obstacle = planCorridor(9, 0, planCourse(() => 0.99)).obstacles[0]
    expect(hitsObstacle(obstacle.z - 0.4, obstacle.z - 0.2, obstacle.x, obstacle)).toBe(true)
    expect(hitsObstacle(obstacle.z - 0.4, obstacle.z - 0.2, obstacle.x + 0.5, obstacle)).toBe(false)
    expect(hitsObstacle(obstacle.z - 2, obstacle.z - 1, obstacle.x, obstacle)).toBe(false)
  })
})

describe('xp and pace', () => {
  it('rewards streaks of correct gates', () => {
    expect([gateXp(1), gateXp(3), gateXp(6), gateXp(20)]).toEqual([10, 15, 20, 20])
  })

  it('keeps the endless pace climbing past the champion milestone', () => {
    expect(speedForGate(1)).toBe(baseRunSpeed)
    for (const number of [2, 100, championGates, 10000]) expect(speedForGate(number)).toBeGreaterThan(speedForGate(number - 1))
  })
})

describe('jumping', () => {
  it('arcs up and back down within the jump time', () => {
    expect(jumpOffset(-1)).toBe(0)
    expect(jumpOffset(jumpSeconds / 2)).toBeCloseTo(jumpHeight)
    expect(jumpOffset(jumpSeconds)).toBe(0)
  })

  it('clears every obstacle in the air, and a barrier blocks the whole width on the ground', () => {
    const plan = planCorridor(9, 0, planCourse(() => 0.99), true)
    const barrier = plan.obstacles.find((item) => item.kind === 'barrier')!
    expect(barrier.z).toBe(plan.bends[0].endZ + 2)
    expect(hitsObstacle(barrier.z - 0.1, barrier.z, 0.7, barrier)).toBe(true)
    expect(hitsObstacle(barrier.z - 0.1, barrier.z, 0.7, barrier, true)).toBe(false)
    expect(planCorridor(9, 0, planCourse(() => 0.99)).obstacles.some((item) => item.kind === 'barrier')).toBe(false)
  })

  it('speeds tapes up after every gate from their own opening pace', () => {
    expect(speedForLevelGate(1, 1)).toBe(1)
    expect(speedForLevelGate(1, 4)).toBeCloseTo(1 + 3 * 0.11 * 1.2)
  })

  it('plans up to two jumps per corridor, holes included, and a battery on the last straight', () => {
    const plan = planCorridor(9, 0, planCourse(() => 0.99), ['hole', 'barrier'], true)
    expect(plan.obstacles.filter((item) => item.kind === 'hole' || item.kind === 'barrier').map((item) => item.kind)).toEqual(['hole', 'barrier'])
    expect(plan.pickups).toHaveLength(1)
    const hole = plan.obstacles.find((item) => item.kind === 'hole')!
    // On the ground anywhere over the hole is a fall; in the air the whole way is safe.
    expect(hitsObstacle(hole.z - 0.3, hole.z - 0.2, 0.6, hole)).toBe(true)
    expect(hitsObstacle(hole.z - 0.3, hole.z + 0.3, 0, hole, true)).toBe(false)
    const battery = plan.pickups[0]
    expect(picksUp(battery.z - 0.1, battery.z + 0.1, battery.x, battery)).toBe(true)
    expect(picksUp(battery.z - 0.1, battery.z + 0.1, battery.x + 0.5, battery)).toBe(false)
    expect(planCorridor(9, 0, planCourse(() => 0.99)).pickups).toEqual([])
  })

  it('puts saws on one wall: the near half is deadly, jumping does not help, the far half is safe', () => {
    const plan = planCorridor(9, 0, planCourse(() => 0.99), ['saw-left', null])
    const saw = plan.obstacles.find((item) => item.kind === 'saw')!
    expect(saw.side).toBe(-1)
    expect(hitsObstacle(saw.z - 0.3, saw.z, saw.x - 0.3, saw)).toBe(true)
    expect(hitsObstacle(saw.z - 0.3, saw.z, saw.x, saw, true)).toBe(true)
    expect(hitsObstacle(saw.z - 0.3, saw.z, saw.x + 0.3, saw)).toBe(false)
  })

  it('strikes drills in one lane, from the ceiling or the floor, and jumping does not help', () => {
    const plan = planCorridor(9, 0, planCourse(() => 0.99), ['drill-ceiling-left', 'drill-floor-middle'])
    const [left, middle] = plan.obstacles.filter((item) => item.kind === 'drill')
    expect(left.side).toBe(1)
    expect(middle.side).toBe(-1)
    expect(hitsObstacle(left.z - 0.3, left.z, left.x, left, true)).toBe(true)
    expect(hitsObstacle(left.z - 0.3, left.z, left.x + 0.4, left)).toBe(false)
    expect(hitsObstacle(middle.z - 0.3, middle.z, middle.x - 0.4, middle)).toBe(false)
  })

  it('knows the value right on the edge for every operator', () => {
    expect(edgeValues('>', 40)).toEqual([41])
    expect(edgeValues('>=', 40)).toEqual([40])
    expect(edgeValues('<', 40)).toEqual([39])
    expect(edgeValues('<=', 40)).toEqual([40])
    expect(edgeValues('==', 40)).toEqual([40])
    expect(edgeValues('!=', 40)).toEqual([39, 41])
  })

  it('brings the operators a student misses back more often in The Deep', () => {
    expect(operatorWeight(undefined)).toBe(1)
    expect(operatorWeight({ right: 10, wrong: 0 })).toBe(1)
    expect(operatorWeight({ right: 0, wrong: 9 })).toBeCloseTo(3.7)
    const random = mulberry32(5)
    const picks = Array.from({ length: 300 }, (_, index) => generateEndlessGate(20 + index, random, undefined, { '<=': { right: 0, wrong: 20 } }))
    const share = picks.filter((gate) => gate.clauses[0].type === 'compare' && gate.clauses[0].operator === '<=').length / picks.length
    expect(share).toBeGreaterThan(0.3)
  })
})
