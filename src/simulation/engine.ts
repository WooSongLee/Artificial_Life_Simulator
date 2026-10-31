import { DEFAULT_LEARNING_CONTEXT, type LearningStepContext } from '../learning/controller'
import type { Agent } from '../types/agent'
import type { SimulationSnapshot } from '../types/simulation'
import { respawnFood, updateAgent } from './agentSystem'

export function stepSimulation(
  snapshot: SimulationSnapshot,
  dt: number,
  context: LearningStepContext = DEFAULT_LEARNING_CONTEXT,
): SimulationSnapshot {
  const objects = snapshot.world.objects.slice()
  const agents: Agent[] = []

  for (const agent of snapshot.world.agents) {
    const worldView = {
      ...snapshot.world,
      objects,
    }
    const result = updateAgent(agent, worldView, dt, context)
    agents.push(result.agent)

    if (result.consumedFoodId) {
      const index = objects.findIndex((object) => object.id === result.consumedFoodId)
      if (index >= 0) {
        objects.splice(index, 1)
      }
    }
  }

  const afterSpawn = respawnFood(objects, snapshot.world, dt)

  return {
    tick: snapshot.tick + 1,
    world: {
      ...snapshot.world,
      agents,
      objects: afterSpawn.objects,
      foodSpawnCooldown: afterSpawn.foodSpawnCooldown,
    },
  }
}
