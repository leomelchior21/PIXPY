import type { ScriptRunResult } from '../types'

type Value = string | number | boolean | null

export function runGuidedPython(code: string, inputs: string[] = []): ScriptRunResult {
  const variables: Record<string, Value> = {}
  const output: string[] = []
  let inputIndex = 0
  const lines = code.split('\n')
  const branches: Array<{ indent: number; bodyIndent: number | null; parentActive: boolean; condition: boolean; active: boolean; hasElse: boolean }> = []
  let needsBody = false

  for (let index = 0; index < lines.length; index += 1) {
    const raw = stripPythonComment(lines[index])
    const line = raw.trim()
    if (!line) continue
    const whitespace = raw.match(/^\s*/)?.[0] ?? ''
    if (whitespace.includes('\t')) throw new Error(`Line ${index + 1}: use spaces for indentation.`)
    const indent = whitespace.length
    const previous = branches.at(-1)
    if (needsBody && (!previous || indent <= previous.indent)) throw new Error(`Line ${index + 1}: indent the code inside the condition.`)
    needsBody = false
    while (branches.length && (indent < branches.at(-1)!.indent || (indent === branches.at(-1)!.indent && line !== 'else:'))) branches.pop()

    if (line === 'else:') {
      const branch = branches.at(-1)
      if (!branch || branch.indent !== indent || branch.hasElse) throw new Error(`Line ${index + 1}: else needs a matching if.`)
      branch.hasElse = true
      branch.active = branch.parentActive && !branch.condition
      branch.bodyIndent = null
      needsBody = true
      continue
    }
    const parent = branches.at(-1)
    if (parent) {
      parent.bodyIndent ??= indent
      if (indent !== parent.bodyIndent || indent <= parent.indent) throw new Error(`Line ${index + 1}: check the indentation.`)
    } else if (indent !== 0) throw new Error(`Line ${index + 1}: unexpected indentation.`)
    const active = parent?.active ?? true
    const ifMatch = line.match(/^if\s+(.+):$/)
    if (ifMatch) {
      const condition = active && readCondition(ifMatch[1], variables, inputs, () => inputIndex++)
      branches.push({ indent, bodyIndent: null, parentActive: active, condition, active: condition, hasElse: false })
      needsBody = true
      continue
    }

    const printMatch = line.match(/^print\((.*)\)$/)
    if (printMatch) {
      if (!active) continue
      const printed = splitTopLevel(printMatch[1], ',').map((argument) => argument.trim() === '' ? '' : formatValue(readValue(argument, variables, inputs, () => inputIndex++))).join(' ')
      output.push(printed)
      continue
    }

    const assignment = line.match(/^([A-Za-z_]\w*)\s*(\+=|=)(?!=)\s*(.+)$/)
    if (assignment) {
      if (!active) continue
      const name = assignment[1]
      const value = readValue(assignment[3], variables, inputs, () => inputIndex++)
      if (assignment[2] === '+=') {
        if (!Object.prototype.hasOwnProperty.call(variables, name)) throw new Error(`Line ${index + 1}: ${name} needs a value before +=.`)
        variables[name] = addValues(variables[name], value)
      } else {
        variables[name] = value
      }
      continue
    }

    throw new Error(`Line ${index + 1} needs an assignment or print().`)
  }

  if (needsBody) throw new Error('Indent a line of code after the condition.')

  return { stdout: output.join('\n'), variables }
}

function readCondition(expression: string, variables: Record<string, Value>, inputs: string[], takeInput: () => number): boolean {
  const comparison = expression.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/)
  if (!comparison) return Boolean(readValue(expression, variables, inputs, takeInput))
  const left = readValue(comparison[1], variables, inputs, takeInput)
  const right = readValue(comparison[3], variables, inputs, takeInput)
  if (comparison[2] === '==') return left === right
  if (comparison[2] === '!=') return left !== right
  if (typeof left !== 'number' || typeof right !== 'number') throw new Error('Use numbers on both sides of this comparison.')
  if (comparison[2] === '>=') return left >= right
  if (comparison[2] === '<=') return left <= right
  if (comparison[2] === '>') return left > right
  return left < right
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
  const parts = splitTopLevel(source, '+')
  if (parts.length > 1 && parts.some((part) => /["']/.test(part))) {
    return parts.map((part) => formatValue(readValue(part, variables, inputs, takeInput))).join('')
  }
  const fstring = source.match(/^[fF](["'])([\s\S]*)\1$/)
  if (fstring) {
    return fstring[2]
      .replace(/\{\{/g, '\uE000').replace(/\}\}/g, '\uE001')
      .replace(/\{([^{}]+)\}/g, (_match, inner: string) => formatValue(readValue(inner.trim(), variables, inputs, takeInput)))
      .replace(/\uE000/g, '{').replace(/\uE001/g, '}')
  }
  if ((source.startsWith('"') && source.endsWith('"')) || (source.startsWith("'") && source.endsWith("'"))) {
    return source.slice(1, -1).replace(/\\n/g, '\n').replace(/\\([\\"'])/g, '$1')
  }
  if (source === 'True') return true
  if (source === 'False') return false
  if (source === 'None') return null
  if (/^[A-Za-z_]\w*$/.test(source) && Object.prototype.hasOwnProperty.call(variables, source)) return variables[source]
  return evaluateMath(source, variables)
}

function splitTopLevel(expression: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let escaped = false
  let start = 0
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index]
    if (quote) {
      if (escaped) { escaped = false; continue }
      if (character === '\\') { escaped = true; continue }
      if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'") { quote = character; continue }
    if ('([{'.includes(character)) depth += 1
    if (')]}'.includes(character)) depth -= 1
    if (depth === 0 && character === separator) {
      parts.push(expression.slice(start, index))
      start = index + 1
    }
  }
  parts.push(expression.slice(start))
  return parts
}

function addValues(left: Value, right: Value): Value {
  if (typeof left === 'string' || typeof right === 'string') return formatValue(left) + formatValue(right)
  if (typeof left === 'number' && typeof right === 'number') return left + right
  if (typeof left === 'boolean' || typeof right === 'boolean') return Number(left) + Number(right)
  return null
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
      if (!Object.prototype.hasOwnProperty.call(variables, token)) throw new Error(`${token} is not defined.`)
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
