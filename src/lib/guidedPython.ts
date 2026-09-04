import type { ScriptRunResult } from '../types'

type Value = string | number | boolean | null

export function runGuidedPython(code: string, inputs: string[] = []): ScriptRunResult {
  const variables: Record<string, Value> = {}
  const output: string[] = []
  let inputIndex = 0
  const lines = code.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = stripPythonComment(lines[index]).trim()
    if (!line) continue

    const printMatch = line.match(/^print\((.*)\)$/)
    if (printMatch) {
      output.push(printMatch[1].trim() === '' ? '' : formatValue(readValue(printMatch[1], variables, inputs, () => inputIndex++)))
      continue
    }

    const assignment = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/)
    if (assignment) {
      variables[assignment[1]] = readValue(assignment[2], variables, inputs, () => inputIndex++)
      continue
    }

    throw new Error(`Line ${index + 1} needs an assignment or print().`)
  }

  return { stdout: output.join('\n'), variables }
}

function stripPythonComment(line: string): string {
  let quote = ''
  let escaped = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (quote) {
      if (!escaped && character === quote) quote = ''
      escaped = !escaped && character === '\\'
      if (character !== '\\') escaped = false
      continue
    }
    if (character === '"' || character === "'") quote = character
    if (character === '#') return line.slice(0, index)
  }
  return line
}

function readValue(expression: string, variables: Record<string, Value>, inputs: string[], takeInput: () => number): Value {
  const source = expression.trim()
  if (/^input\((?:["'].*["'])?\)$/.test(source)) return inputs[takeInput()] ?? ''
  if (/^(?:int|float)\(input\((?:["'].*["'])?\)\)$/.test(source)) {
    const value = Number(inputs[takeInput()] ?? '')
    if (!Number.isFinite(value)) throw new Error('That input needs a number.')
    return value
  }
  const stringCall = source.match(/^str\((.*)\)$/)
  if (stringCall) return formatValue(readValue(stringCall[1], variables, inputs, takeInput))
  const numberCall = source.match(/^(round|abs)\((.*)\)$/)
  if (numberCall) {
    const value = Number(readValue(numberCall[2], variables, inputs, takeInput))
    return numberCall[1] === 'round' ? Math.round(value) : Math.abs(value)
  }
  if ((source.startsWith('"') && source.endsWith('"')) || (source.startsWith("'") && source.endsWith("'"))) {
    return source.slice(1, -1).replace(/\\n/g, '\n').replace(/\\([\\"'])/g, '$1')
  }
  if (source === 'True') return true
  if (source === 'False') return false
  if (source === 'None') return null
  return evaluateMath(source, variables)
}

export function evaluateMath(expression: string, variables: Record<string, Value>): number {
  const tokens = tokenize(expression)
  let position = 0

  const peek = () => tokens[position]
  const take = () => tokens[position++]

  const primary = (): number => {
    const token = take()
    if (!token) throw new Error('Finish the formula before running it.')
    if (token === '(') {
      const value = addition()
      if (take() !== ')') throw new Error('A closing parenthesis is missing.')
      return value
    }
    if (/^\d+(?:\.\d+)?$/.test(token)) return Number(token)
    if (/^[A-Za-z_]\w*$/.test(token)) {
      const value = variables[token]
      if (typeof value !== 'number') throw new Error(`${token} needs a number.`)
      return value
    }
    throw new Error(`PixPy did not expect “${token}” there.`)
  }

  const unary = (): number => {
    if (peek() === '+') { take(); return unary() }
    if (peek() === '-') { take(); return -unary() }
    return primary()
  }

  const power = (): number => {
    const left = unary()
    if (peek() === '**') { take(); return left ** power() }
    return left
  }

  const multiplication = (): number => {
    let value = power()
    while (['*', '/', '//', '%'].includes(peek())) {
      const operator = take()
      const right = power()
      if ((operator === '/' || operator === '//' || operator === '%') && right === 0) throw new Error('Python cannot divide by zero.')
      if (operator === '*') value *= right
      if (operator === '/') value /= right
      if (operator === '//') value = Math.floor(value / right)
      if (operator === '%') value %= right
    }
    return value
  }

  const addition = (): number => {
    let value = multiplication()
    while (peek() === '+' || peek() === '-') {
      const operator = take()
      const right = multiplication()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  const result = addition()
  if (position < tokens.length) throw new Error(`PixPy did not expect “${tokens[position]}” there.`)
  if (!Number.isFinite(result)) throw new Error('That result is too wild to display safely.')
  return result
}

function tokenize(expression: string): string[] {
  const tokens = expression.match(/\*\*|\/\/|\d+(?:\.\d+)?|[A-Za-z_]\w*|[()+\-*/%]/g) ?? []
  if (tokens.join('').length !== expression.replace(/\s/g, '').length) throw new Error('That formula contains something this playground does not use yet.')
  return tokens
}

function formatValue(value: Value): string {
  if (value === null) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  return String(value)
}
