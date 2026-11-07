import { agentSeparation, attackRangeFor, findNearestLivingAgent } from '../simulation/combat'
import { AGENT_LOOKAHEAD, AGENT_RADIUS, FOOD_EAT_RADIUS, GATHER_RADIUS } from '../simulation/constants'
import { durabilityBand, findVisibleForage, findVisibleTool } from '../simulation/forage'
import { findVisibleInteractable, INTERACT_RADIUS } from '../simulation/interactables'
import { allowsAgentSensing, clampSimulationMode } from '../simulation/labMode'
import { isBlockedWorldPosition } from '../simulation/spatial'
import {
  canDetectAt,
  getDetectionRange,
  getTerrainTypeAt,
} from '../simulation/terrain'
import type { Agent } from '../types/agent'
import type { ForageNode, ToolType } from '../types/forage'
import type { Interactable } from '../types/interactable'
import type { WorldObject, WorldState } from '../types/world'
import { distanceSq, shortestAngleDelta } from '../utils/math'
import { EFFICIENT_REST_ENERGY, STAT_BAND_LOW_MAX, STAT_BAND_MID_MAX, URGENT_HUNGER } from './constants'
import {
  AGENT_DIRECTIONS,
  AGENT_DISTANCES,
  DRIVE_CUES,
  ENERGY_BANDS,
  FOOD_DIRECTIONS,
  FOOD_DISTANCES,
  FORAGE_CUES,
  HEALTH_BANDS,
  HELD_TOOLS,
  HUNGER_BANDS,
  INTERACTABLE_CUES,
  NEARBY_TOOLS,
  OBSTACLE_AHEAD_VALUES,
  OBSERVATION_TERRAIN_VALUES,
} from './types'
import type {
  AgentDirection,
  AgentDistance,
  DriveCue,
  EnergyBand,
  FoodDirection,
  FoodDistance,
  ForageCue,
  HeldTool,
  InteractableCue,
  NearbyTool,
  Observation,
  ObservationTerrain,
  ObstacleAhead,
  StateKey,
} from './types'

/** Fatigue/comfort unmet above this → tired cue. */
export const DRIVE_TIRED_THRESHOLD = 55
/** Curiosity unmet above this → curious cue. */
export const DRIVE_CURIOUS_THRESHOLD = 55

export function findNearestFood(agent: Agent, world: WorldState): WorldObject | null {
  let nearest: WorldObject | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const object of world.objects) {
    if (object.type !== 'food') continue
    const dist = distanceSq(agent.position.x, agent.position.z, object.position.x, object.position.z)
    if (dist >= nearestDist) continue
    if (!canDetectAt(agent, object.position.x, object.position.z, world, dist)) continue
    nearest = object
    nearestDist = dist
  }

  return nearest
}

export function findFoodInEatRange(agent: Agent, objects: WorldObject[]): WorldObject | null {
  const reach = FOOD_EAT_RADIUS * FOOD_EAT_RADIUS

  for (const object of objects) {
    if (object.type !== 'food') continue
    const dist = distanceSq(agent.position.x, agent.position.z, object.position.x, object.position.z)
    if (dist <= reach) return object
  }

  return null
}

export function bandStat(value: number): EnergyBand {
  if (value <= STAT_BAND_LOW_MAX) return 'low'
  if (value <= STAT_BAND_MID_MAX) return 'mid'
  return 'high'
}

/** Bearing from agent facing to a world point (no "none"). */
export function observeBearing(
  agent: Pick<Agent, 'position' | 'rotation'>,
  x: number,
  z: number,
): Exclude<FoodDirection, 'none'> {
  const desired = Math.atan2(x - agent.position.x, z - agent.position.z)
  const delta = shortestAngleDelta(agent.rotation, desired)
  const abs = Math.abs(delta)

  if (abs <= Math.PI / 4) return 'forward'
  if (abs >= (Math.PI * 3) / 4) return 'back'
  return delta > 0 ? 'left' : 'right'
}

export function observeFoodDirection(agent: Agent, food: WorldObject | null): FoodDirection {
  if (!food) return 'none'
  return observeBearing(agent, food.position.x, food.position.z)
}

export function observeFoodDistance(agent: Agent, food: WorldObject | null, world: WorldState): FoodDistance {
  if (!food) return 'out'

  const dist = Math.hypot(food.position.x - agent.position.x, food.position.z - agent.position.z)
  const detection = getDetectionRange(agent, food.position.x, food.position.z, world)
  if (dist <= FOOD_EAT_RADIUS) return 'close'
  if (dist <= detection * 0.5) return 'mid'
  if (dist <= detection) return 'far'
  return 'out'
}

