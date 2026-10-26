import { describe, expect, it } from "vitest";
import { comparisonOperators, energyRange, evaluateGate, gateSkills, speedForGate } from './backroomEngine'
import { backroomLevels, endlessUnlocked, hazardsFor, levelUnlocked, migrateTapeStars, nextLevelIndex, normalizeStars, starsFor } from './backroomLevels'

describe('Backrooms tapes', () => {
  it('teach every comparison across four tapes, and nothing but comparisons', () => {
    expect(backroomLevels).toHaveLength(4)
    const skills = new Set(backroomLevels.flatMap((level) => level.gates.flatMap(gateSkills)))
    for (const operator of comparisonOperators) expect(skills).toContain(operator)
    expect(skills.has('bool')).toBe(false)
    expect(skills.has('and')).toBe(false)
  })

  it('starts every editable gate FALSE and keeps it reachable', () => {
    for (const level of backroomLevels) {
      for (const gate of level.gates.filter((item) => item.kind === 'set')) {
        expect(evaluateGate(gate, gate.start), gate.id).toBe(false)
        let solvable = false
        for (let energy = energyRange.min; energy <= energyRange.max; energy += 1) {
          if (evaluateGate(gate, { energy, flag: true }) || evaluateGate(gate, { energy, flag: false })) solvable = true
        }
        expect(solvable, gate.id).toBe(true)
      }
    }
  })

  it('balances TRUE and FALSE doors on the fork tapes', () => {
    for (const level of backroomLevels) {
      const forks = level.gates.filter((gate) => gate.kind === 'fork')
      if (forks.length < 3) continue
      const trueDoors = forks.filter((gate) => evaluateGate(gate, gate.start)).length
      const least = Math.floor(forks.length / 3)
      expect(trueDoors, level.title).toBeGreaterThanOrEqual(least)
      expect(forks.length - trueDoors, level.title).toBeGreaterThanOrEqual(least)
    }
  })

  it('starts every set gate after the first one step from the edge, so the operator decides', () => {
    for (const level of backroomLevels) {
      for (const gate of level.gates.filter((item) => item.kind === 'set' && item.id !== 'tape-1-1')) {
        const clause = gate.clauses[0]
        expect(clause.type === 'compare' && Math.abs(clause.threshold - gate.start.energy) <= 1, gate.id).toBe(true)
      }
    }
  })

  it('fades the live TRUE/FALSE light: all of tape 01, the first gate of 03, then never', () => {
    expect(backroomLevels[0].gates.every((gate) => gate.liveTruth)).toBe(true)
    for (const index of [2]) expect(backroomLevels[index].gates.map((gate) => gate.liveTruth)).toEqual(backroomLevels[index].gates.map((_, gate) => gate === 0))
    expect(backroomLevels.slice(3).every((level) => level.gates.every((gate) => !gate.liveTruth))).toBe(true)
  })

  it('adds new ideas per tape: doors on 02, then the hazards build up', () => {
    expect(backroomLevels.map((level) => level.title)).toEqual(['LIGHTS ON', 'TWO DOORS', 'THE EDGE', 'FINAL CUT'])
    expect(backroomLevels[1].gates.every((gate) => gate.kind === 'fork')).toBe(true)
    expect([0, 1, 2, 3].map((index) => hazardsFor(index, 1))).toEqual([[], ['barrier'], ['barrier', 'saw', 'hole'], ['barrier', 'saw', 'hole', 'drill']])
    expect(hazardsFor(null, 2)).toEqual([])
    expect(hazardsFor(null, 9)).toEqual(['barrier', 'saw', 'hole', 'drill'])
  })

  it('moves saved stars from the six-tape layouts into the four tapes', () => {
    // Layout 1: Lights On, The Edge, Exactly, Two Doors, No Light, Final Cut.
    expect(migrateTapeStars([3, 2, 1, 1, 0, 0], 1)).toEqual([3, 1, 2, 0])
    // Layout 2: Lights On, Two Doors, The Edge, Exactly, No Light, Final Cut.
    expect(migrateTapeStars([3, 2, 0, 1, 2, 0], 2)).toEqual([3, 2, 1, 2])
  })

  it('raises the pace of The Deep at every gate', () => {
    for (let gate = 1; gate < 40; gate += 1) expect(speedForGate(gate + 1)).toBeGreaterThan(speedForGate(gate))
  })

  it('unlocks tapes in order and The Deep after all four', () => {
    const none = normalizeStars([])
    expect(levelUnlocked(0, none, false)).toBe(true)
    expect(levelUnlocked(1, none, false)).toBe(false)
    expect(levelUnlocked(1, [2, 0, 0, 0], false)).toBe(true)
    expect(endlessUnlocked([3, 3, 3, 0], false)).toBe(false)
    expect(endlessUnlocked([1, 1, 1, 1], false)).toBe(true)
    expect(endlessUnlocked(none, true)).toBe(true)
    expect(levelUnlocked(3, none, true)).toBe(true)
  })

  it('points to the first unfinished tape and scores mistakes as stars', () => {
    expect(nextLevelIndex([3, 1, 0, 0])).toBe(2)
    expect(nextLevelIndex([1, 1, 1, 1])).toBeNull()
    expect([starsFor(0), starsFor(1), starsFor(2)]).toEqual([3, 2, 1])
    expect(normalizeStars([9, -1, 2.5, 2])).toEqual([3, 0, 0, 2])
  })
})
