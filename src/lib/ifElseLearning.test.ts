import { ifElseProblems, problemLines } from '../data/ifElseBuilder'
import { ifElsePedagogy } from '../data/ifElsePedagogy'
import { runGuidedPython } from './guidedPython'
import { codePieces, diagnoseProgram, executionTrace, initialProgram, learningFeedback } from './ifElseLearning'

it('configures exactly ten existing questions with progressively less guidance', () => {
  expect(ifElsePedagogy).toHaveLength(ifElseProblems.length)
  expect(ifElsePedagogy.map((p) => p.support)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
  expect(new Set(ifElsePedagogy.map((p) => p.mode)).size).toBe(10)
  expect(codePieces(ifElseProblems[0], ifElsePedagogy[0]).map((p) => p.code)).toEqual(problemLines(ifElseProblems[0], false))
  const select = codePieces(ifElseProblems[2], ifElsePedagogy[2])
  expect(select).toHaveLength(7)
  select.filter((piece) => piece.role === 'condition').forEach((piece) => {
    const lines = problemLines(ifElseProblems[2], false)
    lines[1] = piece.code
    expect(() => runGuidedPython(lines.join('\n'))).not.toThrow()
  })
})

it('validates the existing rule over boundary values, even when the chosen input hides the error', () => {
  ifElseProblems.forEach((problem, index) => {
    const pedagogy = ifElsePedagogy[index]
    const lines = problemLines(problem, pedagogy.useInput)
    expect(diagnoseProgram(problem, pedagogy, lines, problem.initial)).toBeNull()
    lines[1] = `if ${problem.wrongCondition}:`
    const issue = diagnoseProgram(problem, pedagogy, lines, problem.initial)
    expect(issue?.kind).toBe(pedagogy.mode === 'debug' ? 'logic' : 'condition')
    expect(issue?.witness).toBeDefined()
  })
  const problem = ifElseProblems[6]
  const lines = initialProgram(problem, ifElsePedagogy[6]) as string[]
  expect(runGuidedPython(lines.join('\n'), ['17']).stdout).toBe('Not old enough yet')
  expect(diagnoseProgram(problem, ifElsePedagogy[6], lines, 17)).toEqual({ kind: 'logic', line: 1, witness: 18 })
})

it('accepts a semantically equivalent reversed comparison and distinguishes output and structure mistakes', () => {
  const problem = ifElseProblems[9], pedagogy = ifElsePedagogy[9]
  const lines = problemLines(problem, true)
  lines[1] = 'if 50 <= total:'
  expect(diagnoseProgram(problem, pedagogy, lines, 50)).toBeNull()
  lines[2] = lines[4]
  expect(diagnoseProgram(problem, pedagogy, lines, 50)).toEqual({ kind: 'output', line: 2 })
  ;[lines[1], lines[3]] = [lines[3], lines[1]]
  expect(diagnoseProgram(problem, pedagogy, lines, 50)).toEqual({ kind: 'structure', line: 1 })
})

it('traces the actual program instead of silently tracing the intended answer', () => {
  const problem = ifElseProblems[6]
  const lines = initialProgram(problem, ifElsePedagogy[6]) as string[]
  const output = runGuidedPython(lines.join('\n'), ['18']).stdout
  const trace = executionTrace(problem, lines, 18, output)
  expect(trace.truth).toBe(false)
  expect(trace.branch).toBe('ELSE')
  expect(trace.output).toBe('Not old enough yet')
  expect(trace.steps.map((step) => step.line)).toEqual([0, 1, 1, 3, 4])
  expect(trace.steps[1].text).toBe('age > 18\n18 > 18')
  const parity = ifElseProblems[8]
  const parityLines = problemLines(parity, true)
  const parityOutput = runGuidedPython(parityLines.join('\n'), ['-3']).stdout
  expect(executionTrace(parity, parityLines, -3, parityOutput).steps[1].text).toBe('number % 2 == 0\n-3 % 2 == 0\n1 == 0')
  parityLines[1] = 'if number % 2 == -1:'
  expect(runGuidedPython(parityLines.join('\n'), ['-3']).stdout).toBe('Odd')
  expect(executionTrace(parity, parityLines, -3, 'Odd').truth).toBe(false)
})

it('keeps early feedback focused on an area and reasoning before explaining the concept', () => {
  const problem = ifElseProblems[0], diagnosis = { kind: 'condition', line: 1, witness: 12 } as const
  expect(learningFeedback(problem, diagnosis, 1, 12)).toBe('Check the condition.')
  expect(learningFeedback(problem, diagnosis, 2, 12)).toContain('Which result should age = 12 produce')
  expect(learningFeedback(problem, diagnosis, 1, 12)).not.toContain('<=')
  expect(learningFeedback(problem, diagnosis, 2, 12)).not.toContain('<=')
  expect(learningFeedback(problem, diagnosis, 3, 12)).toBe(problem.explanation)
  expect(learningFeedback(ifElseProblems[8], diagnosis, 2, 8)).toContain('Work out the remainder')
  expect(learningFeedback(ifElseProblems[8], diagnosis, 4, 8)).not.toContain('cutoff')
  expect(learningFeedback(ifElseProblems[4], diagnosis, 2, 42)).toContain('exact match')
})
