import type { PrintActivityId, ScriptRunResult } from '../types'
import { isMorningGreetingOutput } from '../lib/printMatching'

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

function isFiveLineHeart(stdout: string): boolean {
  const lines = normalizedOutput(stdout).split('\n')
  if (lines.length !== 5 || lines.some((line) => !/^[# ]+$/.test(line))) return false

  const visibleRows = lines.map((line) => line.trim())
  const hashCounts = visibleRows.map((line) => line.replaceAll(' ', '').length)
  return /^#+ +#+$/.test(visibleRows[0])
    && /^#+$/.test(visibleRows[1])
    && visibleRows.slice(2).every((line) => /^#+$/.test(line))
    && hashCounts[1] > hashCounts[0]
    && hashCounts[1] > hashCounts[2]
    && hashCounts[2] > hashCounts[3]
    && hashCounts[3] > hashCounts[4]
    && hashCounts[4] === 1
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = Array.from({ length: right.length + 1 }, () => 0)

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost,
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

function isLiftoffPhrase(line: string | undefined): boolean {
  const phrase = (line ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll('0', 'o')
    .replace(/[^a-z]/g, '')

  return phrase.length >= 5 && phrase.length <= 9 && phrase.startsWith('l') && editDistance(phrase, 'liftoff') <= 2
}

function isLaunchCountdown(stdout: string): boolean {
  const lines = normalizedOutput(stdout).split('\n').map((line) => line.trim()).filter(Boolean)
  return lines.length === 4 && lines[0] === '3' && lines[1] === '2' && lines[2] === '1' && isLiftoffPhrase(lines[3])
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
    prompt: 'Change the print() line so the output is Bom dia, chat! Close punctuation, capitalization, and spelling variants can pass.',
    starterCode: '#Change the message to "Bom dia, chat!"\nprint("Hello!")',
    hints: ['Only change the words between the quote marks.', 'Capital letters and punctuation can be a little flexible.', 'Use: print("Bom dia, chat!")'],
    extra: false,
    validate: ({ stdout }, code) => isMorningGreetingOutput(stdout) && countPrintCalls(code) === 1,
  },
  {
    id: 'introduce-yourself',
    title: 'Introduce yourself',
    prompt: 'Keep the greeting and add a second print() call containing your player name.',
    starterCode: '# Add a second print with your name.\nprint("HELLO!")',
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
    starterCode: '# Add one blank line with print().\nprint("TOP")\nprint("BOTTOM")',
    hints: ['An empty print sends only a new line.', 'Put print() between the TOP and BOTTOM lines.', 'Use three calls: print("TOP"), print(), then print("BOTTOM").'],
    extra: false,
    validate: ({ stdout }, code) => normalizedOutput(stdout) === 'TOP\n\nBOTTOM' && countPrintCalls(code) === 3 && hasEmptyPrintCall(code),
  },
  {
    id: 'draw-frame',
    title: 'Draw a frame',
    prompt: 'Use at least three print() calls to create a closed frame made from # characters.',
    starterCode: '# Add the matching bottom edge.\nprint("#####")\nprint("#   #")',
    hints: ['The first and last rows need to match.', 'Every middle row must start and end with #.', 'Add: print("#####")'],
    extra: false,
    validate: ({ stdout }, code) => countPrintCalls(code) >= 3 && isFrame(stdout),
  },
  {
    id: 'initials-banner',
    title: 'Stack a heart',
    prompt: 'Use exactly five print() calls and # characters to draw a five-line heart.',
    starterCode: '# Use 5 print lines of # stacked to draw a heart.\nprint("#######")',
    hints: ['Start with two groups of # for the heart\'s rounded top.', 'Make the second row widest, then make each row narrower until one # forms the point.', 'Try these rows: "## ##", "#######", "#####", "###", and "#".'],
    extra: false,
    validate: ({ stdout }, code) => countPrintCalls(code) === 5 && isFiveLineHeart(stdout),
  },
  {
    id: 'player-id-card',
    title: 'Player ID card',
    prompt: 'Create your own ID card with your name, age, favourite food, and favourite game or music.',
    starterCode: '# Create your ID card with name, age, favourite food, and favourite game or music.\nprint("=============================")\nprint("PLAYER: YOUR NAME")\nprint("=============================")',
    hints: ['Keep identical borders as the first and last output lines.', 'Replace YOUR NAME, then add AGE and FAVOURITE FOOD lines before the bottom border.', 'Add either FAVOURITE GAME or FAVOURITE MUSIC so the finished card has six lines.'],
    extra: true,
    validate: ({ stdout }, code, playerName) => {
      const lines = normalizedOutput(stdout).split('\n')
      const fieldValue = (line: string | undefined, label: RegExp) => Boolean(line && label.test(line) && line.split(':').slice(1).join(':').trim())
      return countPrintCalls(code) === 6
        && lines.length === 6
        && lines[0].length >= 3
        && /^[#=+*\-|]+$/.test(lines[0])
        && lines[5] === lines[0]
        && /^PLAYER\s*:/i.test(lines[1])
        && containsPlayerName(lines[1], playerName)
        && /^AGE\s*:\s*\d{1,3}\s*$/i.test(lines[2])
        && fieldValue(lines[3], /^FAVOU?RITE FOOD\s*:/i)
        && fieldValue(lines[4], /^FAVOU?RITE (?:GAME|MUSIC)\s*:/i)
    },
  },
  {
    id: 'launch-countdown',
    title: 'Launch countdown',
    prompt: 'Print 3, 2, 1, and any version of LIFTOFF on separate lines.',
    starterCode: '# Print LIFTOFF! after the countdown.\nprint(3)\nprint(2)\nprint(1)',
    hints: ['You already have the countdown numbers.', 'Add one final print() call after print(1).', 'LIFTOFF, lift off, or even a tiny spelling mistake can still launch.'],
    extra: true,
    validate: ({ stdout }, code) => isLaunchCountdown(stdout) && countPrintCalls(code) >= 4,
  },
  {
    id: 'crack-code',
    title: 'Crack the code',
    prompt: 'Store 6 * 7 in access_code and adjust the print so it shows the correct result.',
    starterCode: '#Store 6 * 7 in access_code and adjust it to print correctly.\naccess_code = 6 + 7\n\nprint("ACCESS CODE")',
    hints: ['The variable name must stay access_code.', 'Use the multiplication operator * between 6 and 7.', 'Print the variable name without quote marks.'],
    extra: true,
    validate: ({ stdout, variables }, code) => {
      const executableCode = maskStringsAndComments(code)
      return normalizedOutput(stdout) === '42' && variables.access_code === 42 && /^\s*access_code\s*=\s*6\s*\*\s*7\s*(?:;|\r?$)/m.test(executableCode) && countPrintCalls(code) === 1
    },
  },
]

export const corePrintActivities = printActivities.filter((activity) => !activity.extra)

export function getPrintActivity(id: PrintActivityId): PrintActivity {
  return printActivities.find((activity) => activity.id === id) ?? printActivities[0]
}
