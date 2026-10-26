import { cleanup, render, screen } from '@testing-library/react'
import { createSession } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { BackroomRun } from './BackroomRun'
import type { BackroomProgress } from './backroom/types'

const game = vi.hoisted(() => ({ props: null as { progress: BackroomProgress; onProgress: (next: BackroomProgress) => void } | null }))
vi.mock('./backroom/BackroomRun', () => ({
  BackroomRun: (props: NonNullable<typeof game.props>) => { game.props = props; return <p>game</p> },
}))

describe('Backroom Run in PixPy', () => {
  afterEach(cleanup)

  it('hands the session to the game and saves what the game records', () => {
    const progress: SessionProgress = { ...createSession('Ada', 'adaa'), backroomRunBest: 7, backroomLevelStars: [3, 0, 0, 0], backroomCoachSeen: ['energy'] }
    const onProgress = vi.fn()
    render(<BackroomRun progress={progress} onProgress={onProgress} onBack={() => undefined} />)
    expect(screen.getByText('game')).toBeInTheDocument()
    expect(game.props!.progress).toMatchObject({ username: 'adaa', name: 'Ada', backroomRunBest: 7, levelStars: [3, 0, 0, 0], coachSeen: ['energy'] })

    game.props!.onProgress({ ...game.props!.progress, levelStars: [3, 2, 0, 0], skills: { '>': { right: 2, wrong: 1 } } })
    const saved = onProgress.mock.lastCall![0] as SessionProgress
    expect(saved).toMatchObject({ backroomLevelStars: [3, 2, 0, 0], backroomSkills: { '>': { right: 2, wrong: 1 } } })
    expect(saved.completed).not.toContain('backroom-run')
  })

  it('completes the activity once every tape is cleared', () => {
    const onProgress = vi.fn()
    render(<BackroomRun progress={createSession('Ada', 'adaa')} onProgress={onProgress} onBack={() => undefined} />)
    game.props!.onProgress({ ...game.props!.progress, levelStars: [3, 1, 2, 1] })
    expect((onProgress.mock.lastCall![0] as SessionProgress).completed).toContain('backroom-run')
  })
})
