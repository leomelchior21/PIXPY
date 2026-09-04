import type { PrintActivityId, ScriptRunResult } from '../types'

export interface PrintActivity {
  id: PrintActivityId
  title: string
  prompt: string
  starterCode: string
  hints: [string, string, string]
  extra: boolean
  validate: (result: ScriptRunResult, code: string, playerName: string) => boolean
}

const normalizedOutput = (stdout: string) => stdout.replace(/\r\n?/g, '\n')

function maskStringsAndComments(code: string): string {
  let masked = ''
  let quote = ''
  let triple = false
  let escaped = false

  for (let index = 0; index < code.length; index += 1) {
    const character = code[index]
    const nextThree = code.slice(index, index + 3)

    if (quote) {
      if (triple && nextThree === quote.repeat(3)) {
        masked += '   '
        index += 2
        quote = ''
        triple = false
      } else if (!triple && !escaped && character === quote) {
        masked += ' '
        quote = ''
      } else {
        masked += character === '\n' ? '\n' : ' '
        escaped = !escaped && character === '\\'
        if (character !== '\\') escaped = false
      }
      continue
    }

    if (character === '#') {
      const newline = code.indexOf('\n', index)
      if (newline === -1) return masked + ' '.repeat(code.length - index)
      masked += ' '.repeat(newline - index)
      index = newline - 1
      continue
    }

    if (character === '"' || character === "'") {
      triple = nextThree === character.repeat(3)
      quote = character
      escaped = false
      masked += triple ? '   ' : ' '
      if (triple) index += 2
      continue
    }

    masked += character
  }

  return masked
}

