import { fetchBackroomScores } from '../../../lib/classroomCloud'
import type { BackroomProgress } from './types'

export interface BackroomScore {
  username: string
  name: string
  gates: number
  xp: number
}

const storageKey = 'pixpy.backroom-scores.v1'

// The class ranking every student sees.
export const boardSize = 20

export function rankBackroomScores(scores: BackroomScore[], limit = boardSize): BackroomScore[] {
  const best = new Map<string, BackroomScore>()
  for (const score of scores) {
    if (!score || typeof score.username !== 'string' || !score.username || typeof score.name !== 'string' || !score.name || !Number.isSafeInteger(score.gates) || score.gates < 1 || !Number.isSafeInteger(score.xp) || score.xp < 0) continue
    const previous = best.get(score.username)
    best.set(score.username, previous ? { ...score, gates: Math.max(previous.gates, score.gates), xp: Math.max(previous.xp, score.xp) } : score)
  }
  return [...best.values()].sort((a, b) => b.gates - a.gates || b.xp - a.xp || a.name.localeCompare(b.name)).slice(0, limit)
}

// Guests share one profile on a device, so each one types a name and their own
// runs in The Deep are recorded under it.
export function isGuestName(name: string): boolean {
  const trimmed = name.trim().toLowerCase()
  return !trimmed || trimmed === 'guest'
}

export function playerKey(name: string): string {
  return `player:${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')}`
}

function storedScores(): BackroomScore[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (Array.isArray(data)) return data.filter((row): row is BackroomScore => !!row && typeof row === 'object' && typeof row.username === 'string' && typeof row.name === 'string')
  } catch { /* Scores still work when device storage is unavailable. */ }
  return []
}

// With an entry, records that run; without one, records the profile's best (none for guests or teachers).
export function rememberBackroomScore(progress: BackroomProgress, entry?: BackroomScore): BackroomScore[] {
  const stored = storedScores()
  if (progress.isTeacher) return rankBackroomScores(stored)
  const score = entry ?? (isGuestName(progress.name) ? null : { username: progress.username, name: progress.name, gates: progress.backroomRunBest, xp: progress.backroomRunXp })
  if (!score) return rankBackroomScores(stored)
  const scores = rankBackroomScores([...stored, score])
  try { localStorage.setItem(storageKey, JSON.stringify(scores)) } catch { /* Storage is optional. */ }
  return scores
}

// Device scores right away, then the class board merged in when it answers. Students'
// best runs reach the class board with their saved progress, so nothing is sent from here.
export function loadBackroomScores(local: BackroomScore[], onScores: (scores: BackroomScore[]) => void): void {
  onScores(local)
  void fetchBackroomScores()
    .then((remote) => { if (remote.length) onScores(rankBackroomScores([...local, ...remote as BackroomScore[]])) })
    .catch(() => { /* Offline: the device scores stay on screen. */ })
}
