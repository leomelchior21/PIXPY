export const STOP_COLUMN_COUNT = 6
export const STOP_MAX_CODE_LENGTH = 20000

export type StopChip = 'VALID' | 'COMBO'
export type StopTipKind = 'unlabeled' | 'undefined' | 'pending' | 'mix'

export interface StopTip {
  kind: StopTipKind
  text: string
  line: number
}

export interface StopColumn {
  label: string
  source: string
  value: string
  chip: StopChip
  line: number
}

export interface StopSyntaxIssue {
  line: number
  message: string
}

export interface StopSheetState {
  columns: StopColumn[]
  tips: StopTip[]
  complete: boolean
  syntaxIssue: StopSyntaxIssue | null
}

export function buildStopStarter(name: string): string {
  const safeName = name.trim().replace(/["\\\r\n]/g, '') || 'Your Name'
  return [
    '# STOP RULES',
    '# 1. A string variable stores text.',
    `answer1 = "${safeName}"`,
    '',
    '# 2. Use the "+" sign to add the text and variable.',
    'print("Name: " + answer1)',
    '',
    ...Array.from({ length: 10 }, () => ''),
  ].join('\n')
}

export function cleanStopLabel(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s:=–—-]+$/u, '')
    .trim()
    .toUpperCase()
}

export function countStopLines(code: string): number {
  return code.split(/\r?\n/).length
}

type StopKind = 'string' | 'int' | 'float' | 'bool' | 'none' | 'unknown'

interface StopFStringPart {
  text?: string
  code?: string
}

interface Token {
  kind: 'name' | 'number' | 'string' | 'fstring' | 'op' | 'unknown' | 'newline'
  value: string
  raw: string
  line: number
  start: number
  end: number
  parts?: StopFStringPart[]
}

interface StopVariable {
  kind: StopKind
  value: string | number | boolean | null
  display: string
  combo: boolean
  line: number
  printed: boolean
}

interface ResolvedValue {
  kind: StopKind
  value: string | number | boolean | null
  display: string
  combo: boolean
  refs: string[]
  undefinedName: string | null
}

type StopExpr =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'none' }
  | { kind: 'name'; name: string }
  | { kind: 'fstring'; parts: StopFStringPart[] }
  | { kind: 'call'; name: string; args: StopExpr[] }
  | { kind: 'binop'; op: '+' | '-' | '*' | '/' | '//' | '%' | '**'; left: StopExpr; right: StopExpr }
  | { kind: 'unknown' }

export function analyzeStopSheet(source: string): StopSheetState {
  const code = source.length > STOP_MAX_CODE_LENGTH ? source.slice(0, STOP_MAX_CODE_LENGTH) : source
  const { tokens, syntaxIssue } = tokenizeStopCode(code)
  const lines = splitLogicalLines(tokens)
  const variables = new Map<string, StopVariable>()
  const columns: StopColumn[] = []
  const tips: StopTip[] = []

  for (const line of lines) {
    if (!line.tokens.length) continue
    const assignment = readAssignment(line.tokens)
    if (assignment) {
      if (assignment.operator === '+=') {
        const previous = variables.get(assignment.name)
        if (!previous) {
          variables.set(assignment.name, { kind: 'unknown', value: null, display: '?', combo: false, line: line.line, printed: false })
        } else if (assignment.expression === null) {
          variables.set(assignment.name, { ...previous, kind: 'unknown', value: null, display: '?', combo: false, line: line.line })
        } else {
          const resolved = resolveStopExpression({ kind: 'binop', op: '+', left: { kind: 'name', name: assignment.name }, right: assignment.expression }, variables)
          variables.set(assignment.name, toVariable(resolved, line.line))
        }
      } else if (assignment.expression === null) {
        variables.set(assignment.name, { kind: 'unknown', value: null, display: '?', combo: false, line: line.line, printed: false })
      } else {
        const resolved = resolveStopExpression(assignment.expression, variables)
        variables.set(assignment.name, toVariable(resolved, line.line))
      }
      continue
    }
    const args = readPrintArguments(line.tokens)
    if (args) analyzePrint(args, line.line, variables, columns, tips)
  }

  for (const [name, variable] of variables) {
    if (variable.kind === 'string' && !variable.printed) {
      tips.push({ kind: 'pending', text: `Not on the sheet yet: ${name}. Print it with a label to add a column.`, line: variable.line })
    }
  }

  tips.sort((a, b) => a.line - b.line)
  return { columns, tips, complete: columns.length >= STOP_COLUMN_COUNT, syntaxIssue }
}

