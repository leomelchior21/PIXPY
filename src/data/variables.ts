import { Box, BrainCircuit, Gamepad2, Keyboard, MessageSquareText, Printer, Trophy } from 'lucide-react'
import type { ActivityId } from '../types'

export interface VariableExperience {
  id: ActivityId
  order: string
  title: string
  shortTitle: string
  question: string
  description: string
  color: string
  icon: typeof Gamepad2
}

export const variableExperiences: VariableExperience[] = [
  { id: 'dino-variables', order: '01', title: 'Dino Variables', shortTitle: 'Dino Lab', question: 'What happens when a value changes?', description: 'Values can change things.', color: '#b9f352', icon: Gamepad2 },
  { id: 'print-playground', order: '02', title: 'Print Playground', shortTitle: 'Print', question: 'How can Python put something on screen?', description: 'Python can output values.', color: '#ffcb47', icon: Printer },
  { id: 'black-box', order: '03', title: 'Black Box', shortTitle: 'Black Box', question: 'How can a value go through a calculation?', description: 'Values can be transformed.', color: '#fe6f8f', icon: Box },
  { id: 'input-machine', order: '04', title: 'Input Machine', shortTitle: 'Input', question: 'How can a program receive something from me?', description: 'Values can enter the program.', color: '#72dcff', icon: Keyboard },
  { id: 'memory-machine', order: '05', title: 'Memory Machine', shortTitle: 'Memory', question: "Where does a variable's value go?", description: 'Variables remember those values.', color: '#a994ff', icon: BrainCircuit },
  { id: 'build-black-box', order: '06', title: 'Build a Black Box', shortTitle: 'Build', question: 'Can I make my own transformation?', description: 'Now combine everything.', color: '#54e3bd', icon: MessageSquareText },
  { id: 'final-bosses', order: '07', title: 'Final Bosses', shortTitle: 'Bosses', question: 'Can you use what you discovered?', description: 'Prove you can use it.', color: '#ff855e', icon: Trophy },
]

export function getExperience(id: ActivityId) {
  return variableExperiences.find((experience) => experience.id === id) ?? variableExperiences[0]
}
