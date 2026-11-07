/**
 * Lab experimental condition presets.
 * Ecology ignores these; Human Behavior Lab uses them to reconfigure
 * chamber gates, food pressure, and drive/survival scales.
 */

import {
  LAB_CONDITIONS,
  type LabCondition,
  type WorldConfig,
} from '../types/world'

export type { LabCondition }
export { LAB_CONDITIONS }

export const DEFAULT_LAB_CONDITION: LabCondition = 'baseline'

export const LAB_CONDITION_LABELS: Record<LabCondition, string> = {
  baseline: 'Baseline',
  food_scarce: 'Food scarce',
  rest_locked: 'Rest locked',
  curiosity_prime: 'Curiosity prime',
  tradeoff_hard: 'Tradeoff hard',
}

export interface LabConditionEffects {
  /** Multiplies configured Lab food target. */
  foodCountMult: number
  /** Multiplies food regen rate while in Lab. */
  foodRegenMult: number
  /** Rest-chamber door starts closed (switch required). */
  restDoorStartsClosed: boolean
  /** Extra multipliers on curriculum drive/hunger rates. */
  hungerGainMult: number
  fatigueGainMult: number
  curiosityGainMult: number
  comfortDecayMult: number
  /** Scales drive-relief rewards (rest/lookout). */
  driveRewardMult: number
  /** Scales survival eat / seek rewards. */
  survivalRewardMult: number
}

export function isLabCondition(value: unknown): value is LabCondition {
  return typeof value === 'string' && (LAB_CONDITIONS as readonly string[]).includes(value)
}

export function clampLabCondition(value: unknown): LabCondition {
  return isLabCondition(value) ? value : DEFAULT_LAB_CONDITION
}

export function labConditionEffects(condition: LabCondition): LabConditionEffects {
  switch (condition) {
    case 'food_scarce':
      return {
        foodCountMult: 0.28,
        foodRegenMult: 0.35,
        restDoorStartsClosed: false,
        hungerGainMult: 1.35,
        fatigueGainMult: 0.9,
        curiosityGainMult: 0.9,
        comfortDecayMult: 0.9,
        driveRewardMult: 1,
        survivalRewardMult: 1.25,
      }
    case 'rest_locked':
      return {
        foodCountMult: 1,
        foodRegenMult: 1,
        restDoorStartsClosed: true,
        hungerGainMult: 1,
        fatigueGainMult: 1.25,
        curiosityGainMult: 1,
        comfortDecayMult: 1.2,
        driveRewardMult: 1.15,
        survivalRewardMult: 1,
      }
    case 'curiosity_prime':
      return {
        foodCountMult: 1,
        foodRegenMult: 1,
        restDoorStartsClosed: false,
        hungerGainMult: 0.85,
        fatigueGainMult: 0.85,
        curiosityGainMult: 1.8,
        comfortDecayMult: 0.9,
        driveRewardMult: 1.45,
        survivalRewardMult: 0.85,
      }
    case 'tradeoff_hard':
      return {
        foodCountMult: 0.55,
        foodRegenMult: 0.65,
        restDoorStartsClosed: true,
        hungerGainMult: 1.55,
        fatigueGainMult: 1.45,
        curiosityGainMult: 1.45,
        comfortDecayMult: 1.35,
        driveRewardMult: 1.2,
        survivalRewardMult: 1.2,
      }
    case 'baseline':
    default:
      return {
        foodCountMult: 1,
        foodRegenMult: 1,
        restDoorStartsClosed: false,
        hungerGainMult: 1,
        fatigueGainMult: 1,
        curiosityGainMult: 1,
        comfortDecayMult: 1,
        driveRewardMult: 1,
        survivalRewardMult: 1,
      }
  }
}

export function labConditionFromConfig(config: Pick<WorldConfig, 'labCondition'>): LabCondition {
  return clampLabCondition(config.labCondition)
}

export function effectsFromWorldConfig(config: Pick<WorldConfig, 'labCondition'>): LabConditionEffects {
  return labConditionEffects(labConditionFromConfig(config))
}
