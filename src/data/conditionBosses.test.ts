import { describe, expect, it } from 'vitest'
import { runGuidedPython } from '../lib/guidedPython'
import { bossOutputMatches, bossSprite, cleanBossOutput, conditionBosses, promptParts } from './conditionBosses'

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

  it('accepts the right message in any capitals, spacing or punctuation, but not another message', () => {
    for (const variant of ['welcome in', 'WELCOME IN', 'Welcome  In', 'Welcome in!', 'Welcome in.']) expect(bossOutputMatches(variant, 'Welcome in'), variant).toBe(true)
    expect(bossOutputMatches('too fast', 'Too fast!')).toBe(true)
    expect(bossOutputMatches('Welcom in', 'Welcome in')).toBe(false)
    expect(bossOutputMatches('fan on', 'Fan OFF')).toBe(false)
    // Numbers stay numbers: dropping the point would turn 4.9 into 49.
    expect(bossOutputMatches('4.9', '49')).toBe(false)
  })

  it('highlights every message the tests expect in the prompt', () => {
    expect(promptParts('{18 or more}: print [Welcome in]. *Write it*.')).toEqual([
      { kind: 'rule', text: '18 or more' }, { kind: 'text', text: ': print ' }, { kind: 'say', text: 'Welcome in' },
      { kind: 'text', text: '. ' }, { kind: 'task', text: 'Write it' }, { kind: 'text', text: '.' },
    ])
    for (const boss of conditionBosses) {
      const parts = promptParts(boss.prompt)
      expect(parts.some((part) => part.kind === 'task'), boss.name).toBe(true)
      // No stray markup left over in the plain text.
      expect(parts.filter((part) => part.kind === 'text').some((part) => /[[\]{}*]/.test(part.text)), boss.name).toBe(false)
      const said = parts.filter((part) => part.kind === 'say').map((part) => part.text)
      for (const test of boss.tests) if (!Number.isFinite(Number(test.expected))) expect(said, boss.name).toContain(test.expected)
    }
  })

  it('draws square, mirrored sprites', () => {
    for (const boss of conditionBosses) {
      const sprite = bossSprite(boss.sprite)
      expect(sprite).toHaveLength(16)
      expect(sprite.every((row) => row.length === 16 && row === [...row].reverse().join(''))).toBe(true)
    }
  })
})
