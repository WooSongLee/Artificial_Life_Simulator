import type { Agent } from '../types/agent'
import type { TerrainGrid, TerrainProfile, TerrainType } from '../types/terrain'
import { TERRAIN_TYPES } from '../types/terrain'
import type { WorldConfig, WorldObjectType, WorldState } from '../types/world'
import { clamp } from '../utils/math'
import { mixSeed, mulberry32, randomInRange, type Rng } from '../utils/random'
import {
  TARGET_CONCEALMENT_VISION_SCALE,
  TERRAIN_CELL_SIZE,
  TERRAIN_PRESET_RATIOS,
  TERRAIN_PROFILES,
  TERRAIN_SEED_SALT,
  WETLAND_FOOD_BIAS,
} from './constants'

const PATCH_GROW_ORDER: TerrainType[] = ['water', 'forest', 'rocky', 'wetland']

export function createEmptyTerrain(worldSize: number, fill: TerrainType = 'grassland'): TerrainGrid {
  const size = cellsPerSide(worldSize)
  return {
    cellSize: TERRAIN_CELL_SIZE,
    size,
    cells: Array.from({ length: size * size }, () => fill),
  }
}

export function cellsPerSide(worldSize: number): number {
  return Math.max(8, Math.round(worldSize / TERRAIN_CELL_SIZE))
}

export function isTerrainType(value: unknown): value is TerrainType {
  return typeof value === 'string' && TERRAIN_TYPES.includes(value as TerrainType)
}

export function worldToCell(
  x: number,
  z: number,
  worldSize: number,
  terrain: Pick<TerrainGrid, 'cellSize' | 'size'>,
): { col: number; row: number } {
  const col = Math.floor((x + worldSize * 0.5) / terrain.cellSize)
  const row = Math.floor((z + worldSize * 0.5) / terrain.cellSize)
  return {
    col: clamp(col, 0, terrain.size - 1),
    row: clamp(row, 0, terrain.size - 1),
  }
}

export function cellIndex(col: number, row: number, size: number): number {
  return row * size + col
}

export function getTerrainTypeAt(
  terrain: TerrainGrid,
  x: number,
  z: number,
  worldSize: number,
): TerrainType {
  const { col, row } = worldToCell(x, z, worldSize, terrain)
  return terrain.cells[cellIndex(col, row, terrain.size)] ?? 'grassland'
}

export function getTerrainProfile(type: TerrainType): TerrainProfile {
  return TERRAIN_PROFILES[type]
}

export function getTerrainProfileAt(
  terrain: TerrainGrid,
  x: number,
  z: number,
  worldSize: number,
): TerrainProfile {
  return getTerrainProfile(getTerrainTypeAt(terrain, x, z, worldSize))
}

export function isTerrainWalkable(
  terrain: TerrainGrid,
  x: number,
  z: number,
  worldSize: number,
): boolean {
  return getTerrainProfileAt(terrain, x, z, worldSize).walkable
}

export function getAgentTerrain(agent: Pick<Agent, 'position'>, world: WorldState): TerrainType {
  return getTerrainTypeAt(world.terrain, agent.position.x, agent.position.z, world.config.size)
}

export function getAgentTerrainProfile(
  agent: Pick<Agent, 'position'>,
  world: WorldState,
): TerrainProfile {
  return getTerrainProfile(getAgentTerrain(agent, world))
}

export function getEffectiveVision(agent: Pick<Agent, 'position' | 'vision'>, world: WorldState): number {
  return agent.vision * getAgentTerrainProfile(agent, world).visionMultiplier
}

export function getDetectionRange(
  observer: Pick<Agent, 'position' | 'vision'>,
  targetX: number,
  targetZ: number,
  world: WorldState,
): number {
  const vision = getEffectiveVision(observer, world)
  const concealment = getTerrainProfileAt(world.terrain, targetX, targetZ, world.config.size).concealment
  return vision * (1 - concealment * TARGET_CONCEALMENT_VISION_SCALE)
}

export function canDetectAt(
  observer: Pick<Agent, 'position' | 'vision'>,
  targetX: number,
  targetZ: number,
  world: WorldState,
  distanceSq: number,
): boolean {
  const range = getDetectionRange(observer, targetX, targetZ, world)
  return distanceSq <= range * range
}

