import { AGENT_LOOKAHEAD, AGENT_RADIUS, FOOD_EAT_RADIUS } from '../simulation/constants'
import { collidesWithObstacles, isInsideWorld } from '../simulation/spatial'
import type { Agent } from '../types/agent'
import type { WorldObject, WorldState } from '../types/world'
import { distanceSq, shortestAngleDelta } from '../utils/math'
import { FOOD_DISTANCE_CLOSE, STAT_BAND_LOW_MAX, STAT_BAND_MID_MAX } from './constants'
import type {
  EnergyBand,
  FoodDirection,
  FoodDistance,
  HungerBand,
  Observation,
  ObstacleAhead,
  StateKey,
} from './types'

export function findNearestFood(agent: Agent, objects: WorldObject[]): WorldObject | null {
  let nearest: WorldObject | null = null
  let nearestDist = agent.vision * agent.vision

  for (const object of objects) {
    if (object.type !== 'food') continue
    const dist = distanceSq(agent.position.x, agent.position.z, object.position.x, object.position.z)
    if (dist < nearestDist) {
      nearest = object
      nearestDist = dist
    }
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

export function observeFoodDirection(agent: Agent, food: WorldObject | null): FoodDirection {
  if (!food) return 'none'

  const desired = Math.atan2(food.position.x - agent.position.x, food.position.z - agent.position.z)
  const delta = shortestAngleDelta(agent.rotation, desired)
  const abs = Math.abs(delta)

  if (abs <= Math.PI / 4) return 'forward'
  if (abs >= (Math.PI * 3) / 4) return 'back'
  return delta > 0 ? 'left' : 'right'
}

export function observeFoodDistance(agent: Agent, food: WorldObject | null): FoodDistance {
  if (!food) return 'out'

  const dist = Math.hypot(food.position.x - agent.position.x, food.position.z - agent.position.z)
  if (dist <= FOOD_DISTANCE_CLOSE) return 'close'
  if (dist <= agent.vision * 0.5) return 'mid'
  if (dist <= agent.vision) return 'far'
  return 'out'
}

export function observeObstacleAhead(agent: Agent, world: WorldState): ObstacleAhead {
  const lookX = agent.position.x + Math.sin(agent.rotation) * AGENT_LOOKAHEAD
  const lookZ = agent.position.z + Math.cos(agent.rotation) * AGENT_LOOKAHEAD
  const blocked =
    !isInsideWorld(lookX, lookZ, world.config.size) ||
    collidesWithObstacles(lookX, lookZ, AGENT_RADIUS, world.objects)

  return blocked ? 'yes' : 'no'
}

export function observeAgent(agent: Agent, world: WorldState): Observation {
  const food = findNearestFood(agent, world.objects)

  return {
    energy: bandStat(agent.energy),
    hunger: bandStat(agent.hunger),
    foodDirection: observeFoodDirection(agent, food),
    foodDistance: observeFoodDistance(agent, food),
    obstacleAhead: observeObstacleAhead(agent, world),
  }
}

export function encodeObservation(observation: Observation): StateKey {
  return `${observation.energy}|${observation.hunger}|${observation.foodDirection}|${observation.foodDistance}|${observation.obstacleAhead}`
}

export function decodeObservation(stateKey: StateKey): Observation | null {
  const [energy, hunger, foodDirection, foodDistance, obstacleAhead] = stateKey.split('|')
  if (!energy || !hunger || !foodDirection || !foodDistance || !obstacleAhead) return null

  return {
    energy: energy as EnergyBand,
    hunger: hunger as HungerBand,
    foodDirection: foodDirection as FoodDirection,
    foodDistance: foodDistance as FoodDistance,
    obstacleAhead: obstacleAhead as ObstacleAhead,
  }
}
