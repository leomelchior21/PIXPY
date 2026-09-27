import { analyzeStopSheet, buildStopStarter, cleanStopLabel, countStopLines, formatStopNumber, STOP_COLUMN_COUNT } from './stopAnalyzer'

const workedExample = [
  'answer1 = "Aveiro"',
  'print("City: " + answer1)      # CITY = Aveiro (VALID)',
  'answer1 = "Braga"',
  'print("City: " + answer1)      # CITY updates to Braga (still 1 column)',
  'print("Name: " + answer1)      # NAME = Braga (2 columns)',
  'print(answer1)                 # tip: almost! add a label',
  'print("Missing: " + answer2)   # tip: define answer2 above',
  'score = 10',
  'print(f"Score: {score}")       # once score exists: SCORE = 10',
  'print("Score:", score)         # updates the same SCORE column',
].join('\n')

describe('analyzeStopSheet', () => {
  it('reproduces the worked example from the rule sheet', () => {
    const sheet = analyzeStopSheet(workedExample)

    expect(sheet.columns).toHaveLength(3)
    expect(sheet.columns.map((column) => column.label)).toEqual(['CITY', 'NAME', 'SCORE'])
    expect(sheet.columns[0]).toMatchObject({ value: 'Braga', chip: 'VALID', source: 'answer1' })
    expect(sheet.columns[1]).toMatchObject({ value: 'Braga', chip: 'VALID' })
    expect(sheet.columns[2]).toMatchObject({ value: '10', chip: 'VALID' })
    expect(sheet.tips.map((tip) => tip.kind)).toEqual(['unlabeled', 'undefined'])
    expect(sheet.tips[0].text).toContain('Add a label before the variable')
    expect(sheet.tips[1].text).toContain('Python does not know answer2 yet')
    expect(sheet.complete).toBe(false)
    expect(sheet.syntaxIssue).toBeNull()
  })

  it('accepts concatenation, comma and f-string forms', () => {
    const sheet = analyzeStopSheet([
      'first = "Ada"',
      'last = "Lovelace"',
      'print("First: " + first)',
      'print("Last:", last)',
      'print(f"Full: {first} {last}")',
    ].join('\n'))

    expect(sheet.columns).toEqual([
      expect.objectContaining({ label: 'FIRST', value: 'Ada', chip: 'VALID', source: 'first' }),
      expect.objectContaining({ label: 'LAST', value: 'Lovelace', chip: 'VALID', source: 'last' }),
      expect.objectContaining({ label: 'FULL', value: 'Ada Lovelace', chip: 'COMBO' }),
    ])
  })

  it('updates the same column when a label repeats and never duplicates it', () => {
    const sheet = analyzeStopSheet([
      'name = "Ada"',
      'print("Name: " + name)',
      'print(f"Name: {name}")',
      'print("Name:", name)',
    ].join('\n'))

    expect(sheet.columns).toHaveLength(1)
    expect(sheet.columns[0]).toMatchObject({ label: 'NAME', value: 'Ada', line: 2 })
  })

  it('completes the sheet with six distinct labels and caps the board at six', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((name) => [`${name} = "${name.toUpperCase()}"`, `print("${name.toUpperCase()}: " + ${name})`]).join('\n')
    const complete = analyzeStopSheet(six)
    expect(complete.columns).toHaveLength(STOP_COLUMN_COUNT)
    expect(complete.complete).toBe(true)

    const seven = `${six}\nprint("G: " + a)`
    const capped = analyzeStopSheet(seven)
    expect(capped.columns).toHaveLength(STOP_COLUMN_COUNT)
    expect(capped.columns.some((column) => column.label === 'G')).toBe(false)
  })

  it('marks simple values VALID and built or mixed values COMBO', () => {
    const sheet = analyzeStopSheet([
      'name = "Ada"',
      'full = name + " Lovelace"',
      'print("Name: " + name)',
      'print("Full: " + full)',
      'print("Count:", 3)',
      'print("Calc:", 2 + 3)',
      'print("Repeated: " + name + "!")',
    ].join('\n'))

    const byLabel = Object.fromEntries(sheet.columns.map((column) => [column.label, column]))
    expect(byLabel.NAME).toMatchObject({ value: 'Ada', chip: 'VALID' })
    expect(byLabel.FULL).toMatchObject({ value: 'Ada Lovelace', chip: 'COMBO' })
    expect(byLabel.COUNT).toMatchObject({ value: '3', chip: 'VALID' })
    expect(byLabel.CALC).toMatchObject({ value: '5', chip: 'COMBO' })
    expect(byLabel.REPEATED).toMatchObject({ value: 'Ada!', chip: 'COMBO' })
  })

  it('flags a variable printed without a label instead of adding a column', () => {
    const sheet = analyzeStopSheet('answer1 = "Ada"\nprint(answer1)')
    expect(sheet.columns).toHaveLength(0)
    expect(sheet.tips).toEqual([expect.objectContaining({ kind: 'unlabeled' })])
  })

  it('flags undefined names but keeps the intended column for string + number', () => {
    const undefinedSheet = analyzeStopSheet('print("Missing: " + answer2)')
    expect(undefinedSheet.columns).toHaveLength(0)
    expect(undefinedSheet.tips[0]).toMatchObject({ kind: 'undefined', line: 1 })

    const mixedSheet = analyzeStopSheet('age = 12\nprint("Age: " + age)')
    expect(mixedSheet.columns).toEqual([expect.objectContaining({ label: 'AGE', value: '12', chip: 'VALID' })])
    expect(mixedSheet.tips).toEqual([expect.objectContaining({ kind: 'mix', text: expect.stringContaining('str(age)') })])

    const converted = analyzeStopSheet('age = 12\nprint("Age: " + str(age))')
    expect(converted.tips).toHaveLength(0)
    expect(converted.columns[0]).toMatchObject({ value: '12', chip: 'VALID' })
  })

  it('reminds the student about string variables that never reach the sheet', () => {
    const sheet = analyzeStopSheet('answer1 = "Ada"\nanswer2 = "Grace"\nprint("First: " + answer1)')
    expect(sheet.tips).toEqual([expect.objectContaining({ kind: 'pending', text: expect.stringContaining('answer2') })])
  })

  it('accumulates with += and switches kind on reassignment', () => {
    const sheet = analyzeStopSheet([
      'greeting = "Hi"',
      'greeting += " there"',
      'print("Greeting: " + greeting)',
      'flag = "yes"',
      'flag = True',
      'print("Flag:", flag)',
      'score = 7.5',
      'score += 0.5',
      'print("Score:", score)',
    ].join('\n'))

    const byLabel = Object.fromEntries(sheet.columns.map((column) => [column.label, column]))
    expect(byLabel.GREETING).toMatchObject({ value: 'Hi there', chip: 'COMBO' })
    expect(byLabel.FLAG).toMatchObject({ value: 'True', chip: 'VALID' })
    expect(byLabel.SCORE).toMatchObject({ value: '8', chip: 'COMBO' })
    expect(sheet.tips).toHaveLength(0)
  })

  it('cleans labels with colons, equals signs, dashes and quotes while ignoring comments', () => {
    const sheet = analyzeStopSheet([
      'x = "ok"',
      '# print("Ghost: " + x)',
      'print("  Name :  " + x)',
      'print("Total = " + x)',
      'print("Class - " + x)',
      'print("Id – " + x)',
      'print("High-Score: " + x)',
      'print("Tag #1: " + x)',
    ].join('\n'))

    expect(sheet.columns.map((column) => column.label)).toEqual(['NAME', 'TOTAL', 'CLASS', 'ID', 'HIGH-SCORE', 'TAG #1'])
    expect(sheet.columns.some((column) => column.label === 'GHOST')).toBe(false)
    expect(sheet.syntaxIssue).toBeNull()

    const escaped = analyzeStopSheet('x = "ok"\nprint("Say \\"hi\\": " + x)')
    expect(escaped.columns[0]).toMatchObject({ label: 'SAY "HI"', value: 'ok' })
  })

  it('handles empty prints, decimal numbers, booleans, comments and CRLF', () => {
    const sheet = analyzeStopSheet('score = 10\r\nprint()\r\n# print("Nope: " + score)\r\nprint("Score:", score)\r\nprint("Ready:", True)\r\n')
    expect(sheet.columns).toEqual([
      expect.objectContaining({ label: 'SCORE', value: '10', chip: 'VALID' }),
      expect.objectContaining({ label: 'READY', value: 'True', chip: 'VALID' }),
    ])
  })

  it('treats multiline strings as opaque values', () => {
    const sheet = analyzeStopSheet('note = """first\nsecond"""\nprint("Note: " + note)')
    expect(sheet.syntaxIssue).toBeNull()
    expect(sheet.columns).toEqual([expect.objectContaining({ label: 'NOTE', value: 'first\nsecond' })])
  })

  it('reports a syntax issue instead of crashing on broken code', () => {
    const sheet = analyzeStopSheet('answer1 = "Ada"\nprint("Name: " + answer1')
    expect(sheet.syntaxIssue).toEqual(expect.objectContaining({ line: 2 }))
    expect(sheet.columns).toHaveLength(0)

    const quote = analyzeStopSheet('answer1 = "Ada"\nprint("Name: " + "unfinished)')
    expect(quote.syntaxIssue).toEqual(expect.objectContaining({ line: 2, message: expect.stringContaining('quote') }))
  })

  it('never throws on hostile or oversized code', () => {
    expect(() => analyzeStopSheet('@@@ ((( ??? "unclosed\n}}}')).not.toThrow()
    expect(analyzeStopSheet('x = ' + '"a"' + ' + '.repeat(6000) + '"b"')).toBeTruthy()
    expect(analyzeStopSheet('print(' + ')'.repeat(3))).toBeTruthy()
  })
})

