export {
  DEFAULT_EVOLUTION_CONFIG,
  GENE_DEFAULTS,
  GENE_RANGES,
  GENERATION_DURATION_PRESETS,
  isGeneticsEnabled,
} from './constants'
export { crossoverGenomes } from './crossover'
export {
  appendGenerationRecord,
  collectGenerationRecord,
  generationElapsed,
  generationRemaining,
  hasGenerationRecord,
} from './generations'
export { clampGenome, createDefaultGenome, createRandomGenome, normalizeGenome } from './genome'
export { assignChildBrains, cloneQTable, inheritBrain } from './inheritance'
export { processMating } from './mating'
export { mutateGenome } from './mutation'
export {
  breedChild,
  canReproduce,
  canStartMating,
  computeFitness,
  eligibleParents,
  isMating,
  isPaired,
  nextGenerationSize,
} from './reproduction'
export { GENOME_GENES } from './types'

export type {
  EvolutionConfig,
  GenerationEndReason,
  GenerationRecord,
  Genome,
  GenomeGene,
  MutationSummary,
} from './types'
