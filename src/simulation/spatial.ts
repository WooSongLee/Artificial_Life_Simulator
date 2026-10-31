import { distanceSq } from '../utils/math'
import type { Rng } from '../utils/random'
import { randomInRange } from '../utils/random'
import type { WorldConfig, WorldObject } from '../types/world'
import {
  AGENT_RADIUS,
  ROCK_COLLISION_RADIUS,
  TREE_COLLISION_RADIUS,
  WORLD_EDGE_MARGIN,
} from './constants'

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
  objects: WorldObject[],
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
  objects: WorldObject[],
  extraRadius = AGENT_RADIUS,
): boolean {
  return collidesWithObstacles(x, z, extraRadius + 0.9, objects)
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

  return {
    x: randomInRange(rng, -half, half),
    z: randomInRange(rng, -half, half),
  }
}