function toVariable(resolved: ResolvedValue, line: number): StopVariable {
  return { kind: resolved.kind, value: resolved.value, display: resolved.display, combo: resolved.combo, line, printed: false }
}

function analyzePrint(args: Token[][], line: number, variables: Map<string, StopVariable>, columns: StopColumn[], tips: StopTip[]): void {
  if (!args.length) return
  const label = readPrintLabel(args)
  if (!label) {
    const parsed = args.map((arg) => parseStopExpression(arg))
    const names = [...new Set([
      ...parsed.flatMap((expression) => expression ? collectExpressionNames(expression) : []),
      ...args.flatMap((arg) => collectTokenNames(arg)),
    ])]
    if (names.length) {
      tips.push({ kind: 'unlabeled', text: `Almost! Add a label before the variable: print("Name: " + ${names[0]})`, line })
      for (const name of names) {
        const variable = variables.get(name)
        if (!variable) tips.push({ kind: 'undefined', text: `Python does not know ${name} yet. Define it above the print.`, line })
        else variable.printed = true
      }
    }
    return
  }

  const resolvedParts = label.values.map((expr) => resolveStopExpression(expr, variables))
  const missing = resolvedParts.find((part) => part.undefinedName)
  if (missing?.undefinedName) {
    tips.push({ kind: 'undefined', text: `Python does not know ${missing.undefinedName} yet. Define it above the print.`, line })
    return
  }
  const mixed = label.joiner === '' && resolvedParts.some((part) => part.kind !== 'string' && part.kind !== 'unknown')

  const displays = resolvedParts.map((part) => part.display)
  const display = label.joiner === '' ? displays.join('') : displays.join(label.joiner)
  const combo = resolvedParts.length > 1 || resolvedParts.some((part) => part.combo)
  const name = cleanStopLabel(label.raw)
  if (!name) {
    const fallback = label.values.flatMap((expr) => collectExpressionNames(expr))
    if (fallback.length) tips.push({ kind: 'unlabeled', text: `Almost! Add a label before the variable: print("Name: " + ${fallback[0]})`, line })
    return
  }

  const column: StopColumn = {
    label: name,
    source: label.source,
    value: display === '' ? '(empty)' : display,
    chip: combo ? 'COMBO' : 'VALID',
    line,
  }
  const existing = columns.findIndex((item) => item.label === name)
  if (existing >= 0) columns[existing] = { ...column, line: columns[existing].line }
  else if (columns.length < STOP_COLUMN_COUNT) columns.push(column)

  for (const part of resolvedParts) for (const ref of part.refs) {
    const variable = variables.get(ref)
    if (variable) variable.printed = true
  }

  if (mixed) {
    const mixedIndex = resolvedParts.findIndex((part) => part.kind !== 'string' && part.kind !== 'unknown')
    const offender = mixedIndex >= 0 ? collectExpressionNames(label.values[mixedIndex])[0] : null
    tips.push({ kind: 'mix', text: `Use " + str(${offender ?? 'age'}) or an f-string to combine text with numbers.`, line })
  }
}

interface PrintLabel {
  raw: string
  values: StopExpr[]
  joiner: string
  source: string
}

function readPrintLabel(args: Token[][]): PrintLabel | null {
  if (args.length >= 2 && isPlainStringToken(args[0])) {
    const values = args.slice(1).map((tokens) => parseStopExpression(tokens) ?? { kind: 'unknown' as const })
    return { raw: stringTokenValue(args[0]), values, joiner: ' ', source: args.slice(1).map((tokens) => tokens.map((token) => token.raw).join('')).join(', ') }
  }
  if (args.length !== 1) return null
  const expression = parseStopExpression(args[0])
  if (!expression) return null

  if (expression.kind === 'fstring') {
    const parts = expression.parts
    const firstText = parts[0]?.text
    if (firstText === undefined) return null
    const values = parts.filter((part) => part.code !== undefined).map((part) => expressionFromCode(part.code ?? ''))
    if (!values.length) return null
    return { raw: firstText, values, joiner: ' ', source: args[0].map((token) => token.raw).join('') }
  }

  if (expression.kind === 'binop' && expression.op === '+') {
    const terms = flattenAddition(expression)
    if (terms.length < 2 || terms[0].kind !== 'string') return null
    const labelText = terms[0].value
    const valueExpressions = terms.slice(1)
    const valueTokens = args[0]
    return { raw: labelText, values: valueExpressions, joiner: '', source: sourceForTerms(valueExpressions, valueTokens) }
  }
  return null
}

