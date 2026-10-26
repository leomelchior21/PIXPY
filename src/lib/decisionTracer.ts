// A small, exact interpreter for the classroom's decision programs.
// It understands assignments, input(), if/else blocks (nested too), and
// print(), and it records every step so activities can animate the path.
// Syntax and runtime messages follow CPython 3.12+ wording for these programs.

export type PyValue =
  | { kind: 'int' | 'float'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'none' }

export type DecisionErrorType = 'SyntaxError' | 'IndentationError' | 'TypeError' | 'NameError' | 'ValueError' | 'EOFError' | 'ZeroDivisionError'

export interface DecisionError {
  type: DecisionErrorType
  message: string
  /** 0-based line where Python reports the problem. */
  line: number
  phase: 'syntax' | 'runtime'
}

export interface TraceEvent {
  line: number
  kind: 'assign' | 'test' | 'else' | 'print'
  text: string
  truth?: boolean
  output?: string
}

export interface DecisionRun {
  outputs: string[]
  events: TraceEvent[]
  error: DecisionError | null
}

type Token = { type: 'num' | 'str' | 'name' | 'op'; value: string }

type Expr =
  | { type: 'num'; value: number; float: boolean }
  | { type: 'str'; value: string }
  | { type: 'name'; name: string }
  | { type: 'const'; value: PyValue }
  | { type: 'call'; name: string; args: Expr[] }
  | { type: 'unary'; op: string; operand: Expr }
  | { type: 'binary'; op: string; left: Expr; right: Expr }
  | { type: 'compare'; ops: string[]; operands: Expr[] }

type Statement =
  | { type: 'if'; line: number; test: Expr; body: Statement[]; orelse: Statement[] | null; elseLine: number | null }
  | { type: 'assign'; line: number; name: string; value: Expr }
  | { type: 'expr'; line: number; value: Expr }

class PythonError extends Error {
  readonly type: DecisionErrorType
  readonly line: number
  constructor(type: DecisionErrorType, message: string, line: number) {
    super(message)
    this.type = type
    this.line = line
  }
}

const comparisonOps = ['==', '!=', '>=', '<=', '>', '<']
const callable = new Set(['print', 'input', 'int', 'float', 'str', 'abs'])

/** Splits one-line parts that contain newlines so callers can mix both. */
export function flattenProgram(parts: string[]): string[] {
  return parts.flatMap((part) => part.split('\n'))
}

export function runDecisionProgram(lines: string[], inputs: string[] = []): DecisionRun {
  let program: Statement[]
  try {
    program = compileProgram(lines)
  } catch (error) {
    if (error instanceof PythonError) return { outputs: [], events: [], error: { type: error.type, message: error.message, line: error.line, phase: 'syntax' } }
    throw error
  }
  const state: RunState = { variables: new Map(), inputs, inputIndex: 0, outputs: [], events: [], line: 0 }
  try {
    executeBlock(program, state)
    return { outputs: state.outputs, events: state.events, error: null }
  } catch (error) {
    if (error instanceof PythonError) return { outputs: state.outputs, events: state.events, error: { type: error.type, message: error.message, line: error.line, phase: 'runtime' } }
    throw error
  }
}

/** Python's "File ..., line N / Kind: message" report, kept short for students. */
export function formatPythonError(error: DecisionError, fileName = 'machine.py'): string {
  return `File "${fileName}", line ${error.line + 1}\n${error.type}: ${error.message}`
}

// ---------------------------------------------------------------- compile

interface LogicalLine { line: number; indent: number; tokens: Token[]; raw: string }

