import { starterValues, valuesToConfig } from '../data/dinoLab'
import type { DinoRunResult, DinoValues } from '../types'

const safeRanges: Record<keyof DinoValues, [number, number]> = {
  speed: [1, 50],
  jump: [1, 120],
  gravity: [0, 30],
  obstacles: [0, 18],
  player_size: [16, 120],
}

export function validateDinoValues(raw: Partial<Record<keyof DinoValues, unknown>>): DinoRunResult {
  const values = { ...starterValues }
  const safeValues = { ...starterValues }
  const warnings: string[] = []

  for (const key of Object.keys(starterValues) as Array<keyof DinoValues>) {
    const value = raw[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${key} needs a real number.`)
    values[key] = value
    const [min, max] = safeRanges[key]
    const clamped = Math.min(max, Math.max(min, value))
    safeValues[key] = clamped
    if (value !== clamped) warnings.push(reactionForClamp(key, value, clamped))
  }

  safeValues.obstacles = Math.round(safeValues.obstacles)
  return { values, config: valuesToConfig(safeValues), warnings }
}

function reactionForClamp(key: keyof DinoValues, requested: number, clamped: number): string {
  if (key === 'player_size' && requested > clamped) return 'THAT IS TOO MUCH DINO. PixPy kept the lab standing.'
  if (key === 'obstacles' && requested > clamped) return 'OBSTACLE APOCALYPSE PREVENTED. The lab capped it safely.'
  return `${key} was safely capped at ${clamped}. The experiment still ran.`
}
