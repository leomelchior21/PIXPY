export type BossSpriteId = 'slime' | 'golem' | 'robot' | 'ghost' | 'dragon' | 'cyclops'

export interface BossTest { inputs: string[]; expected: string }

export interface ConditionBoss {
  id: number
  name: string
  mission: string
  sprite: BossSpriteId
  palette: { body: string; shade: string; light: string; accent: string }
  prompt: string
  inputNames: string[]
  kind: 'write' | 'fix' | 'finish'
  /** What the student writes this round. The help shrinks boss by boss. */
  task: string
  starter: string
  solution: string
  tests: BossTest[]
  hints: string[]
}

const t = (inputs: string | string[], expected: string): BossTest => ({ inputs: Array.isArray(inputs) ? inputs : [inputs], expected })

export const conditionBosses: ConditionBoss[] = [
  {
    id: 1, name: 'Gate Slime', mission: 'The club door', sprite: 'slime', kind: 'finish', task: 'WRITE THE LAST PRINT',
    palette: { body: '#8fdc5a', shade: '#4f9c37', light: '#d4f7a8', accent: '#ffcb47' },
    prompt: 'The club door reads an age. 18 or more: print Welcome in. Anyone younger: print Too young. The if and the else are ready: write the print under else.',
    inputNames: ['age'],
    starter: 'age = int(input())\nif age >= 18:\n    print("Welcome in")\nelse:\n    # Write the print for anyone younger\n',
    solution: 'age = int(input())\nif age >= 18:\n    print("Welcome in")\nelse:\n    print("Too young")',
    tests: [t('20', 'Welcome in'), t('12', 'Too young'), t('18', 'Welcome in'), t('17', 'Too young'), t('45', 'Welcome in')],
    hints: ['Only the else branch is missing its print.', 'Indent the print under else with 4 spaces, like the print under if.', 'Text needs quotes: print("Too young").'],
  },
  {
    id: 2, name: 'Fan Golem', mission: 'The overheated lab', sprite: 'golem', kind: 'finish', task: 'WRITE BOTH PRINTS',
    palette: { body: '#7fb0e8', shade: '#4a74b0', light: '#c9e2ff', accent: '#ff855e' },
    prompt: 'The lab fan reads a temperature. Above 30 degrees: print Fan ON. Otherwise: print Fan OFF. The if and the else are ready: write a print in each branch.',
    inputNames: ['temp'],
    starter: 'temp = int(input())\nif temp > 30:\n    # Print for above 30\nelse:\n    # Print for 30 or less\n',
    solution: 'temp = int(input())\nif temp > 30:\n    print("Fan ON")\nelse:\n    print("Fan OFF")',
    tests: [t('35', 'Fan ON'), t('10', 'Fan OFF'), t('31', 'Fan ON'), t('30', 'Fan OFF'), t('29', 'Fan OFF')],
    hints: ['Each branch needs one print, indented with 4 spaces.', 'The if branch runs above 30: print("Fan ON"). The else branch: print("Fan OFF").', 'The surprise tests try 29, 30 and 31. Only 31 turns the fan on.'],
  },
  {
    id: 3, name: 'Glitch Lock', mission: 'The locked vault', sprite: 'robot', kind: 'finish', task: 'WRITE THE PRINTS AND ELSE',
    palette: { body: '#b8c0cf', shade: '#7a8396', light: '#e8edf5', accent: '#ff5f7e' },
    prompt: 'Code 4729 must print Unlocked. Any other code: Wrong code. The if is ready: write its print, then else: and the other print.',
    inputNames: ['code'],
    starter: 'code = int(input())\nif code == 4729:\n    # Print for the right code here. Then add the other branch below.\n',
    solution: 'code = int(input())\nif code == 4729:\n    print("Unlocked")\nelse:\n    print("Wrong code")',
    tests: [t('4729', 'Unlocked'), t('1234', 'Wrong code'), t('4728', 'Wrong code'), t('4730', 'Wrong code'), t('0', 'Wrong code')],
    hints: ['Under the if, indented with 4 spaces: print("Unlocked").', 'else: goes back to the left edge, lined up with if, and ends with a colon.', 'Under else, indented: print("Wrong code").'],
  },
  {
    id: 4, name: 'Coin Muncher', mission: 'The hungry arcade', sprite: 'slime', kind: 'write', task: 'WRITE THE WHOLE DECISION',
    palette: { body: '#ffd34e', shade: '#d39a1d', light: '#fff2b8', accent: '#ff6f94' },
    prompt: 'Two numbers arrive: your coins, then the price. Enough coins to pay: print Play!. Otherwise: print Not enough coins.',
    inputNames: ['coins', 'price'],
    starter: 'coins = int(input())\nprice = int(input())\n\n',
    solution: 'coins = int(input())\nprice = int(input())\nif coins >= price:\n    print("Play!")\nelse:\n    print("Not enough coins")',
    tests: [t(['10', '4'], 'Play!'), t(['2', '3'], 'Not enough coins'), t(['3', '3'], 'Play!'), t(['5', '6'], 'Not enough coins'), t(['7', '7'], 'Play!')],
    hints: ['A condition can compare two variables: coins and price.', 'Exactly the price is enough to pay.', 'if coins >= price: is a complete question.'],
  },
  {
    id: 5, name: 'Odd Twin', mission: 'The number splitter', sprite: 'ghost', kind: 'write', task: 'WRITE THE WHOLE DECISION',
    palette: { body: '#c3a6ff', shade: '#8a6ad6', light: '#ebe0ff', accent: '#72dcff' },
    prompt: 'Print Even for even numbers and Odd for odd numbers. Negative numbers too!',
    inputNames: ['number'],
    starter: 'number = int(input())\n\n',
    solution: 'number = int(input())\nif number % 2 == 0:\n    print("Even")\nelse:\n    print("Odd")',
    tests: [t('8', 'Even'), t('7', 'Odd'), t('0', 'Even'), t('-3', 'Odd'), t('100', 'Even')],
    hints: ['% gives the remainder of a division.', 'Even numbers leave remainder 0 when divided by 2.', 'if number % 2 == 0:'],
  },
  {
    id: 6, name: 'Password Hydra', mission: 'The secret cave', sprite: 'dragon', kind: 'write', task: 'WRITE THE WHOLE DECISION',
    palette: { body: '#5fd3a8', shade: '#2f9a74', light: '#bff3df', accent: '#ffcb47' },
    prompt: 'The password is dragon. Print Access granted only for exactly dragon. Anything else: print Access denied.',
    inputNames: ['password'],
    starter: 'password = input()\n\n',
    solution: 'password = input()\nif password == "dragon":\n    print("Access granted")\nelse:\n    print("Access denied")',
    tests: [t('dragon', 'Access granted'), t('cat', 'Access denied'), t('Dragon', 'Access denied'), t('dragon1', 'Access denied'), t('DRAGON', 'Access denied')],
    hints: ['The password is text, so keep input() as text: no int().', 'Text values need quotes: "dragon".', 'Python cares about capitals: Dragon is not dragon.'],
  },
  {
    id: 7, name: 'Speed Wraith', mission: 'The school zone', sprite: 'ghost', kind: 'write', task: 'WRITE THE WHOLE DECISION',
    palette: { body: '#7ee3f2', shade: '#3ba5be', light: '#d3f8ff', accent: '#ff6f94' },
    prompt: 'More than 50: print Too fast!. Less than 20: print Too slow. Everything else: print Good speed. Use an if/else inside else.',
    inputNames: ['speed'],
    starter: 'speed = int(input())\n\n',
    solution: 'speed = int(input())\nif speed > 50:\n    print("Too fast!")\nelse:\n    if speed < 20:\n        print("Too slow")\n    else:\n        print("Good speed")',
    tests: [t('51', 'Too fast!'), t('50', 'Good speed'), t('35', 'Good speed'), t('20', 'Good speed'), t('19', 'Too slow')],
    hints: ['Three answers need two questions.', 'Put the second if inside else: indent it with 4 spaces, and its prints with 8.', '50 and 20 are both Good speed. Watch > and <.'],
  },
  {
    id: 8, name: 'Medal Dragon', mission: 'The medal ceremony', sprite: 'dragon', kind: 'write', task: 'WRITE THE WHOLE DECISION',
    palette: { body: '#ffb347', shade: '#c9771b', light: '#ffe2b0', accent: '#ff5f7e' },
    prompt: '100 points or more: Gold. 50 or more: Silver. Anything else: Bronze. Use an if/else inside else.',
    inputNames: ['points'],
    starter: 'points = int(input())\n\n',
    solution: 'points = int(input())\nif points >= 100:\n    print("Gold")\nelse:\n    if points >= 50:\n        print("Silver")\n    else:\n        print("Bronze")',
    tests: [t('120', 'Gold'), t('100', 'Gold'), t('99', 'Silver'), t('50', 'Silver'), t('49', 'Bronze')],
    hints: ['Three answers need two questions. Ask about Gold first.', 'Inside else, ask a new question with if. The inner if needs 4 spaces, its prints 8.', 'The inner else catches everything below 50: Bronze.'],
  },
  {
    id: 9, name: 'Discount Mimic', mission: 'The online shop', sprite: 'cyclops', kind: 'write', task: 'WRITE THE WHOLE DECISION',
    palette: { body: '#ff8fb8', shade: '#cf5486', light: '#ffd2e4', accent: '#b9f352' },
    prompt: 'Orders of 50 or more get 10 off. Print the price to pay. A total of 60 prints 50. A total of 30 prints 30.',
    inputNames: ['total'],
    starter: 'total = int(input())\n\n',
    solution: 'total = int(input())\nif total >= 50:\n    print(total - 10)\nelse:\n    print(total)',
    tests: [t('60', '50'), t('30', '30'), t('50', '40'), t('49', '49'), t('51', '41')],
    hints: ['A branch can print a calculation, like print(total - 10).', 'Small orders print the total unchanged.', '50 itself gets the discount.'],
  },
  {
    id: 10, name: 'The Grade Judge', mission: 'The final report card', sprite: 'golem', kind: 'write', task: 'WRITE THE WHOLE DECISION',
    palette: { body: '#ff7a59', shade: '#c4472c', light: '#ffc6b3', accent: '#ffe066' },
    prompt: '9 or more: Excellent. 7 or more: Approved. 5 or more: Recovery. Below 5: Failed. Grades can have decimals.',
    inputNames: ['grade'],
    starter: 'grade = float(input())\n\n',
    solution: 'grade = float(input())\nif grade >= 9:\n    print("Excellent")\nelse:\n    if grade >= 7:\n        print("Approved")\n    else:\n        if grade >= 5:\n            print("Recovery")\n        else:\n            print("Failed")',
    tests: [t('9', 'Excellent'), t('8.9', 'Approved'), t('7', 'Approved'), t('5', 'Recovery'), t('4.9', 'Failed')],
    hints: ['Four answers need three questions. Start with the highest grade.', 'Every new question goes inside the else above it, 4 more spaces in.', 'Each cutoff counts as reaching it: use >=.'],
  },
]

