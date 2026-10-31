import type { Rng } from '../utils/random'
import { GENE_RANGES } from './constants'
import { clampGenome } from './genome'
import { GENOME_GENES, type EvolutionConfig, type Genome, type GenomeGene } from './types'

export interface MutationResult {
  genome: Genome
  mutatedGenes: GenomeGene[]
}

export function mutateGeneValue(
  gene: GenomeGene,
  value: number,
  mutationScale: number,
  rng: Rng,
): number {
  const range = GENE_RANGES[gene]
  const span = range.max - range.min
  const delta = (rng() * 2 - 1) * mutationScale * span
  return value + delta
}

export function mutateGenome(
  genome: Genome,
  config: Pick<EvolutionConfig, 'mutationRate' | 'mutationScale'>,
  rng: Rng,
): MutationResult {
  const next: Genome = { ...genome }
  const mutatedGenes: GenomeGene[] = []

  for (const gene of GENOME_GENES) {
    if (rng() >= config.mutationRate) continue
    next[gene] = mutateGeneValue(gene, genome[gene], config.mutationScale, rng)
    mutatedGenes.push(gene)
  }

  return {
    genome: clampGenome(next),
    mutatedGenes,
  }
}
