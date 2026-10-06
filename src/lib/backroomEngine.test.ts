import { baseRunSpeed, championGates, comparisonOperators, corridorCenterAt, energyRange, evaluateCondition, gateCrossing, gateXp, generateChallenge, hasSolution, hitsObstacle, operatorHint, operatorWords, planCorridor, planCourse, speedForGate } from './backroomEngine'

function lcg(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

describe('evaluateCondition', () => {
  it('evaluates greater than', () => {
    expect(evaluateCondition(61, '>', 60)).toBe(true)
    expect(evaluateCondition(60, '>', 60)).toBe(false)
  })

  it('evaluates less than', () => {
    expect(evaluateCondition(39, '<', 40)).toBe(true)
    expect(evaluateCondition(40, '<', 40)).toBe(false)
  })

  it('includes the threshold for greater than or equal', () => {
    expect(evaluateCondition(50, '>=', 50)).toBe(true)
    expect(evaluateCondition(49, '>=', 50)).toBe(false)
  })

  it('includes the threshold for less than or equal', () => {
    expect(evaluateCondition(25, '<=', 25)).toBe(true)
    expect(evaluateCondition(26, '<=', 25)).toBe(false)
  })

  it('evaluates equality', () => {
    expect(evaluateCondition(42, '==', 42)).toBe(true)
    expect(evaluateCondition(41, '==', 42)).toBe(false)
  })

  it('evaluates inequality', () => {
    expect(evaluateCondition(50, '!=', 50)).toBe(false)
    expect(evaluateCondition(51, '!=', 50)).toBe(true)
  })
})

describe('operator labels', () => {
  it('names every operator', () => {
    expect(operatorWords('>')).toBe('GREATER THAN')
    expect(operatorWords('<')).toBe('LESS THAN')
    expect(operatorWords('>=')).toBe('GREATER THAN OR EQUAL TO')
    expect(operatorWords('<=')).toBe('LESS THAN OR EQUAL TO')
    expect(operatorWords('==')).toBe('EQUAL TO')
    expect(operatorWords('!=')).toBe('NOT EQUAL TO')
  })

  it('writes hints that mention the threshold', () => {
    const challenge = generateChallenge(4, 7, 2)
    expect(operatorHint(challenge)).toContain(String(challenge.threshold))
  })
})

describe('challenge generator', () => {
  it('always offers a reachable energy value', () => {
    for (let run = 1; run <= 60; run += 1) {
      for (const seed of [3, 17, 99, 404, 1234]) {
        const challenge = generateChallenge(run, seed, ((run - 1) % 3) + 1)
        expect(hasSolution(challenge.operator, challenge.threshold)).toBe(true)
        expect(challenge.threshold).toBeGreaterThanOrEqual(energyRange.min)
        expect(challenge.threshold).toBeLessThanOrEqual(energyRange.max)
        expect(challenge.startValue).toBeGreaterThanOrEqual(energyRange.min)
        expect(challenge.startValue).toBeLessThanOrEqual(energyRange.max)
        expect(comparisonOperators).toContain(challenge.operator)
      }
    }
  })

  it('teaches the first gate with required_energy > 60 starting at 30', () => {
    const first = generateChallenge(1, 11, 1)
    expect(first.variableName).toBe('required_energy')
    expect(first.operator).toBe('>')
    expect(first.threshold).toBe(60)
    expect(first.startValue).toBe(30)
    expect(first.startsTrue).toBe(false)
  })

  it('mixes every comparator as the endless run goes on', () => {
    const operators = new Set(Array.from({ length: 120 }, (_, index) => generateChallenge(index + 2, 21, 1).operator))
    for (const operator of comparisonOperators) expect(operators).toContain(operator)
  })

  it('never repeats the previous comparator when one is avoided', () => {
    for (let run = 2; run <= 40; run += 1) {
      const challenge = generateChallenge(run, run * 17, 2, '>')
      expect(challenge.operator).not.toBe('>')
    }
  })

  it('starts later gates false and close enough to adjust at higher pace', () => {
    for (let run = 2; run <= 80; run += 1) {
      for (const seed of [11, 31, 71]) {
        const challenge = generateChallenge(run, seed, 3)
        expect(challenge.startsTrue).toBe(false)
        expect(Math.abs(challenge.startValue - challenge.threshold)).toBeLessThanOrEqual(18)
      }
    }
  })

  it('is deterministic for the same run and seed', () => {
    expect(generateChallenge(12, 77, 2)).toEqual(generateChallenge(12, 77, 2))
  })

  it('gives each gate a unique id', () => {
    const ids = new Set(Array.from({ length: 30 }, (_, index) => generateChallenge(index + 1, 9, 2).id))
    expect(ids.size).toBe(30)
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

  it('places three curves before the gate on a low roll', () => {
    expect(planCourse(() => 0.1)).toEqual([
      { kind: 'curve', dir: -1 },
      { kind: 'curve', dir: -1 },
      { kind: 'curve', dir: -1 },
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
      for (const curve of curves) expect([-1, 1]).toContain(curve.dir)
    }
  })

  it('is deterministic for the same random stream', () => {
    expect(planCourse(lcg(77))).toEqual(planCourse(lcg(77)))
  })
})

describe('gate progression', () => {
  it('keeps gates well past the final bend on both route lengths', () => {
    for (const tiles of [planCourse(() => 0.99), planCourse(() => 0.1)]) {
      const plan = planCorridor(9, 0, tiles)
      expect(plan.bends).toHaveLength(tiles.length - 1)
      expect(plan.nextGateZ - 9).toBeGreaterThanOrEqual(45)
      expect(plan.nextGateZ - plan.bends.at(-1)!.endZ).toBe(26)
      expect(plan.activationZ).toBe(plan.nextGateZ - 16)
      expect(corridorCenterAt(0, plan.bends, plan.nextGateZ)).toBe(plan.nextGateCenter)
      expect(plan.obstacles).toHaveLength(1)
      expect(plan.obstacles[0].z).toBeLessThan(plan.activationZ)
    }
  })

  it('keeps every bend anchored to the same world coordinates as the player advances', () => {
    const plan = planCorridor(9, 0, planCourse(() => 0.1))
    const [first, second] = plan.bends
    expect(corridorCenterAt(0, plan.bends, first.startZ)).toBe(0)
    expect(corridorCenterAt(0, plan.bends, first.endZ)).toBe(first.to)
    expect(corridorCenterAt(0, plan.bends, second.startZ)).toBe(second.from)
    expect(second.startZ).toBeGreaterThan(first.endZ)
  })

  it('validates at the gate plane and only through a fully open door', () => {
    expect(gateCrossing(8, 8.9, 9, true, 1)).toBe('before')
    expect(gateCrossing(8.9, 9.01, 9, false, 1)).toBe('blocked')
    expect(gateCrossing(8.9, 9.01, 9, true, 0.8)).toBe('blocked')
    expect(gateCrossing(8.9, 9.01, 9, true, 1)).toBe('pass')
    expect(gateCrossing(9.01, 9.2, 9, true, 1)).toBe('before')
  })

  it('hits a floor obstacle only when the player overlaps its lane and depth', () => {
    const obstacle = planCorridor(9, 0, planCourse(() => 0.99)).obstacles[0]
    expect(hitsObstacle(obstacle.z - 0.4, obstacle.z - 0.2, obstacle.x, obstacle)).toBe(true)
    expect(hitsObstacle(obstacle.z - 0.4, obstacle.z - 0.2, obstacle.x + 0.5, obstacle)).toBe(false)
    expect(hitsObstacle(obstacle.z - 2, obstacle.z - 1, obstacle.x, obstacle)).toBe(false)
  })
})

describe('xp', () => {
  it('awards a base of ten and a first-try bonus', () => {
    expect(gateXp(false)).toBe(10)
    expect(gateXp(true)).toBe(15)
  })
})

describe('runner pace', () => {
  it('starts thirty percent faster than the previous starting pace', () => {
    expect(speedForGate(1)).toBeCloseTo((0.95 * 1.2) * 1.3)
    expect(speedForGate(1)).toBe(baseRunSpeed)
  })

  it('keeps increasing beyond the old cap, the champion milestone, and late runs', () => {
    for (const gate of [2, 15, 100, 669, championGates, 671, 1000, 10000, 1000000]) {
      expect(speedForGate(gate)).toBeGreaterThan(speedForGate(gate - 1))
      expect(speedForGate(gate) - speedForGate(gate - 1)).toBeCloseTo(.11 * 1.2)
    }
    expect(speedForGate(100)).toBeGreaterThan(2.5)
    expect(speedForGate(10000)).toBeGreaterThan(speedForGate(championGates))
  })

  it('keeps the starting pace for a nonpositive gate number', () => {
    expect(speedForGate(0)).toBe(baseRunSpeed)
    expect(speedForGate(-1)).toBe(baseRunSpeed)
  })
})
