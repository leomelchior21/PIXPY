import type { DinoConfig, Mission } from '../types'

export const starterCode = `player_speed = 6
jump_power = 12
gravity = 8
obstacle_speed = 5
obstacle_count = 3
player_size = 32
lives = 3`

export const starterConfig: DinoConfig = {
  player_speed: 6,
  jump_power: 12,
  gravity: 8,
  obstacle_speed: 5,
  obstacle_count: 3,
  player_size: 32,
  lives: 3,
}

export const dinoMissions: Mission[] = [
  {
    id: 'super-speed',
    number: '01',
    title: 'Super Speed',
    instruction: 'Make your runner seriously fast.',
    reward: 80,
    check: (config) => config.player_speed >= 15,
  },
  {
    id: 'moon-mode',
    number: '02',
    title: 'Moon Mode',
    instruction: 'Turn gravity down and float.',
    reward: 90,
    check: (config) => config.gravity <= 3,
  },
  {
    id: 'giant-mode',
    number: '03',
    title: 'Giant Mode',
    instruction: 'Make the runner impossible to miss.',
    reward: 100,
    check: (config) => config.player_size >= 80,
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
    title: 'Survivor Mode',
    instruction: 'Give yourself a ridiculous number of lives.',
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