export function observeObstacleAhead(agent: Agent, world: WorldState): ObstacleAhead {
  const look = lookAheadPoint(agent)
  return isBlockedWorldPosition(look.x, look.z, world, AGENT_RADIUS) ? 'yes' : 'no'
}

export function observeTerrain(agent: Agent, world: WorldState): ObservationTerrain {
  return getTerrainTypeAt(world.terrain, agent.position.x, agent.position.z, world.config.size)
}

export function observeTerrainAhead(agent: Agent, world: WorldState): ObservationTerrain {
  const look = lookAheadPoint(agent)
  return getTerrainTypeAt(world.terrain, look.x, look.z, world.config.size)
}

export function observeForage(agent: Agent, world: WorldState): ForageCue {
  const forage = findVisibleForage(agent, world, (x, z, dist) => canDetectAt(agent, x, z, world, dist))
  if (!forage) return 'none'

  const dist = Math.hypot(forage.position.x - agent.position.x, forage.position.z - agent.position.z)
  const prefix = forage.kind === 'berry_bush' ? 'berry' : 'root'
  if (dist <= GATHER_RADIUS) return `${prefix}_close`

  const heading = observeTargetHeading(agent, forage)
  return heading === 'forward' ? `${prefix}_fwd` : `${prefix}_oth`
}

export function observeNearbyTool(agent: Agent, world: WorldState): NearbyTool {
  const tool = findVisibleTool(agent, world.worldTools, (x, z, dist) =>
    canDetectAt(agent, x, z, world, dist),
  )
  if (!tool) return 'none'
  return nearbyToolToken(tool.toolType)
}

export function observeHeldTool(agent: Agent): HeldTool {
  const band = durabilityBand(agent.equipment)
  if (band === 'none' || !agent.equipment) return 'none'
  return `${heldToolPrefix(agent.equipment.toolType)}_${band}`
}

export function observeNearbyAgentDirection(agent: Agent, other: Agent | null): AgentDirection {
  if (!other) return 'none'
  return observeFoodDirection(agent, { position: { x: other.position.x, z: other.position.z } } as WorldObject)
}

export function observeNearbyAgentDistance(agent: Agent, other: Agent | null, world: WorldState): AgentDistance {
  if (!other) return 'out'

  const dist = agentSeparation(agent, other)
  if (dist <= attackRangeFor(agent)) return 'close'
  const detection = getDetectionRange(agent, other.position.x, other.position.z, world)
  if (dist <= detection * 0.5) return 'mid'
  if (dist <= detection) return 'far'
  return 'out'
}

export function observeInteractable(agent: Agent, world: WorldState): InteractableCue {
  const target = findVisibleInteractable(agent, world.interactables ?? [], (x, z, dist) =>
    canDetectAt(agent, x, z, world, dist),
  )
  if (!target) return 'none'

  const dist = Math.hypot(target.position.x - agent.position.x, target.position.z - agent.position.z)
  const prefix = interactableCuePrefix(target)
  if (dist <= INTERACT_RADIUS) return `${prefix}_close`

  const heading = observeInteractableHeading(agent, target)
  return heading === 'forward' ? `${prefix}_fwd` : `${prefix}_oth`
}

/** Compact dominant-need cue so Q can learn rest/lookout vs survival. */
export function observeDrive(agent: Agent): DriveCue {
  if (agent.fatigue === undefined && agent.curiosity === undefined && agent.comfort === undefined) {
    return 'na'
  }

  if (agent.hunger >= URGENT_HUNGER || agent.energy <= EFFICIENT_REST_ENERGY) return 'surv'

  const fatigue = agent.fatigue ?? 0
  const comfortNeed = 100 - (agent.comfort ?? 100)
  const tiredScore = Math.max(fatigue, comfortNeed)
  const curiosity = agent.curiosity ?? 0

  if (tiredScore < DRIVE_TIRED_THRESHOLD && curiosity < DRIVE_CURIOUS_THRESHOLD) return 'calm'
  if (tiredScore >= curiosity) return 'tired'
  return 'curious'
}

