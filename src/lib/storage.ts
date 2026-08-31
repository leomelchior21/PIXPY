import { starterCode, starterConfig } from '../data/dinoLab'
import type { DinoConfig, StudentProfile } from '../types'

const PROFILE_KEY = 'pixpy.profile.v1'
const CODE_KEY = 'pixpy.dino.code.v1'
const CONFIG_KEY = 'pixpy.dino.config.v1'

export function loadProfile(): StudentProfile | null {
  try {
    const value = localStorage.getItem(PROFILE_KEY)
    return value ? (JSON.parse(value) as StudentProfile) : null
  } catch {
    return null
  }
}

export function saveProfile(profile: StudentProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function clearProfile(): void {
  localStorage.removeItem(PROFILE_KEY)
}

export function loadDinoCode(): string {
  return localStorage.getItem(CODE_KEY) ?? starterCode
}

export function saveDinoCode(code: string): void {
  localStorage.setItem(CODE_KEY, code)
}

export function loadDinoConfig(): DinoConfig {
  try {
    const value = localStorage.getItem(CONFIG_KEY)
    return value ? { ...starterConfig, ...(JSON.parse(value) as DinoConfig) } : starterConfig
  } catch {
    return starterConfig
  }
}

export function saveDinoConfig(config: DinoConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

export function resetDinoStorage(): void {
  localStorage.removeItem(CODE_KEY)
  localStorage.removeItem(CONFIG_KEY)
}