function sourceForTerms(terms: StopExpr[], tokens: Token[]): string {
  const sections: string[] = []
  for (const term of terms) {
    const match = matchExpressionRaw(term, tokens)
    if (match) sections.push(match)
  }
  return sections.length === terms.length ? sections.join(' + ') : tokens.map((token) => token.raw).join(' ')
}

function matchExpressionRaw(expr: StopExpr, tokens: Token[]): string | null {
  if (expr.kind === 'name') {
    const token = tokens.find((item) => item.kind === 'name' && item.value === expr.name)
    return token?.raw ?? null
  }
  if (expr.kind === 'number') {
    const token = tokens.find((item) => item.kind === 'number')
    return token?.raw ?? null
  }
  if (expr.kind === 'string') {
    const token = tokens.find((item) => item.kind === 'string' || item.kind === 'fstring')
    return token?.raw ?? null
  }
  if (expr.kind === 'call') {
    const nameToken = tokens.find((item) => item.kind === 'name' && item.value === expr.name)
    return nameToken ? `${expr.name}(…)` : null
  }
  return null
}

function expressionFromCode(code: string): StopExpr {
  const trimmed = stripFormatSpec(code.trim())
  if (!trimmed) return { kind: 'unknown' }
  const { tokens } = tokenizeStopCode(trimmed)
  const expression = parseStopExpression(tokens.filter((token) => token.kind !== 'newline'))
  return expression ?? { kind: 'unknown' }
}

