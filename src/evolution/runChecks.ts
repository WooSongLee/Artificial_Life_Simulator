import { getBrain, resetBrains, setBrain } from '../learning/brain'
import { DEFAULT_LEARNING_CONFIG } from '../learning/constants'
import { createEmptyQValues } from '../learning/qLearning'
import { updateAgent } from '../simulation/agentSystem'
import { DEFAULT_WORLD_CONFIG, SIMULATION_STEP_DT } from '../simulation/constants'
import { createInitialWorld } from '../simulation/worldFactory'
import { mulberry32 } from '../utils/random'
import { DEFAULT_EVOLUTION_CONFIG, GENE_RANGES } from './constants'
import { crossoverGenomes, genomeUsesParentValues } from './crossover'
import { collectGenerationRecord } from './generations'
import { clampGenome, createRandomGenome } from './genome'
import { assignChildBrains, cloneQTable } from './inheritance'
import { processMating } from './mating'
import { mutateGenome } from './mutation'
import { breedChild, canStartMating, isMating } from './reproduction'
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
    libido: 9,
    lifespan: 1,
  })

  assert(genome.speed === GENE_RANGES.speed.max, 'speed must clamp to max')
  assert(genome.vision === GENE_RANGES.vision.min, 'vision must clamp to min')
  assert(genome.energyEfficiency === GENE_RANGES.energyEfficiency.max, 'efficiency must clamp')
  assert(genome.learningRate === GENE_RANGES.learningRate.min, 'learning rate must clamp')
  assert(genome.explorationRate === GENE_RANGES.explorationRate.max, 'exploration must clamp')
  assert(genome.libido === GENE_RANGES.libido.max, 'libido must clamp to max')
  assert(genome.lifespan === GENE_RANGES.lifespan.min, 'lifespan must clamp to min')
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

function readyMates(world = createInitialWorld({ ...DEFAULT_WORLD_CONFIG, agentCount: 2 })) {
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
    first,
    second,
  }
}

function liveBreedingCreatesChild(): void {
  const { world } = readyMates()
  const paired = processMating(world, 10, { ...DEFAULT_EVOLUTION_CONFIG, mutationRate: 0 }, () => 0.25)
  assert(paired.world.agents.filter(isMating).length === 2, 'nearby aroused agents must start mating')
  assert(paired.born.length === 0, 'a child is not born until mating finishes')

  const finished = processMating(
    {
      ...paired.world,
      agents: paired.world.agents.map((agent) => ({ ...agent, matingTimeLeft: 0 })),
    },
    20,
    { ...DEFAULT_EVOLUTION_CONFIG, mutationRate: 0 },
    () => 0.25,
  )

  assert(finished.born.length === 1, `expected 1 child, got ${finished.born.length}`)
  const child = finished.born[0]
  if (!child) throw new Error('expected a child')
  assert(child.generation === 2, 'child generation must be parent generation + 1')
  assert(finished.world.generation === 2, 'world generation must follow the new birth')
  assert(finished.recordedGeneration === 1, 'parent generation must be recorded on first birth')
  assert(child.desire < 30, 'newborn desire starts low')
  assert(
    finished.world.agents.every((agent) => !isMating(agent) || agent.id === child.id),
    'parents must stop mating after birth',
  )
  assert(
    world.agents.every((parent) =>
      finished.world.agents.some((agent) => agent.id === parent.id && agent.desire <= 8),
    ),
    'mating must satisfy desire',
  )
}

function populationLimitBlocksBirth(): void {
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

  assert(finished.born.length === 0, 'a full population must not add a child')
  assert(
    finished.world.agents.every((agent) => agent.desire <= 8),
    'desire is still satisfied when the population is full',
  )
}

function lifespanEndsAnAgent(): void {
  const world = createInitialWorld({ ...DEFAULT_WORLD_CONFIG, agentCount: 1 })
  const agent = world.agents[0]
  if (!agent) throw new Error('expected an agent')

  const aged = {
    ...agent,
    age: agent.maxLifespan - SIMULATION_STEP_DT / 2,
  }
  const result = updateAgent(aged, { ...world, agents: [aged] }, SIMULATION_STEP_DT, {
    learningEnabled: false,
    learningConfig: DEFAULT_LEARNING_CONFIG,
    rewardConfig: {
      eatSuccess: 1,
      wastedEnergy: 0,
      collision: 0,
      death: 0,
      efficientRest: 0,
    },
    rng: Math.random,
  })

  assert(!result.agent.alive, 'reaching max lifespan must kill the agent')
  assert(result.agent.deathCause === 'age', 'old-age death must be marked')
}

