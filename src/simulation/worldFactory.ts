import type { WorldConfig, WorldObject, WorldObjectType, WorldState } from '../types/world'
import { createId } from '../utils/id'
import { mulberry32, randomInRange, type Rng } from '../utils/random'
import { createInitialAgents } from './agentFactory'
import { DEFAULT_WORLD_CONFIG, INITIAL_OBJECT_COUNTS, WORLD_SEED } from './constants'
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
    ['food', INITIAL_OBJECT_COUNTS.food],
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
  }

  return {
    ...worldWithoutAgents,
    agents: createInitialAgents(worldWithoutAgents, rng),
  }
}

export function createInitialWorld(): WorldState {
  return generateWorld()
}
