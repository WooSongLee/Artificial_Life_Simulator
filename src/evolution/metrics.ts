import { getBrain } from '../learning/brain'
import type { Agent } from '../types/agent'
import { GENOME_GENES, type Genome, type GenomeGene } from './types'

export type GenomeAverages = Genome & {
  sampleCount: number
}

function emptyAverages(): GenomeAverages {
  const averages = { sampleCount: 0 } as GenomeAverages
  for (const gene of GENOME_GENES) {
    averages[gene] = 0
  }
  return averages
}

export function averageGenomes(agents: readonly Agent[]): GenomeAverages {
  if (agents.length === 0) return emptyAverages()

  const sums = emptyAverages()
  for (const agent of agents) {
    for (const gene of GENOME_GENES) {
      sums[gene] += agent.genome[gene]
    }
  }

  const n = agents.length
  const averages = { sampleCount: n } as GenomeAverages
  for (const gene of GENOME_GENES) {
    averages[gene] = sums[gene] / n
  }
  return averages
}

export function genomeFromAverages(averages: GenomeAverages): Genome {
  const genome = {} as Genome
  for (const gene of GENOME_GENES) {
    genome[gene] = averages[gene]
  }
  return genome
}

export function averageLifetimeReward(agents: readonly Agent[]): {
  averageReward: number
  hasLearningSamples: boolean
} {
  let sum = 0
  let count = 0

  for (const agent of agents) {
    const brain = getBrain(agent.id)
    if (!brain || brain.totalSteps === 0) continue
    sum += brain.totalReward / brain.totalSteps
    count += 1
  }

  return {
    averageReward: count === 0 ? 0 : sum / count,
    hasLearningSamples: count > 0,
  }
}

export function geneLabel(gene: GenomeGene): string {
  return GENE_LABELS[gene]
}

export const GENE_LABELS: Record<GenomeGene, string> = {
  speed: 'Speed',
  vision: 'Vision',
  energyEfficiency: 'Energy Efficiency',
  learningRate: 'Learning Rate',
  explorationRate: 'Exploration Rate',
  libido: 'Libido',
  lifespan: 'Lifespan',
  strength: 'Strength',
  aggression: 'Aggression',
  caution: 'Caution',
  toolAffinity: 'Tool Affinity',
}
