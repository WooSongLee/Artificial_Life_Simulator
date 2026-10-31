import { EXPLORE_ACTION_WEIGHTS } from './constants'
import { AGENT_ACTIONS, type ActionSelection, type AgentAction, type AgentPolicy, type StateKey } from './types'

export const ACTION_COUNT = AGENT_ACTIONS.length
export const ZERO_Q_VALUES: readonly number[] = [0, 0, 0, 0, 0]

export function actionIndex(action: AgentAction): number {
  return AGENT_ACTIONS.indexOf(action)
}

export function createEmptyQValues(): number[] {
  return [0, 0, 0, 0, 0]
}

export function peekQValues(table: Map<StateKey, number[]>, state: StateKey): readonly number[] {
  return table.get(state) ?? ZERO_Q_VALUES
}

export function getOrCreateQValues(table: Map<StateKey, number[]>, state: StateKey): number[] {
  const existing = table.get(state)
  if (existing) return existing

  const created = createEmptyQValues()
  table.set(state, created)
  return created
}

export function maxQValue(qValues: readonly number[]): number {
  let max = Number.isFinite(qValues[0]) ? (qValues[0] ?? 0) : 0
  for (let i = 1; i < qValues.length; i += 1) {
    const value = qValues[i] ?? 0
    if (Number.isFinite(value) && value > max) max = value
  }
  return max
}

export function argmaxAction(qValues: readonly number[]): AgentAction {
  let bestIndex = 0
  let bestValue = Number.isFinite(qValues[0]) ? (qValues[0] ?? 0) : Number.NEGATIVE_INFINITY

  for (let i = 1; i < qValues.length; i += 1) {
    const value = qValues[i] ?? 0
    if (Number.isFinite(value) && value > bestValue) {
      bestValue = value
      bestIndex = i
    }
  }

  return AGENT_ACTIONS[bestIndex] ?? AGENT_ACTIONS[0]
}

export function updateQValue(
  current: number,
  reward: number,
  nextMax: number,
  learningRate: number,
  discountFactor: number,
): number {
  const safeCurrent = Number.isFinite(current) ? current : 0
  const next =
    safeCurrent +
    learningRate * (reward + discountFactor * nextMax - safeCurrent)
  return Number.isFinite(next) ? next : safeCurrent
}

export function decayEpsilon(epsilon: number, decay: number, minEpsilon: number): number {
  return Math.max(minEpsilon, epsilon * decay)
}

export function pickWeightedAction(weights: readonly number[], rng: () => number): AgentAction {
  const roll = rng()
  let cumulative = 0

  for (let i = 0; i < weights.length; i += 1) {
    cumulative += weights[i] ?? 0
    if (roll < cumulative) {
      return AGENT_ACTIONS[i] ?? AGENT_ACTIONS[0]
    }
  }

  return AGENT_ACTIONS[weights.length - 1] ?? AGENT_ACTIONS[0]
}

export function selectEpsilonGreedy(
  qValues: readonly number[],
  epsilon: number,
  rng: () => number,
): ActionSelection {
  if (rng() < epsilon) {
    return {
      action: pickWeightedAction(EXPLORE_ACTION_WEIGHTS, rng),
      explored: true,
    }
  }

  return {
    action: argmaxAction(qValues),
    explored: false,
  }
}

export const epsilonGreedyPolicy: AgentPolicy = {
  name: 'epsilon-greedy',
  selectAction: selectEpsilonGreedy,
}

export const randomPolicy: AgentPolicy = {
  name: 'random',
  selectAction: (_qValues, _epsilon, rng) => selectEpsilonGreedy(ZERO_Q_VALUES, 1, rng),
}

export function meanQValue(table: Map<StateKey, number[]>): number {
  if (table.size === 0) return 0

  let sum = 0
  let count = 0
  for (const values of table.values()) {
    for (const value of values) {
      sum += value
      count += 1
    }
  }

  return count === 0 ? 0 : sum / count
}
