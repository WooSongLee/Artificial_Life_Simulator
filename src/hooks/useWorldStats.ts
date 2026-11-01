import { countMatingPairs } from '../evolution/mating'
import { generationElapsed } from '../evolution/generations'
import { SIMULATION_STEP_DT } from '../simulation/constants'
import { summarizeAgents } from '../utils/agentStats'
import { countForage, countObjects } from '../utils/worldStats'
import { useThrottledStore } from './useThrottledStore'

export function useWorldStats() {
  return useThrottledStore((state) => {
    const living = state.world.agents.filter((agent) => agent.alive)
    const averageDesire =
      living.length === 0
        ? 0
        : living.reduce((sum, agent) => sum + agent.desire, 0) / living.length

    return {
      tick: state.tick,
      speed: state.speed,
      status: state.status,
      simulationTime: state.tick * SIMULATION_STEP_DT,
      ...countObjects(state.world.objects),
      ...countForage(state.world),
      ...summarizeAgents(state.world.agents),
      generation: state.world.generation,
      generationElapsed: generationElapsed(state.world.generationStartTick, state.tick),
      birthCount: state.world.birthCount,
      matingCount: countMatingPairs(state.world.agents),
      averageDesire,
    }
  })
}
