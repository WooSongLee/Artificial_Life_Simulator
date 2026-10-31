import { EFFICIENT_REST_ENERGY, URGENT_HUNGER } from './constants'
import type { RewardConfig, RewardContext } from './types'

export function isEfficientRest(context: RewardContext): boolean {
  if (context.action !== 'REST' || context.died) return false
  if (context.hungerBefore >= URGENT_HUNGER && context.foodInEatRange) return false
  return context.energyBefore <= EFFICIENT_REST_ENERGY
}

export function isWastedEnergy(context: RewardContext): boolean {
  if (context.collided || context.ate || context.died) return false
  if (context.action === 'MOVE_FORWARD') return true
  if (context.action === 'EAT' && !context.ate) return true
  return false
}

export function computeReward(context: RewardContext, config: RewardConfig): number {
  let reward = 0

  if (context.ate) reward += config.eatSuccess
  if (context.died) reward += config.death
  if (context.collided) reward += config.collision
  if (isWastedEnergy(context)) reward += config.wastedEnergy
  if (isEfficientRest(context)) reward += config.efficientRest

  return reward
}
