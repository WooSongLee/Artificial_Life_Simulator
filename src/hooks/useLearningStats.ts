import { getAgentActionEvents } from '../learning/actionEvents'
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
    (state) => getAgentLearningView(agent, state.world),
    150,
    `${agent.id}:${agent.lastAction ?? ''}:${agent.lastReward}:${agent.health.toFixed(0)}`,
  )
}

export function useAgentActionEvents(agentId: string) {
  return useThrottledStore(() => getAgentActionEvents(agentId), 150, agentId)
}
