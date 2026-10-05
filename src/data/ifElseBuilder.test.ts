import { runGuidedPython } from '../lib/guidedPython'
import { ifElseProblems, problemLines } from './ifElseBuilder'

it('runs the IF and ELSE paths of every builder problem without downloading Python', () => {
  const cases = [
    [12, 13], [8, 7], [31, 30], [100, 99], [42, 41],
    [7, 6.75], [18, 17], [7, 8], [8, 9], [50, 49.99],
  ]
  ifElseProblems.forEach((problem, index) => {
    const code = problemLines(problem, true).join('\n')
    expect(runGuidedPython(code, [String(cases[index][0])]).stdout).toBe(problem.trueOutput)
    expect(runGuidedPython(code, [String(cases[index][1])]).stdout).toBe(problem.falseOutput)
  })
})

it('respects indentation, nested branches, and statements after a conditional', () => {
  const code = 'age = int(input())\nif age >= 18:\n    if age >= 65:\n        print("Senior")\n    else:\n        print("Adult")\nelse:\n    print("Child")\nprint("Done")'
  expect(runGuidedPython(code, ['18']).stdout).toBe('Adult\nDone')
  expect(runGuidedPython(code, ['65']).stdout).toBe('Senior\nDone')
  expect(runGuidedPython(code, ['12']).stdout).toBe('Child\nDone')
  expect(() => runGuidedPython('if True:\nprint("Hi")')).toThrow(/indent/i)
  expect(() => runGuidedPython('else:\n    print("Hi")')).toThrow(/matching if/i)
  expect(() => runGuidedPython('if True:')).toThrow(/indent/i)
})
