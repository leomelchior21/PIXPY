import { BrainCircuit, DoorOpen, GitBranch, Split, Swords, Wrench } from 'lucide-react'
import type { ActivityId, AppRoute, SessionProgress } from '../types'

export interface ConditionExperience {
  id: ActivityId
  order: string
  title: string
  description: string
  color: string
  icon: typeof GitBranch
  disabled?: boolean
}

/** Parked for now: the code stays, but nobody sees these cards and their routes go back to Conditions. */
const hiddenActivities: ActivityId[] = ['more-than-one-choice']

const allConditionExperiences: ConditionExperience[] = [
  { id: 'backroom-run', order: '01', title: 'BACKROOM RUN', description: 'Make the condition true. Open the gate.', color: '#15171c', icon: DoorOpen },
  { id: 'choice-machine', order: '02', title: 'HOW THE COMPUTER MAKES A CHOICE', description: 'Follow a condition and predict the path.', color: '#b9f352', icon: BrainCircuit },
  { id: 'if-else', order: '03', title: 'IF/ELSE', description: 'Predict, build, and debug ten decisions.', color: '#72dcff', icon: GitBranch },
  { id: 'make-it-work', order: '04', title: 'REPAIR SHOP', description: 'Watch the customer, find the broken line, and rebuild it.', color: '#ffcb47', icon: Wrench },
  { id: 'more-than-one-choice', order: '—', title: 'MORE THAN ONE CHOICE?', description: 'Drop values through decisions with three paths.', color: '#a994ff', icon: Split },
  { id: 'conditions-final-bosses', order: '05', title: 'Final Bosses', description: 'Write real decisions that survive every test.', color: '#ff855e', icon: Swords },
]

/** The cards on screen, numbered in the order they appear. */
export const conditionExperiences: ConditionExperience[] = allConditionExperiences
  .filter((item) => !hiddenActivities.includes(item.id))
  .map((item, index) => ({ ...item, order: String(index + 1).padStart(2, '0') }))

/** Closed to students until the teacher opens them. Teachers can always preview. */
const lockedForStudents: ActivityId[] = []

/** Activities that open once another one is complete. */
const unlockedBy: Partial<Record<ActivityId, ActivityId>> = {
  'more-than-one-choice': 'make-it-work',
  'conditions-final-bosses': 'make-it-work',
}

export type ConditionLock = 'open' | 'soon' | 'locked'

/** Whether this student can open an activity: open, coming soon, or waiting on an earlier activity. */
export function conditionLock(id: ActivityId, progress: Pick<SessionProgress, 'isTeacher' | 'completed'> | null): ConditionLock {
  if (hiddenActivities.includes(id)) return 'soon'
  const experience = conditionExperiences.find((item) => item.id === id)
  if (!experience) return 'open'
  if (experience.disabled) return 'soon'
  if (progress?.isTeacher) return 'open'
  if (lockedForStudents.includes(id)) return 'soon'
  const needs = unlockedBy[id]
  return needs && !progress?.completed.includes(needs) ? 'locked' : 'open'
}

/** The activity that has to be finished first, for the "finish … first" message. */
export function conditionPrerequisite(id: ActivityId): ConditionExperience | null {
  const needs = unlockedBy[id]
  return needs ? conditionExperiences.find((item) => item.id === needs) ?? null : null
}

export function isConditionActivity(route: AppRoute): route is ActivityId {
  return allConditionExperiences.some((item) => item.id === route)
}
