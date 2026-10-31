import { clamp } from '../utils/math'
import type { LearningConfig, RewardConfig } from './types'

export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  learningRate: 0.1,
  discountFactor: 0.95,
  initialEpsilon: 1.0,
  minEpsilon: 0.05,
  epsilonDecay: 0.999,
}

export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  eatSuccess: 10,
  wastedEnergy: -1,
  collision: -2,
  death: -20,
  efficientRest: 0.4,
}

export const LEARNING_CONFIG_RANGES = {
  learningRate: { min: 0.01, max: 0.5 },
  discountFactor: { min: 0.5, max: 0.999 },
  initialEpsilon: { min: 0.05, max: 1 },
  minEpsilon: { min: 0.01, max: 0.5 },
  epsilonDecay: { min: 0.99, max: 0.9999 },
} as const

export const REWARD_CONFIG_RANGES = {
  eatSuccess: { min: 0, max: 50 },
  wastedEnergy: { min: -10, max: 0 },
  collision: { min: -20, max: 0 },
  death: { min: -50, max: 0 },
  efficientRest: { min: 0, max: 5 },
} as const

export const EPSILON_DECAY_OPTIONS = [0.995, 0.999, 0.9995] as const

export function clampLearningConfig(config: LearningConfig): LearningConfig {
  const initialEpsilon = clamp(
    config.initialEpsilon,
    LEARNING_CONFIG_RANGES.initialEpsilon.min,
    LEARNING_CONFIG_RANGES.initialEpsilon.max,
  )
  const minEpsilon = clamp(
    config.minEpsilon,
    LEARNING_CONFIG_RANGES.minEpsilon.min,
    Math.min(LEARNING_CONFIG_RANGES.minEpsilon.max, initialEpsilon),
  )

  return {
    learningRate: clamp(
      config.learningRate,
      LEARNING_CONFIG_RANGES.learningRate.min,
      LEARNING_CONFIG_RANGES.learningRate.max,
    ),
    discountFactor: clamp(
      config.discountFactor,
      LEARNING_CONFIG_RANGES.discountFactor.min,
      LEARNING_CONFIG_RANGES.discountFactor.max,
    ),
    initialEpsilon,
    minEpsilon,
    epsilonDecay: clamp(
      config.epsilonDecay,
      LEARNING_CONFIG_RANGES.epsilonDecay.min,
      LEARNING_CONFIG_RANGES.epsilonDecay.max,
    ),
  }
}

export function clampRewardConfig(config: RewardConfig): RewardConfig {
  return {
    eatSuccess: clamp(
      config.eatSuccess,
      REWARD_CONFIG_RANGES.eatSuccess.min,
      REWARD_CONFIG_RANGES.eatSuccess.max,
    ),
    wastedEnergy: clamp(
      config.wastedEnergy,
      REWARD_CONFIG_RANGES.wastedEnergy.min,
      REWARD_CONFIG_RANGES.wastedEnergy.max,
    ),
    collision: clamp(
      config.collision,
      REWARD_CONFIG_RANGES.collision.min,
      REWARD_CONFIG_RANGES.collision.max,
    ),
    death: clamp(config.death, REWARD_CONFIG_RANGES.death.min, REWARD_CONFIG_RANGES.death.max),
    efficientRest: clamp(
      config.efficientRest,
      REWARD_CONFIG_RANGES.efficientRest.min,
      REWARD_CONFIG_RANGES.efficientRest.max,
    ),
  }
}

// MOVE, TURN_LEFT, TURN_RIGHT, EAT, REST
export const EXPLORE_ACTION_WEIGHTS = [0.48, 0.16, 0.16, 0.1, 0.1] as const

export const STAT_BAND_LOW_MAX = 33
export const STAT_BAND_MID_MAX = 66
export const EFFICIENT_REST_ENERGY = 30
export const URGENT_HUNGER = 66

export const LEARNING_REWARD_WINDOW = 80
export const LEARNING_EXPLORE_WINDOW = 80

export const ACTION_LABELS = {
  MOVE_FORWARD: 'Forward',
  TURN_LEFT: 'Turn L',
  TURN_RIGHT: 'Turn R',
  EAT: 'Eat',
  REST: 'Rest',
} as const

export const ACTION_MARKS = {
  MOVE_FORWARD: 'F',
  TURN_LEFT: 'L',
  TURN_RIGHT: 'R',
  EAT: 'E',
  REST: 'S',
} as const

export const ACTION_COLORS = {
  MOVE_FORWARD: '#5aa0d6',
  TURN_LEFT: '#7b8cff',
  TURN_RIGHT: '#3d9b7a',
  EAT: '#c9a227',
  REST: '#8b97a8',
} as const

export const STATE_SPACE_SIZE = 3 * 3 * 5 * 4 * 2
