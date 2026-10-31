import type { AgentAction } from '../learning/types'

export interface AgentPosition {
  x: number
  z: number
}

export interface Agent {
  id: string
  position: AgentPosition
  rotation: number
  energy: number
  hunger: number
  health: number
  speed: number
  vision: number
  age: number
  alive: boolean
  turnRate: number
  turnBias: number
  wanderTimer: number
  wanderInterval: number
  lastAction: AgentAction | null
  lastReward: number
  lastStateKey: string | null
}

export type AgentTrail = AgentPosition[]

export interface AgentStats {
  totalAgents: number
  aliveCount: number
  deadCount: number
  averageEnergy: number
  averageHealth: number
  averageLifespan: number
}