function compileProgram(lines: string[]): Statement[] {
  const logical: LogicalLine[] = []
  lines.forEach((source, line) => {
    const raw = stripComment(source)
    if (!raw.trim()) return
    const whitespace = raw.match(/^[ \t]*/)?.[0] ?? ''
    logical.push({ line, indent: whitespace.replace(/\t/g, '        ').length, tokens: [], raw: raw.trim() })
  })

  const stack = [0]
  let expecting: { kind: 'if' | 'else'; line: number } | null = null
  type Frame = { statements: Statement[]; lastIf: Extract<Statement, { type: 'if' }> | null }
  const frames: Frame[] = [{ statements: [], lastIf: null }]
  const openBodies: Array<{ statements: Statement[] }> = []

  for (const item of logical) {
    // Indentation is checked before the line's own grammar, like CPython.
    if (expecting) {
      if (item.indent <= stack.at(-1)!) throw new PythonError('IndentationError', `expected an indented block after '${expecting.kind}' statement on line ${expecting.line + 1}`, item.line)
      stack.push(item.indent)
      frames.push({ statements: openBodies.pop()!.statements, lastIf: null })
    } else if (item.indent > stack.at(-1)!) {
      throw new PythonError('IndentationError', 'unexpected indent', item.line)
    } else {
      while (item.indent < stack.at(-1)!) { stack.pop(); frames.pop() }
      if (item.indent !== stack.at(-1)) throw new PythonError('IndentationError', 'unindent does not match any outer indentation level', item.line)
    }
    expecting = null

    item.tokens = tokenize(item.raw, item.line)
    const frame = frames.at(-1)!
    const first = item.tokens[0]
    if (first.type === 'name' && first.value === 'else') {
      if (item.tokens.length !== 2 || item.tokens[1].value !== ':') throw new PythonError('SyntaxError', "expected ':'", item.line)
      const owner = frame.lastIf
      if (!owner || owner.orelse) throw new PythonError('SyntaxError', 'invalid syntax', item.line)
      owner.orelse = []
      owner.elseLine = item.line
      frame.lastIf = null
      openBodies.push({ statements: owner.orelse })
      expecting = { kind: 'else', line: item.line }
      continue
    }
    if (first.type === 'name' && first.value === 'if') {
      const test = parseIfHeader(item.tokens, item.line)
      const statement: Extract<Statement, { type: 'if' }> = { type: 'if', line: item.line, test, body: [], orelse: null, elseLine: null }
      frame.statements.push(statement)
      frame.lastIf = statement
      openBodies.push({ statements: statement.body })
      expecting = { kind: 'if', line: item.line }
      continue
    }
    frame.lastIf = null
    frame.statements.push(parseSimpleStatement(item.tokens, item.line))
  }
  if (expecting) {
    const last = logical.at(-1)?.line ?? 0
    throw new PythonError('IndentationError', `expected an indented block after '${expecting.kind}' statement on line ${expecting.line + 1}`, last + 1)
  }
  return frames[0].statements
}

function stripComment(line: string): string {
  let quote = ''
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (quote) {
      if (character === '\\') { index += 1; continue }
      if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'") quote = character
    else if (character === '#') return line.slice(0, index)
  }
  return line
}

function tokenize(source: string, line: number): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < source.length) {
    const character = source[index]
    if (character === ' ' || character === '\t') { index += 1; continue }
    if (character === '"' || character === "'") {
      let end = index + 1
      let value = ''
      while (end < source.length && source[end] !== character) {
        if (source[end] === '\\' && end + 1 < source.length) { value += source[end + 1] === 'n' ? '\n' : source[end + 1]; end += 2; continue }
        value += source[end]
        end += 1
      }
      if (end >= source.length) throw new PythonError('SyntaxError', `unterminated string literal (detected at line ${line + 1})`, line)
      tokens.push({ type: 'str', value })
      index = end + 1
      continue
    }
    const number = source.slice(index).match(/^(\d+\.\d*|\.\d+|\d+)/)
    if (number) { tokens.push({ type: 'num', value: number[0] }); index += number[0].length; continue }
    const name = source.slice(index).match(/^[A-Za-z_]\w*/)
    if (name) { tokens.push({ type: 'name', value: name[0] }); index += name[0].length; continue }
    const op = ['==', '!=', '>=', '<=', '//', '**'].find((candidate) => source.startsWith(candidate, index)) ?? character
    if (!'=!<>+-*/%(),:;'.includes(op[0])) throw new PythonError('SyntaxError', 'invalid syntax', line)
    tokens.push({ type: 'op', value: op })
    index += op.length
  }
  return tokens
}

function topLevelAssignIndex(tokens: Token[]): number {
  let depth = 0
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.type !== 'op') continue
    if (token.value === '(') depth += 1
    if (token.value === ')') depth -= 1
    if (depth === 0 && token.value === '=') return index
  }
  return -1
}

function startsOperand(token: Token | undefined): boolean {
  return Boolean(token && (token.type !== 'op' || token.value === '(' || token.value === '-'))
}

