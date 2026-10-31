import { getBrain, resetBrains, setBrain } from '../learning/brain'
import { DEFAULT_LEARNING_CONFIG } from '../learning/constants'
import { createEmptyQValues } from '../learning/qLearning'
import { DEFAULT_WORLD_CONFIG, SIMULATION_STEP_DT } from '../simulation/constants'
import { createInitialWorld } from '../simulation/worldFactory'
import { mulberry32 } from '../utils/random'
import { DEFAULT_EVOLUTION_CONFIG, GENE_RANGES } from './constants'
import { crossoverGenomes, genomeUsesParentValues } from './crossover'
import {
  collectGenerationRecord,
  createNextGeneration,
  shouldEndGeneration,
} from './generations'
import { clampGenome, createRandomGenome } from './genome'
import { assignChildBrains, cloneQTable } from './inheritance'
import { mutateGenome } from './mutation'
import { canReproduce, eligibleParents, nextGenerationSize } from './reproduction'
import { GENOME_GENES } from './types'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function almostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-10
}

function genomeClampAndRange(): void {
  const genome = clampGenome({
    speed: 99,
    vision: -4,
    energyEfficiency: 4,
    learningRate: -1,
    explorationRate: 2,
  })

  assert(genome.speed === GENE_RANGES.speed.max, 'speed must clamp to max')
  assert(genome.vision === GENE_RANGES.vision.min, 'vision must clamp to min')
  assert(genome.energyEfficiency === GENE_RANGES.energyEfficiency.max, 'efficiency must clamp')
  assert(genome.learningRate === GENE_RANGES.learningRate.min, 'learning rate must clamp')
  assert(genome.explorationRate === GENE_RANGES.explorationRate.max, 'exploration must clamp')
}

function crossoverCopiesParentGenes(): void {
  const rng = mulberry32(3)
  const parentA = createRandomGenome(rng)
  const parentB = createRandomGenome(rng)
  const child = crossoverGenomes(parentA, parentB, rng)

  assert(genomeUsesParentValues(child, parentA, parentB), 'crossover must pick each gene from a parent')
}

function mutationStaysInRangeAndCanChange(): void {
  const rng = mulberry32(11)
  const source = createRandomGenome(() => 0.5)
  const forced = mutateGenome(source, { mutationRate: 1, mutationScale: 0.18 }, rng)

  assert(forced.mutatedGenes.length === GENOME_GENES.length, 'mutationRate 1 must touch every gene')
  for (const gene of GENOME_GENES) {
    const range = GENE_RANGES[gene]
    assert(forced.genome[gene] >= range.min && forced.genome[gene] <= range.max, `${gene} left its range`)
  }
  assert(
    GENOME_GENES.some((gene) => forced.genome[gene] !== source[gene]),
    'mutation must be able to change at least one gene',
  )

  const none = mutateGenome(source, { mutationRate: 0, mutationScale: 0.5 }, rng)
  assert(none.mutatedGenes.length === 0, 'mutationRate 0 must not mark genes')
  assert(
    GENOME_GENES.every((gene) => none.genome[gene] === source[gene]),
    'mutationRate 0 must keep the parent genome',
  )
}

function onlySurvivorsReproduce(): void {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 6,
  })
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)

  const mixed = {
    ...world,
    agents: world.agents.map((agent, index) =>
      index < 4 ? { ...agent, alive: false, health: 0 } : agent,
    ),
  }

  const parents = eligibleParents(mixed.agents)
  assert(parents.length === 2, `expected 2 living parents, got ${parents.length}`)
  assert(
    parents.every((agent) => canReproduce(agent)),
    'dead agents must not be eligible parents',
  )

  const next = createNextGeneration(
    mixed,
    100,
    { ...DEFAULT_EVOLUTION_CONFIG, mutationRate: 0 },
    () => 0.25,
  )
  assert(next !== null, 'two survivors must produce a next generation')
  assert(
    next?.world.agents.every((child) => {
      const [a, b] = child.parentIds ?? []
      return parents.some((parent) => parent.id === a) && parents.some((parent) => parent.id === b)
    }) ?? false,
    'children must only list surviving parents',
  )
}

function populationLimitIsHonored(): void {
  assert(nextGenerationSize(40, 12) === 12, 'next generation must respect population limit')
  assert(nextGenerationSize(3, 50) === 3, 'next generation must follow the configured count when lower')

  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 8,
  })
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)
  const next = createNextGeneration(
    world,
    20,
    { ...DEFAULT_EVOLUTION_CONFIG, populationLimit: 5, mutationRate: 0 },
    mulberry32(4),
  )

  assert(next !== null, 'living population must breed')
  assert(next?.world.agents.length === 5, `expected 5 children, got ${next?.world.agents.length}`)
}

function generationEndsOnTimeOrExtinction(): void {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 3,
  })
  const config = { ...DEFAULT_EVOLUTION_CONFIG, generationDuration: 10 }

  assert(shouldEndGeneration(world, 1, config) === null, 'a living generation must continue before the time limit')
  assert(
    shouldEndGeneration(world, Math.round(10 / SIMULATION_STEP_DT), config) === 'time',
    'elapsed generation time must end the generation',
  )
  assert(
    shouldEndGeneration(
      { ...world, agents: world.agents.map((agent) => ({ ...agent, alive: false, health: 0 })) },
      4,
      config,
    ) === 'extinction',
    'all-dead populations must end the generation',
  )
  assert(
    createNextGeneration(
      { ...world, agents: world.agents.map((agent) => ({ ...agent, alive: false, health: 0 })) },
      4,
      config,
      Math.random,
    ) === null,
    'extinction must not invent children',
  )
}

