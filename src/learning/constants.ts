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
  gatherUnit: 2.5,
  pickupSuccess: 1,
  interactSuccess: 1.5,
  attackHitUnit: 0.3,
  attackMiss: -0.4,
  damageTakenUnit: -0.3,
  defendReduceUnit: 0.2,
  fleeSuccess: 0.7,
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
  gatherUnit: { min: 0, max: 10 },
  pickupSuccess: { min: 0, max: 10 },
  interactSuccess: { min: 0, max: 10 },
  attackHitUnit: { min: 0, max: 2 },
  attackMiss: { min: -5, max: 0 },
  damageTakenUnit: { min: -2, max: 0 },
  defendReduceUnit: { min: 0, max: 2 },
  fleeSuccess: { min: 0, max: 5 },
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
    gatherUnit: clamp(
      Number.isFinite(config.gatherUnit) ? config.gatherUnit : DEFAULT_REWARD_CONFIG.gatherUnit,
      REWARD_CONFIG_RANGES.gatherUnit.min,
      REWARD_CONFIG_RANGES.gatherUnit.max,
    ),
    pickupSuccess: clamp(
      Number.isFinite(config.pickupSuccess) ? config.pickupSuccess : DEFAULT_REWARD_CONFIG.pickupSuccess,
      REWARD_CONFIG_RANGES.pickupSuccess.min,
      REWARD_CONFIG_RANGES.pickupSuccess.max,
    ),
    interactSuccess: clamp(
      Number.isFinite(config.interactSuccess) ? config.interactSuccess : DEFAULT_REWARD_CONFIG.interactSuccess,
      REWARD_CONFIG_RANGES.interactSuccess.min,
      REWARD_CONFIG_RANGES.interactSuccess.max,
    ),
    attackHitUnit: clamp(
      Number.isFinite(config.attackHitUnit) ? config.attackHitUnit : DEFAULT_REWARD_CONFIG.attackHitUnit,
      REWARD_CONFIG_RANGES.attackHitUnit.min,
      REWARD_CONFIG_RANGES.attackHitUnit.max,
    ),
    attackMiss: clamp(
      Number.isFinite(config.attackMiss) ? config.attackMiss : DEFAULT_REWARD_CONFIG.attackMiss,
      REWARD_CONFIG_RANGES.attackMiss.min,
      REWARD_CONFIG_RANGES.attackMiss.max,
    ),
    damageTakenUnit: clamp(
      Number.isFinite(config.damageTakenUnit) ? config.damageTakenUnit : DEFAULT_REWARD_CONFIG.damageTakenUnit,
      REWARD_CONFIG_RANGES.damageTakenUnit.min,
      REWARD_CONFIG_RANGES.damageTakenUnit.max,
    ),
    defendReduceUnit: clamp(
      Number.isFinite(config.defendReduceUnit) ? config.defendReduceUnit : DEFAULT_REWARD_CONFIG.defendReduceUnit,
      REWARD_CONFIG_RANGES.defendReduceUnit.min,
      REWARD_CONFIG_RANGES.defendReduceUnit.max,
    ),
    fleeSuccess: clamp(
      Number.isFinite(config.fleeSuccess) ? config.fleeSuccess : DEFAULT_REWARD_CONFIG.fleeSuccess,
      REWARD_CONFIG_RANGES.fleeSuccess.min,
      REWARD_CONFIG_RANGES.fleeSuccess.max,
    ),
  }
}

// MOVE, TURN_LEFT, TURN_RIGHT, EAT, REST, PICK_UP, GATHER, ATTACK, DEFEND, FLEE
export const EXPLORE_ACTION_WEIGHTS = [0.4, 0.12, 0.12, 0.08, 0.08, 0.1, 0.1, 0.08, 0.05, 0.05] as const

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
  PICK_UP: 'Pick up',
  GATHER: 'Gather',
  ATTACK: 'Attack',
  DEFEND: 'Defend',
  FLEE: 'Flee',
} as const

export const ACTION_MARKS = {
  MOVE_FORWARD: 'F',
  TURN_LEFT: 'L',
  TURN_RIGHT: 'R',
  EAT: 'E',
  REST: 'S',
  PICK_UP: 'P',
  GATHER: 'G',
  ATTACK: 'A',
  DEFEND: 'D',
  FLEE: 'X',
} as const

export const ACTION_COLORS = {
  MOVE_FORWARD: '#5aa0d6',
  TURN_LEFT: '#7b8cff',
  TURN_RIGHT: '#3d9b7a',
  EAT: '#c9a227',
  REST: '#8b97a8',
  PICK_UP: '#c47a3d',
  GATHER: '#6aa84e',
  ATTACK: '#c45c4a',
  DEFEND: '#5aa0d6',
  FLEE: '#c9a227',
} as const

export const DECISION_TYPE_LABELS = {
  exploration: 'Explore',
  exploitation: 'Exploit',
} as const

export const ACTION_OUTCOME_LABELS = {
  success: 'Success',
  failed: 'Failed',
  blocked: 'Blocked',
  'no-target': 'No target',
  died: 'Died',
} as const

export const OBSERVATION_TERRAIN_COUNT = 5
export const FORAGE_CUE_COUNT = 7
export const NEARBY_TOOL_COUNT = 5
export const HELD_TOOL_COUNT = 9
export const AGENT_DIRECTION_COUNT = 5
export const AGENT_DISTANCE_COUNT = 4
export const HEALTH_BAND_COUNT = 3
export const INTERACTABLE_CUE_COUNT = 16
export const DRIVE_CUE_COUNT = 5
export const ENV_CUE_COUNT = 9
export const STATE_SPACE_SIZE =
  3 * 3 * 5 * 4 * 2 * OBSERVATION_TERRAIN_COUNT * OBSERVATION_TERRAIN_COUNT *
  FORAGE_CUE_COUNT *
  NEARBY_TOOL_COUNT *
  HELD_TOOL_COUNT *
  AGENT_DIRECTION_COUNT *
  AGENT_DISTANCE_COUNT *
  HEALTH_BAND_COUNT *
  INTERACTABLE_CUE_COUNT *
  DRIVE_CUE_COUNT *
  ENV_CUE_COUNT
