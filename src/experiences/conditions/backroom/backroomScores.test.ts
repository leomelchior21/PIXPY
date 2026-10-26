import { describe, expect, it, beforeEach, vi } from "vitest";
import { createBackroomProgress as createSession } from './types'
import { playerKey, rankBackroomScores, rememberBackroomScore } from './backroomScores'

vi.mock('../../../lib/classroomCloud', () => ({ fetchBackroomScores: () => Promise.reject(new Error('offline')) }))

describe('backroom top scores', () => {
  beforeEach(() => localStorage.clear())

  it('ranks by best gate, breaks ties with XP, and merges a student’s saved scores', () => {
    expect(rankBackroomScores([
      { username: 'maya', name: 'Maya', gates: 5, xp: 80 },
      { username: 'leo', name: 'Leo', gates: 7, xp: 70 },
      { username: 'nia', name: 'Nia', gates: 5, xp: 100 },
      { username: 'maya', name: 'Maya', gates: 3, xp: 110 },
    ])).toEqual([
      { username: 'leo', name: 'Leo', gates: 7, xp: 70 },
      { username: 'maya', name: 'Maya', gates: 5, xp: 110 },
      { username: 'nia', name: 'Nia', gates: 5, xp: 100 },
    ])
  })

  it('keeps scores after a new session and ignores corrupt device data', () => {
    rememberBackroomScore({ ...createSession('Maya'), backroomRunBest: 5, backroomRunXp: 75 })
    const scores = rememberBackroomScore(createSession('Leo'))
    expect(scores).toHaveLength(1)
    expect(scores[0].name).toBe('Maya')
    localStorage.setItem('pixpy.backroom-scores.v1', '{broken')
    expect(rememberBackroomScore(createSession('Leo'))).toEqual([])
  })

  it('records each guest under the name they typed, from that run alone', () => {
    const guest = { ...createSession('Guest'), backroomRunBest: 30, backroomRunXp: 400 }
    expect(rememberBackroomScore(guest)).toEqual([])
    rememberBackroomScore(guest, { username: playerKey('Maya Lima'), name: 'Maya Lima', gates: 6, xp: 90 })
    const scores = rememberBackroomScore(guest, { username: playerKey('Léo Souza'), name: 'Léo Souza', gates: 9, xp: 120 })
    expect(scores.map((score) => [score.name, score.gates])).toEqual([['Léo Souza', 9], ['Maya Lima', 6]])
    expect(playerKey(' Léo  Souza ')).toBe('player:leosouza')
  })
})
