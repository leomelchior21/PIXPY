import { describe, expect, it } from 'vitest'
import { starterValues } from '../data/dinoLab'
import { validateDinoValues } from './dinoValidation'

describe('Dino Variables safety', () => {
  it('caps extreme values without removing the experiment', () => {
    const result = validateDinoValues({ ...starterValues, player_size: 999999, obstacles: 1000000 })
    expect(result.values.player_size).toBe(999999)
    expect(result.values.obstacles).toBe(1000000)
    expect(result.config.player_size).toBe(120)
    expect(result.config.obstacle_count).toBe(18)
    expect(result.warnings).toHaveLength(2)
  })

  it('rejects non-numeric configuration values', () => {
    expect(() => validateDinoValues({ ...starterValues, gravity: 'moon' })).toThrow('gravity needs a real number')
  })
})