function parseIfHeader(tokens: Token[], line: number): Expr {
  const body = tokens.slice(1)
  const assign = topLevelAssignIndex(body)
  const before = body[assign - 1]
  if (assign > 0 && (before.type !== 'op' || before.value === ')') && startsOperand(body[assign + 1])) throw new PythonError('SyntaxError', "invalid syntax. Maybe you meant '==' or ':=' instead of '='?", line)
  const hasColon = body.at(-1)?.value === ':' && body.at(-1)?.type === 'op'
  const condition = hasColon ? body.slice(0, -1) : body
  const parsed = tryParseExpression(condition)
  if (!hasColon) throw new PythonError('SyntaxError', parsed ? "expected ':'" : 'invalid syntax', line)
  if (!parsed) throw new PythonError('SyntaxError', 'invalid syntax', line)
  return parsed
}

function parseSimpleStatement(tokens: Token[], line: number): Statement {
  if (tokens.some((token) => token.type === 'name' && token.value === 'elif')) throw new PythonError('SyntaxError', 'invalid syntax', line)
  const opens = tokens.filter((token) => token.type === 'op' && token.value === '(').length
  const closes = tokens.filter((token) => token.type === 'op' && token.value === ')').length
  if (opens > closes) throw new PythonError('SyntaxError', "'(' was never closed", line)
  const assign = topLevelAssignIndex(tokens)
  if (assign >= 0) {
    const target = tokens.slice(0, assign)
    if (target.length === 1 && target[0].type === 'name') {
      const value = tryParseExpression(tokens.slice(assign + 1))
      if (!value) throw new PythonError('SyntaxError', 'invalid syntax', line)
      return { type: 'assign', line, name: target[0].value, value }
    }
    if (target.length >= 3 && target[0].type === 'name' && target[1].value === '(' && target.at(-1)?.value === ')') {
      throw new PythonError('SyntaxError', "cannot assign to function call here. Maybe you meant '==' instead of '='?", line)
    }
    throw new PythonError('SyntaxError', 'invalid syntax', line)
  }
  const value = tryParseExpression(tokens)
  if (value) return { type: 'expr', line, value }
  const adjacent = tokens.some((token, index) => index > 0 && token.type !== 'op' && tokens[index - 1].type !== 'op' && !isKeyword(token.value) && !isKeyword(tokens[index - 1].value))
  throw new PythonError('SyntaxError', adjacent ? 'invalid syntax. Perhaps you forgot a comma?' : 'invalid syntax', line)
}

function isKeyword(value: string): boolean {
  return ['if', 'else', 'elif', 'and', 'or', 'not', 'then', 'True', 'False', 'None'].includes(value)
}

function tryParseExpression(tokens: Token[]): Expr | null {
  if (!tokens.length) return null
  let position = 0
  const peek = () => tokens[position]
  const take = () => tokens[position++]
  const isOp = (value: string) => peek()?.type === 'op' && peek()?.value === value

  const atom = (): Expr | null => {
    const token = take()
    if (!token) return null
    if (token.type === 'num') return { type: 'num', value: Number(token.value), float: token.value.includes('.') }
    if (token.type === 'str') return { type: 'str', value: token.value }
    if (token.type === 'name') {
      if (token.value === 'True' || token.value === 'False') return { type: 'const', value: { kind: 'bool', value: token.value === 'True' } }
      if (token.value === 'None') return { type: 'const', value: { kind: 'none' } }
      if (['if', 'else', 'elif', 'and', 'or', 'not', 'then'].includes(token.value)) return null
      if (isOp('(')) {
        take()
        const args: Expr[] = []
        if (!isOp(')')) {
          for (;;) {
            const argument = comparison()
            if (!argument) return null
            args.push(argument)
            if (isOp(',')) { take(); continue }
            break
          }
        }
        if (!isOp(')')) return null
        take()
        return { type: 'call', name: token.value, args }
      }
      return { type: 'name', name: token.value }
    }
    if (token.value === '(') {
      const inner = comparison()
      if (!inner || !isOp(')')) return null
      take()
      return inner
    }
    return null
  }
  const unary = (): Expr | null => {
    if (isOp('-') || isOp('+')) {
      const op = take().value
      const operand = unary()
      return operand ? { type: 'unary', op, operand } : null
    }
    return atom()
  }
  const term = (): Expr | null => {
    let left = unary()
    while (left && ['*', '/', '//', '%'].some(isOp)) {
      const op = take().value
      const right = unary()
      if (!right) return null
      left = { type: 'binary', op, left, right }
    }
    return left
  }
  const arith = (): Expr | null => {
    let left = term()
    while (left && (isOp('+') || isOp('-'))) {
      const op = take().value
      const right = term()
      if (!right) return null
      left = { type: 'binary', op, left, right }
    }
    return left
  }
  function comparison(): Expr | null {
    const first = arith()
    if (!first) return null
    const ops: string[] = []
    const operands = [first]
    while (peek()?.type === 'op' && comparisonOps.includes(peek()!.value)) {
      ops.push(take().value)
      const next = arith()
      if (!next) return null
      operands.push(next)
    }
    return ops.length ? { type: 'compare', ops, operands } : first
  }

  const result = comparison()
  return result && position === tokens.length ? result : null
}

