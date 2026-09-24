import { comparisonOperators, evaluateCondition, gateXp, generateChallenge, hasSolution, operatorHint, operatorWords, planCourse, sliderRange } from './backroomEngine'

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
  it('always offers a reachable solution on the slider', () => {
    for (let run = 1; run <= 60; run += 1) {
      for (const seed of [3, 17, 99, 404, 1234]) {
        const challenge = generateChallenge(run, seed, ((run - 1) % 3) + 1)
        expect(hasSolution(challenge.operator, challenge.threshold)).toBe(true)
        expect(challenge.threshold).toBeGreaterThanOrEqual(sliderRange.min)
        expect(challenge.threshold).toBeLessThanOrEqual(sliderRange.max)
        expect(challenge.startValue).toBeGreaterThanOrEqual(sliderRange.min)
        expect(challenge.startValue).toBeLessThanOrEqual(sliderRange.max)
        expect(comparisonOperators).toContain(challenge.operator)
      }
    }
  })

  it('teaches the first gate with energy > 60 starting at 30', () => {
    const first = generateChallenge(1, 11, 1)
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

  it('never starts every equality gate already solved', () => {
    for (let run = 8; run <= 40; run += 1) {
      const challenge = generateChallenge(run, run * 31, 3)
      if (challenge.operator === '==') expect(challenge.startValue).not.toBe(challenge.threshold)
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
  it('places a single curve before the gate on a high roll', () => {
    expect(planCourse(() => 0.99)).toEqual([{ kind: 'curve', dir: 1 }, { kind: 'gate', dir: 0 }])
  })

  it('places two curves before the gate on a low roll', () => {
    expect(planCourse(() => 0.1)).toEqual([
      { kind: 'curve', dir: -1 },
      { kind: 'curve', dir: -1 },
      { kind: 'gate', dir: 0 },
    ])
  })

  it('always ends on a gate after one or two curves', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const tiles = planCourse(lcg(seed))
      const curves = tiles.filter((tile) => tile.kind === 'curve')
      expect(curves.length).toBeGreaterThanOrEqual(1)
      expect(curves.length).toBeLessThanOrEqual(2)
      expect(tiles[tiles.length - 1]).toEqual({ kind: 'gate', dir: 0 })
      for (const curve of curves) expect([-1, 1]).toContain(curve.dir)
    }
  })

  it('is deterministic for the same random stream', () => {
    expect(planCourse(lcg(77))).toEqual(planCourse(lcg(77)))
  })
})

describe('xp', () => {
  it('awards a base of ten and a first-try bonus', () => {
    expect(gateXp(false)).toBe(10)
    expect(gateXp(true)).toBe(15)
  })
})
