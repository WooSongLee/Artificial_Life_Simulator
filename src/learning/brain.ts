import type { Agent } from '../types/agent'
import type { WorldState } from '../types/world'
import { createEmptyActionCounts, qValuesByAction } from './actionEvents'
import {
  DEFAULT_LEARNING_CONFIG,
  LEARNING_EXPLORE_WINDOW,
  LEARNING_REWARD_WINDOW,
  STATE_SPACE_SIZE,
} from './constants'
import { biasByAction, geneticActionBias, selectionScoresFrom } from './geneticBias'
import { createEmptyQValues, meanQValue, peekQValues } from './qLearning'
import { ACTION_SCHEMA_VERSION, OBSERVATION_SCHEMA_VERSION } from './schema'
import { AGENT_ACTIONS } from './types'
import type {
  AgentAction,
  AgentBrain,
  AgentLearningView,
  LearningConfig,
  LearningStats,
  QTableSummary,
} from './types'

export interface SerializedBrain {
  agentId: string
  qTable: Array<[string, number[]]>
  epsilon: number
  totalSteps: number
  totalReward: number
  recentRewards: number[]
  recentExplored: number[]
  actionCounts: Record<AgentAction, number>
  actionSchemaVersion?: number
  observationSchemaVersion?: number
}

const brains = new Map<string, AgentBrain>()

function emptyActionFloats(): Record<AgentAction, number> {
  return createEmptyActionCounts()
}

export function emptyQTableSummary(): QTableSummary {
  return {
    visitedStates: 0,
    stateSpaceSize: STATE_SPACE_SIZE,
    coverage: 0,
    averageQ: 0,
    minQ: 0,
    maxQ: 0,
    averageQByAction: emptyActionFloats(),
    preferredActionCounts: createEmptyActionCounts(),
  }
}

export function summarizeQTable(table: Map<string, number[]>): QTableSummary {
  if (table.size === 0) {
    return emptyQTableSummary()
  }

  const averageQByAction = emptyActionFloats()
  const preferredActionCounts = createEmptyActionCounts()
  let qSum = 0
  let qCount = 0
  let minQ = Number.POSITIVE_INFINITY
  let maxQ = Number.NEGATIVE_INFINITY

  for (const values of table.values()) {
    let bestIndex = 0
    let bestValue = values[0] ?? 0

    for (let i = 0; i < AGENT_ACTIONS.length; i += 1) {
      const action = AGENT_ACTIONS[i]
      const value = values[i] ?? 0
      if (!action) continue

      averageQByAction[action] += value
      qSum += value
      qCount += 1
      if (value < minQ) minQ = value
      if (value > maxQ) maxQ = value
      if (value > bestValue) {
        bestValue = value
        bestIndex = i
      }
    }

    const preferred = AGENT_ACTIONS[bestIndex]
    if (preferred) {
      preferredActionCounts[preferred] += 1
    }
  }

  for (const action of AGENT_ACTIONS) {
    averageQByAction[action] /= table.size
  }

  return {
    visitedStates: table.size,
    stateSpaceSize: STATE_SPACE_SIZE,
    coverage: table.size / STATE_SPACE_SIZE,
    averageQ: qCount === 0 ? 0 : qSum / qCount,
    minQ: Number.isFinite(minQ) ? minQ : 0,
    maxQ: Number.isFinite(maxQ) ? maxQ : 0,
    averageQByAction,
    preferredActionCounts,
  }
}

export function createBrain(
  config: LearningConfig = DEFAULT_LEARNING_CONFIG,
  initialEpsilon = config.initialEpsilon,
): AgentBrain {
  return {
    qTable: new Map(),
    epsilon: initialEpsilon,
    totalSteps: 0,
    totalReward: 0,
    recentRewards: [],
    recentExplored: [],
    actionCounts: createEmptyActionCounts(),
    actionSchemaVersion: ACTION_SCHEMA_VERSION,
    observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
  }
}

export function setBrain(agentId: string, brain: AgentBrain): void {
  brains.set(agentId, brain)
}

export function resetBrains(agents: Agent[], config: LearningConfig = DEFAULT_LEARNING_CONFIG): void {
  brains.clear()
  for (const agent of agents) {
    brains.set(agent.id, createBrain(config, agent.genome.explorationRate))
  }
}

export function getBrain(agentId: string): AgentBrain | undefined {
  return brains.get(agentId)
}

export function removeBrains(agentIds: Iterable<string>): void {
  for (const id of agentIds) {
    brains.delete(id)
  }
}

export function serializeBrain(agentId: string, brain: AgentBrain): SerializedBrain {
  return {
    agentId,
    qTable: Array.from(brain.qTable.entries()).map(([key, values]) => [key, values.slice()]),
    epsilon: brain.epsilon,
    totalSteps: brain.totalSteps,
    totalReward: brain.totalReward,
    recentRewards: brain.recentRewards.slice(),
    recentExplored: brain.recentExplored.slice(),
    actionCounts: { ...brain.actionCounts },
    actionSchemaVersion: ACTION_SCHEMA_VERSION,
    observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
  }
}

