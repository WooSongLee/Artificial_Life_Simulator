import { EFFICIENT_REST_ENERGY, URGENT_HUNGER } from './constants'
import type { RewardConfig, RewardContext } from './types'

export function isEfficientRest(context: RewardContext): boolean {
  if (context.action !== 'REST' || context.died) return false
  if (context.hungerBefore >= URGENT_HUNGER) return false
  return context.energyBefore <= EFFICIENT_REST_ENERGY
}

export function isWastedEnergy(context: RewardContext): boolean {
  if (context.collided || context.ate || context.died || context.gatheredAmount > 0 || context.pickedUp) {
    return false
  }
  if ((context.damageDealt ?? 0) > 0 || (context.damageTaken ?? 0) > 0) return false
  if (context.action === 'EAT' && !context.ate) return true
  if (context.action === 'MOVE_FORWARD' && context.foodInEatRange) return true
  return false
}

export function computeReward(context: RewardContext, config: RewardConfig): number {
  let reward = 0
  const damageDealt = context.damageDealt ?? 0
  const damageTaken = context.damageTaken ?? 0
  const damageReduced = context.damageReduced ?? 0

  if (context.ate) reward += config.eatSuccess
  if (context.gatheredAmount > 0) reward += config.gatherUnit * context.gatheredAmount
  if (context.pickedUp) reward += config.pickupSuccess
  if (context.died) reward += config.death
  if (context.collided) reward += config.collision
  if (isWastedEnergy(context)) reward += config.wastedEnergy
  if (isEfficientRest(context)) reward += config.efficientRest

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
