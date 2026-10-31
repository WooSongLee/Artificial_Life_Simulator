import type { LearningConfig } from '../learning/types'
import type { AgentStats, AgentTrail } from './agent'
import type { WorldObjectType, WorldState } from './world'

export type SimulationStatus = 'idle' | 'running' | 'paused'

export interface ViewerSettings {
  showGrid: boolean
  showTrees: boolean
  showRocks: boolean
  showFood: boolean
  showAgents: boolean
}

export interface WorldStats {
  tick: number
  speed: number
  status: SimulationStatus
  simulationTime: number
  totalObjects: number
  treeCount: number
  rockCount: number
  foodCount: number
  totalAgents: number
  aliveCount: number
  deadCount: number
  averageEnergy: number
  averageHealth: number
  averageLifespan: number
}

export interface SimulationSnapshot {
  tick: number
  world: WorldState
}

export interface SimulationState {
  status: SimulationStatus
  tick: number
  speed: number
  world: WorldState
  selectedObjectId: string | null
  agentTrails: Record<string, AgentTrail>
  settings: ViewerSettings
  cameraResetToken: number
  learningEnabled: boolean
  learningConfig: LearningConfig
}

export interface SimulationActions {
  play: () => void
  pause: () => void
  reset: () => void
  step: (dt?: number) => void
  setSpeed: (speed: number) => void
  selectObject: (id: string | null) => void
  setSetting: <K extends keyof ViewerSettings>(key: K, value: ViewerSettings[K]) => void
  setLearningEnabled: (enabled: boolean) => void
  setEpsilonDecay: (decay: number) => void
  addObject: (type: WorldObjectType) => void
  resetCamera: () => void
}

export type { AgentStats }
