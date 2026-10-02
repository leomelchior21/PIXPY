import { describe, expect, it } from 'vitest'
import { highlightPython } from './pythonHighlight'

const kinds = (code: string) => highlightPython(code)
  .filter((token) => token.kind !== 'plain')
  .map((token) => `${token.kind}:${token.value}`)

describe('python highlighting', () => {
  it('colors commands the same way as the playground editor', () => {
    expect(kinds('if grade >= 7:')).toEqual(['keyword:if', 'name:grade', 'operator:>=', 'number:7'])
    expect(kinds('grade = int(input())')).toEqual(['name:grade', 'operator:=', 'function:int', 'function:input'])
  })

  it('marks strings, print and comments', () => {
    expect(kinds('print("Approved")  # result')).toEqual(['keyword:print', 'string:"Approved"', 'comment:# result'])
  })

  it('handles booleans, else and f-strings', () => {
    expect(kinds('if ready == True:\n    print(f"go {ready}")\nelse:\n    print("Wait")')).toEqual([
      'keyword:if', 'name:ready', 'operator:==', 'keyword:True', 'keyword:print', 'string:f"go {ready}"', 'keyword:else', 'keyword:print', 'string:"Wait"',
    ])
  })
})