export function observeAgent(agent: Agent, world: WorldState): Observation {
  const food = findNearestFood(agent, world)
  const senseAgents = allowsAgentSensing(clampSimulationMode(world.config.mode))
  const nearby = senseAgents ? findNearestLivingAgent(agent, world) : null

  return {
    energy: bandStat(agent.energy),
    hunger: bandStat(agent.hunger),
    foodDirection: observeFoodDirection(agent, food),
    foodDistance: observeFoodDistance(agent, food, world),
    obstacleAhead: observeObstacleAhead(agent, world),
    terrain: observeTerrain(agent, world),
    terrainAhead: observeTerrainAhead(agent, world),
    forage: observeForage(agent, world),
    nearbyTool: observeNearbyTool(agent, world),
    heldTool: observeHeldTool(agent),
    agentDirection: observeNearbyAgentDirection(agent, nearby),
    agentDistance: observeNearbyAgentDistance(agent, nearby, world),
    health: bandStat(agent.health),
    interactable: observeInteractable(agent, world),
    drive: observeDrive(agent),
  }
}

export function encodeObservation(observation: Observation): StateKey {
  return `${observation.energy}|${observation.hunger}|${observation.foodDirection}|${observation.foodDistance}|${observation.obstacleAhead}|${observation.terrain}|${observation.terrainAhead}|${observation.forage}|${observation.nearbyTool}|${observation.heldTool}|${observation.agentDirection}|${observation.agentDistance}|${observation.health}|${observation.interactable}|${observation.drive}`
}

export function decodeObservation(stateKey: StateKey): Observation | null {
  const tokens = stateKey.split('|')
  if (tokens.length !== 15) return null
  const [
    energy,
    hunger,
    foodDirection,
    foodDistance,
    obstacleAhead,
    terrain,
    terrainAhead,
    forage,
    nearbyTool,
    heldTool,
    agentDirection,
    agentDistance,
    health,
    interactable,
    drive,
  ] = tokens
  if (
    !isToken(energy, ENERGY_BANDS) ||
    !isToken(hunger, HUNGER_BANDS) ||
    !isToken(foodDirection, FOOD_DIRECTIONS) ||
    !isToken(foodDistance, FOOD_DISTANCES) ||
    !isToken(obstacleAhead, OBSTACLE_AHEAD_VALUES) ||
    !isToken(terrain, OBSERVATION_TERRAIN_VALUES) ||
    !isToken(terrainAhead, OBSERVATION_TERRAIN_VALUES) ||
    !isToken(forage, FORAGE_CUES) ||
    !isToken(nearbyTool, NEARBY_TOOLS) ||
    !isToken(heldTool, HELD_TOOLS) ||
    !isToken(agentDirection, AGENT_DIRECTIONS) ||
    !isToken(agentDistance, AGENT_DISTANCES) ||
    !isToken(health, HEALTH_BANDS) ||
    !isToken(interactable, INTERACTABLE_CUES) ||
    !isToken(drive, DRIVE_CUES)
  ) {
    return null
  }

  return {
    energy,
    hunger,
    foodDirection,
    foodDistance,
    obstacleAhead,
    terrain,
    terrainAhead,
    forage,
    nearbyTool,
    heldTool,
    agentDirection,
    agentDistance,
    health,
    interactable,
    drive,
  }
}

function nearbyToolToken(toolType: ToolType): NearbyTool {
  if (toolType === 'basket') return 'basket'
  if (toolType === 'digging_stick') return 'stick'
  if (toolType === 'spear') return 'spear'
  return 'shield'
}

function heldToolPrefix(toolType: ToolType): 'basket' | 'stick' | 'spear' | 'shield' {
  if (toolType === 'digging_stick') return 'stick'
  return toolType
}

function observeTargetHeading(agent: Agent, target: ForageNode): 'forward' | 'other' {
  const desired = Math.atan2(target.position.x - agent.position.x, target.position.z - agent.position.z)
  return Math.abs(shortestAngleDelta(agent.rotation, desired)) <= Math.PI / 4 ? 'forward' : 'other'
}

function observeInteractableHeading(agent: Agent, target: Interactable): 'forward' | 'other' {
  const desired = Math.atan2(target.position.x - agent.position.x, target.position.z - agent.position.z)
  return Math.abs(shortestAngleDelta(agent.rotation, desired)) <= Math.PI / 4 ? 'forward' : 'other'
}

function interactableCuePrefix(target: Interactable): 'switch' | 'door' | 'box' | 'rest' | 'look' {
  if (target.kind === 'switch') return 'switch'
  if (target.kind === 'door') return 'door'
  if (target.kind === 'rest_bed') return 'rest'
  if (target.kind === 'lookout') return 'look'
  return 'box'
}

export function lookAheadPoint(agent: Pick<Agent, 'position' | 'rotation'>): { x: number; z: number } {
  return {
    x: agent.position.x + Math.sin(agent.rotation) * AGENT_LOOKAHEAD,
    z: agent.position.z + Math.cos(agent.rotation) * AGENT_LOOKAHEAD,
  }
}

function isToken<T extends string>(value: string | undefined, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T)
}
