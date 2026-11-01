import { averageGenomes, averageLifetimeReward, genomeFromAverages } from '../evolution/metrics'
import { createId } from '../utils/id'
import { GENOME_GENES, type Genome } from '../evolution/types'
import { exportBrains, getBrain, importBrains } from '../learning/brain'
import { ACTION_SCHEMA_VERSION, OBSERVATION_SCHEMA_VERSION } from '../learning/schema'
import { SIMULATION_STEP_DT } from '../simulation/constants'
import { createEmptyOutcomeStats, toolUsageAttempts, toolUsageSuccessRate, toolUsageSuccesses } from '../simulation/outcomes'
import type { SimulationState } from '../types/simulation'
import { summarizeAgents } from '../utils/agentStats'
import { policyModeFor } from './conditions'
import { EXPERIMENT_SCHEMA_VERSION } from './constants'
import type { ExperimentIdentity, ExperimentRecord, ExperimentStatistics } from './types'

export interface ExperimentRuntimeState {
  identity: ExperimentIdentity
  simulation: Pick<
    SimulationState,
    | 'status'
    | 'tick'
    | 'speed'
    | 'world'
    | 'learningHistory'
    | 'generationHistory'
    | 'learningEnabled'
    | 'learningConfig'
    | 'rewardConfig'
    | 'evolutionConfig'
    | 'pendingWorldConfig'
  >
}

export function defaultExperimentName(date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `Experiment ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function createExperimentIdentity(name?: string): ExperimentIdentity {
  const now = new Date().toISOString()
  return {
    id: createId('experiment'),
    name: name ?? defaultExperimentName(),
    createdAt: now,
    updatedAt: now,
    dirty: false,
  }
}

function emptyGenome(): Genome {
  const genome = {} as Genome
  for (const gene of GENOME_GENES) {
    genome[gene] = 0
  }
  return genome
}

export function collectExperimentStatistics(state: ExperimentRuntimeState['simulation']): ExperimentStatistics {
  const population = summarizeAgents(state.world.agents)
  const reward = averageLifetimeReward(state.world.agents)
  const lastGeneration = state.generationHistory[state.generationHistory.length - 1]
  const genome = averageGenomes(state.world.agents)
  const survival =
    lastGeneration !== undefined
      ? lastGeneration.survivalRate
      : population.totalAgents === 0
        ? 0
        : population.aliveCount / population.totalAgents
  const outcomes = state.world.outcomeStats ?? createEmptyOutcomeStats()
  const combatDeaths = state.world.agents.filter((agent) => agent.deathCause === 'combat').length
  const combatOccurred = combatDeaths > 0 || outcomes.damageDealt > 0 || outcomes.damageReceived > 0
  const visitedStates = state.world.agents.reduce(
    (sum, agent) => sum + (getBrain(agent.id)?.qTable.size ?? 0),
    0,
  )

  return {
    populationSurvival: survival,
    averageReward: reward.hasLearningSamples ? reward.averageReward : null,
    averageLifespan:
      lastGeneration !== undefined
        ? lastGeneration.averageLifespan
        : population.deadCount > 0
          ? population.averageLifespan
          : null,
    generationCount: state.generationHistory.length,
    currentGeneration: state.world.generation,
    averageGenome: genome.sampleCount === 0 ? emptyGenome() : genomeFromAverages(genome),
    aliveCount: population.aliveCount,
    totalAgents: population.totalAgents,
    simulationTime: state.tick * SIMULATION_STEP_DT,
    tick: state.tick,
    foodEaten: outcomes.foodEaten,
    resourcesGathered: outcomes.resourcesGathered,
    toolUsageAttempts: toolUsageAttempts(outcomes),
    toolUsageSuccesses: toolUsageSuccesses(outcomes),
    toolUsageSuccessRate: toolUsageSuccessRate(outcomes),
    damageDealt: outcomes.damageDealt,
    damageReceived: outcomes.damageReceived,
    combatDeaths,
    combatSurvivalRate:
      combatOccurred && population.totalAgents > 0
        ? 1 - combatDeaths / population.totalAgents
        : null,
    reproductionCount: state.world.birthCount,
    visitedStates,
    learningEnabled: state.learningEnabled,
    policyMode: policyModeFor({
      learningEnabled: state.learningEnabled,
      visitedStates,
    }),
  }
}

export function captureExperimentRecord(state: ExperimentRuntimeState): ExperimentRecord {
  const worldConfig = state.simulation.pendingWorldConfig ?? state.simulation.world.config
  const now = new Date().toISOString()

  return {
    schemaVersion: EXPERIMENT_SCHEMA_VERSION,
    actionSchemaVersion: ACTION_SCHEMA_VERSION,
    observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
    id: state.identity.id,
    name: state.identity.name,
    createdAt: state.identity.createdAt,
    updatedAt: now,
    worldConfig,
    learningConfig: state.simulation.learningConfig,
    rewardConfig: state.simulation.rewardConfig,
    evolutionConfig: state.simulation.evolutionConfig,
    learningEnabled: state.simulation.learningEnabled,
    speed: state.simulation.speed,
    status: state.simulation.status === 'running' ? 'paused' : state.simulation.status,
    tick: state.simulation.tick,
    world: structuredClone(state.simulation.world),
    brains: exportBrains(state.simulation.world.agents.map((agent) => agent.id)),
    learningHistory: structuredClone(state.simulation.learningHistory),
    generationHistory: structuredClone(state.simulation.generationHistory),
    statistics: collectExperimentStatistics(state.simulation),
    qTableStatus: 'intact',
    qTableResetReason: null,
    migrationWarnings: [],
  }
}

export function applyExperimentBrains(record: ExperimentRecord): void {
  importBrains(record.brains)
}
