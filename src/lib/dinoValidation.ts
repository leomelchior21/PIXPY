import { configKeys, starterConfig } from '../data/dinoLab'
import type { DinoConfig, PythonRunResult } from '../types'

const safeRanges: Record<keyof DinoConfig, [number, number]> = {
  player_speed: [1, 50],
  jump_power: [1, 120],
  gravity: [0, 30],
  obstacle_speed: [1, 40],
  obstacle_count: [0, 18],
  player_size: [16, 120],
  lives: [1, 30],
}

export function validateDinoConfig(raw: Partial<Record<keyof DinoConfig, unknown>>): PythonRunResult {
  const config = { ...starterConfig }
  const warnings: string[] = []

  for (const key of configKeys) {
    const value = raw[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${key} needs a real number.`)
    }
    const [min, max] = safeRanges[key]
    const clamped = Math.min(max, Math.max(min, value))
    config[key] = clamped
    if (value !== clamped) {
      warnings.push(`${key} was safely capped at ${clamped}. The lab survived!`)
    }
  }

  config.obstacle_count = Math.round(config.obstacle_count)
  config.lives = Math.round(config.lives)
  return { config, warnings }
}
