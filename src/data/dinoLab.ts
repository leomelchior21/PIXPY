import type { DinoConfig, DinoValues } from '../types'

export const starterValues: DinoValues = {
  speed: 6,
  jump: 12,
  gravity: 8,
  obstacles: 3,
  player_size: 42,
}

export const starterCode = formatDinoCode(starterValues)

export const starterConfig: DinoConfig = valuesToConfig(starterValues)

export const dinoHints = [
  'Move one slider and run the world.',
  'Try making gravity smaller or player_size bigger.',
  'Every slider writes a real Python variable for you.',
]

export function valuesToConfig(values: DinoValues): DinoConfig {
  return {
    player_speed: values.speed,
    jump_power: values.jump,
    gravity: values.gravity,
    obstacle_speed: Math.max(2, Math.min(20, values.speed * 0.8)),
    obstacle_count: values.obstacles,
    player_size: values.player_size,
    lives: 3,
  }
}

export function formatDinoCode(values: DinoValues): string {
  return [
    `speed = ${values.speed}`,
    `jump = ${values.jump}`,
    `gravity = ${values.gravity}`,
    `obstacles = ${values.obstacles}`,
    `player_size = ${values.player_size}`,
  ].join('\n')
}
