import { describe, expect, it } from 'vitest'
import { runGuidedPython } from '../lib/guidedPython'
import { bossOutputMatches, bossSprite, cleanBossOutput, conditionBosses } from './conditionBosses'

function passes(code: string, inputs: string[], expected: string): boolean {
  try {
    return bossOutputMatches(cleanBossOutput(code, runGuidedPython(code, inputs).stdout), expected)
  } catch {
    return false
  }
}

describe('conditions final bosses', () => {
  it('have solutions that pass every test and starters that do not', () => {
    for (const boss of conditionBosses) {
      for (const test of boss.tests) expect(passes(boss.solution, test.inputs, test.expected), `${boss.name} ${test.inputs}`).toBe(true)
      expect(boss.tests.every((test) => passes(boss.starter, test.inputs, test.expected)), boss.name).toBe(false)
      expect(boss.tests.every((test) => test.inputs.length === boss.inputNames.length)).toBe(true)
    }
  })

  it('aim tests at both sides of every cutoff', () => {
    for (const boss of conditionBosses) {
      const outcomes = new Set(boss.tests.map((test) => test.expected))
      expect(outcomes.size, boss.name).toBeGreaterThanOrEqual(2)
      expect(boss.tests.length).toBeGreaterThanOrEqual(5)
    }
  })

  it('ignores input prompts and accepts equal numbers', () => {
    expect(cleanBossOutput('age = int(input("Age: "))', 'Age: Welcome in')).toBe('Welcome in')
    expect(bossOutputMatches('40.0', '40')).toBe(true)
    expect(bossOutputMatches('Welcome in\nToo young', 'Welcome in')).toBe(false)
  })

  it('draws square, mirrored sprites', () => {
    for (const boss of conditionBosses) {
      const sprite = bossSprite(boss.sprite)
      expect(sprite).toHaveLength(16)
      expect(sprite.every((row) => row.length === 16 && row === [...row].reverse().join(''))).toBe(true)
    }
  })
})