/** Removes text that input("...") prompts printed before the answer. */
export function cleanBossOutput(code: string, stdout: string): string {
  let output = stdout
  for (const match of code.matchAll(/input\(\s*(["'])(.*?)\1\s*\)/g)) {
    if (match[2] && output.includes(match[2])) output = output.replace(match[2], '')
  }
  return output.split('\n').map((line) => line.trimEnd()).join('\n').trim()
}

export function bossOutputMatches(actual: string, expected: string): boolean {
  if (actual === expected) return true
  const a = Number(actual)
  const b = Number(expected)
  return actual !== '' && !actual.includes('\n') && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9
}

// Pixel art: 16 rows of 8 columns, mirrored into 16×16 sprites.
// o outline · b body · d shade · l light · w eye · p pupil · a accent · m mouth · t tooth
const halfSprites: Record<BossSpriteId, string[]> = {
  slime: [
    '........', '........', '........', '......oo', '....oobb', '...obbll', '..obblll', '..obbbbb',
    '.obbwwbb', '.obbwpbb', 'obbbbbbb', 'obbbbbbb', 'obdbbbmm', 'obddbbbb', 'obdddddd', '.ooooooo',
  ],
  golem: [
    '........', '...ooooo', '...obbbb', '...obaab', '...obbbb', '...obmmm', 'ooooobbb', 'obbbobbb',
    'obdbobbl', 'obdbobdb', 'obbbobbb', 'oooobbbb', '...obbdb', '...obbo.', '...obbo.', '...oooo.',
  ],
  robot: [
    '.......o', '.......a', '....oooo', '....obbb', '....obab', '....obbb', '....obtt', '....oooo',
    '..oooobb', '..obbbbl', 'oobbbbal', 'obobbbbb', 'o.obbbdd', '..obbbbb', '...oo.oo', '...oo.oo',
  ],
  ghost: [
    '........', '.....ooo', '....obbb', '...obbll', '..obbbll', '..obbbbb', '.obbwwbb', '.obbwpbb',
    '.obbbbbb', '.obbbbmm', '.obbbbmm', '.obbbbbb', '.obdbbbb', '.obddbbd', '.obo.obo', '..o...o.',
  ],
  dragon: [
    '..a.....', '..aa....', '..oooooo', '.obbbbbb', '.obwpbbb', '.obbbbbb', 'oobbbbbb', 'obbmmmmm',
    'obbmtmtm', '.obbbbbb', 'a.obbbll', 'aaobbbll', 'aaobbbbb', '.aobdbbd', '..obbo.o', '..ooo...',
  ],
  cyclops: [
    '........', '....oooo', '...obbbb', '..obblll', '..obwwww', '.obwwwpp', '.obwwwpp', '.obbwwww',
    '.obbbbbb', 'obbmmmmm', 'obbmtmtm', 'obbbbbbb', 'obdbbbbb', '.obdbbbb', '..obbo..', '..ooo...',
  ],
}

export function bossSprite(id: BossSpriteId): string[] {
  return halfSprites[id].map((row) => row + [...row].reverse().join(''))
}
