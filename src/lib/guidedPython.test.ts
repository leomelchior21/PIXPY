import { evaluateMath, runGuidedPython } from './guidedPython'

describe('guided Python fallback', () => {
  it('runs valid input, variables, arithmetic, and print programs', () => {
    const result = runGuidedPython('number = int(input())\nresult = number * 3 + 2\nprint(result)', ['7'])
    expect(result.stdout).toBe('23')
    expect(result.variables.result).toBe(23)
  })

  it('prints a text value stored from raw input', () => {
    const result = runGuidedPython('message = input()\nprint(message)', ['hello'])
    expect(result.stdout).toBe('hello')
    expect(result.variables.message).toBe('hello')
  })

  it('supports Python arithmetic operators safely', () => {
    expect(evaluateMath('seconds // 60', { seconds: 125 })).toBe(2)
    expect(evaluateMath('seconds % 60', { seconds: 125 })).toBe(5)
    expect(evaluateMath('number ** 2', { number: 7 })).toBe(49)
  })

  it('rejects unknown syntax instead of evaluating JavaScript', () => {
    expect(() => evaluateMath('window.alert(1)', {})).toThrow()
  })
})
