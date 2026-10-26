import type { ComparisonOperator, SkillKey } from './backroomEngine'
import { normalizeStars, type CoachMoment } from './backroomLevels'

export type SkillRecord = Partial<Record<SkillKey, { right: number; wrong: number }>>

export interface BackroomProgress {
  username: string
  name: string
  isTeacher: boolean
  // Every tape open at once: the teacher preview. Teachers otherwise follow the tape order too.
  unlockAll?: boolean
  // Best gate count in one Endless run.
  backroomRunBest: number
  // Best XP earned in one run of any mode.
  backroomRunXp: number
  // Every gate ever cleared.
  backroomRunGates: number
  backroomRunOperators: ComparisonOperator[]
  // Stars per tape, 0 when the tape has not been cleared yet.
  levelStars: number[]
  skills: SkillRecord
  // Guided pauses already shown; they never repeat, even after losing a tape.
  coachSeen: CoachMoment[]
}

export function createBackroomProgress(name: string, username = name.toLowerCase(), isTeacher = false): BackroomProgress {
  return { name, username, isTeacher, backroomRunBest: 0, backroomRunXp: 0, backroomRunGates: 0, backroomRunOperators: [], levelStars: normalizeStars([]), skills: {}, coachSeen: [] }
}
