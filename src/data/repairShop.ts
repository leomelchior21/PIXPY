import { flattenProgram, runDecisionProgram, type DecisionRun } from '../lib/decisionTracer'

export type BugKind = 'syntax' | 'runtime' | 'logic'
export type RepairMachineId = 'arcade' | 'door' | 'charger' | 'ride' | 'fan' | 'quiz' | 'lamp' | 'snack'
export type RepairSupport = 'high' | 'medium' | 'low'

export interface RepairBug {
  /** Index of the broken entry in the ticket's `lines`. */
  line: number
  kind: BugKind
  /** Replacement parts. A part may span several lines. */
  parts: string[]
  answer: number
  /** Clue for the LOCATE step. */
  locate: string
  /** Shown when a student taps the line where Python crashed, if that is not the bug. */
  crashLine?: string
  /** Why the correct part works. */
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
  tryValues: string[]
  suggested?: string
  lines: string[]
  bugs: RepairBug[]
  tests: string[]
  support: RepairSupport
}

export const bugKindLabels: Record<BugKind, string> = { syntax: 'SYNTAX ERROR', runtime: 'RUNTIME ERROR', logic: 'LOGIC ERROR' }

export const bugKindMeaning: Record<BugKind, string> = {
  syntax: 'Python refused to start. It reads the whole program first, and one line breaks the rules.',
  runtime: 'Python started running, then crashed on a line that could not work with these values.',
  logic: 'Python ran to the end without complaining, but the answer is wrong.',
}

