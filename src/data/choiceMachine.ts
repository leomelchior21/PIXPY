export interface EverydayChoice {
  id: 'rain' | 'password' | 'grade'
  title: string
  eyebrow: string
  explanation: string
  situation: string
  condition: string
  question: string
  options: string[]
  answer: number
  feedback: string
  path: 'TRUE' | 'FALSE'
  result: string
  visualLabel: string
}

export const everydayChoices: EverydayChoice[] = [
  {
    id: 'rain', eyebrow: '01 / THE WEATHER', title: 'A rainy day',
    explanation: 'You look outside before leaving home. One question decides what you bring.',
    situation: 'Rain is falling outside.', condition: 'Is it raining?', question: 'What do you take with you?',
    options: ['Take an umbrella', 'Leave the umbrella'], answer: 0,
    feedback: 'Yes, it is raining. The answer is TRUE, so you take the umbrella.',
    path: 'TRUE', result: 'Umbrella ready', visualLabel: 'RAINING NOW',
  },
  {
    id: 'password', eyebrow: '02 / THE PASSWORD', title: 'The locked door',
    explanation: 'The secret code is 4729. Someone types 4728. The door must decide what happens.',
    situation: 'Secret code: 4729   ·   Typed code: 4728', condition: 'Do the codes match?', question: 'What should the door do?',
    options: ['Open the door', 'Show an error'], answer: 1,
    feedback: 'The codes do not match. The answer is FALSE, so the door shows an error.',
    path: 'FALSE', result: 'Access denied', visualLabel: 'NUMERIC LOCK',
  },
  {
    id: 'grade', eyebrow: '03 / THE RESULT', title: 'The school result',
    explanation: 'The pass mark is 7. One student got 8. One comparison decides the result.',
    situation: 'Student grade: 8   ·   Pass mark: 7', condition: 'Is 8 at least 7?', question: 'Which result should appear?',
    options: ['Approved', 'Try again'], answer: 0,
    feedback: '8 is at least 7. The answer is TRUE, so the result is Approved.',
    path: 'TRUE', result: 'Approved', visualLabel: 'GRADE CHECK',
  },
]

export interface FlowStoryInput {
  placeholder: string
  hint: string
  typeHint: string
  parse: (raw: string) => number | null
  below: string
  above: string
}

export interface FlowStory {
  id: string
  title: string
  narrative: string
  variable: string
  question: string
  condition: string
  trueOutput: string
  falseOutput: string
  decide: (value: number) => boolean
  format: (value: number) => string
  calc: (value: number) => string[]
  input: FlowStoryInput
}

function wholeNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^-?\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isSafeInteger(value) ? value : null
}

export const flowStories: FlowStory[] = [
  {
    id: 'grade', title: 'The school result', narrative: 'A grade decides which message the student sees. Type any whole number and watch Python choose a path.',
    variable: 'grade', question: 'Is the grade at least 7?', condition: 'grade >= 7',
    trueOutput: 'Approved', falseOutput: 'Try again', decide: (value) => value >= 7, format: String,
    calc: (value) => [`${value} >= 7 → ${value >= 7 ? 'True' : 'False'}`],
    input: { placeholder: 'type a number, e.g. 8', hint: 'Type a whole number in the box, then press START FLOW.', typeHint: 'Whole numbers only', parse: wholeNumber, below: 'less than 7', above: '7 or more' },
  },
  {
    id: 'even-odd', title: 'Even or odd', narrative: 'The computer looks at the last digit to split every number into two groups. Give it a number to test.',
    variable: 'n', question: 'Is n an even number?', condition: 'n % 2 == 0',
    trueOutput: 'Even', falseOutput: 'Odd', decide: (value) => Math.abs(value) % 2 === 0, format: String,
    calc: (value) => {
      const remainder = Math.abs(value) % 2
      return [`${value} % 2 = ${remainder}`, `${remainder} == 0 → ${remainder === 0 ? 'True' : 'False'}`]
    },
    input: { placeholder: 'type a number, e.g. 7', hint: 'Type a whole number in the box, then press START FLOW.', typeHint: 'Whole numbers only', parse: wholeNumber, below: 'odd (n % 2 is 1)', above: 'even (n % 2 is 0)' },
  },
  {
    id: 'adult', title: 'Grown-up or not', narrative: 'An age check chooses between two very different answers. Try an age of your own.',
    variable: 'age', question: 'Is the age at least 18?', condition: 'age >= 18',
    trueOutput: 'Adult', falseOutput: 'Minor', decide: (value) => value >= 18, format: String,
    calc: (value) => [`${value} >= 18 → ${value >= 18 ? 'True' : 'False'}`],
    input: { placeholder: 'type an age, e.g. 18', hint: 'Type a whole number in the box, then press START FLOW.', typeHint: 'Whole numbers only', parse: wholeNumber, below: 'under 18', above: '18 or more' },
  },
]

