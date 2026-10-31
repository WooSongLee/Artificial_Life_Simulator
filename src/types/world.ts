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

export interface WorldConfig {
  size: number
  gridDivisions: number
  agentCount: number
}

export interface WorldState {
  config: WorldConfig
  objects: WorldObject[]
  agents: Agent[]
  foodSpawnCooldown: number
  generation: number
  generationStartTick: number
}

export interface ObjectDefinition {
  type: WorldObjectType
  label: string
  category: 'environment' | 'resource'
  description: string
}
