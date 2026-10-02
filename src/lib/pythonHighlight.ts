export type PythonTokenKind = 'keyword' | 'function' | 'name' | 'number' | 'string' | 'operator' | 'comment' | 'plain'

export interface PythonToken {
  kind: PythonTokenKind
  value: string
}

const keywords = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'case', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
  'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'match', 'None', 'nonlocal', 'not',
  'or', 'pass', 'print', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield',
])

const stringPrefixes = new Set(['f', 'r', 'b', 'u', 'fr', 'rf', 'br', 'rb'])

const operators = ['**', '//', '==', '!=', '<=', '>=', '->', '+=', '-=', '*=', '/=', '%=', '=', '+', '-', '*', '/', '%', '<', '>']

function readString(code: string, start: number): number {
  const quote = code[start]
  const long = code.startsWith(quote.repeat(3), start)
  const marker = long ? quote.repeat(3) : quote
  let index = start + marker.length
  while (index < code.length) {
    if (code[index] === '\\') { index += 2; continue }
    if (code.startsWith(marker, index)) return index + marker.length
    if (!long && code[index] === '\n') return index
    index += 1
  }
  return code.length
}

export function highlightPython(code: string): PythonToken[] {
  const tokens: PythonToken[] = []
  let plain = ''
  let index = 0
  const flush = () => {
    if (!plain) return
    tokens.push({ kind: 'plain', value: plain })
    plain = ''
  }
  const push = (kind: PythonTokenKind, value: string) => { flush(); tokens.push({ kind, value }) }

  while (index < code.length) {
    const char = code[index]
    if (char === '#') {
      const end = code.indexOf('\n', index)
      const stop = end === -1 ? code.length : end
      push('comment', code.slice(index, stop))
      index = stop
      continue
    }
    if (char === '"' || char === "'") {
      const end = readString(code, index)
      push('string', code.slice(index, end))
      index = end
      continue
    }
    if (/[0-9]/.test(char)) {
      let end = index + 1
      while (end < code.length && /[0-9A-Za-z_.]/.test(code[end])) end += 1
      push('number', code.slice(index, end))
      index = end
      continue
    }
    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1
      while (end < code.length && /[A-Za-z0-9_]/.test(code[end])) end += 1
      const word = code.slice(index, end)
      if (stringPrefixes.has(word.toLowerCase()) && /['"]/.test(code[end] ?? '')) {
        const stop = readString(code, end)
        push('string', code.slice(index, stop))
        index = stop
        continue
      }
      if (keywords.has(word)) push('keyword', word)
      else if (code[end] === '(') push('function', word)
      else push('name', word)
      index = end
      continue
    }
    const pair = code.slice(index, index + 2)
    if (operators.includes(pair)) {
      push('operator', pair)
      index += 2
      continue
    }
    if (operators.includes(char)) {
      push('operator', char)
      index += 1
      continue
    }
    plain += char
    index += 1
  }

  flush()
  return tokens
}
