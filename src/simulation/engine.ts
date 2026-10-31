import { DEFAULT_EVOLUTION_CONFIG } from '../evolution/constants'
import { processMating, type MatingTickResult } from '../evolution/mating'
import type { EvolutionConfig } from '../evolution/types'
import { DEFAULT_LEARNING_CONTEXT, type LearningStepContext } from '../learning/controller'
import type { Agent } from '../types/agent'
import type { SimulationSnapshot } from '../types/simulation'
import type { Rng } from '../utils/random'
import { respawnFood, updateAgent } from './agentSystem'

export interface SimulationStepContext extends Omit<LearningStepContext, 'rng'> {
  evolutionConfig?: EvolutionConfig
  rng?: Rng
}

export interface SimulationStepResult extends SimulationSnapshot {
  born: Agent[]
  recordedGeneration: number | null
  recordedGenerationStartTick: number | null
  removedAgentIds: string[]
}

export function stepSimulation(
  snapshot: SimulationSnapshot,
  dt: number,
  context: SimulationStepContext = DEFAULT_LEARNING_CONTEXT,
): SimulationStepResult {
  const objects = snapshot.world.objects.slice()
  const agents: Agent[] = []

  for (const agent of snapshot.world.agents) {
    const worldView = {
      ...snapshot.world,
      objects,
    }
    const result = updateAgent(agent, worldView, dt, {
      learningEnabled: context.learningEnabled,
      learningConfig: context.learningConfig,
      rewardConfig: context.rewardConfig,
      rng: context.rng ?? Math.random,
    })
    agents.push(result.agent)

    if (result.consumedFoodId) {
      const index = objects.findIndex((object) => object.id === result.consumedFoodId)
      if (index >= 0) {
        objects.splice(index, 1)
      }
    }
  }

  const afterSpawn = respawnFood(objects, snapshot.world, dt)
  const reproduced = processMating(
    {
      ...snapshot.world,
      agents,
      objects: afterSpawn.objects,
      foodSpawnCooldown: afterSpawn.foodSpawnCooldown,
    },
    snapshot.tick + 1,
    context.evolutionConfig ?? DEFAULT_EVOLUTION_CONFIG,
    context.rng ?? Math.random,
  )

  return {
    tick: snapshot.tick + 1,
    world: reproduced.world,
    born: reproduced.born,
    recordedGeneration: reproduced.recordedGeneration,
    recordedGenerationStartTick: reproduced.recordedGenerationStartTick,
    removedAgentIds: reproduced.removedAgentIds,
  }
}

export type { MatingTickResult }
