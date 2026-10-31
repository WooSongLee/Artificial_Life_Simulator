import { getBrain } from '../learning/brain'
import type { Agent } from '../types/agent'

export interface GenomeAverages {
  speed: number
  vision: number
  energyEfficiency: number
  learningRate: number
  explorationRate: number
  sampleCount: number
}

export function averageGenomes(agents: readonly Agent[]): GenomeAverages {
  if (agents.length === 0) {
    return {
      speed: 0,
      vision: 0,
      energyEfficiency: 0,
      learningRate: 0,
      explorationRate: 0,
      sampleCount: 0,
    }
  }

  let speed = 0
  let vision = 0
  let energyEfficiency = 0
  let learningRate = 0
  let explorationRate = 0

  for (const agent of agents) {
    speed += agent.genome.speed
    vision += agent.genome.vision
    energyEfficiency += agent.genome.energyEfficiency
    learningRate += agent.genome.learningRate
    explorationRate += agent.genome.explorationRate
  }

  const n = agents.length
  return {
    speed: speed / n,
    vision: vision / n,
    energyEfficiency: energyEfficiency / n,
    learningRate: learningRate / n,
    explorationRate: explorationRate / n,
    sampleCount: n,
  }
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