export function terrainSpawnWeight(
  type: WorldObjectType,
  terrainType: TerrainType,
): number {
  return getTerrainProfile(terrainType).resourceSpawnWeights[type]
}

export function maxTerrainSpawnWeight(type: WorldObjectType): number {
  let max = 0
  for (const terrainType of TERRAIN_TYPES) {
    max = Math.max(max, terrainSpawnWeight(type, terrainType))
  }
  return max
}

export function generateTerrainGrid(config: WorldConfig, rng?: Rng): TerrainGrid {
  const size = cellsPerSide(config.size)
  const cells: TerrainType[] = Array.from({ length: size * size }, () => 'grassland')
  const source = rng ?? mulberry32(mixSeed(config.seed, TERRAIN_SEED_SALT))
  const ratios = TERRAIN_PRESET_RATIOS[config.terrainPreset]
  const total = size * size

  for (const type of PATCH_GROW_ORDER) {
    growPatches(cells, size, type, Math.round(total * ratios[type]), source)
  }

  keepCenterWalkable(cells, size)
  return {
    cellSize: TERRAIN_CELL_SIZE,
    size,
    cells,
  }
}

export function terrainsEqual(left: TerrainGrid, right: TerrainGrid): boolean {
  if (left.cellSize !== right.cellSize || left.size !== right.size || left.cells.length !== right.cells.length) {
    return false
  }
  for (let i = 0; i < left.cells.length; i += 1) {
    if (left.cells[i] !== right.cells[i]) return false
  }
  return true
}

export function terrainMatchesGeneration(terrain: TerrainGrid, config: WorldConfig): boolean {
  return terrainsEqual(terrain, generateTerrainGrid(config))
}

export function findNearestWalkablePosition(
  terrain: TerrainGrid,
  x: number,
  z: number,
  worldSize: number,
): { x: number; z: number } {
  if (isTerrainWalkable(terrain, x, z, worldSize)) {
    return { x, z }
  }

  const origin = worldToCell(x, z, worldSize, terrain)
  const maxRadius = terrain.size
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let row = origin.row - radius; row <= origin.row + radius; row += 1) {
      for (let col = origin.col - radius; col <= origin.col + radius; col += 1) {
        if (row < 0 || col < 0 || row >= terrain.size || col >= terrain.size) continue
        if (Math.max(Math.abs(row - origin.row), Math.abs(col - origin.col)) !== radius) continue
        if ((terrain.cells[cellIndex(col, row, terrain.size)] ?? 'water') === 'water') continue
        return cellCenter(col, row, terrain, worldSize)
      }
    }
  }

  return { x: 0, z: 0 }
}

export function relocateAgentsOffWater(world: WorldState): { world: WorldState; relocated: number } {
  let relocated = 0
  const agents = world.agents.map((agent) => {
    if (isTerrainWalkable(world.terrain, agent.position.x, agent.position.z, world.config.size)) {
      return agent
    }
    relocated += 1
    return {
      ...agent,
      position: findNearestWalkablePosition(
        world.terrain,
        agent.position.x,
        agent.position.z,
        world.config.size,
      ),
    }
  })

  return {
    world: {
      ...world,
      agents,
    },
    relocated,
  }
}

export function pickTerrainWeightedPoint(
  rng: Rng,
  config: WorldConfig,
  terrain: TerrainGrid,
  type: WorldObjectType,
  isBlocked: (x: number, z: number) => boolean,
  sampleBase: () => { x: number; z: number },
): { x: number; z: number } {
  const maxWeight = maxTerrainSpawnWeight(type)
  if (type === 'food' && rng() < WETLAND_FOOD_BIAS) {
    const wetland = pickPointInTerrain(rng, config, terrain, 'wetland', isBlocked)
    if (wetland) return wetland
  }

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const point = sampleBase()
    if (isBlocked(point.x, point.z)) continue
    const weight = terrainSpawnWeight(
      type,
      getTerrainTypeAt(terrain, point.x, point.z, config.size),
    )
    if (weight <= 0) continue
    if (maxWeight <= 0 || rng() * maxWeight <= weight) {
      return point
    }
  }

  return (
    pickPointInTerrain(rng, config, terrain, preferredTerrainFor(type), isBlocked) ??
    sampleBase()
  )
}

function preferredTerrainFor(type: WorldObjectType): TerrainType {
  if (type === 'tree') return 'forest'
  if (type === 'rock') return 'rocky'
  return 'grassland'
}