export function countPrintCalls(code: string): number {
  return maskStringsAndComments(code).match(/\bprint\s*\(/g)?.length ?? 0
}

export function hasEmptyPrintCall(code: string): boolean {
  return /\bprint\s*\(\s*\)/.test(maskStringsAndComments(code))
}

function isFrame(stdout: string): boolean {
  const lines = normalizedOutput(stdout).split('\n')
  if (lines.length < 3 || lines[0].length < 3) return false
  if (lines.some((line) => line.length !== lines[0].length || !/^[# ]+$/.test(line))) return false
  if (!/^#+$/.test(lines[0]) || lines.at(-1) !== lines[0]) return false
  return lines.slice(1, -1).every((line) => line.startsWith('#') && line.endsWith('#'))
}

function containsPlayerName(line: string | undefined, playerName: string): boolean {
  if (!line || !playerName) return false
  const escapedName = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapedName}([^\\p{L}\\p{N}]|$)`, 'iu').test(line)
}

export const printActivities: PrintActivity[] = [
  {
    id: 'morning-chat',
    title: 'Bom dia, chat!',
    prompt: 'Change the print() line so the output is exactly: Bom dia, chat!',
    starterCode: 'print("Hello, chat!")',
    hints: ['Only change the words between the quote marks.', 'Capital letters and punctuation must match the target.', 'Use: print("Bom dia, chat!")'],
    extra: false,
    validate: ({ stdout }, code) => normalizedOutput(stdout) === 'Bom dia, chat!' && countPrintCalls(code) === 1,
  },
  {
    id: 'introduce-yourself',
    title: 'Introduce yourself',
    prompt: 'Keep the greeting and add a second print() call containing your player name.',
    starterCode: 'print("HELLO!")\n# Add a second print() with your name.',
    hints: ['Leave the first line in place and work below it.', 'Your program needs exactly two print() calls.', 'Try: print("My name is YOUR NAME")'],
    extra: false,
    validate: ({ stdout }, code, playerName) => {
      const lines = normalizedOutput(stdout).split('\n')
      return countPrintCalls(code) === 2 && lines.length === 2 && lines[0] === 'HELLO!' && containsPlayerName(lines[1], playerName)
    },
  },
  {
    id: 'blank-line',
    title: 'Leave a blank line',
    prompt: 'Print TOP and BOTTOM with exactly one empty line between them. Use print() with no argument.',
    starterCode: 'print("TOP")\nprint("BOTTOM")',
    hints: ['An empty print sends only a new line.', 'Put print() between the TOP and BOTTOM lines.', 'Use three calls: print("TOP"), print(), then print("BOTTOM").'],
    extra: false,
    validate: ({ stdout }, code) => normalizedOutput(stdout) === 'TOP\n\nBOTTOM' && countPrintCalls(code) === 3 && hasEmptyPrintCall(code),
  },
  {
    id: 'draw-frame',
    title: 'Draw a frame',
    prompt: 'Use at least three print() calls to create a closed frame made from # characters.',
    starterCode: 'print("#####")\nprint("#   #")\n# Add the bottom edge.',
    hints: ['The first and last rows need to match.', 'Every middle row must start and end with #.', 'Add: print("#####")'],
    extra: false,
    validate: ({ stdout }, code) => countPrintCalls(code) >= 3 && isFrame(stdout),
  },
  {
    id: 'initials-banner',
    title: 'Initials banner',
    prompt: 'Create exactly five visible output lines using letters or numbers.',
    starterCode: 'print("P")\nprint("I")\nprint("X")\nprint("P")\n# Add one more visible line.',
    hints: ['The terminal should show five non-empty rows.', 'Use only letters, numbers, and spaces in the output.', 'Add one more print() line containing a letter or number.'],
    extra: false,
    validate: ({ stdout }) => {
      const lines = normalizedOutput(stdout).split('\n')
      return lines.length === 5 && lines.every((line) => /^(?=.*[A-Za-z0-9])[A-Za-z0-9 ]+$/.test(line))
    },
  },
  {
    id: 'player-id-card',
    title: 'Player ID card',
    prompt: 'Print a four-line ID card with matching borders, your player name, and PIXPY.',
    starterCode: 'print("##########")\nprint("PLAYER: YOUR NAME")\nprint("PIXPY")\n# Add a matching bottom border.',
    hints: ['Your first and fourth output lines must be identical.', 'Replace YOUR NAME with the name shown in the page header.', 'Finish with: print("##########")'],
    extra: true,
    validate: ({ stdout }, code, playerName) => {
      const lines = normalizedOutput(stdout).split('\n')
      return countPrintCalls(code) === 4 && lines.length === 4 && lines[0].length >= 3 && /^[#=+*\-|]+$/.test(lines[0]) && lines[3] === lines[0] && containsPlayerName(lines[1], playerName) && lines[2] === 'PIXPY'
    },
  },
  {
    id: 'crack-code',
    title: 'Crack the code',
    prompt: 'Store 6 * 7 in access_code, then print ACCESS CODE and 42 on separate lines.',
    starterCode: 'access_code = 6 + 7\nprint("ACCESS CODE")\nprint(access_code)',
    hints: ['The variable name must stay access_code.', 'Use the multiplication operator * between 6 and 7.', 'Write: access_code = 6 * 7'],
    extra: true,
    validate: ({ stdout, variables }, code) => {
      const executableCode = maskStringsAndComments(code)
      return normalizedOutput(stdout) === 'ACCESS CODE\n42' && variables.access_code === 42 && /^\s*access_code\s*=\s*6\s*\*\s*7\s*(?:;|\r?$)/m.test(executableCode) && countPrintCalls(code) === 2
    },
  },
  {
    id: 'launch-countdown',
    title: 'Launch countdown',
    prompt: 'Print 3, 2, 1, and LIFTOFF! on separate lines in that exact order.',
    starterCode: 'print(3)\nprint(2)\nprint(1)\n# Add the launch message.',
    hints: ['You already have the countdown numbers.', 'Add one final print() call after print(1).', 'Use: print("LIFTOFF!")'],
    extra: true,
    validate: ({ stdout }, code) => normalizedOutput(stdout) === '3\n2\n1\nLIFTOFF!' && countPrintCalls(code) === 4,
  },
]

export const corePrintActivities = printActivities.filter((activity) => !activity.extra)

export function getPrintActivity(id: PrintActivityId): PrintActivity {
  return printActivities.find((activity) => activity.id === id) ?? printActivities[0]
}