function generationRecordUsesMeasuredValues(): void {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 2,
  })
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)

  const first = world.agents[0]
  const second = world.agents[1]
  if (!first || !second) throw new Error('expected two agents')

  const measured = {
    ...world,
    generation: 3,
    generationStartTick: 0,
    agents: [
      { ...first, age: 12, alive: true, genome: { ...first.genome, speed: 2, vision: 8, energyEfficiency: 1 } },
      { ...second, age: 8, alive: false, genome: { ...second.genome, speed: 1, vision: 10, energyEfficiency: 1.1 } },
    ],
  }

  const brain = getBrain(first.id)
  if (!brain) throw new Error('expected a brain')
  brain.totalSteps = 4
  brain.totalReward = 8

  const record = collectGenerationRecord(measured, 40, 'time', 0.15)
  assert(record.generation === 3, 'record must keep the generation number')
  assert(record.populationSize === 2, 'record must count the actual population')
  assert(record.aliveCount === 1, 'record must count living agents')
  assert(almostEqual(record.survivalRate, 0.5), 'survival rate must be alive/total')
  assert(almostEqual(record.averageLifespan, 10), 'lifespan must average all ages in the generation')
  assert(almostEqual(record.averageSpeed, 1.5), 'average speed must come from genomes')
  assert(almostEqual(record.averageVision, 9), 'average vision must come from genomes')
  assert(almostEqual(record.averageEnergyEfficiency, 1.05), 'average efficiency must come from genomes')
  assert(almostEqual(record.averageReward, 2), 'average reward must be totalReward / steps')
  assert(record.hasLearningSamples, 'learning samples must be marked when steps exist')
  assert(record.endReason === 'time', 'record must keep the real end reason')
}

function qTableInheritanceCopiesButStaysSeparate(): void {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 2,
  })
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)
  for (const parent of world.agents) {
    const parentBrain = getBrain(parent.id)
    if (!parentBrain) throw new Error('expected a parent brain')
    parentBrain.qTable.set('low|low|none|out|no', [1, 2, 3, 4, 5])
  }

  const childWorld = createNextGeneration(world, 10, { ...DEFAULT_EVOLUTION_CONFIG, mutationRate: 0 }, () => 0.2)
  assert(childWorld !== null, 'parents must produce children')
  if (!childWorld) return

  assignChildBrains(childWorld.world.agents, true, DEFAULT_LEARNING_CONFIG, setBrain)
  const child = childWorld.world.agents[0]
  const childBrain = child ? getBrain(child.id) : undefined
  assert(childBrain !== undefined, 'inherited child must have a brain')
  const inherited = childBrain?.qTable.get('low|low|none|out|no')
  assert(inherited?.[1] === 2, 'child must receive a copy of the parent Q values')

  if (inherited) inherited[1] = 99
  const parentId = child?.inheritParentId
  const parentBrain = parentId ? getBrain(parentId) : undefined
  assert(parentBrain?.qTable.get('low|low|none|out|no')?.[1] === 2, 'mutating the child Q-table must not change the parent')
  assert(childBrain?.totalSteps === 0, 'inherited knowledge must not copy the parent life stats')
  assert(
    childBrain?.epsilon === child?.genome.explorationRate,
    'child epsilon must come from the genome, not the parent brain',
  )
}

function defaultChildrenStartWithEmptyQTable(): void {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 2,
  })
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)
  const parent = world.agents[0]
  const parentBrain = parent ? getBrain(parent.id) : undefined
  parentBrain?.qTable.set('low|low|none|out|no', createEmptyQValues().map((_, index) => index + 1))

  const childWorld = createNextGeneration(world, 10, { ...DEFAULT_EVOLUTION_CONFIG, mutationRate: 0 }, () => 0.4)
  assert(childWorld !== null, 'parents must produce children')
  if (!childWorld) return

  assignChildBrains(childWorld.world.agents, false, DEFAULT_LEARNING_CONFIG, setBrain)
  const child = childWorld.world.agents[0]
  const childBrain = child ? getBrain(child.id) : undefined
  assert(childBrain?.qTable.size === 0, 'default inheritance off must start a new Q-table')
}

function cloneKeepsSeparateArrays(): void {
  const source = new Map<string, number[]>()
  source.set('a', [1, 2, 3, 4, 5])
  const cloned = cloneQTable(source)
  const values = cloned.get('a')
  if (values) values[0] = 8
  assert(source.get('a')?.[0] === 1, 'cloned Q rows must be copies')
}

export function runEvolutionChecks(): void {
  genomeClampAndRange()
  crossoverCopiesParentGenes()
  mutationStaysInRangeAndCanChange()
  onlySurvivorsReproduce()
  populationLimitIsHonored()
  generationEndsOnTimeOrExtinction()
  generationRecordUsesMeasuredValues()
  qTableInheritanceCopiesButStaysSeparate()
  defaultChildrenStartWithEmptyQTable()
  cloneKeepsSeparateArrays()
}

runEvolutionChecks()
console.log('evolution checks passed')
