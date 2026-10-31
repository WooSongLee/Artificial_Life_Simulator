import { getAgentLearningView, summarizeLearning } from '../learning/brain'
import type { Agent } from '../types/agent'
import { useThrottledStore } from './useThrottledStore'

export function useLearningStats() {
  return useThrottledStore((state) => ({
    tick: state.tick,
    ...summarizeLearning(state.world.agents, state.learningEnabled),
  }))
}

export function useAgentLearningView(agent: Agent) {
  return useThrottledStore(
    () => getAgentLearningView(agent),
    150,
    `${agent.id}:${agent.lastAction ?? ''}:${agent.lastReward}`,
  )
}
