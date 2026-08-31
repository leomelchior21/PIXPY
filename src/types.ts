export type AppRoute = 'login' | 'avatar' | 'home' | 'journey' | 'ranking' | 'profile' | 'dino-lab' | 'teacher'

export interface Avatar {
  id: string
  name: string
  skin: string
  hair: string
  outfit: string
  accent: string
  accessory?: 'glasses' | 'headphones' | 'visor' | 'cap'
}

export interface StudentProfile {
  id: string
  accessId: string
  displayName: string
  avatarId: string | null
  xp: number
  completedMissions: string[]
  badges: string[]
  sessionToken?: string
  isTeacher: boolean
  lastActiveAt: string
}

export interface DinoConfig {
  player_speed: number
  jump_power: number
  gravity: number
  obstacle_speed: number
  obstacle_count: number
  player_size: number
  lives: number
}

export type DinoConfigKey = keyof DinoConfig

export interface Mission {
  id: string
  number: string
  title: string
  instruction: string
  reward: number
  check: (config: DinoConfig) => boolean
}

export interface PythonRunResult {
  config: DinoConfig
  warnings: string[]
}

export interface RankingEntry {
  rank: number
  displayName: string
  avatarId: string
  xp: number
  progress: number
  badges: number
  isCurrent?: boolean
}
