import { averageGenomes, averageLifetimeReward } from '../evolution/metrics'
import { createId } from '../utils/id'
import type { Genome } from '../evolution/types'
import { exportBrains, importBrains } from '../learning/brain'
import { SIMULATION_STEP_DT } from '../simulation/constants'
import type { SimulationState } from '../types/simulation'
import { summarizeAgents } from '../utils/agentStats'
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
  return {
    speed: 0,
    vision: 0,
    energyEfficiency: 0,
    learningRate: 0,
    explorationRate: 0,
    libido: 0,
    lifespan: 0,
  }
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
    averageGenome:
      genome.sampleCount === 0
        ? emptyGenome()
        : {
            speed: genome.speed,
            vision: genome.vision,
            energyEfficiency: genome.energyEfficiency,
            learningRate: genome.learningRate,
            explorationRate: genome.explorationRate,
            libido: genome.libido,
            lifespan: genome.lifespan,
          },
    aliveCount: population.aliveCount,
    totalAgents: population.totalAgents,
    simulationTime: state.tick * SIMULATION_STEP_DT,
    tick: state.tick,
  }
}

export function captureExperimentRecord(state: ExperimentRuntimeState): ExperimentRecord {
  const worldConfig = state.simulation.pendingWorldConfig ?? state.simulation.world.config
  const now = new Date().toISOString()

  return {
    schemaVersion: EXPERIMENT_SCHEMA_VERSION,
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
  }
}

export function applyExperimentBrains(record: ExperimentRecord): void {
  importBrains(record.brains)
}
