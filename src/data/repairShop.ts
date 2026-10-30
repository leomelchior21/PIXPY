import { flattenProgram, runDecisionProgram, type DecisionRun } from '../lib/decisionTracer'

export type BugKind = 'syntax' | 'runtime' | 'logic'
export type RepairMachineId = 'arcade' | 'door' | 'charger' | 'ride' | 'fan' | 'quiz' | 'lamp' | 'snack'
export type RepairSupport = 'high' | 'medium' | 'low'

export interface RepairBug {
  /** Index of the broken entry in the ticket's `lines`. */
  line: number
  kind: BugKind
  /** The value the customer types to show the problem. */
  demo: string
  /** Pieces on the workbench tray. The student rebuilds the broken line from them. */
  tokens: string[]
  /** One correct rebuild. Any rebuild that passes every test also counts. */
  answer: string[]
  /** Clue for the LOCATE step. */
  locate: string
  /** Why the rebuilt line works. */
  lesson: string
}

export interface RepairTicket {
  id: number
  machine: RepairMachineId
  title: string
  customer: string
  complaint: string
  rule: string
  variable: string
  lines: string[]
  bugs: RepairBug[]
  tests: string[]
  support: RepairSupport
}

/** What the machine does, in plain words. Students see it; they never have to name it. */
export const bugKindLabels: Record<BugKind, string> = { syntax: 'WON’T START', runtime: 'CRASHES', logic: 'WRONG ANSWER' }

