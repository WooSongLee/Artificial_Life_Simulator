export const GENOME_GENES = [
  'speed',
  'vision',
  'energyEfficiency',
  'learningRate',
  'explorationRate',
] as const

export type GenomeGene = (typeof GENOME_GENES)[number]

export interface Genome {
  speed: number
  vision: number
  energyEfficiency: number
  learningRate: number
  explorationRate: number
}

export interface GeneRange {
  min: number
  max: number
}

export interface EvolutionConfig {
  generationDuration: number
  mutationRate: number
  mutationScale: number
  populationLimit: number
  inheritQTable: boolean
}

export type GenerationEndReason = 'time' | 'extinction'

export interface MutationSummary {
  mutatedAgentCount: number
  mutatedGeneCount: number
  mutationRate: number
}

export interface GenerationRecord {
  generation: number
  populationSize: number
  aliveCount: number
  survivalRate: number
  averageLifespan: number
  averageReward: number
  averageSpeed: number
  averageVision: number
  averageEnergyEfficiency: number
  averageLearningRate: number
  averageExplorationRate: number
  hasLearningSamples: boolean
  mutation: MutationSummary
  endedAtTick: number
  endedAtTime: number
  duration: number
  endReason: GenerationEndReason
}
