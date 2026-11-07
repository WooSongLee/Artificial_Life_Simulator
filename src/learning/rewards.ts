import { EFFICIENT_REST_ENERGY, URGENT_HUNGER } from './constants'
import type { AgentAction, FoodDirection, RewardConfig, RewardContext } from './types'

/** Lab drive relief reward units (compete with eatSuccess≈10 when drives high). */
export const REST_FATIGUE_REWARD_UNIT = 0.1
export const REST_COMFORT_REWARD_UNIT = 0.06
export const LOOKOUT_CURIOSITY_REWARD_UNIT = 0.12
/** Flat bonus when relieving a high drive (helps Q credit rest/lookout). */
export const DRIVE_RELIEF_FLAT_BONUS = 2.5
/** Subtracted when choosing rest/lookout under urgent hunger or low energy. */
export const DRIVE_VS_SURVIVAL_PENALTY = -8

/** Lab survival-seek: MOVE_FORWARD while facing food when hungry. */
export const APPROACH_FOOD_REWARD = 0.85
/** Lab survival-seek: turn that matches foodDirection. */
export const CORRECT_TURN_REWARD = 0.35
/** Lab survival-seek: wrong-way turn or turn while already facing food. */
export const WRONG_TURN_PENALTY = -0.55
/** Lab: consecutive opposite turns (L↔R) — anti-spin (keep mild vs approach). */
export const SPIN_OSCILLATION_PENALTY = -0.9
/** Hunger at/above this unlocks approach / turn seek shaping (matches curriculum seek). */
export const SURVIVAL_SEEK_HUNGER = 32

export type DriveRewardContext = RewardContext & {
  targetKind?: string | null
  fatigueBefore?: number
  curiosityBefore?: number
  comfortBefore?: number
  foodDirection?: FoodDirection
  previousAction?: AgentAction | null
}

export function isEfficientRest(context: RewardContext): boolean {
  if (context.action !== 'REST' || context.died) return false
  if (context.hungerBefore >= URGENT_HUNGER) return false
  return context.energyBefore <= EFFICIENT_REST_ENERGY
}

export function isWastedEnergy(context: RewardContext): boolean {
  if (
    context.collided ||
    context.ate ||
    context.died ||
    context.gatheredAmount > 0 ||
    context.pickedUp ||
    context.interacted
  ) {
    return false
  }
  if ((context.damageDealt ?? 0) > 0 || (context.damageTaken ?? 0) > 0) return false
  if (context.action === 'EAT' && !context.ate) return true
  if (context.action === 'MOVE_FORWARD' && context.foodInEatRange) return true
  return false
}

function hasLabDriveSnapshot(context: DriveRewardContext): boolean {
  return (
    context.fatigueBefore !== undefined ||
    context.curiosityBefore !== undefined ||
    context.comfortBefore !== undefined
  )
}

/** Non-survival rest/lookout bonus vs survival urgency penalty (Lab only). */
export function driveTradeoffReward(context: DriveRewardContext): number {
  if (context.died || !context.interacted || !hasLabDriveSnapshot(context)) return 0
  const kind = context.targetKind
  if (kind !== 'rest_bed' && kind !== 'lookout') return 0

  let bonus = DRIVE_RELIEF_FLAT_BONUS
  if (kind === 'rest_bed') {
    bonus += REST_FATIGUE_REWARD_UNIT * (context.fatigueBefore ?? 0)
    bonus += REST_COMFORT_REWARD_UNIT * (100 - (context.comfortBefore ?? 100))
  } else {
    bonus += LOOKOUT_CURIOSITY_REWARD_UNIT * (context.curiosityBefore ?? 0)
  }

  const survivalUrgent =
    context.hungerBefore >= URGENT_HUNGER || context.energyBefore <= EFFICIENT_REST_ENERGY
  if (survivalUrgent) bonus += DRIVE_VS_SURVIVAL_PENALTY
  return bonus
}

function isOppositeTurn(action: AgentAction, previous: AgentAction | null | undefined): boolean {
  if (previous !== 'TURN_LEFT' && previous !== 'TURN_RIGHT') return false
  if (action === 'TURN_LEFT') return previous === 'TURN_RIGHT'
  if (action === 'TURN_RIGHT') return previous === 'TURN_LEFT'
  return false
}

/**
 * Lab-only shaping so hungry agents learn to face/approach food instead of L↔R spinning.
 * Spin penalty only when food is sensed (do not punish blind explore L/R).
 * Approach / turn shaping requires hunger ≥ threshold.
 */
export function survivalSeekReward(context: DriveRewardContext): number {
  if (context.died || !hasLabDriveSnapshot(context)) return 0

  const dir = context.foodDirection ?? 'none'
  let reward = 0

  // Anti-spin only with a sensed food target — blind explore may legitimately L↔R.
  if (dir !== 'none' && isOppositeTurn(context.action, context.previousAction)) {
    reward += SPIN_OSCILLATION_PENALTY
  }

  if (context.hungerBefore < SURVIVAL_SEEK_HUNGER || dir === 'none') return reward

  if (context.action === 'MOVE_FORWARD' && dir === 'forward') {
    reward += APPROACH_FOOD_REWARD
    return reward
  }

  if (context.action !== 'TURN_LEFT' && context.action !== 'TURN_RIGHT') return reward

  if (dir === 'forward') {
    reward += WRONG_TURN_PENALTY
  } else if (dir === 'left') {
    reward += context.action === 'TURN_LEFT' ? CORRECT_TURN_REWARD : WRONG_TURN_PENALTY
  } else if (dir === 'right') {
    reward += context.action === 'TURN_RIGHT' ? CORRECT_TURN_REWARD : WRONG_TURN_PENALTY
  } else if (dir === 'back') {
    reward += context.action === 'TURN_LEFT' ? CORRECT_TURN_REWARD : WRONG_TURN_PENALTY
  }

  return reward
}

export function computeReward(context: DriveRewardContext, config: RewardConfig): number {
  let reward = 0
  const damageDealt = context.damageDealt ?? 0
  const damageTaken = context.damageTaken ?? 0
  const damageReduced = context.damageReduced ?? 0

  if (context.ate) reward += config.eatSuccess
  if (context.gatheredAmount > 0) reward += config.gatherUnit * context.gatheredAmount
  if (context.pickedUp) reward += config.pickupSuccess
  if (context.interacted) reward += config.interactSuccess
  if (context.died) reward += config.death
  if (context.collided) reward += config.collision
  if (isWastedEnergy(context)) reward += config.wastedEnergy
  if (isEfficientRest(context)) reward += config.efficientRest
  reward += driveTradeoffReward(context)
  reward += survivalSeekReward(context)

  if (damageDealt > 0) {
    reward += config.attackHitUnit * damageDealt
  } else if (context.attackAttempted && !context.attackHit && !context.died) {
    reward += config.attackMiss
  }
  if (damageTaken > 0 && !context.died) {
    reward += config.damageTakenUnit * damageTaken
  }
  if (damageReduced > 0) {
    reward += config.defendReduceUnit * damageReduced
  }
  if (context.fledFarther && !context.died) {
    reward += config.fleeSuccess
  }

  return reward
}
