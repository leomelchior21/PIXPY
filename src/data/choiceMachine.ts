export type EverydayChoiceId = 'rain' | 'password' | 'grade' | 'traffic' | 'battery' | 'ride' | 'arcade' | 'motion' | 'temperature'

export interface EverydayChoice {
  id: EverydayChoiceId
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
  visual?: { valueLabel: string; value: string; ruleLabel: string; rule: string; description: string }
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
  {
    id: 'traffic', eyebrow: '04 / THE CROSSING', title: 'The crossing light',
    explanation: 'The crossing signal is red. You cross only when the signal is green.',
    situation: 'Signal now: red · Cross when: green', condition: 'Is the signal green?', question: 'What should you do now?',
    options: ['Cross the road', 'Wait for green'], answer: 1,
    feedback: 'Red is not green. The answer is FALSE, so you wait. Only the ELSE action happens.',
    path: 'FALSE', result: 'Wait for green', visualLabel: 'CROSSING SIGNAL',
    visual: { valueLabel: 'SIGNAL NOW', value: 'RED', ruleLabel: 'CROSS WHEN', rule: 'GREEN', description: 'A red crossing signal beside a pedestrian crossing. The rule says to cross only on green.' },
  },
  {
    id: 'battery', eyebrow: '05 / THE BATTERY', title: 'A low battery',
    explanation: 'Your phone has 20% battery. You charge it when the battery is 20% or less.',
    situation: 'Battery: 20% · Charge at: 20% or less', condition: 'Is 20 at most 20?', question: 'What do you do with the phone?',
    options: ['Charge the phone', 'Keep using it'], answer: 0,
    feedback: '20 is at most 20. The answer is TRUE, so you charge the phone. The limit itself counts.',
    path: 'TRUE', result: 'Charge the phone', visualLabel: 'BATTERY CHECK',
    visual: { valueLabel: 'BATTERY LEFT', value: '20%', ruleLabel: 'CHARGE AT', rule: '20% OR LESS', description: 'A phone with 20 percent battery remaining. The charging rule is 20 percent or less.' },
  },
  {
    id: 'ride', eyebrow: '06 / THE RIDE', title: 'The ride entrance',
    explanation: 'A ride requires a height of at least 130 cm. Your height is 125 cm.',
    situation: 'Your height: 125 cm · Minimum: 130 cm', condition: 'Is 125 at least 130?', question: 'Which action matches the rule?',
    options: ['Enter this ride', 'Choose another ride'], answer: 1,
    feedback: '125 is below 130. The answer is FALSE, so you choose another ride. The IF action does not run.',
    path: 'FALSE', result: 'Choose another ride', visualLabel: 'HEIGHT CHECK',
    visual: { valueLabel: 'YOUR HEIGHT', value: '125 cm', ruleLabel: 'MINIMUM HEIGHT', rule: '130 cm', description: 'A person beside a height ruler. Their height is 125 centimetres and the ride minimum is marked at 130 centimetres.' },
  },
  {
    id: 'arcade', eyebrow: '07 / THE ARCADE', title: 'One more game',
    explanation: 'One arcade game costs 3 coins. You have exactly 3 coins. Play when you have at least the price.',
    situation: 'Your coins: 3 · Game price: 3 coins', condition: 'Is 3 at least 3?', question: 'What can the machine let you do?',
    options: ['Play the game', 'Add more coins'], answer: 0,
    feedback: '3 is at least 3. The answer is TRUE, so you play. You have exactly enough; you do not need more.',
    path: 'TRUE', result: 'Play the game', visualLabel: 'COIN CHECK',
    visual: { valueLabel: 'YOUR COINS', value: '3', ruleLabel: 'GAME PRICE', rule: '3 COINS', description: 'An arcade cabinet with three coins beside it. One game costs three coins.' },
  },
  {
    id: 'motion', eyebrow: '08 / THE SENSOR', title: 'The hallway light',
    explanation: 'A sensor turns the light on if it detects movement. The hallway is empty and no movement is detected.',
    situation: 'Movement detected: no · Light on when: movement', condition: 'Is movement detected?', question: 'What should the light do?',
    options: ['Turn the light on', 'Keep the light off'], answer: 1,
    feedback: 'No movement is detected. The answer is FALSE, so the light stays off. An IF question can be answered without a number.',
    path: 'FALSE', result: 'Keep the light off', visualLabel: 'MOTION CHECK',
    visual: { valueLabel: 'MOVEMENT', value: 'NONE', ruleLabel: 'LIGHT ON WHEN', rule: 'MOVEMENT', description: 'An empty hallway with a movement sensor and an unlit ceiling lamp. The sensor detects no movement.' },
  },
  {
    id: 'temperature', eyebrow: '09 / THE TEMPERATURE', title: 'A warm afternoon',
    explanation: 'The room is 28°C. A fan turns on when the temperature is more than 25°C.',
    situation: 'Room temperature: 28°C · Fan on above: 25°C', condition: 'Is 28 more than 25?', question: 'What should the fan do?',
    options: ['Turn the fan on', 'Leave the fan off'], answer: 0,
    feedback: '28 is more than 25. The answer is TRUE, so the fan turns on. The value, the question, and the action form one decision.',
    path: 'TRUE', result: 'Turn the fan on', visualLabel: 'TEMPERATURE CHECK',
    visual: { valueLabel: 'ROOM TEMPERATURE', value: '28°C', ruleLabel: 'FAN ON ABOVE', rule: '25°C', description: 'A room thermometer reading 28 degrees Celsius beside a fan. The fan turns on above 25 degrees Celsius.' },
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

export interface FlowStoryBriefing {
  lead: string
  watch: string[]
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
  briefing: FlowStoryBriefing
}

function wholeNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^-?\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isSafeInteger(value) ? value : null
}

export const flowStories: FlowStory[] = [
  {
    id: 'grade', title: 'The school result', narrative: 'A grade decides which message the student sees. Tap the arrows to adjust it and watch Python choose a path.',
    variable: 'grade', question: 'Is the grade at least 7?', condition: 'grade >= 7',
    trueOutput: 'Approved', falseOutput: 'Try again', decide: (value) => value >= 7, format: String,
    calc: (value) => [`${value} >= 7 → ${value >= 7 ? 'True' : 'False'}`],
    input: { placeholder: '', hint: 'Tap the arrows to choose a grade, then press START FLOW.', typeHint: '0 to 10 · arrows change by 0.25', parse: (raw) => {
      if (!/^\d+(\.\d+)?$/.test(raw.trim())) return null
      const value = Number(raw)
      return value >= 0 && value <= 10 && Number.isInteger(value * 4) ? value : null
    }, below: 'less than 7', above: '7 or more' },
    briefing: {
      lead: 'A grade comes in from a student. Python compares it with the pass mark of 7 and chooses which message appears.',
      watch: ['You tap the arrows to choose a grade from 0 to 10 and press START FLOW.', 'Python tests the condition grade >= 7.', 'The glow follows TRUE to Approved or FALSE to Try again.'],
    },
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
    briefing: {
      lead: 'Now the test uses the remainder operator. Python divides your number by 2 and checks what is left over.',
      watch: ['You type a whole number for n and press START FLOW.', 'Python calculates the condition n % 2 == 0.', 'Even numbers go TRUE. Odd numbers go FALSE.'],
    },
  },
  {
    id: 'adult', title: 'Grown-up or not', narrative: 'An age check chooses between two very different answers. Try an age of your own.',
    variable: 'age', question: 'Is the age at least 18?', condition: 'age >= 18',
    trueOutput: 'Adult', falseOutput: 'Minor', decide: (value) => value >= 18, format: String,
    calc: (value) => [`${value} >= 18 → ${value >= 18 ? 'True' : 'False'}`],
    input: { placeholder: 'type an age, e.g. 18', hint: 'Type a whole number in the box, then press START FLOW.', typeHint: 'Whole numbers only', parse: wholeNumber, below: 'under 18', above: '18 or more' },
    briefing: {
      lead: 'A door has to know if a visitor is an adult. One age value decides which label walks through.',
      watch: ['You type an age and press START FLOW.', 'Python tests the condition age >= 18.', 'The answer chooses between Adult and Minor.'],
    },
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
