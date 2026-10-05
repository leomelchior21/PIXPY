import type { IfElseProblem } from '../data/ifElseBuilder'
import { problemLines } from '../data/ifElseBuilder'
import type { IfElsePedagogy } from '../data/ifElsePedagogy'
import { evaluateMath } from './guidedPython'

export type LearningError = 'structure' | 'condition' | 'logic' | 'output' | 'runtime'
export interface Diagnosis { kind: LearningError; line: number; witness?: number }
export interface ConditionParts { left: string; operator: string; right: string }
export interface ExecutionStep { label: string; text: string; line: number }
export interface ExecutionTrace { value: number; truth: boolean; branch: 'IF' | 'ELSE'; output: string; steps: ExecutionStep[] }
export interface CodePiece { id: string; code: string; role: 'value' | 'condition' | 'print' | 'else' }

export const comparisonOperators = ['<', '<=', '==', '!=', '>=', '>']
export const structureLabels = ['Read a value', 'Test a condition', 'IF action (indented)', 'ELSE path', 'ELSE action (indented)']

export function splitCondition(condition: string): ConditionParts {
  const match = condition.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/)
  if (!match) throw new Error('This condition needs a comparison.')
  return { left: match[1].trim(), operator: match[2], right: match[3].trim() }
}

export function evaluateCondition(condition: string, variable: string, value: number): boolean {
  const { left, operator, right } = splitCondition(condition)
  const a = evaluateMath(left, { [variable]: value })
  const b = evaluateMath(right, { [variable]: value })
  switch (operator) {
    case '<': return a < b
    case '<=': return a <= b
    case '>': return a > b
    case '>=': return a >= b
    case '==': return a === b
    default: return a !== b
  }
}

export function initialProgram(problem: IfElseProblem, pedagogy: IfElsePedagogy): Array<string | null> {
  const lines = problemLines(problem, pedagogy.useInput)
  return lines.map((line, i) => pedagogy.prefilledLines.includes(i)
    ? pedagogy.requireDebugRun && i === 1 ? `if ${problem.wrongCondition}:` : line
    : null)
}

export function initialExpression(problem: IfElseProblem, operatorOnly: boolean, debug: boolean): ConditionParts {
  const parts = splitCondition(debug ? problem.wrongCondition : problem.condition)
  return operatorOnly ? { ...parts, operator: debug ? parts.operator : '' } : { left: '', operator: '', right: '' }
}

export function codePieces(problem: IfElseProblem, pedagogy: IfElsePedagogy): CodePiece[] {
  const lines = problemLines(problem, pedagogy.useInput)
  const roles = ['value', 'condition', 'print', 'else', 'print'] as const
  const pieces: CodePiece[] = lines.map((code, i) => ({ id: `line-${i}`, code, role: roles[i] }))
  if (pedagogy.construction === 'slot') return [
    ...pieces.filter((_, i) => pedagogy.prefilledLines.includes(i)).slice(0, pedagogy.distractorCount),
    ...pieces.filter((_, i) => !pedagogy.prefilledLines.includes(i)),
  ]
  const parts = splitCondition(problem.condition)
  const conditions = [problem.wrongCondition, ...comparisonOperators.map((operator) => `${parts.left} ${operator} ${parts.right}`)]
  const distractors = [...new Set(conditions)].filter((condition) => condition !== problem.condition).slice(0, pedagogy.distractorCount)
  distractors.forEach((condition, i) => pieces.push({ id: `decoy-${i}`, code: `if ${condition}:`, role: 'condition' }))
  if (pedagogy.showOrderLabels) return pieces
  // Stable mixing lets the UI stay predictable without suggesting code order.
  return pieces.map((piece, i) => ({ piece, sort: (i * 3 + 2) % pieces.length })).sort((a, b) => a.sort - b.sort).map(({ piece }) => piece)
}

export function expressionChoices(problem: IfElseProblem, independent: boolean): { left: string[]; operator: string[]; right: string[] } {
  const { left, right } = splitCondition(problem.condition)
  const target = Number(right)
  return {
    left: independent ? [right, problem.variable] : left === problem.variable ? [problem.variable, right] : [problem.variable, left],
    operator: comparisonOperators,
    right: [...new Set([String(target + 1), right, String(target - 1), ...(independent ? [problem.variable] : [])])],
  }
}

// Test the rule, not just one lucky input. All editable expressions use a
// single comparison over the existing variable, a constant, or its remainder.
export function ruleProbeValues(problem: IfElseProblem, condition: string, value: number): number[] {
  const expected = splitCondition(problem.condition)
  const candidate = splitCondition(condition)
  const boundaries = [Number(expected.right), Number(candidate.right), Number(candidate.left)]
  const step = problem.decimal ? 0.01 : 1
  return [...new Set([problem.min, problem.max, problem.initial, value, 0, 1, 2, -1,
    ...boundaries.filter(Number.isFinite).flatMap((n) => [n - step, n, n + step])])]
    .filter((n) => Number.isFinite(n) && n >= problem.min && n <= problem.max && (problem.decimal || Number.isInteger(n)))
}

