import type { Agent } from '../types/agent'
import { DEFAULT_LEARNING_CONFIG, LEARNING_EXPLORE_WINDOW, LEARNING_REWARD_WINDOW } from './constants'
import { meanQValue } from './qLearning'
import type {
  AgentAction,
  AgentBrain,
  AgentLearningView,
  LearningConfig,
  LearningStats,
} from './types'

const brains = new Map<string, AgentBrain>()

function emptyActionCounts(): Record<AgentAction, number> {
  return {
    MOVE_FORWARD: 0,
    TURN_LEFT: 0,
    TURN_RIGHT: 0,
    EAT: 0,
    REST: 0,
  }
}

export function createBrain(config: LearningConfig = DEFAULT_LEARNING_CONFIG): AgentBrain {
  return {
    qTable: new Map(),
    epsilon: config.initialEpsilon,
    totalSteps: 0,
    totalReward: 0,
    recentRewards: [],
    recentExplored: [],
    actionCounts: emptyActionCounts(),
  }
}

export function resetBrains(agents: Agent[], config: LearningConfig = DEFAULT_LEARNING_CONFIG): void {
  brains.clear()
  for (const agent of agents) {
    brains.set(agent.id, createBrain(config))
  }
}

export function getBrain(agentId: string): AgentBrain | undefined {
  return brains.get(agentId)
}

export function ensureBrain(agentId: string, config: LearningConfig = DEFAULT_LEARNING_CONFIG): AgentBrain {
  const existing = brains.get(agentId)
  if (existing) return existing

  const created = createBrain(config)
  brains.set(agentId, created)
  return created
}

export function pushWindow(values: number[], value: number, maxLength: number): void {
  values.push(value)
  if (values.length > maxLength) {
    values.shift()
  }
}

export function recordLearningStep(
  brain: AgentBrain,
  action: AgentAction,
  reward: number,
  explored: boolean,
): void {
  brain.totalSteps += 1
  brain.totalReward += reward
  brain.actionCounts[action] += 1
  pushWindow(brain.recentRewards, reward, LEARNING_REWARD_WINDOW)
  pushWindow(brain.recentExplored, explored ? 1 : 0, LEARNING_EXPLORE_WINDOW)
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

export function getAgentLearningView(agent: Agent): AgentLearningView {
  const brain = getBrain(agent.id)

  return {
    lastAction: agent.lastAction,
    lastReward: agent.lastReward,
    lastStateKey: agent.lastStateKey,
    epsilon: brain?.epsilon ?? 0,
    totalSteps: brain?.totalSteps ?? 0,
    totalReward: brain?.totalReward ?? 0,
    averageReward: brain ? mean(brain.recentRewards) : 0,
    averageQValue: brain ? meanQValue(brain.qTable) : 0,
    explorationRate: brain ? mean(brain.recentExplored) : 0,
    visitedStates: brain?.qTable.size ?? 0,
    actionCounts: brain ? { ...brain.actionCounts } : emptyActionCounts(),
  }
}

export function summarizeLearning(agents: Agent[], learningEnabled: boolean): LearningStats {
  if (agents.length === 0) {
    return {
      totalLearningSteps: 0,
      currentEpsilon: 0,
      averageReward: 0,
      averageQValue: 0,
      explorationRate: 0,
      visitedStates: 0,
      learningEnabled,
    }
  }

  let totalLearningSteps = 0
  let epsilonSum = 0
  let epsilonCount = 0
  let rewardSum = 0
  let rewardCount = 0
  let qSum = 0
  let qCount = 0
  let exploreSum = 0
  let exploreCount = 0
  let visitedStates = 0
  const epsilonAgents = agents.some((agent) => agent.alive)
    ? agents.filter((agent) => agent.alive)
    : agents

  for (const agent of epsilonAgents) {
    const brain = getBrain(agent.id)
    if (!brain) continue
    epsilonSum += brain.epsilon
    epsilonCount += 1
  }

  for (const agent of agents) {
    const brain = getBrain(agent.id)
    if (!brain) continue

    totalLearningSteps += brain.totalSteps
    visitedStates += brain.qTable.size

    for (const reward of brain.recentRewards) {
      rewardSum += reward
      rewardCount += 1
    }

    for (const values of brain.qTable.values()) {
      for (const value of values) {
        qSum += value
        qCount += 1
      }
    }

    for (const explored of brain.recentExplored) {
      exploreSum += explored
      exploreCount += 1
    }
  }

  return {
    totalLearningSteps,
    currentEpsilon: epsilonCount === 0 ? 0 : epsilonSum / epsilonCount,
    averageReward: rewardCount === 0 ? 0 : rewardSum / rewardCount,
    averageQValue: qCount === 0 ? 0 : qSum / qCount,
    explorationRate: exploreCount === 0 ? 0 : exploreSum / exploreCount,
    visitedStates,
    learningEnabled,
  }
}
