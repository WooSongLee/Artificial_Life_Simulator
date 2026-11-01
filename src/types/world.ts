import type { Agent } from './agent'
import type { ForageNode, WorldTool } from './forage'
import type { TerrainGrid, TerrainPreset } from './terrain'

export interface WorldOutcomeStats {
  foodEaten: number
  resourcesGathered: number
  toolPickupAttempts: number
  toolPickupSuccesses: number
  gatherAttempts: number
  gatherSuccesses: number
  damageDealt: number
  damageReceived: number
  attackAttempts: number
  attackHits: number
  defendAttempts: number
  defendReductions: number
  fleeAttempts: number
  fleeSuccesses: number
}

export type WorldObjectType = 'tree' | 'rock' | 'food'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface WorldObject {
  id: string
  type: WorldObjectType
  position: Vec3
  scale: number
  rotation: number
}

export const RESOURCE_DISTRIBUTIONS = ['uniform', 'clustered', 'edge'] as const

export type ResourceDistribution = (typeof RESOURCE_DISTRIBUTIONS)[number]

export interface WorldConfig {
  size: number
  gridDivisions: number
  agentCount: number
  initialFoodCount: number
  foodRegenRate: number
  obstacleDensity: number
  resourceDistribution: ResourceDistribution
  seed: number
  terrainPreset: TerrainPreset
  initialBerryCount: number
  initialRootCount: number
  forageRegenRate: number
  initialBasketCount: number
  initialStickCount: number
  initialSpearCount: number
  initialShieldCount: number
}

export interface WorldState {
  config: WorldConfig
  objects: WorldObject[]
  agents: Agent[]
  forageNodes: ForageNode[]
  worldTools: WorldTool[]
  foodSpawnCooldown: number
  forageSpawnCooldown: number
  generation: number
  generationStartTick: number
  birthCount: number
  terrain: TerrainGrid
  outcomeStats: WorldOutcomeStats
}

export interface ObjectDefinition {
  type: WorldObjectType
  label: string
  category: 'environment' | 'resource'
  description: string
}
