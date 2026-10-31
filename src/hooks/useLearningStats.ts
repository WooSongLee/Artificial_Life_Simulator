import { getAgentLearningView, summarizeLearning } from '../learning/brain'
import { useSimulationStore } from '../store/useSimulationStore'
import type { Agent } from '../types/agent'

export function useLearningStats() {
  const tick = useSimulationStore((state) => state.tick)
  const learningEnabled = useSimulationStore((state) => state.learningEnabled)
  const agents = useSimulationStore((state) => state.world.agents)

  return {
    tick,
    ...summarizeLearning(agents, learningEnabled),
  }
}

export function useAgentLearningView(agent: Agent) {
  useSimulationStore((state) => state.tick)
  return getAgentLearningView(agent)
}