export const repairTickets: RepairTicket[] = [
  {
    id: 1, machine: 'arcade', title: 'The arcade cabinet', customer: 'Nina, player one', support: 'high',
    complaint: 'I put in exactly 3 coins. A game costs 3 coins… but the screen says “Insert more coins”!',
    rule: 'A game costs 3 coins. With 3 coins or more, the game starts.',
    variable: 'coins',
    lines: ['coins = int(input())', 'if coins > 3:', '    print("Game start!")', 'else:', '    print("Insert more coins")'],
    bugs: [{
      line: 1, kind: 'logic', demo: '3',
      tokens: ['coins', '>', '3', '==', 'if', '<', ':', '4', '>='],
      answer: ['if', 'coins', '>=', '3', ':'],
      locate: 'No error message, so read the decision. Which line asks about the coins?',
      lesson: '> leaves 3 out. >= includes the price itself, so exactly 3 coins starts the game.',
    }],
    tests: ['0', '2', '3', '4', '10'],
  },
  {
    id: 2, machine: 'door', title: 'The safe door', customer: 'Theo, night guard', support: 'high',
    complaint: 'The door panel is completely dead. It does not react at all, not even to the right code, 4729.',
    rule: 'Code 4729 opens the door. Any other code shows “Wrong code”.',
    variable: 'code',
    lines: ['code = int(input())', 'if code = 4729:', '    print("Door open")', 'else:', '    print("Wrong code")'],
    bugs: [{
      line: 1, kind: 'syntax', demo: '4729',
      tokens: ['4729', '==', ':', 'code', '=', 'if', '"4729"', '!='],
      answer: ['if', 'code', '==', '4729', ':'],
      locate: 'Python tells you the line number. Read the error report.',
      lesson: 'One = stores a value. Two == compare values. An if needs a comparison.',
    }],
    tests: ['4729', '4728', '4730', '0', '1234'],
  },
  {
    id: 3, machine: 'charger', title: 'The phone dock', customer: 'Kai, always at 1%', support: 'high',
    complaint: 'My phone is almost dead and the dock says “Battery OK”! When it is full, it tells me to plug it in.',
    rule: 'At 20% or less: “Plug in the charger”. Otherwise: “Battery OK”.',
    variable: 'battery',
    lines: ['battery = int(input())', 'if battery >= 20:', '    print("Plug in the charger")', 'else:', '    print("Battery OK")'],
    bugs: [{
      line: 1, kind: 'logic', demo: '5',
      tokens: ['>=', 'battery', ':', '20', '<=', 'if', '>', '100'],
      answer: ['if', 'battery', '<=', '20', ':'],
      locate: 'No error message, so read the decision. Which line asks about the battery?',
      lesson: 'The comparison pointed the wrong way. <= 20 catches the low batteries, including 20 itself.',
    }],
    tests: ['5', '20', '21', '80', '100'],
  },
  {
    id: 4, machine: 'ride', title: 'The ride gate', customer: 'Lia, roller-coaster fan', support: 'medium',
    complaint: 'The ride gate crashed as soon as my sister typed her height.',
    rule: 'Riders must be at least 130 cm tall.',
    variable: 'height',
    lines: ['height = int(input())', 'if heigth >= 130:', '    print("Enjoy the ride!")', 'else:', '    print("Sorry, too short")'],
    bugs: [{
      line: 1, kind: 'runtime', demo: '140',
      tokens: [':', 'heigth', '130', 'if', 'Height', '>=', 'height', '<='],
      answer: ['if', 'height', '>=', '130', ':'],
      locate: 'Read the error report: Python names the line and the word it does not know. Compare it with line 1.',
      lesson: 'Python is very literal: heigth and height are two different names. A name must be spelled the same way every time.',
    }],
    tests: ['129', '130', '131', '100', '180'],
  },
  {
    id: 5, machine: 'fan', title: 'The thermo fan', customer: 'Dr. Ravi, lab chief', support: 'medium',
    complaint: 'At exactly 30 degrees the fan panel goes blank. It says nothing!',
    rule: 'Above 30 degrees: “Fan ON”. Otherwise: “Fan OFF”.',
    variable: 'temp',
    lines: ['temp = int(input())', 'if temp > 30:', '    print("Fan ON")', 'if temp < 30:', '    print("Fan OFF")'],
    bugs: [{
      line: 3, kind: 'logic', demo: '30',
      tokens: ['else', '30', 'temp', ':', '<', 'if', '==', '>'],
      answer: ['else', ':'],
      locate: 'Two separate questions. Is there a value that makes both of them FALSE?',
      lesson: 'Two separate ifs can leave a hole. else catches every value the first question rejects.',
    }],
    tests: ['10', '29', '30', '31', '40'],
  },
  {
    id: 6, machine: 'quiz', title: 'The quiz show', customer: 'Sam, game-show host', support: 'medium',
    complaint: 'It worked for me: I scored 80. Then my friend scored 20 and the whole show crashed!',
    rule: '50 points or more: “You win!”. Below 50: “Retry”.',
    variable: 'score',
    lines: ['score = int(input())', 'if score >= 50:', '    print("You win!")', 'else:', '    print(Retry)'],
    bugs: [{
      line: 4, kind: 'runtime', demo: '20',
      tokens: ['"retry"', ')', 'Retry', 'print(', '"Retry"', 'Retry!'],
      answer: ['print(', '"Retry"', ')'],
      locate: 'Read the error report: Python names the line and the word it did not know.',
      lesson: 'Text needs quotes. Without quotes, Python looks for a variable called Retry, and there is none.',
    }],
    tests: ['80', '50', '49', '20', '0'],
  },
  {
    id: 7, machine: 'lamp', title: 'The night lamp', customer: 'Bia, light sleeper', support: 'low',
    complaint: 'When the room is dark, the lamp says ON and OFF at the same time. When it is bright, it says nothing!',
    rule: 'Light below 30: “Lamp ON”. Otherwise: “Lamp OFF”. Only one message!',
    variable: 'light',
    lines: ['light = int(input())', 'if light < 30:', '    print("Lamp ON")', 'if light < 30:', '    print("Lamp OFF")'],
    bugs: [{
      line: 3, kind: 'logic', demo: '10',
      tokens: ['light', ':', 'if', '30', 'else', '<', '>', '=='],
      answer: ['else', ':'],
      locate: 'Two lines ask exactly the same question. Which one should catch every other value?',
      lesson: 'A copied line asked the same question twice. else catches every value the first question rejects, so only one message prints.',
    }],
    tests: ['0', '29', '30', '31', '90'],
  },
  {
    id: 8, machine: 'snack', title: 'The snack machine', customer: 'Joe, always hungry', support: 'low',
    complaint: 'Totally broken today. And yesterday, when it still worked, it refused my 5 coins! A snack costs 5.',
    rule: 'A snack costs 5 coins. With 5 or more: “Here is your snack”.',
    variable: 'money',
    lines: ['money = int(input())', 'if money > 5:', '    print("Here is your snack")', 'else', '    print("Need more money")'],
    bugs: [
      {
        line: 3, kind: 'syntax', demo: '5',
        tokens: ['money', ';', 'else', '<', 'otherwise', ':', '5'],
        answer: ['else', ':'],
        locate: 'Read the error report. Which line is missing something Python expects?',
        lesson: 'else always ends with a colon, and it never has its own condition.',
      },
      {
        line: 1, kind: 'logic', demo: '5',
        tokens: ['5', 'if', '==', '>', ':', '6', 'money', '>=', '<'],
        answer: ['if', 'money', '>=', '5', ':'],
        locate: 'Now it runs, but 5 coins are refused. Which line decides?',
        lesson: 'Fixing one bug can reveal the next. >= lets exactly 5 coins buy a snack.',
      },
    ],
    tests: ['0', '4', '5', '6', '10'],
  },
]