// ---------------------------------------------------------------- execute

interface RunState {
  variables: Map<string, PyValue>
  inputs: string[]
  inputIndex: number
  outputs: string[]
  events: TraceEvent[]
  line: number
}

function executeBlock(statements: Statement[], state: RunState): void {
  for (const statement of statements) {
    state.line = statement.line
    if (statement.type === 'assign') {
      const value = evaluate(statement.value, state)
      state.variables.set(statement.name, value)
      state.events.push({ line: statement.line, kind: 'assign', text: `${statement.name} = ${repr(value)}` })
    } else if (statement.type === 'expr') {
      evaluate(statement.value, state)
    } else {
      const { truth, text } = evaluateTest(statement.test, state)
      state.events.push({ line: statement.line, kind: 'test', text, truth })
      if (truth) executeBlock(statement.body, state)
      else if (statement.orelse && statement.elseLine !== null) {
        state.events.push({ line: statement.elseLine, kind: 'else', text: 'else' })
        executeBlock(statement.orelse, state)
      }
    }
  }
}

function evaluateTest(test: Expr, state: RunState): { truth: boolean; text: string } {
  if (test.type === 'compare') {
    const values = test.operands.map((operand) => evaluate(operand, state))
    let truth = true
    for (let index = 0; index < test.ops.length; index += 1) {
      if (!compare(values[index], test.ops[index], values[index + 1], state.line)) { truth = false; break }
    }
    const text = values.map((value, index) => index === 0 ? repr(value) : `${test.ops[index - 1]} ${repr(value)}`).join(' ')
    return { truth, text }
  }
  const value = evaluate(test, state)
  return { truth: truthy(value), text: repr(value) }
}

function evaluate(expr: Expr, state: RunState): PyValue {
  switch (expr.type) {
    case 'num': return { kind: expr.float ? 'float' : 'int', value: expr.value }
    case 'str': return { kind: 'str', value: expr.value }
    case 'const': return expr.value
    case 'name': {
      const value = state.variables.get(expr.name)
      if (!value) throw new PythonError('NameError', `name '${expr.name}' is not defined`, state.line)
      return value
    }
    case 'unary': {
      const value = evaluate(expr.operand, state)
      if (value.kind === 'int' || value.kind === 'float') return { kind: value.kind, value: expr.op === '-' ? -value.value : value.value }
      if (value.kind === 'bool') return { kind: 'int', value: expr.op === '-' ? -Number(value.value) : Number(value.value) }
      throw new PythonError('TypeError', `bad operand type for unary ${expr.op}: '${typeName(value)}'`, state.line)
    }
    case 'binary': return arithmetic(expr.op, evaluate(expr.left, state), evaluate(expr.right, state), state.line)
    case 'compare': return { kind: 'bool', value: evaluateTest(expr, state).truth }
    case 'call': return call(expr, state)
  }
}

function call(expr: Extract<Expr, { type: 'call' }>, state: RunState): PyValue {
  if (!callable.has(expr.name)) {
    if (state.variables.has(expr.name)) throw new PythonError('TypeError', `'${typeName(state.variables.get(expr.name)!)}' object is not callable`, state.line)
    throw new PythonError('NameError', `name '${expr.name}' is not defined`, state.line)
  }
  const args = expr.args.map((argument) => evaluate(argument, state))
  if (expr.name === 'print') {
    const output = args.map(display).join(' ')
    state.outputs.push(output)
    state.events.push({ line: state.line, kind: 'print', text: `print → ${output}`, output })
    return { kind: 'none' }
  }
  if (expr.name === 'input') {
    if (state.inputIndex >= state.inputs.length) throw new PythonError('EOFError', 'EOF when reading a line', state.line)
    return { kind: 'str', value: state.inputs[state.inputIndex++] }
  }
  const [value] = args
  if (!value) throw new PythonError('TypeError', `${expr.name}() needs a value`, state.line)
  if (expr.name === 'str') return { kind: 'str', value: display(value) }
  if (expr.name === 'abs') {
    if (value.kind === 'int' || value.kind === 'float') return { kind: value.kind, value: Math.abs(value.value) }
    throw new PythonError('TypeError', `bad operand type for abs(): '${typeName(value)}'`, state.line)
  }
  if (value.kind === 'str') {
    const text = value.value.trim()
    if (expr.name === 'int') {
      if (!/^[+-]?\d+$/.test(text)) throw new PythonError('ValueError', `invalid literal for int() with base 10: ${repr(value)}`, state.line)
      return { kind: 'int', value: Number(text) }
    }
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(text)) throw new PythonError('ValueError', `could not convert string to float: ${repr(value)}`, state.line)
    return { kind: 'float', value: Number(text) }
  }
  const number = value.kind === 'bool' ? Number(value.value) : value.kind === 'none' ? Number.NaN : value.value
  if (Number.isNaN(number)) throw new PythonError('TypeError', `${expr.name}() argument must be a string or a real number, not 'NoneType'`, state.line)
  return expr.name === 'int' ? { kind: 'int', value: Math.trunc(number) } : { kind: 'float', value: number }
}

