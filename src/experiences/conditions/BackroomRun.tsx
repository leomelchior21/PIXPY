import { completeActivity } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { BackroomRun as BackroomGame } from './backroom/BackroomRun'
import { comparisonOperators, type ComparisonOperator } from './backroom/backroomEngine'
import { coachMoments, endlessUnlocked, normalizeStars } from './backroom/backroomLevels'
import type { BackroomProgress } from './backroom/types'

interface Props {
  progress: SessionProgress
  onProgress: (progress: SessionProgress) => void
  onBack: () => void
}

// The complete game lives in ./backroom, shared with Sharpie. This adapter only maps
// PixPy's session onto it; clearing every tape completes the activity.
export function BackroomRun({ progress, onProgress, onBack }: Props) {
  const gameProgress: BackroomProgress = {
    username: progress.username,
    name: progress.name,
    isTeacher: progress.isTeacher,
    backroomRunBest: progress.backroomRunBest,
    backroomRunXp: progress.backroomRunXp,
    backroomRunGates: progress.backroomRunGates,
    backroomRunOperators: comparisonOperators.filter((operator) => progress.backroomRunOperators.includes(operator)),
    levelStars: normalizeStars(progress.backroomLevelStars),
    skills: progress.backroomSkills,
    coachSeen: coachMoments.filter((moment) => progress.backroomCoachSeen.includes(moment)),
  }
  const save = (next: BackroomProgress) => {
    const saved: SessionProgress = {
      ...progress,
      backroomRunBest: next.backroomRunBest,
      backroomRunXp: next.backroomRunXp,
      backroomRunGates: next.backroomRunGates,
      backroomRunOperators: next.backroomRunOperators satisfies ComparisonOperator[],
      backroomLevelStars: next.levelStars,
      backroomSkills: next.skills,
      backroomCoachSeen: next.coachSeen,
    }
    onProgress(endlessUnlocked(next.levelStars, false) ? completeActivity(saved, 'backroom-run') : saved)
  }
  return <BackroomGame progress={gameProgress} onProgress={save} onBack={onBack} />
}