/** Glues tray pieces into one line of Python: `print(` `"Hi"` `)` becomes `print("Hi")`. */
export function joinTokens(tokens: string[]): string {
  return tokens.reduce((line, token, index) => index === 0 ? token : `${line}${/^[:)]/.test(token) || tokens[index - 1].endsWith('(') ? '' : ' '}${token}`, '')
}

function indentOf(line: string): string {
  return line.match(/^ */)?.[0] ?? ''
}

/** Program entries with rebuilt lines installed (index-aligned with `ticket.lines`). */
export function ticketSegments(ticket: RepairTicket, installed: Record<number, string[] | undefined>): string[] {
  return ticket.lines.map((line, index) => {
    const bugIndex = ticket.bugs.findIndex((bug) => bug.line === index)
    const tokens = bugIndex >= 0 ? installed[bugIndex] : undefined
    return tokens === undefined ? line : indentOf(line) + joinTokens(tokens)
  })
}

export function referenceSegments(ticket: RepairTicket): string[] {
  return ticketSegments(ticket, Object.fromEntries(ticket.bugs.map((bug, index) => [index, bug.answer])))
}

/** Flat line numbers covered by one program entry. */
export function segmentLines(segments: string[], segment: number): number[] {
  const start = segments.slice(0, segment).reduce((total, part) => total + part.split('\n').length, 0)
  return Array.from({ length: segments[segment].split('\n').length }, (_, index) => start + index)
}

export function runSegments(segments: string[], input: string): DecisionRun {
  return runDecisionProgram(flattenProgram(segments), [input])
}

export function expectedOutputs(ticket: RepairTicket, input: string): string[] {
  return runSegments(referenceSegments(ticket), input).outputs
}

/** True when a run behaves exactly like the repaired machine. */
export function behavesCorrectly(ticket: RepairTicket, run: DecisionRun, input: string): boolean {
  const expected = expectedOutputs(ticket, input)
  return run.error === null && run.outputs.length === expected.length && run.outputs.every((output, index) => output === expected[index])
}

/** True when this rebuild fixes its bug: with the bugs after it repaired, every test passes. */
export function bugFixed(ticket: RepairTicket, installed: Record<number, string[] | undefined>, bugIndex: number): boolean {
  const later = Object.fromEntries(ticket.bugs.map((bug, index) => [index, bug.answer]).slice(bugIndex + 1))
  const program = ticketSegments(ticket, { ...installed, ...later })
  return ticket.tests.every((input) => behavesCorrectly(ticket, runSegments(program, input), input))
}
