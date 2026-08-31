import { describe, expect, it } from 'vitest'
import { starterConfig } from '../data/dinoLab'
import { validateDinoConfig } from './dinoValidation'

describe('Dino Lab safety', () => {
  it('caps extreme values without removing the experiment', () => {
    const result = validateDinoConfig({
      ...starterConfig,
      player_size: 999999,
      obstacle_count: 1000000,
    })
    expect(result.config.player_size).toBe(120)
    expect(result.config.obstacle_count).toBe(18)
    expect(result.warnings).toHaveLength(2)
  })

  it('rejects non-numeric configuration values', () => {
    expect(() => validateDinoConfig({ ...starterConfig, gravity: 'moon' })).toThrow('gravity needs a real number')
  })
})