function onlyLivingAdultsMate(): void {
  const world = createInitialWorld({ ...DEFAULT_WORLD_CONFIG, agentCount: 3 })
  const [first, second, third] = world.agents
  if (!first || !second || !third) throw new Error('expected three agents')

  const mixed = {
    ...world,
    agents: [
      { ...first, alive: false, health: 0, desire: 100, age: 30, energy: 80, position: { x: 0, z: 0 } },
      { ...second, desire: 100, age: 4, energy: 80, position: { x: 0.3, z: 0 } },
      { ...third, desire: 100, age: 30, energy: 80, position: { x: 0.6, z: 0 } },
    ],
  }

  assert(!canStartMating(mixed.agents[0]!), 'dead agents must not mate')
  assert(!canStartMating(mixed.agents[1]!), 'immature agents must not mate')
  assert(canStartMating(mixed.agents[2]!), 'a living adult with desire can mate')

  const next = processMating(mixed, 8, { ...DEFAULT_EVOLUTION_CONFIG, mutationRate: 0 }, () => 0.3)
  assert(next.world.agents.filter(isMating).length === 0, 'a single eligible adult cannot pair')
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
      { ...first, generation: 3, age: 12, alive: true, genome: { ...first.genome, speed: 2, vision: 8, energyEfficiency: 1 } },
      { ...second, generation: 3, age: 8, alive: false, genome: { ...second.genome, speed: 1, vision: 10, energyEfficiency: 1.1 } },
    ],
  }

  const brain = getBrain(first.id)
  if (!brain) throw new Error('expected a brain')
  brain.totalSteps = 4
  brain.totalReward = 8

  const record = collectGenerationRecord(measured, 40, 'birth', 0.15, 3)
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
  assert(record.endReason === 'birth', 'record must keep the real end reason')
}

function qTableInheritanceCopiesButStaysSeparate(): void {
  const { world } = readyMates()
  for (const parent of world.agents) {
    const parentBrain = getBrain(parent.id)
    if (!parentBrain) throw new Error('expected a parent brain')
    parentBrain.qTable.set('low|low|none|out|no', [1, 2, 3, 4, 5])
  }

  const first = world.agents[0]
  const second = world.agents[1]
  if (!first || !second) throw new Error('expected two parents')
  const blueprint = breedChild(first, second, { mutationRate: 0, mutationScale: 0.18 }, () => 0.2)
  const child = {
    ...first,
    id: 'child-test',
    generation: 2,
    parentIds: blueprint.parentIds,
    inheritParentId: blueprint.inheritParentId,
    genome: blueprint.genome,
    mutatedGenes: blueprint.mutatedGenes,
  }

  assignChildBrains([child], true, DEFAULT_LEARNING_CONFIG, setBrain)
  const childBrain = getBrain(child.id)
  assert(childBrain !== undefined, 'inherited child must have a brain')
  const inherited = childBrain?.qTable.get('low|low|none|out|no')
  assert(inherited?.[1] === 2, 'child must receive a copy of the parent Q values')

  if (inherited) inherited[1] = 99
  const parentBrain = getBrain(child.inheritParentId ?? '')
  assert(parentBrain?.qTable.get('low|low|none|out|no')?.[1] === 2, 'mutating the child Q-table must not change the parent')
  assert(childBrain?.totalSteps === 0, 'inherited knowledge must not copy the parent life stats')
  assert(
    childBrain?.epsilon === child.genome.explorationRate,
    'child epsilon must come from the genome, not the parent brain',
  )
}

function defaultChildrenStartWithEmptyQTable(): void {
  const { world } = readyMates()
  const parent = world.agents[0]
  const parentBrain = parent ? getBrain(parent.id) : undefined
  parentBrain?.qTable.set('low|low|none|out|no', createEmptyQValues().map((_, index) => index + 1))
  if (!parent) throw new Error('expected a parent')

  const child = {
    ...parent,
    id: 'child-empty',
    inheritParentId: parent.id,
    genome: parent.genome,
  }
  assignChildBrains([child], false, DEFAULT_LEARNING_CONFIG, setBrain)
  const childBrain = getBrain(child.id)
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
  liveBreedingCreatesChild()
  populationLimitBlocksBirth()
  lifespanEndsAnAgent()
  onlyLivingAdultsMate()
  generationRecordUsesMeasuredValues()
  qTableInheritanceCopiesButStaysSeparate()
  defaultChildrenStartWithEmptyQTable()
  cloneKeepsSeparateArrays()
}

runEvolutionChecks()
console.log('evolution checks passed')