function stripFormatSpec(code: string): string {
  let depth = 0
  let quote = ''
  for (let index = 0; index < code.length; index += 1) {
    const char = code[index]
    if (quote) {
      if (char === quote && code[index - 1] !== '\\') quote = ''
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if ('([{'.includes(char)) depth += 1
    if (')]}'.includes(char)) depth -= 1
    if (depth === 0 && (char === ':' || char === '!')) return code.slice(0, index)
  }
  return code
}

function isPlainStringToken(tokens: Token[]): boolean {
  return tokens.length === 1 && tokens[0].kind === 'string'
}

function stringTokenValue(tokens: Token[]): string {
  return tokens[0]?.value ?? ''
}

function collectTokenNames(tokens: Token[]): string[] {
  const reserved = new Set(['True', 'False', 'None', 'print', 'str', 'int', 'float', 'round', 'abs', 'input'])
  const names: string[] = []
  for (const token of tokens) {
    if (token.kind === 'name' && !reserved.has(token.value) && !names.includes(token.value)) names.push(token.value)
  }
  return names
}

function collectExpressionNames(expr: StopExpr): string[] {
  if (expr.kind === 'name') return [expr.name]
  if (expr.kind === 'binop') return [...new Set([...collectExpressionNames(expr.left), ...collectExpressionNames(expr.right)])]
  if (expr.kind === 'call') return expr.args.flatMap(collectExpressionNames)
  if (expr.kind === 'fstring') {
    return expr.parts.flatMap((part) => part.code === undefined ? [] : collectExpressionNames(expressionFromCode(part.code)))
  }
  return []
}

function flattenAddition(expr: StopExpr): StopExpr[] {
  if (expr.kind === 'binop' && expr.op === '+') return [...flattenAddition(expr.left), ...flattenAddition(expr.right)]
  return [expr]
}

function resolveStopExpression(expr: StopExpr, variables: Map<string, StopVariable>): ResolvedValue {
  if (expr.kind === 'string') return { kind: 'string', value: expr.value, display: expr.value === '' ? '(empty)' : expr.value, combo: false, refs: [], undefinedName: null }
  if (expr.kind === 'number') return numberValue(expr.value, false)
  if (expr.kind === 'bool') return { kind: 'bool', value: expr.value, display: expr.value ? 'True' : 'False', combo: false, refs: [], undefinedName: null }
  if (expr.kind === 'none') return { kind: 'none', value: null, display: 'None', combo: false, refs: [], undefinedName: null }
  if (expr.kind === 'name') {
    const variable = variables.get(expr.name)
    if (!variable || variable.kind === 'unknown') return unknownValue(null, [expr.name], expr.name)
    return { kind: variable.kind, value: variable.value, display: variable.display, combo: variable.combo, refs: [expr.name], undefinedName: null }
  }
  if (expr.kind === 'fstring') {
    const parts = expr.parts.filter((part) => part.code !== undefined)
    const resolved = parts.map((part) => resolveStopExpression(expressionFromCode(part.code ?? ''), variables))
    const missing = resolved.find((part) => part.undefinedName)
    if (missing) return missing
    return {
      kind: 'string',
      value: resolved.map((part) => part.display).join(' '),
      display: resolved.map((part) => part.display).join(' '),
      combo: resolved.length > 1 || resolved.some((part) => part.combo),
      refs: [...new Set(resolved.flatMap((part) => part.refs))],
      undefinedName: null,
    }
  }
  if (expr.kind === 'call') return resolveCall(expr, variables)
  if (expr.kind === 'binop') return resolveBinary(expr, variables)
  return unknownValue(null, [], null)
}

function resolveCall(expr: Extract<StopExpr, { kind: 'call' }>, variables: Map<string, StopVariable>): ResolvedValue {
  if (expr.name === 'input') return { kind: 'string', value: '', display: '(your input)', combo: false, refs: [], undefinedName: null }
  if (!expr.args[0]) return unknownValue(null, [], null)
  const inner = resolveStopExpression(expr.args[0], variables)
  if (inner.undefinedName) return inner
  if (expr.name === 'str') return { kind: 'string', value: inner.display, display: inner.display, combo: inner.combo, refs: inner.refs, undefinedName: null }
  if (expr.name === 'int' || expr.name === 'float') {
    const numeric = typeof inner.value === 'number' ? inner.value : typeof inner.value === 'boolean' ? (inner.value ? 1 : 0) : Number(inner.value)
    if (!Number.isFinite(numeric)) return unknownValue(null, inner.refs, null)
    return numberValue(expr.name === 'int' ? Math.trunc(numeric) : numeric, inner.combo, inner.refs)
  }
  if (expr.name === 'round' || expr.name === 'abs') {
    const numeric = typeof inner.value === 'number' ? inner.value : Number.NaN
    if (!Number.isFinite(numeric)) return unknownValue(null, inner.refs, null)
    return numberValue(expr.name === 'round' ? Math.round(numeric) : Math.abs(numeric), inner.combo, inner.refs)
  }
  return unknownValue(null, inner.refs, null)
}

function resolveBinary(expr: Extract<StopExpr, { kind: 'binop' }>, variables: Map<string, StopVariable>): ResolvedValue {
  const left = resolveStopExpression(expr.left, variables)
  const right = resolveStopExpression(expr.right, variables)
  if (left.undefinedName) return left
  if (right.undefinedName) return right
  const refs = [...new Set([...left.refs, ...right.refs])]

  if (expr.op === '+') {
    if (left.kind === 'string' || right.kind === 'string') {
      return { kind: 'string', value: left.display + right.display, display: left.display + right.display, combo: true, refs, undefinedName: null }
    }
    const numeric = combineNumbers(left.value, right.value, (a, b) => a + b)
    return numeric === null ? unknownValue(null, refs, null) : numberValue(numeric, true, refs)
  }
  if (expr.op === '-' || expr.op === '*' || expr.op === '/' || expr.op === '//' || expr.op === '%' || expr.op === '**') {
    const numeric = combineNumbers(left.value, right.value, (a, b) => {
      if (expr.op === '-') return a - b
      if (expr.op === '*') return a * b
      if (expr.op === '/') return b === 0 ? Number.NaN : a / b
      if (expr.op === '//') return b === 0 ? Number.NaN : Math.floor(a / b)
      if (expr.op === '%') return b === 0 ? Number.NaN : a % b
      return a ** b
    })
    return numeric === null ? unknownValue(null, refs, null) : numberValue(numeric, true, refs)
  }
  return unknownValue(null, refs, null)
}

function combineNumbers(left: ResolvedValue['value'], right: ResolvedValue['value'], operation: (a: number, b: number) => number): number | null {
  const a = typeof left === 'number' ? left : typeof left === 'boolean' ? (left ? 1 : 0) : Number.NaN
  const b = typeof right === 'number' ? right : typeof right === 'boolean' ? (right ? 1 : 0) : Number.NaN
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const result = operation(a, b)
  return Number.isFinite(result) ? result : null
}

function numberValue(value: number, combo: boolean, refs: string[] = []): ResolvedValue {
  return { kind: Number.isInteger(value) ? 'int' : 'float', value, display: formatStopNumber(value), combo, refs, undefinedName: null }
}

function unknownValue(value: null, refs: string[], undefinedName: string | null): ResolvedValue {
  return { kind: 'unknown', value, display: '?', combo: true, refs, undefinedName }
}

export function formatStopNumber(value: number): string {
  if (!Number.isFinite(value)) return '?'
  if (Number.isInteger(value)) return String(value)
  const rounded = Math.round(value * 1e10) / 1e10
  return String(rounded)
}

function readAssignment(tokens: Token[]): { name: string; operator: '=' | '+='; expression: StopExpr | null } | null {
  if (tokens[0]?.kind !== 'name') return null
  if (tokens[1]?.kind !== 'op') return null
  if (tokens[1].value !== '=' && tokens[1].value !== '+=') return null
  const operator = tokens[1].value as '=' | '+='

  let depth = 0
  for (let index = 2; index < tokens.length; index += 1) {
    if (tokens[index].kind !== 'op') continue
    if ('([{'.includes(tokens[index].value)) depth += 1
    if (')]}'.includes(tokens[index].value)) depth -= 1
    if (depth === 0 && tokens[index].value === '=') return null
  }
  if (depth !== 0) return null
  return { name: tokens[0].value, operator, expression: parseStopExpression(tokens.slice(2)) }
}

function readPrintArguments(tokens: Token[]): Token[][] | null {
  if (tokens[0]?.kind !== 'name' || tokens[0].value !== 'print') return null
  if (tokens[1]?.kind !== 'op' || tokens[1].value !== '(') return null
  let depth = 0
  for (let index = 1; index < tokens.length; index += 1) {
    const value = tokens[index].value
    if (tokens[index].kind !== 'op') continue
    if (value === '(') depth += 1
    if (value === ')') {
      depth -= 1
      if (depth === 0) {
        if (index !== tokens.length - 1) return null
        return splitTopLevel(tokens.slice(2, index))
      }
    }
  }
  return null
}

function splitTopLevel(tokens: Token[]): Token[][] {
  const groups: Token[][] = [[]]
  let depth = 0
  for (const token of tokens) {
    if (token.kind === 'op' && '([{'.includes(token.value)) depth += 1
    if (token.kind === 'op' && ')]}'.includes(token.value)) depth -= 1
    if (depth === 0 && token.kind === 'op' && token.value === ',') {
      groups.push([])
      continue
    }
    groups[groups.length - 1].push(token)
  }
  return groups.filter((group) => group.length > 0)
}

function parseStopExpression(tokens: Token[]): StopExpr | null {
  let position = 0
  const peek = (): Token | undefined => tokens[position]
  const take = (): Token | undefined => tokens[position++]

  function parseAddition(): StopExpr {
    let node = parseMultiplication()
    while (peek()?.kind === 'op' && (peek()?.value === '+' || peek()?.value === '-')) {
      const op = take()!.value as '+' | '-'
      node = { kind: 'binop', op, left: node, right: parseMultiplication() }
    }
    return node
  }

  function parseMultiplication(): StopExpr {
    let node = parseUnary()
    while (peek()?.kind === 'op' && ['*', '/', '//', '%'].includes(peek()!.value)) {
      const op = take()!.value as '*' | '/' | '//' | '%'
      node = { kind: 'binop', op, left: node, right: parseUnary() }
    }
    return node
  }

  function parseUnary(): StopExpr {
    const token = peek()
    if (token?.kind === 'op' && (token.value === '+' || token.value === '-')) {
      take()
      const inner = parseUnary()
      return token.value === '+' ? inner : { kind: 'binop', op: '-', left: { kind: 'number', value: 0 }, right: inner }
    }
    return parsePower()
  }

  function parsePower(): StopExpr {
    const base = parsePrimary()
    if (peek()?.kind === 'op' && peek()?.value === '**') {
      take()
      return { kind: 'binop', op: '**', left: base, right: parseUnary() }
    }
    return base
  }

  function parsePrimary(): StopExpr {
    const token = take()
    if (!token) throw new Error('missing')
    if (token.kind === 'number') {
      const value = Number(token.value)
      if (!Number.isFinite(value)) throw new Error('number')
      return { kind: 'number', value }
    }
    if (token.kind === 'string') return { kind: 'string', value: token.value }
    if (token.kind === 'fstring') return { kind: 'fstring', parts: token.parts ?? [] }
    if (token.kind === 'name') {
      if (token.value === 'True') return { kind: 'bool', value: true }
      if (token.value === 'False') return { kind: 'bool', value: false }
      if (token.value === 'None') return { kind: 'none' }
      if (peek()?.kind === 'op' && peek()?.value === '(') {
        take()
        const args: StopExpr[] = []
        if (!(peek()?.kind === 'op' && peek()?.value === ')')) {
          args.push(parseAddition())
          while (peek()?.kind === 'op' && peek()?.value === ',') {
            take()
            if (peek()?.kind === 'op' && peek()?.value === ')') break
            args.push(parseAddition())
          }
        }
        const close = take()
        if (!close || close.kind !== 'op' || close.value !== ')') throw new Error('missing )')
        return { kind: 'call', name: token.value, args }
      }
      return { kind: 'name', name: token.value }
    }
    if (token.kind === 'op' && token.value === '(') {
      const inner = parseAddition()
      const close = take()
      if (!close || close.kind !== 'op' || close.value !== ')') throw new Error('missing )')
      return inner
    }
    throw new Error('unexpected')
  }

  try {
    const expression = parseAddition()
    if (position !== tokens.length) return null
    return expression
  } catch {
    return null
  }
}

interface LogicalLine {
  tokens: Token[]
  line: number
}

function splitLogicalLines(tokens: Token[]): LogicalLine[] {
  const lines: LogicalLine[] = []
  let current: Token[] = []
  let depth = 0

  const flush = () => {
    if (current.length) {
      lines.push({ tokens: current, line: current[0].line })
      current = []
    }
  }

  for (const token of tokens) {
    if (token.kind === 'newline') {
      if (depth <= 0) flush()
      continue
    }
    if (token.kind === 'op') {
      if ('([{'.includes(token.value)) depth += 1
      if (')]}'.includes(token.value)) depth = Math.max(0, depth - 1)
    }
    current.push(token)
  }
  flush()
  return lines
}

function tokenizeStopCode(code: string): { tokens: Token[]; syntaxIssue: StopSyntaxIssue | null } {
  const tokens: Token[] = []
  let index = 0
  let line = 1
  let syntaxIssue: StopSyntaxIssue | null = null
  const openParens: number[] = []

  const push = (token: Token) => {
    tokens.push(token)
    if (token.kind === 'op' && '([{'.includes(token.value)) openParens.push(token.line)
    if (token.kind === 'op' && ')]}'.includes(token.value)) openParens.pop()
  }

  while (index < code.length) {
    const char = code[index]
    if (char === '\r') { index += 1; continue }
    if (char === '\n') {
      push({ kind: 'newline', value: '\n', raw: '\n', line, start: index, end: index + 1 })
      line += 1
      index += 1
      continue
    }
    if (char === ' ' || char === '\t') { index += 1; continue }
    if (char === '#') {
      while (index < code.length && code[index] !== '\n') index += 1
      continue
    }
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(code[index + 1] ?? ''))) {
      const start = index
      if (char === '.') index += 1
      while (index < code.length && /[0-9]/.test(code[index])) index += 1
      if (code[index] === '.') {
        index += 1
        while (index < code.length && /[0-9]/.test(code[index])) index += 1
      }
      const raw = code.slice(start, index)
      push({ kind: 'number', value: raw, raw, line, start, end: index })
      continue
    }
    if (/[A-Za-z_]/.test(char)) {
      const start = index
      while (index < code.length && /[A-Za-z0-9_]/.test(code[index])) index += 1
      const word = code.slice(start, index)
      const next = code[index]
      const prefixed = word.length <= 2 && /^[rRbBuUfF]+$/.test(word) && (next === '"' || next === "'")
      if (prefixed) {
        const scanned = scanString(code, index, line, { rawPrefix: /[rR]/.test(word), fString: /[fF]/.test(word) })
        if (scanned.issue) {
          syntaxIssue = syntaxIssue ?? scanned.issue
          line = scanned.line
          index = scanned.end
          continue
        }
        const raw = word + scanned.raw
        push({ kind: scanned.fString ? 'fstring' : 'string', value: scanned.content, raw, line: scanned.startLine, start, end: scanned.end, parts: scanned.parts ?? undefined })
        line = scanned.line
        index = scanned.end
        continue
      }
      push({ kind: 'name', value: word, raw: word, line, start, end: index })
      continue
    }
    if (char === '"' || char === "'") {
      const scanned = scanString(code, index, line, { rawPrefix: false, fString: false })
      if (scanned.issue) {
        syntaxIssue = syntaxIssue ?? scanned.issue
        line = scanned.line
        index = scanned.end
        continue
      }
      push({ kind: 'string', value: scanned.content, raw: scanned.raw, line: scanned.startLine, start: index, end: scanned.end })
      line = scanned.line
      index = scanned.end
      continue
    }
    const two = code.slice(index, index + 2)
    if (['**', '//', '+=', '==', '!=', '>=', '<='].includes(two)) {
      push({ kind: 'op', value: two, raw: two, line, start: index, end: index + 2 })
      index += 2
      continue
    }
    if ('+-*/%(),:=.[]{}<>!&|^~'.includes(char)) {
      push({ kind: 'op', value: char, raw: char, line, start: index, end: index + 1 })
      index += 1
      continue
    }
    push({ kind: 'unknown', value: char, raw: char, line, start: index, end: index + 1 })
    index += 1
  }

  if (!syntaxIssue && openParens.length) {
    syntaxIssue = { line: openParens[0], message: 'A parenthesis is still open. Close it to finish the print.' }
  }
  return { tokens, syntaxIssue }
}

