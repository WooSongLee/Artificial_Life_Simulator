import { AGENT_SPEED_RANGE, AGENT_VISION_RANGE, MAX_AGENT_COUNT } from '../simulation/constants'
import type { EvolutionConfig, GeneRange, GenomeGene } from './types'

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  generationDuration: 120,
  mutationRate: 0.15,
  mutationScale: 0.18,
  populationLimit: MAX_AGENT_COUNT,
  inheritQTable: false,
  geneticsEnabled: false,
}

export function isGeneticsEnabled(value?: boolean): boolean {
  return value !== false
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
  libido: { min: 0.45, max: 1.35 },
  lifespan: { min: 240, max: 480 },
  // Personality genes are centered on 1.0 so a missing/default value is a no-op.
  strength: { min: 0.6, max: 1.4 },
  aggression: { min: 0.4, max: 1.6 },
  caution: { min: 0.4, max: 1.6 },
  toolAffinity: { min: 0.6, max: 1.4 },
}

export const GENE_DEFAULTS: Record<GenomeGene, number> = {
  speed: (AGENT_SPEED_RANGE[0] + AGENT_SPEED_RANGE[1]) / 2,
  vision: (AGENT_VISION_RANGE[0] + AGENT_VISION_RANGE[1]) / 2,
  energyEfficiency: 1,
  learningRate: 0.1,
  explorationRate: 1,
  libido: 0.9,
  lifespan: 360,
  strength: 1,
  aggression: 1,
  caution: 1,
  toolAffinity: 1,
}

export const GENETIC_BIAS_SCALE = 0.4
export const GENETIC_BIAS_MAX = 0.25
export const CAUTION_HEALTH_THRESHOLD = 33
export const TOOL_WEAR_COST_MIN = 0.5
export const TOOL_WEAR_COST_MAX = 2

export const DESIRE_GAIN_PER_SEC = 3.2
export const DESIRE_MATE_THRESHOLD = 70
export const DESIRE_AFTER_MATING = 8
export const MIN_REPRODUCE_AGE = 16
export const MIN_MATING_ENERGY = 28
export const MATING_RANGE = 1.7
export const MATING_DURATION = 2.4
export const MATING_ENERGY_DRAIN_PER_SEC = 8
export const MAX_DEAD_AGENTS = 40

export const FITNESS_AGE_WEIGHT = 1
export const FITNESS_REWARD_WEIGHT = 0.2
export const FITNESS_ENERGY_WEIGHT = 0.5
