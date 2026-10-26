import { describe, expect, it } from 'vitest'
import { formatPythonError, runDecisionProgram } from './decisionTracer'

const run = (source: string, inputs: string[] = []) => runDecisionProgram(source.split('\n'), inputs)

describe('decision tracer', () => {
  it('runs if/else and records the path', () => {
    const result = run('age = int(input())\nif age >= 18:\n    print("Adult")\nelse:\n    print("Minor")', ['17'])
    expect(result.error).toBeNull()
    expect(result.outputs).toEqual(['Minor'])
    expect(result.events.map((event) => [event.kind, event.line, event.truth])).toEqual([
      ['assign', 0, undefined], ['test', 1, false], ['else', 3, undefined], ['print', 4, undefined],
    ])
    expect(result.events[1].text).toBe('17 >= 18')
  })

  it('follows if/else nested inside else and checks every separate if', () => {
    const nested = 't = int(input())\nif t <= 0:\n    print("Ice")\nelse:\n    if t < 100:\n        print("Water")\n    else:\n        print("Steam")'
    expect(run(nested, ['-5']).outputs).toEqual(['Ice'])
    expect(run(nested, ['50']).outputs).toEqual(['Water'])
    expect(run(nested, ['100']).outputs).toEqual(['Steam'])
    const separate = 't = int(input())\nif t <= 0:\n    print("Ice")\nif t < 100:\n    print("Water")'
    expect(run(separate, ['-5']).outputs).toEqual(['Ice', 'Water'])
  })

  it('uses Python remainder, float printing, and string comparisons', () => {
    expect(run('n = int(input())\nprint(n % 2)', ['-3']).outputs).toEqual(['1'])
    expect(run('g = float(input())\nprint(g)', ['7']).outputs).toEqual(['7.0'])
    expect(run('p = input()\nif p == "dragon":\n    print("yes")\nelse:\n    print("no")', ['Dragon']).outputs).toEqual(['no'])
  })

  it('reports syntax errors with CPython wording before anything runs', () => {
    const cases: Array<[string, string, string, number]> = [
      ['code = 1\nif code = 4729:\n    print("a")', 'SyntaxError', "invalid syntax. Maybe you meant '==' or ':=' instead of '='?", 1],
      ['code = 1\nif code => 4729:\n    print("a")', 'SyntaxError', 'invalid syntax', 1],
      ['code = 1\nif code === 4729:\n    print("a")', 'SyntaxError', 'invalid syntax', 1],
      ['b = 1\nif b <= 20:\nprint("Plug")\nelse:\n    print("OK")', 'IndentationError', "expected an indented block after 'if' statement on line 2", 2],
      ['m = 1\nif m > 5:\n    print("a")\nelse\n    print("b")', 'SyntaxError', "expected ':'", 3],
      ['m = 1\nif m > 5\n    print("a")', 'SyntaxError', "expected ':'", 1],
      ['l = 1\nif l < 30:\n    print("ON")\nelse print("OFF")', 'SyntaxError', "expected ':'", 3],
      ['s = 1\nprint(Retry!)', 'SyntaxError', 'invalid syntax', 1],
      ['s = 1\nprint(\'Retry")', 'SyntaxError', 'unterminated string literal (detected at line 2)', 1],
      ['int(h) = input()', 'SyntaxError', "cannot assign to function call here. Maybe you meant '==' instead of '='?", 0],
      ['x = 1\n    print("a")', 'IndentationError', 'unexpected indent', 1],
      ['print(Try again)', 'SyntaxError', 'invalid syntax. Perhaps you forgot a comma?', 0],
      ['m = 1\nif m > 5:\n    print("a")\notherwise:\n    print("b")', 'SyntaxError', 'invalid syntax', 3],
    ]
    for (const [source, type, message, line] of cases) {
      const result = run(source, ['5'])
      expect(result.error, source).toEqual({ type, message, line, phase: 'syntax' })
      expect(result.events).toEqual([])
    }
  })

  it('reports runtime errors only when the line runs', () => {
    const typed = run('h = input()\nif h >= 130:\n    print("a")', ['120'])
    expect(typed.error).toEqual({ type: 'TypeError', message: "'>=' not supported between instances of 'str' and 'int'", line: 1, phase: 'runtime' })
    const hidden = 's = int(input())\nif s >= 50:\n    print("You win!")\nelse:\n    print(Retry)'
    expect(run(hidden, ['80'])).toMatchObject({ error: null, outputs: ['You win!'] })
    expect(run(hidden, ['20']).error).toEqual({ type: 'NameError', message: "name 'Retry' is not defined", line: 4, phase: 'runtime' })
    expect(run('x = int(input())', ['abc']).error?.message).toBe("invalid literal for int() with base 10: 'abc'")
    expect(formatPythonError(run(hidden, ['20']).error!)).toBe('File "machine.py", line 5\nNameError: name \'Retry\' is not defined')
  })
})
