import { averageGenomes, averageLifetimeReward } from '../evolution/metrics'
import { useSimulationStore } from '../store/useSimulationStore'

export function useGenerationHistory() {
  const history = useSimulationStore((state) => state.generationHistory)
  const agents = useSimulationStore((state) => state.world.agents)
  const generation = useSimulationStore((state) => state.world.generation)
  const inheritQTable = useSimulationStore((state) => state.evolutionConfig.inheritQTable)
  const mutationRate = useSimulationStore((state) => state.evolutionConfig.mutationRate)
  const populationLimit = useSimulationStore((state) => state.evolutionConfig.populationLimit)
  const generationDuration = useSimulationStore((state) => state.evolutionConfig.generationDuration)

  useSimulationStore((state) => state.tick)

  return {
    history,
    currentAverages: averageGenomes(agents),
    currentReward: averageLifetimeReward(agents),
    generation,
    inheritQTable,
    mutationRate,
    populationLimit,
    generationDuration,
  }
}