function pickPointInTerrain(
  rng: Rng,
  config: WorldConfig,
  terrain: TerrainGrid,
  type: TerrainType,
  isBlocked: (x: number, z: number) => boolean,
): { x: number; z: number } | null {
  const matches: number[] = []
  for (let i = 0; i < terrain.cells.length; i += 1) {
    if (terrain.cells[i] === type) matches.push(i)
  }
  if (matches.length === 0) return null

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const index = matches[Math.floor(rng() * matches.length)]
    if (index === undefined) continue
    const col = index % terrain.size
    const row = Math.floor(index / terrain.size)
    const center = cellCenter(col, row, terrain, config.size)
    const x = clamp(
      center.x + randomInRange(rng, -terrain.cellSize * 0.35, terrain.cellSize * 0.35),
      -config.size * 0.5,
      config.size * 0.5,
    )
    const z = clamp(
      center.z + randomInRange(rng, -terrain.cellSize * 0.35, terrain.cellSize * 0.35),
      -config.size * 0.5,
      config.size * 0.5,
    )
    if (!isBlocked(x, z)) return { x, z }
  }

  return null
}

function cellCenter(
  col: number,
  row: number,
  terrain: TerrainGrid,
  worldSize: number,
): { x: number; z: number } {
  return {
    x: -worldSize * 0.5 + (col + 0.5) * terrain.cellSize,
    z: -worldSize * 0.5 + (row + 0.5) * terrain.cellSize,
  }
}

function growPatches(
  cells: TerrainType[],
  size: number,
  type: TerrainType,
  target: number,
  rng: Rng,
): void {
  if (target <= 0) return

  const frontier: number[] = []
  const seedCount = Math.max(1, Math.round(Math.sqrt(target) * 0.75))

  for (let i = 0; i < seedCount; i += 1) {
    const index = Math.floor(rng() * cells.length)
    if (cells[index] !== 'grassland') continue
    cells[index] = type
    frontier.push(index)
  }

  let placed = frontier.length
  let guard = size * size * 4

  while (placed < target && frontier.length > 0 && guard > 0) {
    guard -= 1
    const frontierIndex = Math.floor(rng() * frontier.length)
    const current = frontier[frontierIndex]
    if (current === undefined) break

    const neighbors = neighborIndexes(current, size)
    shuffleInPlace(neighbors, rng)
    let grew = false

    for (const neighbor of neighbors) {
      if (cells[neighbor] !== 'grassland') continue
      cells[neighbor] = type
      frontier.push(neighbor)
      placed += 1
      grew = true
      if (placed >= target || rng() < 0.42) break
    }

    if (!grew) {
      frontier.splice(frontierIndex, 1)
    }
  }
}

function neighborIndexes(index: number, size: number): number[] {
  const col = index % size
  const row = Math.floor(index / size)
  const next: number[] = []
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dz === 0) continue
      const nextCol = col + dx
      const nextRow = row + dz
      if (nextCol < 0 || nextRow < 0 || nextCol >= size || nextRow >= size) continue
      next.push(cellIndex(nextCol, nextRow, size))
    }
  }
  return next
}

function shuffleInPlace<T>(values: T[], rng: Rng): void {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const current = values[i]
    const swap = values[j]
    if (current === undefined || swap === undefined) continue
    values[i] = swap
    values[j] = current
  }
}

function keepCenterWalkable(cells: TerrainType[], size: number): void {
  const mid = Math.floor(size / 2)
  for (let row = mid - 1; row <= mid + 1; row += 1) {
    for (let col = mid - 1; col <= mid + 1; col += 1) {
      if (row < 0 || col < 0 || row >= size || col >= size) continue
      const index = cellIndex(col, row, size)
      if (cells[index] === 'water') {
        cells[index] = 'grassland'
      }
    }
  }
}

export function isValidTerrainGrid(value: unknown, worldSize: number): value is TerrainGrid {
  if (typeof value !== 'object' || value === null) return false
  const terrain = value as TerrainGrid
  const expectedSize = cellsPerSide(worldSize)
  return (
    terrain.cellSize === TERRAIN_CELL_SIZE &&
    terrain.size === expectedSize &&
    Array.isArray(terrain.cells) &&
    terrain.cells.length === expectedSize * expectedSize &&
    terrain.cells.every(isTerrainType)
  )
}
