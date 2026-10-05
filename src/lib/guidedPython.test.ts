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
    expect(evaluateMath('number % 2', { number: -3 })).toBe(1)
    expect(evaluateMath('3 % -2', {})).toBe(-1)
    expect(evaluateMath('-3 % -2', {})).toBe(-1)
    expect(evaluateMath('-4 % 2', {})).toBe(0)
    expect(evaluateMath('number ** 2', { number: 7 })).toBe(49)
  })

  it('supports string concatenation, comma prints and f-strings', () => {
    const result = runGuidedPython('answer1 = "Ada"\nprint("Name: " + answer1)\nprint("City:", answer1)\nprint(f"Hello, {answer1}!")')
    expect(result.stdout).toBe('Name: Ada\nCity: Ada\nHello, Ada!')
    expect(result.variables.answer1).toBe('Ada')
  })

  it('accumulates strings with += and keeps numbers working', () => {
    const result = runGuidedPython('greeting = "Hi"\ngreeting += " there"\nscore = 2 + 3\nprint(greeting)\nprint("Score:", score)')
    expect(result.stdout).toBe('Hi there\nScore: 5')
  })

  it('builds text from variables and conversions', () => {
    const result = runGuidedPython('age = 12\nprint("Age: " + str(age) + " years")')
    expect(result.stdout).toBe('Age: 12 years')
  })

  it('rejects unknown syntax instead of evaluating JavaScript', () => {
    expect(() => evaluateMath('window.alert(1)', {})).toThrow()
    expect(() => runGuidedPython('nope += 1')).toThrow(/needs a value before \+=/)
    expect(() => runGuidedPython('print("Missing: " + answer2)')).toThrow(/answer2 is not defined/)
  })
})