interface StringScan {
  raw: string
  content: string
  parts: StopFStringPart[] | null
  fString: boolean
  startLine: number
  line: number
  end: number
  issue: StopSyntaxIssue | null
}

function scanString(code: string, start: number, startLine: number, options: { rawPrefix: boolean; fString: boolean }): StringScan {
  const quote = code[start]
  const triple = code.startsWith(quote.repeat(3), start)
  const quoteLength = triple ? 3 : 1
  let index = start + quoteLength
  let line = startLine
  let closeIndex = -1

  while (index < code.length) {
    const char = code[index]
    if (char === '\n') {
      if (!triple) {
        return { raw: code.slice(start, index), content: '', parts: null, fString: false, startLine, line, end: index, issue: { line: startLine, message: 'A quote is still open. Finish the string.' } }
      }
      line += 1
      index += 1
      continue
    }
    if (char === '\\' && code[index + 1] !== undefined) { index += 2; continue }
    if (char === quote && (!triple || code.startsWith(quote.repeat(3), index))) {
      closeIndex = index
      index += quoteLength
      break
    }
    index += 1
  }

  if (closeIndex < 0) {
    return { raw: code.slice(start), content: '', parts: null, fString: false, startLine, line, end: code.length, issue: { line: startLine, message: 'A quote is still open. Finish the string.' } }
  }

  const raw = code.slice(start, index)
  const rawContent = code.slice(start + quoteLength, closeIndex)
  const content = options.rawPrefix ? rawContent : decodeStringContent(rawContent)
  return {
    raw,
    content,
    parts: options.fString ? parseFStringParts(content) : null,
    fString: options.fString,
    startLine,
    line,
    end: index,
    issue: null,
  }
}