function finiteQRow(values: number[]): number[] {
  const row = createEmptyQValues()
  for (let i = 0; i < row.length; i += 1) {
    const value = values[i]
    row[i] = Number.isFinite(value) ? (value as number) : 0
  }
  return row
}

export function deserializeBrain(record: SerializedBrain): AgentBrain {
  return {
    qTable: new Map(record.qTable.map(([key, values]) => [key, finiteQRow(values)])),
    epsilon: Number.isFinite(record.epsilon) ? record.epsilon : 0,
    totalSteps: Math.max(0, Number.isFinite(record.totalSteps) ? record.totalSteps : 0),
    totalReward: Number.isFinite(record.totalReward) ? record.totalReward : 0,
    recentRewards: record.recentRewards.filter((value) => Number.isFinite(value)),
    recentExplored: record.recentExplored.filter((value) => Number.isFinite(value)),
    actionCounts: { ...createEmptyActionCounts(), ...record.actionCounts },
    actionSchemaVersion: record.actionSchemaVersion ?? ACTION_SCHEMA_VERSION,
    observationSchemaVersion: record.observationSchemaVersion ?? OBSERVATION_SCHEMA_VERSION,
  }
}

export function exportBrains(agentIds?: Iterable<string>): SerializedBrain[] {
  if (!agentIds) {
    return Array.from(brains.entries()).map(([agentId, brain]) => serializeBrain(agentId, brain))
  }

  const records: SerializedBrain[] = []
  for (const agentId of agentIds) {
    const brain = brains.get(agentId)
    if (brain) {
      records.push(serializeBrain(agentId, brain))
    }
  }
  return records
}

export function importBrains(records: SerializedBrain[]): void {
  brains.clear()
  for (const record of records) {
    brains.set(record.agentId, deserializeBrain(record))
  }
}

export function ensureBrain(
  agentId: string,
  config: LearningConfig = DEFAULT_LEARNING_CONFIG,
  initialEpsilon = config.initialEpsilon,
): AgentBrain {
  const existing = brains.get(agentId)
  if (existing) return existing

  const created = createBrain(config, initialEpsilon)
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

export function getAgentLearningView(agent: Agent, world?: WorldState): AgentLearningView {
  const brain = getBrain(agent.id)
  const currentQ = brain && agent.lastStateKey
    ? peekQValues(brain.qTable, agent.lastStateKey)
    : null
  const geneticBias = world ? geneticActionBias(agent, world) : createEmptyQValues()

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
    actionCounts: brain ? { ...brain.actionCounts } : createEmptyActionCounts(),
    recentRewards: brain ? brain.recentRewards.slice() : [],
    qTable: brain ? summarizeQTable(brain.qTable) : emptyQTableSummary(),
    currentQByAction: currentQ ? qValuesByAction(currentQ) : null,
    currentGeneticBiasByAction: currentQ ? biasByAction(geneticBias) : null,
    currentSelectionScoreByAction: currentQ
      ? qValuesByAction(selectionScoresFrom(currentQ, geneticBias))
      : null,
  }
}

export function summarizeLearning(agents: Agent[], learningEnabled: boolean): LearningStats {
  const actionCounts = createEmptyActionCounts()

  if (agents.length === 0) {
    return {
      totalLearningSteps: 0,
      currentEpsilon: 0,
      averageReward: 0,
      averageQValue: 0,
      explorationRate: 0,
      visitedStates: 0,
      maxVisitedStates: 0,
      averageVisitedStates: 0,
      qTableCells: 0,
      stateSpaceSize: STATE_SPACE_SIZE,
      learningEnabled,
      hasLearningSamples: false,
      actionCounts,
      agentActionCounts: [],
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
  let maxVisitedStates = 0
  let qTableCells = 0
  const agentActionCounts: LearningStats['agentActionCounts'] = []
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
    maxVisitedStates = Math.max(maxVisitedStates, brain.qTable.size)
    qTableCells += brain.qTable.size * AGENT_ACTIONS.length
    agentActionCounts.push({
      agentId: agent.id,
      alive: agent.alive,
      total: AGENT_ACTIONS.reduce((sum, action) => sum + brain.actionCounts[action], 0),
      visitedStates: brain.qTable.size,
      actionCounts: { ...brain.actionCounts },
    })

    for (const action of AGENT_ACTIONS) {
      actionCounts[action] += brain.actionCounts[action]
    }

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
    maxVisitedStates,
    averageVisitedStates: agentActionCounts.length === 0 ? 0 : visitedStates / agentActionCounts.length,
    qTableCells,
    stateSpaceSize: STATE_SPACE_SIZE,
    learningEnabled,
    hasLearningSamples: totalLearningSteps > 0,
    actionCounts,
    agentActionCounts: agentActionCounts.sort((left, right) => right.total - left.total),
  }
}
