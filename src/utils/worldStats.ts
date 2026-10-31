import { generationElapsed, generationRemaining } from '../evolution/generations'
import { SIMULATION_STEP_DT } from '../simulation/constants'
import type { SimulationState, WorldStats } from '../types/simulation'
import type { WorldObject } from '../types/world'
import { summarizeAgents } from './agentStats'

export function countObjects(objects: WorldObject[]) {
  let treeCount = 0
  let rockCount = 0
  let foodCount = 0

  for (const object of objects) {
    if (object.type === 'tree') treeCount += 1
    if (object.type === 'rock') rockCount += 1
    if (object.type === 'food') foodCount += 1
  }

  return { treeCount, rockCount, foodCount, totalObjects: objects.length }
}

export function getWorldStats(state: SimulationState): WorldStats {
  return {
    tick: state.tick,
    speed: state.speed,
    status: state.status,
    simulationTime: state.tick * SIMULATION_STEP_DT,
    ...countObjects(state.world.objects),
    ...summarizeAgents(state.world.agents),
    generation: state.world.generation,
    generationElapsed: generationElapsed(state.world.generationStartTick, state.tick),
    generationRemaining: generationRemaining(
      state.world.generationStartTick,
      state.tick,
      state.evolutionConfig.generationDuration,
    ),
  }
}
