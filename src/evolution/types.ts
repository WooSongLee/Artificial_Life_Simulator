export const GENOME_GENES = [
  'speed',
  'vision',
  'energyEfficiency',
  'learningRate',
  'explorationRate',
  'libido',
  'lifespan',
  'strength',
  'aggression',
  'caution',
  'toolAffinity',
] as const

export type GenomeGene = (typeof GENOME_GENES)[number]

export interface Genome {
  speed: number
  vision: number
  energyEfficiency: number
  learningRate: number
  explorationRate: number
  libido: number
  lifespan: number
  strength: number
  aggression: number
  caution: number
  toolAffinity: number
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
  geneticsEnabled: boolean
}

export type GenerationEndReason = 'birth' | 'extinction'

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
  averageStrength: number | null
  averageAggression: number | null
  averageCaution: number | null
  averageToolAffinity: number | null
  hasLearningSamples: boolean
  mutation: MutationSummary
  endedAtTick: number
  endedAtTime: number
  duration: number
  endReason: GenerationEndReason
}
