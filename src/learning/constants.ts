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

export const EPSILON_DECAY_OPTIONS = [0.995, 0.999, 0.9995] as const

export const STAT_BAND_LOW_MAX = 33
export const STAT_BAND_MID_MAX = 66
export const FOOD_DISTANCE_CLOSE = 1.6
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

export const STATE_SPACE_SIZE = 3 * 3 * 5 * 4 * 2