type Comparison = '<' | '>' | '<=' | '>=' | '==' | '!='
type QuizKind = 'boolean' | 'if' | 'ifElse' | 'follow' | 'twoIf' | 'reassign'

interface QuizTemplate {
  variable: string
  values: number[]
  op: Comparison
  target: number
  kind: QuizKind
  yes?: string
  no?: string
}

const quizTemplates: QuizTemplate[] = [
  { variable: 'x', values: [10, 2, 5], op: '<', target: 5, kind: 'boolean' },
  { variable: 'x', values: [7, 3, 2], op: '==', target: 3, kind: 'boolean' },
  { variable: 'score', values: [12, 6, 8], op: '>', target: 8, kind: 'boolean' },
  { variable: 'x', values: [10, 9, 11], op: '!=', target: 10, kind: 'boolean' },
  { variable: 'coins', values: [4, 6, 3], op: '<=', target: 4, kind: 'boolean' },
  { variable: 'level', values: [5, 7, 9], op: '>=', target: 7, kind: 'boolean' },
  { variable: 'grade', values: [8, 4, 7], op: '>=', target: 7, kind: 'if', yes: 'Approved' },
  { variable: 'lives', values: [0, 2, 1], op: '>', target: 0, kind: 'if', yes: 'Continue' },
  { variable: 'code', values: [9, 8, 10], op: '==', target: 9, kind: 'if', yes: 'Unlocked' },
  { variable: 'coins', values: [2, 5, 3], op: '<', target: 3, kind: 'if', yes: 'Low coins' },
  { variable: 'grade', values: [5, 8, 7], op: '>=', target: 7, kind: 'ifElse', yes: 'Approved', no: 'Try again' },
  { variable: 'age', values: [18, 16, 20], op: '>=', target: 18, kind: 'ifElse', yes: 'Adult', no: 'Minor' },
  { variable: 'speed', values: [7, 12, 10], op: '>', target: 10, kind: 'ifElse', yes: 'Fast', no: 'Slow' },
  { variable: 'level', values: [5, 4, 6], op: '==', target: 5, kind: 'ifElse', yes: 'Gate open', no: 'Gate closed' },
  { variable: 'x', values: [8, 6, 9], op: '!=', target: 8, kind: 'ifElse', yes: 'Different', no: 'Equal' },
  { variable: 'x', values: [5, 1, 3], op: '<', target: 3, kind: 'follow', yes: 'Small', no: 'Done' },
  { variable: 'points', values: [10, 9, 12], op: '>=', target: 10, kind: 'follow', yes: 'Bonus', no: 'Ready' },
  { variable: 'x', values: [4, 8, 1], op: '>', target: 2, kind: 'twoIf', yes: 'A', no: 'B' },
  { variable: 'x', values: [4, 6, 2], op: '>=', target: 7, kind: 'reassign', yes: 'High', no: 'Low' },
  { variable: 'secret', values: [7, 2, 9], op: '==', target: 7, kind: 'ifElse', yes: 'Match', no: 'Different' },
]

