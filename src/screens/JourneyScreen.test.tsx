import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { dinoMissions } from '../data/dinoLab'
import type { StudentProfile } from '../types'
import { JourneyScreen } from './JourneyScreen'

const profile: StudentProfile = {
  id: 'journey-test',
  accessId: 'journeytest',
  displayName: 'Journey Test',
  avatarId: 'byte',
  xp: 170,
  completedMissions: ['super-speed', 'moon-mode'],
  badges: [],
  isTeacher: false,
  lastActiveAt: '2026-08-31T00:00:00.000Z',
}

describe('Journey slice progress', () => {
  it('shows five mode levels inside Slice 01 and keeps the challenge locked', () => {
    render(<JourneyScreen profile={profile} onNavigate={vi.fn()} />)

    expect(screen.getByRole('img', { name: /slice 1: 2 of 5 modes complete/i })).toBeInTheDocument()
    expect(screen.getByText('Complete all five modes to unlock.')).toBeInTheDocument()
  })

  it('unlocks Century Run after all five modes are complete', () => {
    render(
      <JourneyScreen
        profile={{ ...profile, completedMissions: dinoMissions.map((mission) => mission.id) }}
        onNavigate={vi.fn()}
      />,
    )

    expect(screen.getByText('Reach 100 points in the runner to complete Slice 01.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter final challenge/i })).toBeInTheDocument()
  })
})
