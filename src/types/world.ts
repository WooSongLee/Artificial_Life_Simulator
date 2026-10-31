import type { Agent } from './agent'

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
}

export interface WorldState {
  config: WorldConfig
  objects: WorldObject[]
  agents: Agent[]
  foodSpawnCooldown: number
  generation: number
  generationStartTick: number
  birthCount: number
}

export interface ObjectDefinition {
  type: WorldObjectType
  label: string
  category: 'environment' | 'resource'
  description: string
}
