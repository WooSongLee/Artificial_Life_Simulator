import { clamp, distanceSq } from '../utils/math'
import type { Rng } from '../utils/random'
import { randomInRange } from '../utils/random'
import type { TerrainGrid } from '../types/terrain'
import type { ResourceDistribution, WorldConfig, WorldObject, WorldState } from '../types/world'
import {
  AGENT_RADIUS,
  ROCK_COLLISION_RADIUS,
  TREE_COLLISION_RADIUS,
  WORLD_EDGE_MARGIN,
} from './constants'
import {
  closedDoorBlocksPosition,
  labFacilityBlocksPosition,
  movableBoxBlocksPosition,
} from './interactables'
import { isHumanBehaviorLab, clampSimulationMode } from './labMode'
import { isTerrainWalkable } from './terrain'

export interface ClusterCenter {
  x: number
  z: number
}

export function getWalkHalfExtent(size: number): number {
  return size * 0.5 - WORLD_EDGE_MARGIN
}

export function isInsideWorld(x: number, z: number, size: number): boolean {
  const half = getWalkHalfExtent(size)
  return x >= -half && x <= half && z >= -half && z <= half
}

export function obstacleRadius(object: WorldObject): number {
  if (object.type === 'tree') return TREE_COLLISION_RADIUS * object.scale
  if (object.type === 'rock') return ROCK_COLLISION_RADIUS * object.scale
  return 0
}

export function collidesWithObstacles(
  x: number,
  z: number,
  radius: number,
  objects: readonly WorldObject[],
): boolean {
  for (const object of objects) {
    const objectRadius = obstacleRadius(object)
    if (objectRadius <= 0) continue
    const minDistance = objectRadius + radius
    if (distanceSq(x, z, object.position.x, object.position.z) < minDistance * minDistance) {
      return true
    }
  }
  return false
}

export function isBlockedSpawn(
  x: number,
  z: number,
  objects: readonly WorldObject[],
  extraRadius = AGENT_RADIUS,
  terrain?: TerrainGrid,
  worldSize?: number,
): boolean {
  if (terrain && worldSize !== undefined && !isTerrainWalkable(terrain, x, z, worldSize)) {
    return true
  }
  return collidesWithObstacles(x, z, extraRadius + 0.9, objects)
}

export function isBlockedWorldPosition(
  x: number,
  z: number,
  world: Pick<WorldState, 'objects' | 'terrain' | 'config' | 'interactables'>,
  radius = AGENT_RADIUS,
  excludeInteractableId?: string,
): boolean {
  const lab = isHumanBehaviorLab(clampSimulationMode(world.config.mode))
  return (
    !isInsideWorld(x, z, world.config.size) ||
    (!lab && !isTerrainWalkable(world.terrain, x, z, world.config.size)) ||
    (lab && labFacilityBlocksPosition(x, z, radius)) ||
    collidesWithObstacles(x, z, radius, world.objects) ||
    closedDoorBlocksPosition(x, z, radius, world.interactables) ||
    movableBoxBlocksPosition(x, z, radius, world.interactables, excludeInteractableId)
  )
}

export function findOpenPosition(
  rng: Rng,
  config: WorldConfig,
  isBlocked: (x: number, z: number) => boolean,
  spread = 0.42,
): { x: number; z: number } {
  const half = config.size * spread
  const maxAttempts = 48

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const x = randomInRange(rng, -half, half)
    const z = randomInRange(rng, -half, half)
    if (!isBlocked(x, z)) {
      return { x, z }
    }
  }

  const fallbackStep = Math.max(1.2, config.size / 16)
  for (let z = -half; z <= half; z += fallbackStep) {
    for (let x = -half; x <= half; x += fallbackStep) {
      if (!isBlocked(x, z)) {
        return { x, z }
      }
    }
  }

  return { x: 0, z: 0 }
}

export function createClusterCenters(
  rng: Rng,
  config: WorldConfig,
  count: number,
): ClusterCenter[] {
  const half = getWalkHalfExtent(config.size)
  const centers: ClusterCenter[] = []
  for (let i = 0; i < count; i += 1) {
    centers.push({
      x: randomInRange(rng, -half * 0.65, half * 0.65),
      z: randomInRange(rng, -half * 0.65, half * 0.65),
    })
  }
  return centers
}

function sampleDistributedPoint(
  rng: Rng,
  config: WorldConfig,
  distribution: ResourceDistribution,
  centers: ClusterCenter[] | undefined,
): { x: number; z: number } {
  const half = getWalkHalfExtent(config.size)

  if (distribution === 'clustered' && centers && centers.length > 0) {
    const center = centers[Math.floor(rng() * centers.length)] ?? { x: 0, z: 0 }
    const radius = config.size * 0.12
    const angle = randomInRange(rng, 0, Math.PI * 2)
    const distance = radius * Math.sqrt(rng())
    return {
      x: clamp(center.x + Math.cos(angle) * distance, -half, half),
      z: clamp(center.z + Math.sin(angle) * distance, -half, half),
    }
  }

  if (distribution === 'edge') {
    const axis = rng() < 0.5 ? 'x' : 'z'
    const edge = rng() < 0.5 ? -1 : 1
    const along = randomInRange(rng, -half, half)
    const inset = randomInRange(rng, half * 0.62, half)
    return axis === 'x'
      ? { x: edge * inset, z: along }
      : { x: along, z: edge * inset }
  }

  return {
    x: randomInRange(rng, -half * 0.92, half * 0.92),
    z: randomInRange(rng, -half * 0.92, half * 0.92),
  }
}

export function findDistributedPosition(
  rng: Rng,
  config: WorldConfig,
  isBlocked: (x: number, z: number) => boolean,
  centers?: ClusterCenter[],
  distribution: ResourceDistribution = config.resourceDistribution,
): { x: number; z: number } {
  const maxAttempts = 48

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const point = sampleDistributedPoint(rng, config, distribution, centers)
    if (!isBlocked(point.x, point.z)) {
      return point
    }
  }

  return sampleDistributedPoint(rng, config, distribution, centers)
}
