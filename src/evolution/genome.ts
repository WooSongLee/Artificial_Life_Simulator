import { clamp } from '../utils/math'
import type { Rng } from '../utils/random'
import { randomInRange } from '../utils/random'
import { GENE_RANGES } from './constants'
import { GENOME_GENES, type Genome, type GenomeGene } from './types'

export function clampGene(gene: GenomeGene, value: number): number {
  const range = GENE_RANGES[gene]
  return clamp(value, range.min, range.max)
}

export function clampGenome(genome: Genome): Genome {
  return {
    speed: clampGene('speed', genome.speed),
    vision: clampGene('vision', genome.vision),
    energyEfficiency: clampGene('energyEfficiency', genome.energyEfficiency),
    learningRate: clampGene('learningRate', genome.learningRate),
    explorationRate: clampGene('explorationRate', genome.explorationRate),
  }
}

export function createRandomGenome(rng: Rng): Genome {
  return clampGenome({
    speed: randomInRange(rng, GENE_RANGES.speed.min, GENE_RANGES.speed.max),
    vision: randomInRange(rng, GENE_RANGES.vision.min, GENE_RANGES.vision.max),
    energyEfficiency: randomInRange(
      rng,
      GENE_RANGES.energyEfficiency.min,
      GENE_RANGES.energyEfficiency.max,
    ),
    learningRate: randomInRange(rng, GENE_RANGES.learningRate.min, GENE_RANGES.learningRate.max),
    explorationRate: randomInRange(
      rng,
      GENE_RANGES.explorationRate.min,
      GENE_RANGES.explorationRate.max,
    ),
  })
}

export function readGene(genome: Genome, gene: GenomeGene): number {
  return genome[gene]
}

export function withGene(genome: Genome, gene: GenomeGene, value: number): Genome {
  return clampGenome({
    ...genome,
    [gene]: value,
  })
}

export function isSameGenome(left: Genome, right: Genome): boolean {
  return GENOME_GENES.every((gene) => left[gene] === right[gene])
}
