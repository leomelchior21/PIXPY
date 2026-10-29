import { BrainCircuit, DoorOpen, GitBranch, Split, Swords, Wrench } from 'lucide-react'
import type { ActivityId, AppRoute } from '../types'

export interface ConditionExperience {
  id: ActivityId
  order: string
  title: string
  description: string
  color: string
  icon: typeof GitBranch
  disabled?: boolean
}

export const conditionExperiences: ConditionExperience[] = [
  { id: 'backroom-run', order: '01', title: 'BACKROOM RUN', description: 'Make the condition true. Open the gate.', color: '#15171c', icon: DoorOpen },
  { id: 'choice-machine', order: '02', title: 'HOW THE COMPUTER MAKES A CHOICE', description: 'Follow a condition and predict the path.', color: '#b9f352', icon: BrainCircuit },
  { id: 'if-else', order: '03', title: 'IF/ELSE', description: 'Predict, build, and debug ten decisions.', color: '#72dcff', icon: GitBranch },
  { id: 'make-it-work', order: '04', title: 'REPAIR SHOP', description: 'Reproduce, find, and fix the bugs in eight broken machines.', color: '#ffcb47', icon: Wrench },
  { id: 'more-than-one-choice', order: '05', title: 'MORE THAN ONE CHOICE?', description: 'Drop values through decisions with three paths.', color: '#a994ff', icon: Split },
  { id: 'conditions-final-bosses', order: '06', title: 'Final Bosses', description: 'Write real decisions that survive every test.', color: '#ff855e', icon: Swords },
]

export function isConditionActivity(route: AppRoute): route is ActivityId {
  return conditionExperiences.some((item) => item.id === route)
}
