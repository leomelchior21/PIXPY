import { runDecisionProgram, type DecisionRun } from '../lib/decisionTracer'

export type ChainShape = 'separate' | 'nested'
export type MoreChoiceMode = 'overlap' | 'gap' | 'visitAll' | 'predict' | 'order' | 'build' | 'convert' | 'solo'
export type MoreChoiceScene = 'water' | 'battery' | 'medal' | 'ticket' | 'clothes' | 'speed'

export interface ChoiceRule { condition: string; message: string }

/**
 * separate: one independent `if` per rule.
 * nested: `if A / else: if B / else: …` with `elseMessage` at the bottom.
 */
export interface DecisionChain { shape: ChainShape; rules: ChoiceRule[]; elseMessage?: string }

export interface ChoiceMessage { text: string; color: string }

export interface MoreChoiceLevel {
  id: number
  mode: MoreChoiceMode
  title: string
  skill: string
  scene: MoreChoiceScene
  story: string
  instruction: string
  variable: string
  unit: string
  min: number
  max: number
  start: number
  messages: ChoiceMessage[]
  chain: DecisionChain
  target?: DecisionChain
  /** The broken program a convert level starts from. */
  before?: DecisionChain
  tiles?: string[]
  rounds?: number[][]
  hint: string
  lesson: string
}

const water: ChoiceMessage[] = [{ text: 'Ice', color: '#9fe6ff' }, { text: 'Water', color: '#4f8dff' }, { text: 'Steam', color: '#ff9b7a' }]
const medals: ChoiceMessage[] = [{ text: 'Gold', color: '#ffcb47' }, { text: 'Silver', color: '#c4cfdf' }, { text: 'Bronze', color: '#d98b5a' }]