export const CHOICE_QUIZ_LENGTH = quizTemplates.length
export const CHOICE_XP_PER_QUESTION = 10

function compare(value: number, operator: Comparison, target: number): boolean {
  switch (operator) {
    case '<': return value < target
    case '>': return value > target
    case '<=': return value <= target
    case '>=': return value >= target
    case '==': return value === target
    case '!=': return value !== target
  }
}

export interface ChoiceQuizQuestion {
  prompt: string
  code: string
  options: string[]
  answer: number
  explanation: string
}

export function makeChoiceQuizQuestion(index: number, retry = 0): ChoiceQuizQuestion {
  const item = quizTemplates[index]
  if (!item) throw new RangeError('Unknown quiz question')
  const value = item.values[retry % item.values.length]
  const testValue = item.kind === 'reassign' ? value + 2 : value
  const passed = compare(testValue, item.op, item.target)
  const condition = `${item.variable} ${item.op} ${item.target}`
  const firstLine = `${item.variable} = ${value}`
  let code: string
  let correct: string
  let choices: string[]
  let explanation: string

  if (item.kind === 'boolean') {
    code = `${firstLine}\nprint(${condition})`
    correct = passed ? 'True' : 'False'
    choices = ['True', 'False', String(value), 'Error']
    explanation = `${testValue} ${item.op} ${item.target} is ${correct}, so print() shows ${correct}.`
  } else if (item.kind === 'if') {
    code = `${firstLine}\nif ${condition}:\n    print("${item.yes}")`
    correct = passed ? item.yes! : 'Nothing prints'
    choices = [item.yes!, 'Nothing prints', 'False', 'Error']
    explanation = `${testValue} ${item.op} ${item.target} is ${passed ? 'True' : 'False'}. ${passed ? 'The indented print runs.' : 'Python skips the indented print.'}`
  } else if (item.kind === 'ifElse') {
    code = `${firstLine}\nif ${condition}:\n    print("${item.yes}")\nelse:\n    print("${item.no}")`
    correct = passed ? item.yes! : item.no!
    choices = [item.yes!, item.no!, 'Both messages', 'Nothing prints']
    explanation = `${testValue} ${item.op} ${item.target} is ${passed ? 'True' : 'False'}, so only the ${passed ? 'if' : 'else'} path runs.`
  } else if (item.kind === 'follow') {
    code = `${firstLine}\nif ${condition}:\n    print("${item.yes}")\nprint("${item.no}")`
    correct = passed ? `${item.yes}\n${item.no}` : item.no!
    choices = [item.yes!, item.no!, `${item.yes}\n${item.no}`, 'Nothing prints']
    explanation = `${testValue} ${item.op} ${item.target} is ${passed ? 'True' : 'False'}. The final unindented print always runs.`
  } else if (item.kind === 'twoIf') {
    code = `${firstLine}\nif x > 2:\n    print("A")\nif x < 6:\n    print("B")`
    correct = [value > 2 ? 'A' : '', value < 6 ? 'B' : ''].filter(Boolean).join('\n') || 'Nothing prints'
    choices = ['A', 'B', 'A\nB', 'Nothing prints']
    explanation = `These are two separate if statements. Python tests both with x = ${value}.`
  } else {
    code = `${firstLine}\n${item.variable} = ${item.variable} + 2\nif ${condition}:\n    print("${item.yes}")\nelse:\n    print("${item.no}")`
    correct = passed ? item.yes! : item.no!
    choices = [item.yes!, item.no!, 'Both messages', 'Nothing prints']
    explanation = `Python changes ${item.variable} to ${testValue} before testing the condition.`
  }

  const rotation = (index + retry) % choices.length
  const options = [...choices.slice(rotation), ...choices.slice(0, rotation)]
  return { prompt: item.kind === 'boolean' ? 'What does Python print: True or False?' : 'What does Python print?', code, options, answer: options.indexOf(correct), explanation }
}
