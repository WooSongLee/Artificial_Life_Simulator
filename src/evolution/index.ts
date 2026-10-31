export { DEFAULT_EVOLUTION_CONFIG, GENE_RANGES, GENERATION_DURATION_PRESETS } from './constants'
export { crossoverGenomes } from './crossover'
export {
  appendGenerationRecord,
  collectGenerationRecord,
  createNextGeneration,
  generationElapsed,
  generationRemaining,
  shouldEndGeneration,
} from './generations'
export { clampGenome, createRandomGenome } from './genome'
export { assignChildBrains, cloneQTable, inheritBrain } from './inheritance'
export { mutateGenome } from './mutation'
export { canReproduce, computeFitness, eligibleParents, nextGenerationSize } from './reproduction'
export { GENOME_GENES } from './types'

export type {
  EvolutionConfig,
  GenerationEndReason,
  GenerationRecord,
  Genome,
  GenomeGene,
  MutationSummary,
} from './types'
