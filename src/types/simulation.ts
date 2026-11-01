import type { ExperimentIdentity, ExperimentRecord } from '../experiments/types'
import type { EvolutionConfig, GenerationRecord } from '../evolution/types'
import type { IntervalActionAnalytics } from '../learning/analytics'
import type { AgentAction, LearningConfig, RewardConfig } from '../learning/types'
import type { AgentStats, AgentTrail } from './agent'
import type { WorldConfig, WorldObjectType, WorldState } from './world'

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'ended'

export interface ViewerSettings {
  showGrid: boolean
  showTrees: boolean
  showRocks: boolean
  showFood: boolean
  showForage: boolean
  showTools: boolean
  showAgents: boolean
  showAgentTrails: boolean
  showVisionRange: boolean
  showFoodSeek: boolean
  showActionMarkers: boolean
  showActionCues: boolean
  followSelectedAgent: boolean
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
  actionCounts?: Record<AgentAction, number>
  analytics?: IntervalActionAnalytics
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
  berryCount: number
  rootCount: number
  toolCount: number
  totalAgents: number
  aliveCount: number
  deadCount: number
  averageEnergy: number
  averageHealth: number
  averageLifespan: number
  generation: number
  generationElapsed: number
  birthCount: number
  matingCount: number
  averageDesire: number
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
  rewardConfig: RewardConfig
  evolutionConfig: EvolutionConfig
  pendingWorldConfig: WorldConfig | null
  experiment: ExperimentIdentity
  hydrated: boolean
  migrationNotice: string | null
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
  setGeneticsEnabled: (enabled: boolean) => void
  setInheritQTable: (enabled: boolean) => void
  setPopulationLimit: (limit: number) => void
  setAgentCount: (count: number) => void
  advance: (steps: number, budgetMs?: number) => void
  setWorldConfig: (config: Partial<WorldConfig>) => void
  setLearningConfig: (config: Partial<LearningConfig>) => void
  setRewardConfig: (config: Partial<RewardConfig>) => void
  setExperimentName: (name: string) => void
  newExperiment: () => void
  loadExperimentRecord: (record: ExperimentRecord) => void
  dismissMigrationNotice: () => void
  markSaved: (updatedAt: string) => void
  markHydrated: () => void
  addObject: (type: WorldObjectType) => void
  resetCamera: () => void
}

export type { AgentStats }