export function diagnoseProgram(problem: IfElseProblem, pedagogy: IfElsePedagogy, lines: string[], value: number): Diagnosis | null {
  const expected = problemLines(problem, pedagogy.useInput)
  const structure = [
    (line: string) => line === expected[0],
    (line: string) => /^if .+:$/.test(line),
    (line: string) => /^ {4}print\(".*"\)$/.test(line),
    (line: string) => line === 'else:',
    (line: string) => /^ {4}print\(".*"\)$/.test(line),
  ]
  const badLine = structure.findIndex((valid, i) => !valid(lines[i] ?? ''))
  if (badLine >= 0 || lines.length !== 5) return { kind: 'structure', line: Math.max(0, badLine) }
  const condition = lines[1].slice(3, -1)
  try {
    const witness = ruleProbeValues(problem, condition, value).find((n) => evaluateCondition(condition, problem.variable, n) !== evaluateCondition(problem.condition, problem.variable, n))
    if (witness !== undefined) return { kind: pedagogy.mode === 'debug' ? 'logic' : 'condition', line: 1, witness }
  } catch { return { kind: 'condition', line: 1 } }
  if (lines[2] !== expected[2]) return { kind: 'output', line: 2 }
  if (lines[4] !== expected[4]) return { kind: 'output', line: 4 }
  return null
}

export function executionTrace(problem: IfElseProblem, lines: string[], value: number, stdout: string): ExecutionTrace {
  const condition = lines[1].slice(3, -1)
  const parts = splitCondition(condition)
  const truth = evaluateCondition(condition, problem.variable, value)
  const substitute = (expression: string) => expression.replace(new RegExp(`\\b${problem.variable}\\b`, 'g'), String(value))
  const comparison = `${substitute(parts.left)} ${parts.operator} ${substitute(parts.right)}`
  const resolved = `${evaluateMath(parts.left, { [problem.variable]: value })} ${parts.operator} ${evaluateMath(parts.right, { [problem.variable]: value })}`
  return { value, truth, branch: truth ? 'IF' : 'ELSE', output: stdout, steps: [
    { label: 'VALUE', text: `${problem.variable} = ${value}`, line: 0 },
    { label: 'CONDITION', text: `${condition}\n${comparison}${comparison === resolved ? '' : `\n${resolved}`}`, line: 1 },
    { label: 'TRUE / FALSE', text: truth ? 'TRUE' : 'FALSE', line: 1 },
    { label: 'PATH', text: truth ? 'IF' : 'ELSE', line: truth ? 1 : 3 },
    { label: 'ACTION', text: stdout, line: truth ? 2 : 4 },
  ] }
}

export function learningFeedback(problem: IfElseProblem, diagnosis: Diagnosis, attempt: number, value: number): string {
  const parts = splitCondition(problem.condition)
  const remainder = parts.left.includes('%')
  const equality = parts.operator === '==' || parts.operator === '!='
  const area = { structure: 'Check the structure and line order.', condition: 'Check the condition.', logic: 'Check the decision your program makes.', output: 'Check the action inside this branch.', runtime: 'Python could not run this program. Check the highlighted line.' }
  if (attempt <= 1) return area[diagnosis.kind]
  if (attempt === 2) {
    if (diagnosis.kind === 'structure') return 'Python reads from top to bottom. Has it read the value before testing it? Does each action sit inside its branch?'
    if (diagnosis.kind === 'output') return 'The condition chooses a path. Does the action on that path match the message requested in the mission?'
    return `Which result should ${problem.variable} = ${diagnosis.witness ?? value} produce according to the mission? ${remainder ? 'Work out the remainder before comparing it.' : equality ? 'Does the rule ask for an exact match?' : 'Does the rule include the boundary itself?'}`
  }
  if (attempt === 3) {
    if (diagnosis.kind === 'structure') return 'The IF action is indented under if. else: lines up with if, and its action is indented too.'
    if (diagnosis.kind === 'output') return 'TRUE executes only the IF action. FALSE executes only the ELSE action. Each path needs its own requested message.'
    return problem.explanation
  }
  if (diagnosis.kind === 'structure') return `Look at line ${diagnosis.line + 1}: its job is "${structureLabels[diagnosis.line]}". You can ask to see a model of this piece.`
  if (diagnosis.kind === 'output') return 'Trace TRUE to IF and FALSE to ELSE, then compare each action with the mission. A model is available if you need it.'
  if (remainder) return 'Find the remainder, then compare it with the result requested in the mission. Try an even value and an odd value. A model of the condition is available if you need it.'
  if (equality) return 'Compare an exact match with a non-matching value. Should they take the same path? A model of the condition is available if you need it.'
  return 'Read the rule one phrase at a time and test just below, at, and above its cutoff. A model of the condition is available if you need it.'
}
