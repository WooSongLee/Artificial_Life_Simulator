import { averageGenomes, averageLifetimeReward } from '../evolution/metrics'
import { useThrottledStore } from './useThrottledStore'

export function useGenerationHistory() {
  return useThrottledStore((state) => ({
    history: state.generationHistory,
    currentAverages: averageGenomes(state.world.agents),
    currentReward: averageLifetimeReward(state.world.agents),
    generation: state.world.generation,
    inheritQTable: state.evolutionConfig.inheritQTable,
    geneticsEnabled: state.evolutionConfig.geneticsEnabled,
    mutationRate: state.evolutionConfig.mutationRate,
    populationLimit: state.evolutionConfig.populationLimit,
  }))
}
