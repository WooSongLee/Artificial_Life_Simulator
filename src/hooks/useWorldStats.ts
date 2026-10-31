import { generationElapsed, generationRemaining } from '../evolution/generations'
import { SIMULATION_STEP_DT } from '../simulation/constants'
import { useSimulationStore } from '../store/useSimulationStore'
import { summarizeAgents } from '../utils/agentStats'
import { countObjects } from '../utils/worldStats'

export function useWorldStats() {
  const tick = useSimulationStore((state) => state.tick)
  const speed = useSimulationStore((state) => state.speed)
  const status = useSimulationStore((state) => state.status)
  const objects = useSimulationStore((state) => state.world.objects)
  const agents = useSimulationStore((state) => state.world.agents)
  const generation = useSimulationStore((state) => state.world.generation)
  const generationStartTick = useSimulationStore((state) => state.world.generationStartTick)
  const generationDuration = useSimulationStore((state) => state.evolutionConfig.generationDuration)

  return {
    tick,
    speed,
    status,
    simulationTime: tick * SIMULATION_STEP_DT,
    ...countObjects(objects),
    ...summarizeAgents(agents),
    generation,
    generationElapsed: generationElapsed(generationStartTick, tick),
    generationRemaining: generationRemaining(generationStartTick, tick, generationDuration),
  }
}
