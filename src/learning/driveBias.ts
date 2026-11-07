import { canUseLookout, canUseRestBed, findVisibleInteractable } from '../simulation/interactables'
import { canDetectAt } from '../simulation/terrain'
import type { Agent } from '../types/agent'
import type { WorldState } from '../types/world'
import { EFFICIENT_REST_ENERGY, EXPLORE_ACTION_WEIGHTS, URGENT_HUNGER } from './constants'
import {
  findNearestFood,
  observeBearing,
  observeDrive,
  observeFoodDistance,
  observeInteractable,
} from './observation'
import { actionIndex, createEmptyQValues } from './qLearning'
import type { DriveCue, InteractableCue } from './types'

/** Soft score so Lab rest_bed/lookout GATHER competes with survival Q. */
export const LAB_DRIVE_GATHER_BIAS = 0.35
/** Extra bias when observed drive matches the in-range affordance. */
export const LAB_DRIVE_MATCH_BIAS = 0.55
/** Nudge MOVE_FORWARD when a matching drive target is ahead. */
export const LAB_DRIVE_APPROACH_BIAS = 0.45
/** Nudge turns when a matching drive target is off-axis. */
export const LAB_DRIVE_TURN_BIAS = 0.3
/** Explore weight for GATHER when a non-survival drive target is in range (base 0.1). */
export const LAB_DRIVE_GATHER_EXPLORE_WEIGHT = 0.55
/** Explore weight when drive cue matches the reachable affordance. */
export const LAB_DRIVE_MATCH_EXPLORE_WEIGHT = 0.85

export function hasLabDrives(agent: Agent): boolean {
  return agent.fatigue !== undefined || agent.curiosity !== undefined || agent.comfort !== undefined
}

/** True when rest_bed or lookout is in interact range (non-survival affordance). */
export function hasNonSurvivalDriveTarget(agent: Agent, world: WorldState): boolean {
  return canUseRestBed(agent, world) || canUseLookout(agent, world)
}

function survivalUrgent(agent: Agent): boolean {
  return agent.hunger >= URGENT_HUNGER || agent.energy <= EFFICIENT_REST_ENERGY
}

function matchingDriveCue(drive: DriveCue, cue: InteractableCue): boolean {
  if (drive === 'tired') return cue.startsWith('rest')
  if (drive === 'curious') return cue.startsWith('look')
  return false
}

/** One correct turn (never L+R together) so teacher bias cannot induce spin. */
function applyDirectionalTurnBias(
  bias: number[],
  agent: Agent,
  world: WorldState,
  turnScore: number,
  moveScore = 0,
): void {
  const target = findVisibleInteractable(agent, world.interactables ?? [], (x, z, dist) =>
    canDetectAt(agent, x, z, world, dist),
  )
  if (!target) {
    bias[actionIndex('TURN_LEFT')] = turnScore
    return
  }
  const dir = observeBearing(agent, target.position.x, target.position.z)
  if (dir === 'forward') {
    bias[actionIndex('MOVE_FORWARD')] = moveScore > 0 ? moveScore : turnScore
  } else if (dir === 'right') {
    bias[actionIndex('TURN_RIGHT')] = turnScore
  } else {
    // left or back → deterministic left only
    bias[actionIndex('TURN_LEFT')] = turnScore
  }
}

function applyDirectionalTurnExplore(
  weights: number[],
  agent: Agent,
  world: WorldState,
  turnWeight: number,
): void {
  const target = findVisibleInteractable(agent, world.interactables ?? [], (x, z, dist) =>
    canDetectAt(agent, x, z, world, dist),
  )
  if (!target) {
    weights[actionIndex('TURN_LEFT')] = turnWeight
    return
  }
  const dir = observeBearing(agent, target.position.x, target.position.z)
  if (dir === 'forward') {
    weights[actionIndex('MOVE_FORWARD')] = Math.max(weights[actionIndex('MOVE_FORWARD')]!, turnWeight)
  } else if (dir === 'right') {
    weights[actionIndex('TURN_RIGHT')] = turnWeight
  } else {
    weights[actionIndex('TURN_LEFT')] = turnWeight
  }
}

