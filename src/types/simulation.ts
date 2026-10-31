import type { EvolutionConfig, GenerationRecord } from '../evolution/types'
import type { LearningConfig } from '../learning/types'
import type { AgentStats, AgentTrail } from './agent'
import type { WorldObjectType, WorldState } from './world'

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'ended'

export interface ViewerSettings {
  showGrid: boolean
  showTrees: boolean
  showRocks: boolean
  showFood: boolean
  showAgents: boolean
  showAgentTrails: boolean
  showVisionRange: boolean
  showFoodSeek: boolean
  showActionMarkers: boolean
}

export interface LearningHistoryPoint {
  tick: number
  time: number
  averageReward: number
  averageSurvivalTime: number
  averageEnergy: number
  learningSteps: number
  explorationRate: number
  populationSize: number
  hasLearningSamples: boolean
  hasSurvivalSamples: boolean
}

export interface LearningHistoryState {
  series: LearningHistoryPoint[]
  earlySeries: LearningHistoryPoint[]
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
  generation: number
  generationElapsed: number
  generationRemaining: number
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
  learningHistory: LearningHistoryState
  generationHistory: GenerationRecord[]
  settings: ViewerSettings
  cameraResetToken: number
  learningEnabled: boolean
  learningConfig: LearningConfig
  evolutionConfig: EvolutionConfig
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
  setInheritQTable: (enabled: boolean) => void
  setPopulationLimit: (limit: number) => void
  setGenerationDuration: (seconds: number) => void
  setAgentCount: (count: number) => void
  addObject: (type: WorldObjectType) => void
  resetCamera: () => void
}

export type { AgentStats }
