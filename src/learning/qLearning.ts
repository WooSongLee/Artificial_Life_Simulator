import { fallbackLegalAction } from './actionMask'
import { EXPLORE_ACTION_WEIGHTS } from './constants'
import { isValidStateKeyForSchema, OBSERVATION_SCHEMA_VERSION } from './schema'
import { AGENT_ACTIONS, type ActionSelection, type AgentAction, type AgentPolicy, type StateKey } from './types'

export const ACTION_COUNT = AGENT_ACTIONS.length
export const ZERO_Q_VALUES: readonly number[] = Array.from({ length: ACTION_COUNT }, () => 0)

export function actionIndex(action: AgentAction): number {
  return AGENT_ACTIONS.indexOf(action)
}

export function createEmptyQValues(): number[] {
  return Array.from({ length: ACTION_COUNT }, () => 0)
}

export function peekQValues(table: Map<StateKey, number[]>, state: StateKey): readonly number[] {
  return table.get(state) ?? ZERO_Q_VALUES
}

export function getOrCreateQValues(table: Map<StateKey, number[]>, state: StateKey): number[] {
  const existing = table.get(state)
  if (existing) return existing
  if (!isValidStateKeyForSchema(state, OBSERVATION_SCHEMA_VERSION)) {
    return createEmptyQValues()
  }

  const created = createEmptyQValues()
  table.set(state, created)
  return created
}

export function maxQValue(
  qValues: readonly number[],
  legalActions: readonly AgentAction[] = AGENT_ACTIONS,
): number {
  const legal = legalActions.length > 0 ? legalActions : AGENT_ACTIONS
  let max = Number.NEGATIVE_INFINITY

  for (const action of legal) {
    const value = qValues[actionIndex(action)] ?? 0
    if (Number.isFinite(value) && value > max) max = value
  }

  return Number.isFinite(max) ? max : 0
}

export function argmaxAction(
  qValues: readonly number[],
  legalActions: readonly AgentAction[] = AGENT_ACTIONS,
): AgentAction {
  const legal = legalActions.length > 0 ? legalActions : AGENT_ACTIONS
  let bestAction = fallbackLegalAction(legal)
  let bestValue = Number.NEGATIVE_INFINITY

  for (const action of legal) {
    const value = qValues[actionIndex(action)] ?? 0
    if (Number.isFinite(value) && value > bestValue) {
      bestValue = value
      bestAction = action
    }
  }

  return bestAction
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

export function pickWeightedAction(
  weights: readonly number[],
  rng: () => number,
  legalActions: readonly AgentAction[] = AGENT_ACTIONS,
): AgentAction {
  const legal = legalActions.length > 0 ? legalActions : AGENT_ACTIONS
  let total = 0
  const selected: number[] = []

  for (const action of legal) {
    const weight = Math.max(0, weights[actionIndex(action)] ?? 0)
    selected.push(weight)
    total += weight
  }

  if (total <= 0) return fallbackLegalAction(legal)

  const roll = rng() * total
  let cumulative = 0
  for (let i = 0; i < legal.length; i += 1) {
    cumulative += selected[i] ?? 0
    if (roll < cumulative) {
      return legal[i] ?? fallbackLegalAction(legal)
    }
  }

  return legal[legal.length - 1] ?? fallbackLegalAction(legal)
}

export function selectEpsilonGreedy(
  qValues: readonly number[],
  epsilon: number,
  rng: () => number,
  legalActions: readonly AgentAction[] = AGENT_ACTIONS,
  selectionScores: readonly number[] = qValues,
): ActionSelection {
  const legal: readonly AgentAction[] = legalActions.length > 0 ? legalActions : ['REST']

  if (rng() < epsilon) {
    return {
      action: pickWeightedAction(EXPLORE_ACTION_WEIGHTS, rng, legal),
      explored: true,
    }
  }

  return {
    action: argmaxAction(selectionScores, legal),
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
