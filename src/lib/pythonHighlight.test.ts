import { highlightPythonLines, type HighlightSpan } from './pythonHighlight'

function classesFor(lines: HighlightSpan[][], text: string): string[] {
  return lines.flat().filter((span) => span.text.includes(text) && span.className).map((span) => span.className as string)
}

function classFor(lines: HighlightSpan[][], text: string): string | null {
  return classesFor(lines, text)[0] ?? null
}

describe('python highlighting', () => {
  it('uses the editor tokenizer to separate keywords, strings, numbers, comments and names', () => {
    const lines = highlightPythonLines('name = "Ada"\nscore = 10\n# a note\nprint(name)')
    expect(lines).toHaveLength(4)

    const keyword = classFor(lines, 'print')
    const string = classFor(lines, 'Ada')
    const number = classFor(lines, '10')
    const comment = classFor(lines, 'a note')
    const name = classFor(lines, 'name')

    expect(keyword).toBeTruthy()
    expect(string).toBeTruthy()
    expect(number).toBeTruthy()
    expect(comment).toBeTruthy()
    expect(name).toBeTruthy()

    const distinct = new Set([keyword, string, number, comment])
    expect(distinct.size).toBe(4)
  })

  it('keeps python keywords and control keywords distinct from plain names', () => {
    const lines = highlightPythonLines('for item in items:\n    if item > 2:\n        print(item)')
    expect(classFor(lines, 'for')).toBeTruthy()
    expect(classFor(lines, 'if')).toBeTruthy()
    expect(classFor(lines, 'for')).toBe(classFor(lines, 'if'))
    expect(classFor(lines, 'items')).not.toBe(classFor(lines, 'for'))
  })

  it('handles empty and very long code without throwing', () => {
    expect(highlightPythonLines('')).toEqual([[]])
    const long = Array.from({ length: 400 }, (_, index) => `value_${index} = ${index}`).join('\n')
    const lines = highlightPythonLines(long)
    expect(lines).toHaveLength(400)
  })
})
