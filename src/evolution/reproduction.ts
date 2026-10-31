import { getBrain } from '../learning/brain'
import { clampAgentCount, MIN_AGENT_COUNT } from '../simulation/constants'
import type { Agent } from '../types/agent'
import { clamp } from '../utils/math'
import type { Rng } from '../utils/random'
import { FITNESS_AGE_WEIGHT, FITNESS_ENERGY_WEIGHT, FITNESS_REWARD_WEIGHT } from './constants'
import { crossoverGenomes } from './crossover'
import { mutateGenome } from './mutation'
import type { EvolutionConfig, Genome, GenomeGene } from './types'

export interface OffspringBlueprint {
  genome: Genome
  parentIds: [string, string]
  inheritParentId: string
  mutatedGenes: GenomeGene[]
}

export function canReproduce(agent: Agent): boolean {
  return agent.alive && agent.health > 0
}

export function eligibleParents(agents: readonly Agent[]): Agent[] {
  return agents.filter(canReproduce)
}

export function computeFitness(agent: Agent): number {
  const reward = getBrain(agent.id)?.totalReward ?? 0
  return (
    agent.age * FITNESS_AGE_WEIGHT +
    Math.max(0, reward) * FITNESS_REWARD_WEIGHT +
    agent.energy * FITNESS_ENERGY_WEIGHT
  )
}

export function nextGenerationSize(agentCount: number, populationLimit: number): number {
  return clampAgentCount(clamp(agentCount, MIN_AGENT_COUNT, populationLimit))
}

export function selectParent(parents: readonly Agent[], rng: Rng): Agent {
  const first = parents[0]
  if (!first) {
    throw new Error('selectParent requires at least one eligible parent')
  }
  if (parents.length === 1) return first

  const weights = parents.map((parent) => Math.max(0, computeFitness(parent)))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) {
    return parents[Math.min(parents.length - 1, Math.floor(rng() * parents.length))] ?? first
  }

  let cursor = rng() * total
  for (let i = 0; i < parents.length; i += 1) {
    cursor -= weights[i] ?? 0
    if (cursor <= 0) {
      return parents[i] ?? first
    }
  }

  return parents[parents.length - 1] ?? first
}

export function breedOffspring(
  parents: readonly Agent[],
  count: number,
  config: Pick<EvolutionConfig, 'mutationRate' | 'mutationScale' | 'populationLimit'>,
  rng: Rng,
): OffspringBlueprint[] {
  if (parents.length === 0 || count <= 0) return []

  const size = nextGenerationSize(count, config.populationLimit)
  const offspring: OffspringBlueprint[] = []

  for (let i = 0; i < size; i += 1) {
    const parentA = selectParent(parents, rng)
    const parentB = selectParent(parents, rng)
    const crossed = crossoverGenomes(parentA.genome, parentB.genome, rng)
    const mutated = mutateGenome(crossed, config, rng)
    const inheritParent = computeFitness(parentA) >= computeFitness(parentB) ? parentA : parentB

    offspring.push({
      genome: mutated.genome,
      parentIds: [parentA.id, parentB.id],
      inheritParentId: inheritParent.id,
      mutatedGenes: mutated.mutatedGenes,
    })
  }

  return offspring
}
