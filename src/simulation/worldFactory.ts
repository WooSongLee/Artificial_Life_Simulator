import type { WorldConfig, WorldObject, WorldObjectType, WorldState } from '../types/world'
import { createId } from '../utils/id'
import { mulberry32, randomInRange, type Rng } from '../utils/random'
import { createAgent, createInitialAgents, trimAgents, type CreateAgentOptions } from './agentFactory'
import {
  clampWorldConfig,
  DEFAULT_WORLD_CONFIG,
  getConfiguredFoodCount,
  getObstacleCounts,
  WORLD_SEED,
} from './constants'
import {
  createClusterCenters,
  findDistributedPosition,
  type ClusterCenter,
} from './spatial'

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

export interface WorldCreateOptions {
  seed?: number
  learningDefaults?: CreateAgentOptions['learningDefaults']
}

export type ClusterCenters = Record<WorldObjectType, ClusterCenter[]>

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

export function createClusterMap(rng: Rng, config: WorldConfig): ClusterCenters {
  return {
    tree: createClusterCenters(rng, config, 3),
    rock: createClusterCenters(rng, config, 2),
    food: createClusterCenters(rng, config, 3),
  }
}

export function createWorldObject(
  type: WorldObjectType,
  config: WorldConfig,
  existing: WorldObject[],
  rng: Rng = Math.random,
  centers?: ClusterCenter[],
): WorldObject {
  const minDistance = MIN_DISTANCE[type]
  const { x, z } = findDistributedPosition(
    rng,
    config,
    (px, pz) => isTooClose(existing, px, pz, minDistance),
    centers,
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
  options: WorldCreateOptions = {},
): WorldState {
  const nextConfig = clampWorldConfig({
    ...DEFAULT_WORLD_CONFIG,
    ...config,
  })
  const rng = mulberry32(seed)
  const objects: WorldObject[] = []
  const centers = createClusterMap(rng, nextConfig)
  const obstacles = getObstacleCounts(nextConfig)

  const placements: Array<[WorldObjectType, number]> = [
    ['tree', obstacles.tree],
    ['rock', obstacles.rock],
    ['food', getConfiguredFoodCount(nextConfig)],
  ]

  for (const [type, count] of placements) {
    for (let i = 0; i < count; i += 1) {
      objects.push(createWorldObject(type, nextConfig, objects, rng, centers[type]))
    }
  }

  const worldWithoutAgents: WorldState = {
    config: nextConfig,
    objects,
    agents: [],
    foodSpawnCooldown: 0,
    generation: 1,
    generationStartTick: 0,
    birthCount: 0,
  }

  return {
    ...worldWithoutAgents,
    agents: createInitialAgents(
      worldWithoutAgents,
      rng,
      nextConfig.agentCount,
      options.learningDefaults,
    ),
  }
}

export function createInitialWorld(
  config: WorldConfig = DEFAULT_WORLD_CONFIG,
  options: WorldCreateOptions = {},
): WorldState {
  return generateWorld(options.seed ?? WORLD_SEED, config, options)
}

function countFood(objects: WorldObject[]): number {
  return objects.reduce((count, object) => count + (object.type === 'food' ? 1 : 0), 0)
}

export function topUpFood(world: WorldState, rng: Rng = Math.random): WorldObject[] {
  const target = getConfiguredFoodCount(world.config)
  const objects = [...world.objects]
  let foodCount = countFood(objects)
  const centers = world.config.resourceDistribution === 'clustered'
    ? createClusterCenters(rng, world.config, 3)
    : undefined

  while (foodCount < target) {
    objects.push(createWorldObject('food', world.config, objects, rng, centers))
    foodCount += 1
  }

  return objects
}

export function adjustWorldPopulation(
  world: WorldState,
  agentCount: number,
  rng: Rng = Math.random,
  learningDefaults?: CreateAgentOptions['learningDefaults'],
): { world: WorldState; removedAgentIds: string[] } {
  const nextConfig = clampWorldConfig({
    ...world.config,
    agentCount,
  })
  let agents = world.agents

  if (agents.length < agentCount) {
    const grown = [...agents]
    while (grown.length < agentCount) {
      grown.push(
        createAgent({ ...world, config: nextConfig, agents: grown }, grown, rng, {
          learningDefaults,
        }),
      )
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

