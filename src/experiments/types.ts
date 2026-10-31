import type { EvolutionConfig, GenerationRecord, Genome } from '../evolution/types'
import type { SerializedBrain } from '../learning/brain'
import type { LearningConfig, RewardConfig } from '../learning/types'
import type { LearningHistoryState, SimulationStatus } from '../types/simulation'
import type { WorldConfig, WorldState } from '../types/world'

export interface ExperimentIdentity {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  dirty: boolean
}

export interface ExperimentStatistics {
  populationSurvival: number
  averageReward: number | null
  averageLifespan: number | null
  generationCount: number
  currentGeneration: number
  averageGenome: Genome
  aliveCount: number
  totalAgents: number
  simulationTime: number
  tick: number
}

export interface ExperimentRecord {
  schemaVersion: number
  id: string
  name: string
  createdAt: string
  updatedAt: string
  worldConfig: WorldConfig
  learningConfig: LearningConfig
  rewardConfig: RewardConfig
  evolutionConfig: EvolutionConfig
  learningEnabled: boolean
  speed: number
  status: SimulationStatus
  tick: number
  world: WorldState
  brains: SerializedBrain[]
  learningHistory: LearningHistoryState
  generationHistory: GenerationRecord[]
  statistics: ExperimentStatistics
}

export interface ExperimentSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  currentGeneration: number
  tick: number
  statistics: ExperimentStatistics
  worldConfig: WorldConfig
  learningConfig: LearningConfig
}

export interface ExperimentComparisonRow {
  key: string
  label: string
  format: 'percent' | 'number' | 'integer' | 'emptyable'
  values: Array<number | null>
}

export interface ValidationIssue {
  path: string
  message: string
}

export interface ValidationResult<T> {
  ok: boolean
  value?: T
  issues: ValidationIssue[]
}
