import { clamp } from '../utils/math'
import type { Rng } from '../utils/random'
import { randomInRange } from '../utils/random'
import { GENE_DEFAULTS, GENE_RANGES } from './constants'
import { GENOME_GENES, type Genome, type GenomeGene } from './types'

export function geneDefault(gene: GenomeGene): number {
  return GENE_DEFAULTS[gene]
}

export function clampGene(gene: GenomeGene, value: number): number {
  const range = GENE_RANGES[gene]
  return clamp(value, range.min, range.max)
}

export function clampGenome(genome: Genome): Genome {
  const next = { ...genome }
  for (const gene of GENOME_GENES) {
    next[gene] = clampGene(gene, genome[gene])
  }
  return next
}

export function createDefaultGenome(defaults?: Partial<Genome>): Genome {
  return clampGenome({
    ...GENE_DEFAULTS,
    ...defaults,
  })
}

export function createRandomGenome(rng: Rng, defaults?: Partial<Genome>): Genome {
  const genome = {} as Genome
  for (const gene of GENOME_GENES) {
    const override = defaults?.[gene]
    genome[gene] =
      override === undefined
        ? randomInRange(rng, GENE_RANGES[gene].min, GENE_RANGES[gene].max)
        : override
  }
  return clampGenome(genome)
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeGenome(value: unknown): Genome {
  const source = isRecord(value) ? value : {}
  const genome = {} as Genome
  for (const gene of GENOME_GENES) {
    const raw = source[gene]
    genome[gene] = typeof raw === 'number' && Number.isFinite(raw) ? raw : geneDefault(gene)
  }
  return clampGenome(genome)
}

export function cloneGenome(genome: Genome): Genome {
  return clampGenome({ ...genome })
}
