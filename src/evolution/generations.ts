import { getBrain } from '../learning/brain'
import { SIMULATION_STEP_DT } from '../simulation/constants'
import type { Agent } from '../types/agent'
import type { WorldState } from '../types/world'
import { MAX_GENERATION_RECORDS } from './constants'
import type { GenerationEndReason, GenerationRecord, MutationSummary } from './types'

export function generationElapsed(generationStartTick: number, tick: number): number {
  return Math.max(0, (tick - generationStartTick) * SIMULATION_STEP_DT)
}

export function generationRemaining(
  generationStartTick: number,
  tick: number,
  duration: number,
): number {
  return Math.max(0, duration - generationElapsed(generationStartTick, tick))
}

export function summarizeMutations(agents: readonly Agent[], mutationRate: number): MutationSummary {
  let mutatedAgentCount = 0
  let mutatedGeneCount = 0

  for (const agent of agents) {
    if (agent.mutatedGenes.length === 0) continue
    mutatedAgentCount += 1
    mutatedGeneCount += agent.mutatedGenes.length
  }

  return {
    mutatedAgentCount,
    mutatedGeneCount,
    mutationRate,
  }
}

export function collectGenerationRecord(
  world: WorldState,
  tick: number,
  reason: GenerationEndReason,
  mutationRate: number,
  generation = world.generation,
): GenerationRecord {
  const agents = world.agents.filter((agent) => agent.generation === generation)
  const populationSize = agents.length
  const aliveCount = agents.filter((agent) => agent.alive).length
  let ageSum = 0
  let speedSum = 0
  let visionSum = 0
  let efficiencySum = 0
  let learningRateSum = 0
  let explorationSum = 0
  let rewardPerStepSum = 0
  let rewardSamples = 0

  for (const agent of agents) {
    ageSum += agent.age
    speedSum += agent.genome.speed
    visionSum += agent.genome.vision
    efficiencySum += agent.genome.energyEfficiency
    learningRateSum += agent.genome.learningRate
    explorationSum += agent.genome.explorationRate

    const brain = getBrain(agent.id)
    if (!brain || brain.totalSteps === 0) continue
    rewardPerStepSum += brain.totalReward / brain.totalSteps
    rewardSamples += 1
  }

  const divisor = populationSize === 0 ? 1 : populationSize

  return {
    generation,
    populationSize,
    aliveCount,
    survivalRate: populationSize === 0 ? 0 : aliveCount / populationSize,
    averageLifespan: populationSize === 0 ? 0 : ageSum / divisor,
    averageReward: rewardSamples === 0 ? 0 : rewardPerStepSum / rewardSamples,
    averageSpeed: populationSize === 0 ? 0 : speedSum / divisor,
    averageVision: populationSize === 0 ? 0 : visionSum / divisor,
    averageEnergyEfficiency: populationSize === 0 ? 0 : efficiencySum / divisor,
    averageLearningRate: populationSize === 0 ? 0 : learningRateSum / divisor,
    averageExplorationRate: populationSize === 0 ? 0 : explorationSum / divisor,
    hasLearningSamples: rewardSamples > 0,
    mutation: summarizeMutations(agents, mutationRate),
    endedAtTick: tick,
    endedAtTime: tick * SIMULATION_STEP_DT,
    duration: generationElapsed(world.generationStartTick, tick),
    endReason: reason,
  }
}

export function appendGenerationRecord(
  history: GenerationRecord[],
  record: GenerationRecord,
): GenerationRecord[] {
  const next = [...history, record]
  if (next.length <= MAX_GENERATION_RECORDS) return next
  return next.slice(next.length - MAX_GENERATION_RECORDS)
}

export function hasGenerationRecord(history: readonly GenerationRecord[], generation: number): boolean {
  return history.some((record) => record.generation === generation)
}
