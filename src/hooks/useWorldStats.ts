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

  return {
    tick,
    speed,
    status,
    simulationTime: tick * SIMULATION_STEP_DT,
    ...countObjects(objects),
    ...summarizeAgents(agents),
  }
}
