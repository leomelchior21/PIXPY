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

  it('use exactly five tests, aimed at both sides of every cutoff', () => {
    for (const boss of conditionBosses) {
      const outcomes = new Set(boss.tests.map((test) => test.expected))
      expect(outcomes.size, boss.name).toBeGreaterThanOrEqual(2)
      expect(boss.tests, boss.name).toHaveLength(5)
    }
  })

  it('gives less help each round, until students write the whole decision from round 4', () => {
    const [first, second, third, ...rest] = conditionBosses
    expect(first.starter).toContain('if age >= 18:')
    expect(first.starter).toContain('else:')
    expect(first.starter).toContain('print("Welcome in")')
    expect(first.starter).not.toContain('Too young')
    expect(second.starter).toContain('if temp > 30:')
    expect(second.starter).toContain('else:')
    expect(second.starter).not.toContain('print(')
    expect(third.starter).toContain('if code == 4729:')
    expect(third.starter).not.toContain('else')
    expect(third.starter).not.toContain('print(')
    for (const boss of rest) expect(boss.starter, boss.name).not.toMatch(/\bif\b|else|print\(/)
    // The instruction is a comment on the first line, never inside the code.
    for (const boss of [first, second, third]) expect(boss.starter.split('\n').slice(1).join('\n'), boss.name).not.toContain('#')
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
