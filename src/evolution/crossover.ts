import type { Rng } from '../utils/random'
import { GENOME_GENES, type Genome } from './types'

export function crossoverGenomes(parentA: Genome, parentB: Genome, rng: Rng): Genome {
  const child = {} as Genome
  for (const gene of GENOME_GENES) {
    child[gene] = pickGene(parentA[gene], parentB[gene], rng)
  }
  return child
}

function pickGene(left: number, right: number, rng: Rng): number {
  return rng() < 0.5 ? left : right
}

export function genomeUsesParentValues(child: Genome, parentA: Genome, parentB: Genome): boolean {
  return GENOME_GENES.every((gene) => child[gene] === parentA[gene] || child[gene] === parentB[gene])
}
