import type { WorldConfig, WorldObject, WorldObjectType, WorldState } from '../types/world'
import { createId } from '../utils/id'
import { mulberry32, randomInRange, type Rng } from '../utils/random'
import { createAgent, createInitialAgents, trimAgents } from './agentFactory'
import { DEFAULT_WORLD_CONFIG, INITIAL_OBJECT_COUNTS, WORLD_SEED, getTargetFoodCount } from './constants'
import { findOpenPosition } from './spatial'

const MIN_DISTANCE: Record<WorldObjectType, number> = {
  tree: 3.2,
  rock: 2.2,
  food: 1.6,
}

const SCALE_RANGE: Record<WorldObjectType, readonly [number, number]> = {
  tree: [0.85, 1.25],
  rock: [0.75, 1.35],
  food: [0.85, 1.15],
}

function isTooClose(
  objects: WorldObject[],
  x: number,
  z: number,
  minDistance: number,
): boolean {
  return objects.some((object) => {
    const dx = object.position.x - x
    const dz = object.position.z - z
    return dx * dx + dz * dz < minDistance * minDistance
  })
}

export function createWorldObject(
  type: WorldObjectType,
  config: WorldConfig,
  existing: WorldObject[],
  rng: Rng = Math.random,
): WorldObject {
  const minDistance = MIN_DISTANCE[type]
  const { x, z } = findOpenPosition(
    rng,
    config,
    (px, pz) => isTooClose(existing, px, pz, minDistance),
  )
  const [minScale, maxScale] = SCALE_RANGE[type]

  return {
    id: createId(type),
    type,
    position: { x, y: 0, z },
    scale: randomInRange(rng, minScale, maxScale),
    rotation: randomInRange(rng, 0, Math.PI * 2),
  }
}

export function generateWorld(
  seed: number = WORLD_SEED,
  config: WorldConfig = DEFAULT_WORLD_CONFIG,
): WorldState {
  const rng = mulberry32(seed)
  const objects: WorldObject[] = []

  const placements: Array<[WorldObjectType, number]> = [
    ['tree', INITIAL_OBJECT_COUNTS.tree],
    ['rock', INITIAL_OBJECT_COUNTS.rock],
    ['food', getTargetFoodCount(config.agentCount)],
  ]

  for (const [type, count] of placements) {
    for (let i = 0; i < count; i += 1) {
      objects.push(createWorldObject(type, config, objects, rng))
    }
  }

  const worldWithoutAgents: WorldState = {
    config,
    objects,
    agents: [],
    foodSpawnCooldown: 0,
    generation: 1,
    generationStartTick: 0,
  }

  return {
    ...worldWithoutAgents,
    agents: createInitialAgents(worldWithoutAgents, rng),
  }
}

export function createInitialWorld(config: WorldConfig = DEFAULT_WORLD_CONFIG): WorldState {
  return generateWorld(WORLD_SEED, {
    ...DEFAULT_WORLD_CONFIG,
    ...config,
  })
}

function countFood(objects: WorldObject[]): number {
  return objects.reduce((count, object) => count + (object.type === 'food' ? 1 : 0), 0)
}

export function topUpFood(world: WorldState, rng: Rng = Math.random): WorldObject[] {
  const target = getTargetFoodCount(world.config.agentCount)
  const objects = [...world.objects]
  let foodCount = countFood(objects)

  while (foodCount < target) {
    objects.push(createWorldObject('food', world.config, objects, rng))
    foodCount += 1
  }

  return objects
}

export function adjustWorldPopulation(
  world: WorldState,
  agentCount: number,
  rng: Rng = Math.random,
): { world: WorldState; removedAgentIds: string[] } {
  const nextConfig = {
    ...world.config,
    agentCount,
  }
  let agents = world.agents

  if (agents.length < agentCount) {
    const grown = [...agents]
    while (grown.length < agentCount) {
      grown.push(createAgent({ ...world, config: nextConfig, agents: grown }, grown, rng))
    }
    agents = grown
  } else if (agents.length > agentCount) {
    agents = trimAgents(agents, agentCount)
  }

  const kept = new Set(agents.map((agent) => agent.id))
  const removedAgentIds = world.agents
    .filter((agent) => !kept.has(agent.id))
    .map((agent) => agent.id)

  const nextWorld: WorldState = {
    ...world,
    config: nextConfig,
    agents,
  }

  return {
    world: {
      ...nextWorld,
      objects: topUpFood(nextWorld, rng),
    },
    removedAgentIds,
  }
}