function numeric(value: PyValue): number | null {
  if (value.kind === 'int' || value.kind === 'float') return value.value
  if (value.kind === 'bool') return Number(value.value)
  return null
}

function arithmetic(op: string, left: PyValue, right: PyValue, line: number): PyValue {
  if (op === '+' && left.kind === 'str' && right.kind === 'str') return { kind: 'str', value: left.value + right.value }
  const a = numeric(left)
  const b = numeric(right)
  if (a === null || b === null) {
    if (op === '+' && left.kind === 'str') throw new PythonError('TypeError', `can only concatenate str (not "${typeName(right)}") to str`, line)
    throw new PythonError('TypeError', `unsupported operand type(s) for ${op}: '${typeName(left)}' and '${typeName(right)}'`, line)
  }
  const float = left.kind === 'float' || right.kind === 'float' || op === '/'
  if ((op === '/' || op === '//' || op === '%') && b === 0) throw new PythonError('ZeroDivisionError', 'division by zero', line)
  let result: number
  if (op === '+') result = a + b
  else if (op === '-') result = a - b
  else if (op === '*') result = a * b
  else if (op === '/') result = a / b
  else if (op === '//') result = Math.floor(a / b)
  else {
    const remainder = a % b
    // Python's remainder takes the divisor's sign, including for negatives.
    result = remainder !== 0 && Math.sign(remainder) !== Math.sign(b) ? remainder + b : remainder
  }
  return { kind: float ? 'float' : 'int', value: result }
}

function compare(left: PyValue, op: string, right: PyValue, line: number): boolean {
  const a = numeric(left)
  const b = numeric(right)
  if (op === '==' || op === '!=') {
    let equal: boolean
    if (a !== null && b !== null) equal = a === b
    else if (left.kind === 'str' && right.kind === 'str') equal = left.value === right.value
    else equal = left.kind === 'none' && right.kind === 'none'
    return op === '==' ? equal : !equal
  }
  let x: number | string
  let y: number | string
  if (a !== null && b !== null) { x = a; y = b }
  else if (left.kind === 'str' && right.kind === 'str') { x = left.value; y = right.value }
  else throw new PythonError('TypeError', `'${op}' not supported between instances of '${typeName(left)}' and '${typeName(right)}'`, line)
  if (op === '>') return x > y
  if (op === '<') return x < y
  if (op === '>=') return x >= y
  return x <= y
}

function truthy(value: PyValue): boolean {
  if (value.kind === 'none') return false
  if (value.kind === 'str') return value.value.length > 0
  if (value.kind === 'bool') return value.value
  return value.value !== 0
}

function typeName(value: PyValue): string {
  return value.kind === 'none' ? 'NoneType' : value.kind
}

function formatFloat(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e16) return value.toFixed(1)
  return String(value)
}

/** print() formatting. */
export function display(value: PyValue): string {
  if (value.kind === 'none') return 'None'
  if (value.kind === 'bool') return value.value ? 'True' : 'False'
  if (value.kind === 'str') return value.value
  return value.kind === 'float' ? formatFloat(value.value) : String(value.value)
}

/** repr() formatting, used in traces and error messages. */
export function repr(value: PyValue): string {
  if (value.kind !== 'str') return display(value)
  const quote = value.value.includes("'") && !value.value.includes('"') ? '"' : "'"
  return `${quote}${value.value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}${quote}`
}