function decodeStringContent(content: string): string {
  let output = ''
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    if (char !== '\\') { output += char; continue }
    const next = content[index + 1]
    if (next === undefined) { output += char; continue }
    if (next === 'n') output += '\n'
    else if (next === 't') output += '\t'
    else if (next === 'r') output += '\r'
    else if (next === '\\' || next === '"' || next === "'") output += next
    else if (next === '\n') { /* line continuation */ }
    else output += '\\' + next
    index += 1
  }
  return output
}

function parseFStringParts(content: string): StopFStringPart[] {
  const parts: StopFStringPart[] = []
  let text = ''
  let index = 0

  while (index < content.length) {
    const char = content[index]
    if (char === '{' && content[index + 1] === '{') { text += '{'; index += 2; continue }
    if (char === '}' && content[index + 1] === '}') { text += '}'; index += 2; continue }
    if (char === '}') { index += 1; continue }
    if (char !== '{') { text += char; index += 1; continue }
    if (text) { parts.push({ text }); text = '' }
    let depth = 1
    let snippet = ''
    index += 1
    while (index < content.length && depth > 0) {
      const inner = content[index]
      if (inner === '{') depth += 1
      if (inner === '}') {
        depth -= 1
        if (depth === 0) { index += 1; break }
      }
      snippet += inner
      index += 1
    }
    parts.push({ code: snippet.trim() })
  }
  if (text) parts.push({ text })
  return parts
}