export const moreChoiceLevels: MoreChoiceLevel[] = [
  {
    id: 1, mode: 'overlap', title: 'Two at once?', skill: 'Separate ifs', scene: 'water',
    story: 'The water lab names the state of water for any temperature. It asks three separate if questions.',
    instruction: 'Find a temperature that makes the machine say TWO things at once.',
    variable: 'temp', unit: '°C', min: -20, max: 120, start: 20, messages: water,
    chain: { shape: 'separate', rules: [{ condition: 'temp <= 0', message: 'Ice' }, { condition: 'temp < 100', message: 'Water' }, { condition: 'temp >= 100', message: 'Steam' }] },
    hint: 'Try a temperature below zero. Which questions answer TRUE?',
    lesson: 'Separate ifs are separate questions. Python asks every one of them, so more than one can be TRUE.',
  },
  {
    id: 2, mode: 'gap', title: 'The silent phone', skill: 'Gaps between ifs', scene: 'battery',
    story: 'A phone warns you about its battery with two separate if questions.',
    instruction: 'Find a battery level where the phone says NOTHING at all.',
    variable: 'battery', unit: '%', min: 0, max: 100, start: 60,
    messages: [{ text: 'Charge now', color: '#ff6f94' }, { text: 'Battery OK', color: '#b9f352' }],
    chain: { shape: 'separate', rules: [{ condition: 'battery < 20', message: 'Charge now' }, { condition: 'battery > 20', message: 'Battery OK' }] },
    hint: 'One question asks < 20, the other asks > 20. What about exactly 20?',
    lesson: 'With separate ifs, a value can slip between the questions. Nobody catches it, so nothing prints.',
  },
  {
    id: 3, mode: 'visitAll', title: 'One path only', skill: 'if/else inside else', scene: 'water',
    story: 'The same water lab, rebuilt. The second question now lives inside else.',
    instruction: 'Drop temperatures until the ball has landed in all three bins.',
    variable: 'temp', unit: '°C', min: -20, max: 120, start: 20, messages: water,
    chain: { shape: 'nested', rules: [{ condition: 'temp <= 0', message: 'Ice' }, { condition: 'temp < 100', message: 'Water' }], elseMessage: 'Steam' },
    hint: 'Ice needs 0 or less. Steam needs 100 or more. Water lives in between.',
    lesson: 'The inner if is asked only when the first answer is FALSE. Every temperature gets exactly one message.',
  },
  {
    id: 4, mode: 'predict', title: 'Predict the drop', skill: 'Trace nested decisions', scene: 'medal',
    story: 'A game hands out medals. 100 points or more is Gold. 50 or more is Silver. Anything else is Bronze.',
    instruction: 'Predict the bin before every drop. Get four predictions right.',
    variable: 'points', unit: 'pts', min: 0, max: 150, start: 50, messages: medals,
    chain: { shape: 'nested', rules: [{ condition: 'points >= 100', message: 'Gold' }, { condition: 'points >= 50', message: 'Silver' }], elseMessage: 'Bronze' },
    rounds: [[50, 75, 60], [100, 130, 112], [49, 20, 35], [99, 51, 80]],
    hint: 'Read the questions from top to bottom. The first TRUE answer wins.',
    lesson: 'Python stops at the first TRUE answer. The questions below it are never asked.',
  },
  {
    id: 5, mode: 'order', title: 'The lost gold', skill: 'Order matters', scene: 'medal',
    story: 'Someone rebuilt the medal machine. Now nobody ever wins Gold, not even with 150 points.',
    instruction: 'Swap the two questions so Gold can be reached. Then drop a score that wins Gold.',
    variable: 'points', unit: 'pts', min: 0, max: 150, start: 120, messages: medals,
    chain: { shape: 'nested', rules: [{ condition: 'points >= 50', message: 'Silver' }, { condition: 'points >= 100', message: 'Gold' }], elseMessage: 'Bronze' },
    target: { shape: 'nested', rules: [{ condition: 'points >= 100', message: 'Gold' }, { condition: 'points >= 50', message: 'Silver' }], elseMessage: 'Bronze' },
    hint: '120 is at least 50 too. Which question must Python ask first?',
    lesson: 'Ask the hardest question first. 120 is also at least 50, so asking about Silver first steals every Gold.',
  },
  {
    id: 6, mode: 'build', title: 'Ticket booth', skill: 'Build a 3-way decision', scene: 'ticket',
    story: 'Under 12: Child ticket. 65 or older: Senior ticket. Everyone else: Adult ticket.',
    instruction: 'Choose two questions and three messages. Make your map match the mission map.',
    variable: 'age', unit: 'yrs', min: 0, max: 100, start: 30,
    messages: [{ text: 'Child ticket', color: '#72dcff' }, { text: 'Adult ticket', color: '#a994ff' }, { text: 'Senior ticket', color: '#ffcb47' }],
    chain: { shape: 'nested', rules: [{ condition: '', message: '' }, { condition: '', message: '' }], elseMessage: '' },
    target: { shape: 'nested', rules: [{ condition: 'age < 12', message: 'Child ticket' }, { condition: 'age >= 65', message: 'Senior ticket' }], elseMessage: 'Adult ticket' },
    tiles: ['age < 12', 'age >= 65', 'age > 12', 'age < 65', 'age >= 12'],
    hint: 'Start at one end: who should the first question catch? Watch exactly 12 and 65.',
    lesson: 'Two questions make three paths: the first if, the inner if, and the final else.',
  },
  {
    id: 7, mode: 'convert', title: 'The wardrobe app', skill: 'Fix an overlap', scene: 'clothes',
    story: 'Below 10 °C: Coat. Below 20 °C: Sweater. Otherwise: T-shirt. On cold days the old app says Coat AND Sweater.',
    instruction: 'Rebuild the app with if/else inside else so every temperature gets one answer.',
    variable: 'temp', unit: '°C', min: -10, max: 40, start: 5,
    messages: [{ text: 'Coat', color: '#7aa2ff' }, { text: 'Sweater', color: '#ff9b7a' }, { text: 'T-shirt', color: '#ffd34e' }],
    chain: { shape: 'nested', rules: [{ condition: '', message: '' }, { condition: '', message: '' }], elseMessage: '' },
    target: { shape: 'nested', rules: [{ condition: 'temp < 10', message: 'Coat' }, { condition: 'temp < 20', message: 'Sweater' }], elseMessage: 'T-shirt' },
    before: { shape: 'separate', rules: [{ condition: 'temp < 10', message: 'Coat' }, { condition: 'temp < 20', message: 'Sweater' }, { condition: 'temp >= 20', message: 'T-shirt' }] },
    tiles: ['temp < 10', 'temp < 20', 'temp >= 20', 'temp >= 10'],
    hint: 'Ask about the coldest days first. Inside else, every temperature is already 10 or more.',
    lesson: 'The broken app asked separate questions. Inside else, “below 20” only meets temperatures that are not below 10.',
  },
  {
    id: 8, mode: 'solo', title: 'School zone camera', skill: 'Solo build', scene: 'speed',
    story: 'In the school zone, more than 50 km/h is “Too fast!”. Less than 20 km/h is “Too slow”. Everything else is “Good speed”.',
    instruction: 'Build the camera on your own. The map stays hidden until you check.',
    variable: 'speed', unit: 'km/h', min: 0, max: 120, start: 40,
    messages: [{ text: 'Too fast!', color: '#ff6f94' }, { text: 'Good speed', color: '#b9f352' }, { text: 'Too slow', color: '#72dcff' }],
    chain: { shape: 'nested', rules: [{ condition: '', message: '' }, { condition: '', message: '' }], elseMessage: '' },
    target: { shape: 'nested', rules: [{ condition: 'speed > 50', message: 'Too fast!' }, { condition: 'speed < 20', message: 'Too slow' }], elseMessage: 'Good speed' },
    tiles: ['speed > 50', 'speed >= 50', 'speed < 20', 'speed <= 20', 'speed > 20'],
    hint: '50 and 20 are both good speeds. “More than” and “less than” leave the limits out.',
    lesson: 'You turned three rules in words into one decision with exactly one answer for every speed.',
  },
]