/** Lab-only selection bias toward drive affordances / approach. Ecology → zeros. */
export function driveActionBias(agent: Agent, world: WorldState): number[] {
  const bias = createEmptyQValues()
  if (!hasLabDrives(agent)) return bias

  const drive = observeDrive(agent)

  if (drive === 'surv' || survivalUrgent(agent)) {
    const food = findNearestFood(agent, world)
    const foodDist = observeFoodDistance(agent, food, world)
    if (foodDist === 'close') {
      bias[actionIndex('EAT')] = LAB_DRIVE_MATCH_BIAS
    } else if (foodDist === 'mid' || foodDist === 'far') {
      // Food direction handled by Q + foodDirection obs; soft move nudge only.
      bias[actionIndex('MOVE_FORWARD')] = LAB_DRIVE_APPROACH_BIAS * 0.5
      bias[actionIndex('EAT')] = LAB_DRIVE_GATHER_BIAS
    }
    return bias
  }

  const cue = observeInteractable(agent, world)
  const restReady = canUseRestBed(agent, world)
  const lookReady = canUseLookout(agent, world)

  if ((drive === 'tired' && restReady) || (drive === 'curious' && lookReady)) {
    bias[actionIndex('GATHER')] = LAB_DRIVE_GATHER_BIAS + LAB_DRIVE_MATCH_BIAS
    return bias
  }

  if (matchingDriveCue(drive, cue)) {
    if (cue.endsWith('_close')) {
      bias[actionIndex('GATHER')] = LAB_DRIVE_GATHER_BIAS + LAB_DRIVE_MATCH_BIAS
    } else if (cue.endsWith('_fwd')) {
      bias[actionIndex('MOVE_FORWARD')] = LAB_DRIVE_APPROACH_BIAS
      bias[actionIndex('GATHER')] = LAB_DRIVE_GATHER_BIAS
    } else if (cue.endsWith('_oth')) {
      applyDirectionalTurnBias(bias, agent, world, LAB_DRIVE_TURN_BIAS, LAB_DRIVE_APPROACH_BIAS)
    }
    return bias
  }

  if (restReady || lookReady) {
    bias[actionIndex('GATHER')] =
      drive === 'calm' ? LAB_DRIVE_GATHER_BIAS * 0.35 : LAB_DRIVE_GATHER_BIAS
  }

  return bias
}

/** Raise explore weights toward matching drive actions. */
export function exploreWeightsFor(agent: Agent, world: WorldState): readonly number[] {
  if (!hasLabDrives(agent)) return EXPLORE_ACTION_WEIGHTS

  const weights: number[] = [...EXPLORE_ACTION_WEIGHTS]
  const drive = observeDrive(agent)

  if (drive === 'surv' || survivalUrgent(agent)) {
    weights[actionIndex('EAT')] = Math.max(weights[actionIndex('EAT')]!, 0.45)
    return weights
  }

  if (!hasNonSurvivalDriveTarget(agent, world)) {
    const cue = observeInteractable(agent, world)
    if (matchingDriveCue(drive, cue)) {
      if (cue.endsWith('_fwd')) {
        weights[actionIndex('MOVE_FORWARD')] = Math.max(weights[actionIndex('MOVE_FORWARD')]!, 0.55)
      } else if (cue.endsWith('_oth')) {
        applyDirectionalTurnExplore(weights, agent, world, 0.28)
      }
    }
    return weights
  }

  const match =
    (drive === 'tired' && canUseRestBed(agent, world)) ||
    (drive === 'curious' && canUseLookout(agent, world))
  weights[actionIndex('GATHER')] = match
    ? LAB_DRIVE_MATCH_EXPLORE_WEIGHT
    : LAB_DRIVE_GATHER_EXPLORE_WEIGHT
  return weights
}

export function combineActionBias(left: readonly number[], right: readonly number[]): number[] {
  const out = createEmptyQValues()
  for (let i = 0; i < out.length; i += 1) {
    out[i] = (left[i] ?? 0) + (right[i] ?? 0)
  }
  return out
}
