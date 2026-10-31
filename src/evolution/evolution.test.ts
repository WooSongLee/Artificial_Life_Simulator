import { describe, expect, it } from 'vitest'
import { resetBrains } from '../learning/brain'
import { DEFAULT_LEARNING_CONFIG } from '../learning/constants'
import { DEFAULT_WORLD_CONFIG } from '../simulation/constants'
import { createInitialWorld } from '../simulation/worldFactory'
import { DEFAULT_EVOLUTION_CONFIG, GENE_RANGES } from './constants'
import { crossoverGenomes, genomeUsesParentValues } from './crossover'
import { clampGenome, createRandomGenome } from './genome'
import { processMating } from './mating'
import { mutateGenome } from './mutation'
import { canStartMating, isMating } from './reproduction'
import { GENOME_GENES } from './types'
import { mulberry32 } from '../utils/random'

function readyMates() {
  const world = createInitialWorld({ ...DEFAULT_WORLD_CONFIG, agentCount: 2 })
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)
  const first = world.agents[0]
  const second = world.agents[1]
  if (!first || !second) throw new Error('expected two agents')

  return {
    world: {
      ...world,
      agents: [
        {
          ...first,
          desire: 90,
          age: 24,
          energy: 80,
          health: 100,
          alive: true,
          position: { x: 0, z: 0 },
        },
        {
          ...second,
          desire: 88,
          age: 22,
          energy: 76,
          health: 100,
          alive: true,
          position: { x: 0.5, z: 0.1 },
        },
      ],
    },
  }
}

describe('mutation', () => {
  it('keeps every gene inside its range and can change values', () => {
    const rng = mulberry32(11)
    const source = createRandomGenome(() => 0.5)
    const forced = mutateGenome(source, { mutationRate: 1, mutationScale: 0.18 }, rng)

    expect(forced.mutatedGenes).toHaveLength(GENOME_GENES.length)
    for (const gene of GENOME_GENES) {
      const range = GENE_RANGES[gene]
      expect(forced.genome[gene]).toBeGreaterThanOrEqual(range.min)
      expect(forced.genome[gene]).toBeLessThanOrEqual(range.max)
    }
    expect(GENOME_GENES.some((gene) => forced.genome[gene] !== source[gene])).toBe(true)

    const none = mutateGenome(source, { mutationRate: 0, mutationScale: 0.5 }, rng)
    expect(none.mutatedGenes).toHaveLength(0)
    expect(GENOME_GENES.every((gene) => none.genome[gene] === source[gene])).toBe(true)
  })

  it('clamps genome values that fall outside the legal range', () => {
    const genome = clampGenome({
      speed: 99,
      vision: -4,
      energyEfficiency: 4,
      learningRate: -1,
      explorationRate: 2,
      libido: 9,
      lifespan: 1,
    })
    expect(genome.speed).toBe(GENE_RANGES.speed.max)
    expect(genome.vision).toBe(GENE_RANGES.vision.min)
    expect(genome.lifespan).toBe(GENE_RANGES.lifespan.min)
  })
})

describe('reproduction', () => {
  it('copies each gene from one of the two parents', () => {
    const rng = mulberry32(3)
    const parentA = createRandomGenome(rng)
    const parentB = createRandomGenome(rng)
    const child = crossoverGenomes(parentA, parentB, rng)
    expect(genomeUsesParentValues(child, parentA, parentB)).toBe(true)
  })

  it('creates one child after nearby adults finish mating', () => {
    const { world } = readyMates()
    const paired = processMating(world, 10, { ...DEFAULT_EVOLUTION_CONFIG, mutationRate: 0 }, () => 0.25)
    expect(paired.world.agents.filter(isMating)).toHaveLength(2)
    expect(paired.born).toHaveLength(0)

    const finished = processMating(
      {
        ...paired.world,
        agents: paired.world.agents.map((agent) => ({ ...agent, matingTimeLeft: 0 })),
      },
      20,
      { ...DEFAULT_EVOLUTION_CONFIG, mutationRate: 0 },
      () => 0.25,
    )

    expect(finished.born).toHaveLength(1)
    expect(finished.born[0]?.generation).toBe(2)
    expect(finished.world.generation).toBe(2)
    expect(finished.recordedGeneration).toBe(1)
  })

  it('respects the population limit when a child would be born', () => {
    const { world } = readyMates()
    const paired = processMating(world, 4, { ...DEFAULT_EVOLUTION_CONFIG, mutationRate: 0 }, () => 0.2)
    const finished = processMating(
      {
        ...paired.world,
        agents: paired.world.agents.map((agent) => ({ ...agent, matingTimeLeft: 0 })),
      },
      5,
      { ...DEFAULT_EVOLUTION_CONFIG, populationLimit: 2, mutationRate: 0 },
      () => 0.2,
    )

    expect(finished.born).toHaveLength(0)
    expect(finished.world.agents.every((agent) => agent.desire <= 8)).toBe(true)
  })

  it('does not let dead or immature agents start mating', () => {
    const world = createInitialWorld({ ...DEFAULT_WORLD_CONFIG, agentCount: 3 })
    const [first, second, third] = world.agents
    if (!first || !second || !third) throw new Error('expected three agents')

    const mixed = [
      { ...first, alive: false, health: 0, desire: 100, age: 30, energy: 80 },
      { ...second, desire: 100, age: 4, energy: 80 },
      { ...third, desire: 100, age: 30, energy: 80 },
    ]

    expect(canStartMating(mixed[0]!)).toBe(false)
    expect(canStartMating(mixed[1]!)).toBe(false)
    expect(canStartMating(mixed[2]!)).toBe(true)
  })
})
