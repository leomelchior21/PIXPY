export interface VariableBoss {
  id: number
  title: string
  prompt: string
  code: string
  inputs: string[]
  expected?: string
}

export const variableBosses: VariableBoss[] = [
  { id: 1, title: 'Two Numbers', prompt: 'Add the two values.', inputs: ['8', '4'], expected: '12', code: 'a = int(input())\nb = int(input())\n\nresult = 0  # change this\nprint(result)' },
  { id: 2, title: 'Difference', prompt: 'Subtract b from a.', inputs: ['9', '4'], expected: '5', code: 'a = int(input())\nb = int(input())\n\nresult = 0  # change this\nprint(result)' },
  { id: 3, title: 'Double It', prompt: 'Double the value.', inputs: ['6'], expected: '12', code: 'number = int(input())\n\nresult = 0  # change this\nprint(result)' },
  { id: 4, title: 'Triple It', prompt: 'Triple the value.', inputs: ['5'], expected: '15', code: 'number = int(input())\n\nresult = 0  # change this\nprint(result)' },
  { id: 5, title: 'Quotient', prompt: 'Divide a by b.', inputs: ['20', '4'], expected: '5.0', code: 'a = int(input())\nb = int(input())\n\nresult = 0  # change this\nprint(result)' },
  { id: 6, title: 'Remainder', prompt: 'Find the remainder.', inputs: ['17', '5'], expected: '2', code: 'a = int(input())\nb = int(input())\n\nresult = 0  # use %\nprint(result)' },
  { id: 7, title: 'Celsius → Fahrenheit', prompt: 'Use C × 9 / 5 + 32.', inputs: ['20'], expected: '68.0', code: 'celsius = int(input())\n\nfahrenheit = 0  # change this\nprint(fahrenheit)' },
  { id: 8, title: 'Fuel Efficiency', prompt: 'Calculate distance / fuel.', inputs: ['300', '15'], expected: '20.0', code: 'distance = int(input())\nfuel = int(input())\n\nresult = 0  # change this\nprint(result)' },
  { id: 9, title: 'Taxi Fare', prompt: 'Base fare + distance × rate.', inputs: ['4', '10', '2'], expected: '24', code: 'base = int(input())\ndistance = int(input())\nrate = int(input())\n\nfare = 0  # change this\nprint(fare)' },
  { id: 10, title: 'Three Scores', prompt: 'Calculate the average.', inputs: ['8', '9', '10'], expected: '9.0', code: 'a = int(input())\nb = int(input())\nc = int(input())\n\naverage = 0  # change this\nprint(average)' },
  { id: 11, title: 'Seconds', prompt: 'Print minutes, then seconds left.', inputs: ['125'], expected: '2\n5', code: 'seconds = int(input())\n\nminutes = 0  # use //\nleft = 0  # use %\nprint(minutes)\nprint(left)' },
  { id: 12, title: 'Weighted Score', prompt: '40% of a + 60% of b.', inputs: ['80', '90'], expected: '86.0', code: 'a = int(input())\nb = int(input())\n\nscore = 0  # change this\nprint(score)' },
  { id: 13, title: 'Square It', prompt: 'Use ** to square the value.', inputs: ['7'], expected: '49', code: 'number = int(input())\n\nresult = 0  # use **\nprint(result)' },
  { id: 14, title: 'Discount', prompt: 'Remove the percentage discount.', inputs: ['100', '20'], expected: '80.0', code: 'price = int(input())\ndiscount = int(input())\n\nfinal_price = 0  # change this\nprint(final_price)' },
  { id: 15, title: 'Your Formula', prompt: 'Create any input/output transformation.', inputs: ['7'], code: 'number = int(input())\n\nresult = number * 2  # make it yours\nprint(result)' },
]