describe('stop sheet helpers', () => {
  it('cleans labels the classroom way', () => {
    expect(cleanStopLabel('  Name :  ')).toBe('NAME')
    expect(cleanStopLabel('Total =')).toBe('TOTAL')
    expect(cleanStopLabel('Class -')).toBe('CLASS')
    expect(cleanStopLabel('Id –')).toBe('ID')
    expect(cleanStopLabel('High-Score:')).toBe('HIGH-SCORE')
    expect(cleanStopLabel('a:b')).toBe('A:B')
    expect(cleanStopLabel(':')).toBe('')
  })

  it('formats numbers cleanly', () => {
    expect(formatStopNumber(7.5)).toBe('7.5')
    expect(formatStopNumber(8)).toBe('8')
    expect(formatStopNumber(0.30000000000000004)).toBe('0.3')
  })

  it('seeds the starter with the student name, ten blank lines and no injection', () => {
    const starter = buildStopStarter('Leo')
    expect(starter).toContain('answer1 = "Leo"')
    expect(starter).toContain('print("Name: " + answer1)')
    expect(starter.split('\n').slice(-10)).toEqual(Array.from({ length: 10 }, () => ''))

    const injected = buildStopStarter('Ada"\nprint("hacked")')
    expect(injected.split('\n').length).toBeGreaterThanOrEqual(16)
    expect(injected).not.toContain('print("hacked")')
    expect(countStopLines('a\nb')).toBe(2)
  })
})