export const repairTickets: RepairTicket[] = [
  {
    id: 1, machine: 'arcade', title: 'The arcade cabinet', customer: 'Nina, player one', support: 'high',
    complaint: 'I put in exactly 3 coins. A game costs 3 coins… but the screen says “Insert more coins”!',
    rule: 'A game costs 3 coins. With 3 coins or more, the game starts.',
    variable: 'coins', tryValues: ['1', '3', '5', '8'], suggested: '3',
    lines: ['coins = int(input())', 'if coins > 3:', '    print("Game start!")', 'else:', '    print("Insert more coins")'],
    bugs: [{
      line: 1, kind: 'logic', answer: 0,
      parts: ['if coins >= 3:', 'if coins == 3:', 'if coins < 3:', 'if coins >= 4:'],
      locate: 'No error message, so read the decision. Which line asks about the coins?',
      lesson: '> leaves 3 out. >= includes the price itself, so exactly 3 coins starts the game.',
    }],
    tests: ['0', '2', '3', '4', '10'],
  },
  {
    id: 2, machine: 'door', title: 'The safe door', customer: 'Theo, night guard', support: 'high',
    complaint: 'The door panel is completely dead. It does not react at all, not even to the right code, 4729.',
    rule: 'Code 4729 opens the door. Any other code shows “Wrong code”.',
    variable: 'code', tryValues: ['4729', '1234', '0'], suggested: '4729',
    lines: ['code = int(input())', 'if code = 4729:', '    print("Door open")', 'else:', '    print("Wrong code")'],
    bugs: [{
      line: 1, kind: 'syntax', answer: 0,
      parts: ['if code == 4729:', 'if code => 4729:', 'if code === 4729:', 'if code = "4729":'],
      locate: 'Python tells you the line number. Read the error report.',
      lesson: 'One = stores a value. Two == compare values. An if needs a comparison.',
    }],
    tests: ['4729', '4728', '4730', '0', '1234'],
  },
  {
    id: 3, machine: 'charger', title: 'The phone dock', customer: 'Kai, always at 1%', support: 'high',
    complaint: 'My phone dock shows nothing at all. No message, whatever the battery.',
    rule: 'At 20% or less: “Plug in the charger”. Otherwise: “Battery OK”.',
    variable: 'battery', tryValues: ['5', '20', '50', '100'], suggested: '5',
    lines: ['battery = int(input())', 'if battery <= 20:', 'print("Plug in the charger")', 'else:', '    print("Battery OK")'],
    bugs: [{
      line: 2, kind: 'syntax', answer: 0,
      parts: ['    print("Plug in the charger")', 'print("Plug in the charger"):', '    print(Plug in the charger)', 'if print("Plug in the charger"):'],
      locate: 'An IndentationError is about spaces. Which line should sit inside the if?',
      lesson: 'Lines that belong to an if are indented with 4 spaces. That is how Python knows they are inside.',
    }],
    tests: ['5', '20', '21', '80', '100'],
  },
  {
    id: 4, machine: 'ride', title: 'The ride gate', customer: 'Lia, roller-coaster fan', support: 'medium',
    complaint: 'The ride gate crashed as soon as my sister typed her height.',
    rule: 'Riders must be at least 130 cm tall.',
    variable: 'height', tryValues: ['120', '130', '150'],
    lines: ['height = input()', 'if height >= 130:', '    print("Enjoy the ride!")', 'else:', '    print("Sorry, too short")'],
    bugs: [{
      line: 0, kind: 'runtime', answer: 0,
      parts: ['height = int(input())', 'height = str(input())', 'int(height) = input()', 'height = "130"'],
      locate: 'Python crashed while comparing text with a number. Where does height get its value?',
      crashLine: 'Python crashed here, but this comparison is fine. Why is height text? Look where height gets its value.',
      lesson: 'input() always gives text. int(input()) turns the text into a whole number Python can compare.',
    }],
    tests: ['129', '130', '131', '100', '180'],
  },
  {
    id: 5, machine: 'fan', title: 'The thermo fan', customer: 'Dr. Ravi, lab chief', support: 'medium',
    complaint: 'At exactly 30 degrees the fan panel goes blank. It says nothing!',
    rule: 'Above 30 degrees: “Fan ON”. Otherwise: “Fan OFF”.',
    variable: 'temp', tryValues: ['20', '30', '35'],
    lines: ['temp = int(input())', 'if temp > 30:', '    print("Fan ON")', 'if temp < 30:', '    print("Fan OFF")'],
    bugs: [{
      line: 3, kind: 'logic', answer: 0,
      parts: ['else:', 'if temp >= 30:', 'if temp == 30:', 'if temp > 30:'],
      locate: 'Two separate questions. Is there a value that makes both of them FALSE?',
      lesson: 'Two separate ifs can leave a hole. else catches every value the first question rejects.',
    }],
    tests: ['10', '29', '30', '31', '40'],
  },
  {
    id: 6, machine: 'quiz', title: 'The quiz show', customer: 'Sam, game-show host', support: 'medium',
    complaint: 'It worked for me: I scored 80. Then my friend scored 20 and the whole show crashed!',
    rule: '50 points or more: “You win!”. Below 50: “Retry”.',
    variable: 'score', tryValues: ['80', '50', '20'],
    lines: ['score = int(input())', 'if score >= 50:', '    print("You win!")', 'else:', '    print(Retry)'],
    bugs: [{
      line: 4, kind: 'runtime', answer: 0,
      parts: ['    print("Retry")', '    print(Retry!)', '    print(\'Retry")', '    print(retry)'],
      locate: 'Read the error report: Python names the line and the word it did not know.',
      lesson: 'Text needs quotes. Without quotes, Python looks for a variable called Retry, and there is none.',
    }],
    tests: ['80', '50', '49', '20', '0'],
  },
  {
    id: 7, machine: 'lamp', title: 'The night lamp', customer: 'Bia, light sleeper', support: 'low',
    complaint: 'When the room gets dark, the lamp says ON and OFF at the same time.',
    rule: 'Light below 30: “Lamp ON”. Otherwise: “Lamp OFF”. Only one message!',
    variable: 'light', tryValues: ['10', '30', '80'],
    lines: ['light = int(input())', 'if light < 30:', '    print("Lamp ON")', 'print("Lamp OFF")'],
    bugs: [{
      line: 3, kind: 'logic', answer: 0,
      parts: ['else:\n    print("Lamp OFF")', '    print("Lamp OFF")', 'if light > 30:\n    print("Lamp OFF")', 'else print("Lamp OFF")'],
      locate: 'One line runs no matter what. Which line is not inside any if?',
      lesson: 'An unindented line always runs. Put it under else: so it only runs when the condition is FALSE.',
    }],
    tests: ['0', '29', '30', '31', '90'],
  },
  {
    id: 8, machine: 'snack', title: 'The snack machine', customer: 'Joe, always hungry', support: 'low',
    complaint: 'Totally broken today. And yesterday, when it still worked, it refused my 5 coins! A snack costs 5.',
    rule: 'A snack costs 5 coins. With 5 or more: “Here is your snack”.',
    variable: 'money', tryValues: ['3', '5', '9'],
    lines: ['money = int(input())', 'if money > 5:', '    print("Here is your snack")', 'else', '    print("Need more money")'],
    bugs: [
      {
        line: 3, kind: 'syntax', answer: 0,
        parts: ['else:', 'else;', 'else money < 5:', 'otherwise:'],
        locate: 'Read the error report. Which line is missing something Python expects?',
        lesson: 'else always ends with a colon, and it never has its own condition.',
      },
      {
        line: 1, kind: 'logic', answer: 0,
        parts: ['if money >= 5:', 'if money == 5:', 'if money < 5:', 'if money >= 6:'],
        locate: 'Now it runs, but 5 coins are refused. Which line decides?',
        lesson: 'Fixing one bug can reveal the next. >= lets exactly 5 coins buy a snack.',
      },
    ],
    tests: ['0', '4', '5', '6', '10'],
  },
]

/** Program entries with fixed parts installed (index-aligned with `ticket.lines`). */
export function ticketSegments(ticket: RepairTicket, installed: Record<number, number | undefined>): string[] {
  return ticket.lines.map((line, index) => {
    const bugIndex = ticket.bugs.findIndex((bug) => bug.line === index)
    const part = bugIndex >= 0 ? installed[bugIndex] : undefined
    return part === undefined ? line : ticket.bugs[bugIndex].parts[part]
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

export function symptomKind(run: DecisionRun): BugKind {
  return run.error ? run.error.phase === 'syntax' ? 'syntax' : 'runtime' : 'logic'
}
