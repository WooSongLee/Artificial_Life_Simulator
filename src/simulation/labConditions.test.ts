import { describe, expect, it } from 'vitest'
import { DEFAULT_WORLD_CONFIG, getConfiguredFoodCount, getFoodSpawnInterval } from './constants'
import {
  clampLabCondition,
  effectsFromWorldConfig,
  labConditionEffects,
} from './labConditions'

describe('labConditions', () => {
  it('defaults unknown values to baseline', () => {
    expect(clampLabCondition(undefined)).toBe('baseline')
    expect(clampLabCondition('nope')).toBe('baseline')
    expect(clampLabCondition('rest_locked')).toBe('rest_locked')
  })

  it('locks rest gate only for rest_locked and tradeoff_hard', () => {
    expect(labConditionEffects('baseline').restDoorStartsClosed).toBe(false)
    expect(labConditionEffects('food_scarce').restDoorStartsClosed).toBe(false)
    expect(labConditionEffects('rest_locked').restDoorStartsClosed).toBe(true)
    expect(labConditionEffects('tradeoff_hard').restDoorStartsClosed).toBe(true)
  })

  it('reduces Lab food target under food_scarce without changing Ecology', () => {
    const labScarce = {
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab' as const,
      labCondition: 'food_scarce' as const,
      initialFoodCount: 40,
    }
    const ecology = {
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology' as const,
      labCondition: 'food_scarce' as const,
      initialFoodCount: 40,
    }
    expect(getConfiguredFoodCount(labScarce)).toBeLessThan(20)
    expect(getConfiguredFoodCount(ecology)).toBe(40)
    expect(getFoodSpawnInterval(labScarce)).toBeGreaterThan(getFoodSpawnInterval(ecology))
  })

  it('raises curiosity pressure under curiosity_prime', () => {
    const effects = effectsFromWorldConfig({ labCondition: 'curiosity_prime' })
    expect(effects.curiosityGainMult).toBeGreaterThan(1)
    expect(effects.driveRewardMult).toBeGreaterThan(1)
  })
})
