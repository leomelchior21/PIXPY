export interface IfElseProblem {
  title: string
  scenario: string
  variable: string
  condition: string
  wrongCondition: string
  trueOutput: string
  falseOutput: string
  initial: number
  decimal?: boolean
  inputHint: string
  min: number
  max: number
  explanation: string
}

export const ifElseProblems: IfElseProblem[] = [
  { title: 'Movie night', scenario: 'Check whether a moviegoer qualifies for a discount. If their age is 12 or under, print "You get a child discount!". Otherwise, print "Regular ticket price applies".', variable: 'age', condition: 'age <= 12', wrongCondition: 'age < 12', trueOutput: 'You get a child discount!', falseOutput: 'Regular ticket price applies', initial: 12, inputHint: 'Age in whole years (0–120)', min: 0, max: 120, explanation: '“12 or under” includes 12, so use <=.' },
  { title: 'Password check', scenario: 'Check whether a password is strong enough. A password is strong if it has 8 or more characters. Use password_length to print "Password is strong" or "Password is too weak".', variable: 'password_length', condition: 'password_length >= 8', wrongCondition: 'password_length > 8', trueOutput: 'Password is strong', falseOutput: 'Password is too weak', initial: 8, inputHint: 'Number of characters (0–100)', min: 0, max: 100, explanation: 'A length of exactly 8 is strong. >= includes the boundary.' },
  { title: 'Too hot?', scenario: 'If the temperature is above 30 degrees, print "Turn on the fan". Otherwise, print "Fan stays off".', variable: 'temperature', condition: 'temperature > 30', wrongCondition: 'temperature >= 30', trueOutput: 'Turn on the fan', falseOutput: 'Fan stays off', initial: 30, inputHint: 'Temperature in degrees (-50–60)', min: -50, max: 60, explanation: '“Above 30” means strictly greater than 30. Exactly 30 takes the else path.' },
  { title: 'Level unlocked', scenario: 'A player needs at least 100 points to unlock a level. Print "Level unlocked" if they qualify, or "Keep playing" otherwise.', variable: 'points', condition: 'points >= 100', wrongCondition: 'points <= 100', trueOutput: 'Level unlocked', falseOutput: 'Keep playing', initial: 75, inputHint: 'Points (0–10000)', min: 0, max: 10000, explanation: 'At least 100 means 100 or more, including the boundary.' },
  { title: 'Secret door', scenario: 'The door opens only when the secret code equals 42. Print "Door unlocked" for the correct code, or "Access denied" otherwise.', variable: 'secret', condition: 'secret == 42', wrongCondition: 'secret != 42', trueOutput: 'Door unlocked', falseOutput: 'Access denied', initial: 42, inputHint: 'Secret code (0–999)', min: 0, max: 999, explanation: 'Use == to compare for equality. = assigns a value.' },
  { title: 'Your school result', scenario: 'Read a grade from the student. A grade of 7 or more passes. Print "Approved" if they pass, or "Try again" otherwise. Build the code, then enter a grade to run it.', variable: 'grade', condition: 'grade >= 7', wrongCondition: 'grade > 7', trueOutput: 'Approved', falseOutput: 'Try again', initial: 7, decimal: true, inputHint: 'Grade from 0 to 10 (decimals allowed)', min: 0, max: 10, explanation: 'float(input()) reads a decimal grade. A grade of exactly 7 passes.' },
  { title: 'Old enough to vote?', scenario: 'Read an age. If the person is 18 or older, print "You can vote". Otherwise, print "Not old enough yet". Enter your own age to test the decision.', variable: 'age', condition: 'age >= 18', wrongCondition: 'age > 18', trueOutput: 'You can vote', falseOutput: 'Not old enough yet', initial: 18, inputHint: 'Age in whole years (0–120)', min: 0, max: 120, explanation: 'int(input()) reads a whole number. Exactly 18 takes the if path.' },
  { title: 'Try a password length', scenario: 'Read the number of characters in a password. If it has fewer than 8 characters, print "Add more characters". Otherwise, print "Good length". Test your own password length.', variable: 'password_length', condition: 'password_length < 8', wrongCondition: 'password_length <= 8', trueOutput: 'Add more characters', falseOutput: 'Good length', initial: 8, inputHint: 'Number of characters (0–100)', min: 0, max: 100, explanation: 'At 8 characters the condition is false, so Python prints the else message.' },
  { title: 'Even or odd?', scenario: 'Read a whole number. If dividing it by 2 leaves a remainder of 0, print "Even". Otherwise, print "Odd". Enter a number and discover its path.', variable: 'number', condition: 'number % 2 == 0', wrongCondition: 'number % 2 != 0', trueOutput: 'Even', falseOutput: 'Odd', initial: 8, inputHint: 'Whole number (-10000–10000)', min: -10000, max: 10000, explanation: '% gives the remainder. A remainder of 0 means the number is even.' },
  { title: 'Free delivery', scenario: 'Read an order total. Orders of 50 or more get free delivery. Print "Free delivery" if they qualify, or "Delivery fee applies" otherwise. Try a total with decimals.', variable: 'total', condition: 'total >= 50', wrongCondition: 'total > 50', trueOutput: 'Free delivery', falseOutput: 'Delivery fee applies', initial: 50, decimal: true, inputHint: 'Order total (0–10000; decimals allowed)', min: 0, max: 10000, explanation: 'float(input()) accepts amounts with decimals. Exactly 50 qualifies too.' },
]

export function problemLines(problem: IfElseProblem, interactive: boolean): string[] {
  return [
    `${problem.variable} = ${interactive ? `${problem.decimal ? 'float' : 'int'}(input())` : problem.initial}`,
    `if ${problem.condition}:`,
    `    print("${problem.trueOutput}")`,
    'else:',
    `    print("${problem.falseOutput}")`,
  ]
}

export function parseProblemInput(problem: IfElseProblem, draft: string): number | null {
  const value = draft.trim()
  if (!(problem.decimal ? /^-?\d+(\.\d+)?$/ : /^-?\d+$/).test(value)) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= problem.min && number <= problem.max ? number : null
}
