import { AGENT_SPEED_RANGE, AGENT_VISION_RANGE, MAX_AGENT_COUNT } from '../simulation/constants'
import type { EvolutionConfig, GeneRange, GenomeGene } from './types'

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  generationDuration: 120,
  mutationRate: 0.15,
  mutationScale: 0.18,
  populationLimit: MAX_AGENT_COUNT,
  inheritQTable: false,
}

export const GENERATION_DURATION_PRESETS = [60, 90, 120, 180] as const
export const MIN_GENERATION_DURATION = 30
export const MAX_GENERATION_DURATION = 300
export const MAX_GENERATION_RECORDS = 200

export const GENE_RANGES: Record<GenomeGene, GeneRange> = {
  speed: { min: AGENT_SPEED_RANGE[0], max: AGENT_SPEED_RANGE[1] },
  vision: { min: AGENT_VISION_RANGE[0], max: AGENT_VISION_RANGE[1] },
  energyEfficiency: { min: 0.85, max: 1.2 },
  learningRate: { min: 0.05, max: 0.25 },
  explorationRate: { min: 0.5, max: 1 },
}

export const FITNESS_AGE_WEIGHT = 1
export const FITNESS_REWARD_WEIGHT = 0.2
export const FITNESS_ENERGY_WEIGHT = 0.5
