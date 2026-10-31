import type { Rng } from '../utils/random'
import { GENOME_GENES, type Genome } from './types'

export function crossoverGenomes(parentA: Genome, parentB: Genome, rng: Rng): Genome {
  return {
    speed: pickGene(parentA.speed, parentB.speed, rng),
    vision: pickGene(parentA.vision, parentB.vision, rng),
    energyEfficiency: pickGene(parentA.energyEfficiency, parentB.energyEfficiency, rng),
    learningRate: pickGene(parentA.learningRate, parentB.learningRate, rng),
    explorationRate: pickGene(parentA.explorationRate, parentB.explorationRate, rng),
  }
}

function pickGene(left: number, right: number, rng: Rng): number {
  return rng() < 0.5 ? left : right
}

export function genomeUsesParentValues(child: Genome, parentA: Genome, parentB: Genome): boolean {
  return GENOME_GENES.every((gene) => child[gene] === parentA[gene] || child[gene] === parentB[gene])
}
