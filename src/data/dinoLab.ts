import type { DinoConfig, Mission } from '../types'

export const starterCode = `player_speed = 6
jump_power = 12
gravity = 8
obstacle_speed = 5
obstacle_count = 3
player_size = 42
lives = 3`

export const starterConfig: DinoConfig = {
  player_speed: 6,
  jump_power: 12,
  gravity: 8,
  obstacle_speed: 5,
  obstacle_count: 3,
  player_size: 42,
  lives: 3,
}

export const dinoMissions: Mission[] = [
  {
    id: 'super-speed',
    number: '01',
    title: 'Basics',
    instruction: 'Change player_speed and make the runner move faster.',
    reward: 80,
    check: (config) => config.player_speed >= 10,
  },
  {
    id: 'moon-mode',
    number: '02',
    title: 'Jump Higher',
    instruction: 'Raise jump_power to clear taller spikes.',
    reward: 90,
    check: (config) => config.jump_power >= 20,
  },
  {
    id: 'giant-mode',
    number: '03',
    title: 'Moving Hazards',
    instruction: 'Make obstacles move faster.',
    reward: 100,
    check: (config) => config.obstacle_speed >= 10,
  },
  {
    id: 'chaos-mode',
    number: '04',
    title: 'Chaos Mode',
    instruction: 'Fill the track with obstacles.',
    reward: 110,
    check: (config) => config.obstacle_count >= 10,
  },
  {
    id: 'survivor-mode',
    number: '05',
    title: 'Final Boss',
    instruction: 'Give yourself enough lives for the final run.',
    reward: 120,
    check: (config) => config.lives >= 20,
  },
]

export const dinoHints = [
  'Which value controls how strongly the runner is pulled back to the ground?',
  'Look at the line that starts with gravity.',
  'Try changing gravity = 8 to a number below 4, then run the code.',
]

export const configKeys = Object.keys(starterConfig) as Array<keyof DinoConfig>