export interface ChainLine { line: number; kind: 'assign' | 'if' | 'print' | 'else'; rule?: number; depth: number }

/** Python lines for a chain, plus what each line is for the tower. */
export function chainProgram(chain: DecisionChain, variable: string): { lines: string[]; layout: ChainLine[] } {
  const lines = [`${variable} = int(input())`]
  const layout: ChainLine[] = [{ line: 0, kind: 'assign', depth: 0 }]
  const push = (text: string, kind: ChainLine['kind'], depth: number, rule?: number) => {
    layout.push({ line: lines.length, kind, depth, rule })
    lines.push(`${'    '.repeat(depth)}${text}`)
  }
  if (chain.shape === 'separate') {
    chain.rules.forEach((rule, index) => {
      push(`if ${rule.condition || '___'}:`, 'if', 0, index)
      push(`print("${rule.message || '___'}")`, 'print', 1, index)
    })
  } else {
    chain.rules.forEach((rule, index) => {
      push(`if ${rule.condition || '___'}:`, 'if', index, index)
      push(`print("${rule.message || '___'}")`, 'print', index + 1, index)
      push('else:', 'else', index, index)
    })
    push(`print("${chain.elseMessage || '___'}")`, 'print', chain.rules.length, chain.rules.length)
  }
  return { lines, layout }
}

export function chainComplete(chain: DecisionChain): boolean {
  return chain.rules.every((rule) => rule.condition && rule.message) && (chain.shape === 'separate' || Boolean(chain.elseMessage))
}

export function runChain(chain: DecisionChain, variable: string, value: number): DecisionRun {
  return runDecisionProgram(chainProgram(chain, variable).lines, [String(value)])
}

export interface MapSegment { from: number; to: number; outputs: string[] }

/** Every whole value in the level's range, grouped into runs with the same outputs. */
export function chainMap(chain: DecisionChain, level: Pick<MoreChoiceLevel, 'variable' | 'min' | 'max'>): MapSegment[] {
  const segments: MapSegment[] = []
  for (let value = level.min; value <= level.max; value += 1) {
    const outputs = runChain(chain, level.variable, value).outputs
    const last = segments.at(-1)
    if (last && last.outputs.join('\n') === outputs.join('\n')) last.to = value
    else segments.push({ from: value, to: value, outputs })
  }
  return segments
}

export function outputsAt(segments: MapSegment[], value: number): string[] {
  return segments.find((segment) => value >= segment.from && value <= segment.to)?.outputs ?? []
}

export interface MapMismatch { from: number; to: number; actual: string[]; expected: string[] }

export function firstMismatch(actual: MapSegment[], expected: MapSegment[], level: Pick<MoreChoiceLevel, 'min' | 'max'>): MapMismatch | null {
  let found: MapMismatch | null = null
  for (let value = level.min; value <= level.max; value += 1) {
    const a = outputsAt(actual, value)
    const e = outputsAt(expected, value)
    const differs = a.join('\n') !== e.join('\n')
    if (found) {
      if (differs && a.join('\n') === found.actual.join('\n') && e.join('\n') === found.expected.join('\n')) found.to = value
      else break
    } else if (differs) found = { from: value, to: value, actual: a, expected: e }
  }
  return found
}

/** Messages that no value in the range can ever print. */
export function unreachableMessages(chain: DecisionChain, segments: MapSegment[]): string[] {
  const printed = new Set(segments.flatMap((segment) => segment.outputs))
  const messages = [...chain.rules.map((rule) => rule.message), chain.elseMessage ?? ''].filter(Boolean)
  return messages.filter((message) => !printed.has(message))
}

/** Boundary values a check sweeps: each cutoff and its neighbours. */
export function boundaryProbes(segments: MapSegment[], level: Pick<MoreChoiceLevel, 'min' | 'max'>): number[] {
  const values = new Set<number>([level.min, level.max])
  for (const segment of segments) for (const value of [segment.from - 1, segment.from, segment.to, segment.to + 1]) {
    if (value >= level.min && value <= level.max) values.add(value)
  }
  return [...values].sort((a, b) => a - b)
}
