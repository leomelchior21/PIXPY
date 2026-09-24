import { BrainCircuit, GitBranch, ListChecks, ShieldQuestion, Trophy } from 'lucide-react'
import type { ActivityId, AppRoute } from '../types'

export interface ConditionChallenge {
  prompt: string
  code: string
  options: string[]
  answer: number
  explanation: string
}

export interface ConditionExperience {
  id: ActivityId
  order: string
  title: string
  description: string
  color: string
  icon: typeof GitBranch
  challenges: ConditionChallenge[]
}

export const conditionExperiences: ConditionExperience[] = [
  {
    id: 'choice-machine', order: '01', title: 'HOW THE COMPUTER MAKES A CHOICE', description: 'Follow a condition and predict the path.', color: '#b9f352', icon: BrainCircuit,
    challenges: [],
  },
  {
    id: 'if-else', order: '02', title: 'IF/ELSE', description: 'Give Python two possible paths.', color: '#72dcff', icon: GitBranch,
    challenges: [
      { prompt: 'Which path runs?', code: 'age = 10\nif age >= 12:\n    print("Big ride")\nelse:\n    print("Small ride")', options: ['Big ride', 'Small ride', 'Both'], answer: 1, explanation: '10 is below 12, so the else path runs.' },
      { prompt: 'What belongs after if?', code: 'if temperature > 30:\n    print("Hot")\n____:\n    print("Cool")', options: ['if', 'else', 'print'], answer: 1, explanation: 'else: gives a path when the if condition is false.' },
      { prompt: 'What prints?', code: 'ready = True\nif ready:\n    print("Go")\nelse:\n    print("Wait")', options: ['Go', 'Wait', 'Nothing'], answer: 0, explanation: 'ready is True, so Python chooses the if path.' },
    ],
  },
  {
    id: 'make-it-work', order: '03', title: 'MAKE IT WORK', description: 'Repair a decision by choosing the missing code.', color: '#ffcb47', icon: ListChecks,
    challenges: [
      { prompt: 'Fill the blank to print WIN for a score of 10 or more.', code: 'score = 12\nif score ____ 10:\n    print("WIN")', options: ['>=', '<', '=='], answer: 0, explanation: '>= means greater than or equal to.' },
      { prompt: 'Fill the blank so the second path can run.', code: 'if lives > 0:\n    print("Play")\n____:\n    print("Game over")', options: ['else', 'if', 'True'], answer: 0, explanation: 'else: handles every case where the if condition is false.' },
      { prompt: 'Choose the line that checks a secret code.', code: 'secret = 7\n____:\n    print("Unlocked")', options: ['if secret = 7', 'if secret == 7', 'else secret == 7'], answer: 1, explanation: 'Use == to compare values inside an if statement.' },
    ],
  },
  {
    id: 'more-than-one-choice', order: '04', title: 'MORE THAN ONE CHOICE?', description: 'Use elif to choose among several paths.', color: '#a994ff', icon: ShieldQuestion,
    challenges: [
      { prompt: 'Which message appears?', code: 'score = 7\nif score >= 10:\n    print("Gold")\nelif score >= 5:\n    print("Silver")\nelse:\n    print("Bronze")', options: ['Gold', 'Silver', 'Bronze'], answer: 1, explanation: 'The first condition is false. The elif condition is true, so Silver prints.' },
      { prompt: 'Which keyword adds another condition?', code: 'if color == "red":\n    print("Stop")\n____ color == "yellow":\n    print("Slow")', options: ['else', 'elif', 'then'], answer: 1, explanation: 'elif checks a new condition after an if.' },
      { prompt: 'How many messages print?', code: 'x = 2\nif x > 3:\n    print("A")\nelif x > 1:\n    print("B")\nelse:\n    print("C")', options: ['One', 'Two', 'Three'], answer: 0, explanation: 'An if/elif/else chain chooses just one path.' },
    ],
  },
  {
    id: 'conditions-final-bosses', order: '05', title: 'Final Bosses', description: 'Put your decision skills to the test.', color: '#ff855e', icon: Trophy,
    challenges: [
      { prompt: 'A player has no lives. What prints?', code: 'lives = 0\nif lives > 0:\n    print("Continue")\nelse:\n    print("Game over")', options: ['Continue', 'Game over', 'Nothing'], answer: 1, explanation: '0 is not greater than 0, so the else path runs.' },
      { prompt: 'Pick the condition that unlocks the gate only at level 5.', code: 'level = 5\nif ____:\n    print("Unlocked")', options: ['level = 5', 'level == 5', 'level > 5'], answer: 1, explanation: '== checks for an exact match.' },
      { prompt: 'Which badge does this player earn?', code: 'points = 15\nif points >= 20:\n    badge = "Star"\nelif points >= 10:\n    badge = "Moon"\nelse:\n    badge = "Cloud"\nprint(badge)', options: ['Star', 'Moon', 'Cloud'], answer: 1, explanation: '15 does not reach 20, but it reaches 10. The Moon badge is chosen.' },
    ],
  },
]

export function isConditionActivity(route: AppRoute): route is ActivityId {
  return conditionExperiences.some((item) => item.id === route)
}
