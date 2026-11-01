import type { LearningConfig } from '../learning/types'
import type { WorldConfig } from '../types/world'
import type { ExperimentPolicyMode, ExperimentRecord, ExperimentSummary } from './types'

export interface ExperimentCondition {
  seed: number
  size: number
  agentCount: number
  initialFoodCount: number
  foodRegenRate: number
  obstacleDensity: number
  resourceDistribution: WorldConfig['resourceDistribution']
  terrainPreset: WorldConfig['terrainPreset']
  initialBerryCount: number
  initialRootCount: number
  forageRegenRate: number
  initialBasketCount: number
  initialStickCount: number
  initialSpearCount: number
  initialShieldCount: number
  learningEnabled: boolean
  learningRate: number
  discountFactor: number
  initialEpsilon: number
  minEpsilon: number
  epsilonDecay: number
}

export interface ConditionDifference {
  key: keyof ExperimentCondition
  label: string
  values: Array<string | number | boolean>
}

export type ConditionMatch = 'matched' | 'same-environment-different-policy' | 'different'

const CONDITION_LABELS: Record<keyof ExperimentCondition, string> = {
  seed: 'World Seed',
  size: 'World Size',
  agentCount: 'Initial Population',
  initialFoodCount: 'Initial Food',
  foodRegenRate: 'Food Regen',
  obstacleDensity: 'Obstacle Density',
  resourceDistribution: 'Resource Distribution',
  terrainPreset: 'Terrain Mix',
  initialBerryCount: 'Berry Bushes',
  initialRootCount: 'Root Patches',
  forageRegenRate: 'Forage Regen',
  initialBasketCount: 'Baskets',
  initialStickCount: 'Digging Sticks',
  initialSpearCount: 'Spears',
  initialShieldCount: 'Shields',
  learningEnabled: 'Learning Enabled',
  learningRate: 'Learning Rate',
  discountFactor: 'Discount',
  initialEpsilon: 'Initial Epsilon',
  minEpsilon: 'Min Epsilon',
  epsilonDecay: 'Epsilon Decay',
}

const ENVIRONMENT_KEYS: Array<keyof ExperimentCondition> = [
  'seed',
  'size',
  'agentCount',
  'initialFoodCount',
  'foodRegenRate',
  'obstacleDensity',
  'resourceDistribution',
  'terrainPreset',
  'initialBerryCount',
  'initialRootCount',
  'forageRegenRate',
  'initialBasketCount',
  'initialStickCount',
  'initialSpearCount',
  'initialShieldCount',
]

export function policyModeFor(input: {
  learningEnabled: boolean
  visitedStates: number
  currentEpsilon?: number
}): ExperimentPolicyMode {
  if (input.learningEnabled) return 'learning'
  if (input.visitedStates > 0) return 'frozen-q'
  return 'random-like'
}

export function describePolicyMode(mode: ExperimentPolicyMode): string {
  if (mode === 'learning') return 'Learning On'
  if (mode === 'frozen-q') return 'Learning Off · Frozen Q'
  return 'Learning Off · Random-like'
}

export function experimentCondition(
  worldConfig: WorldConfig,
  learningConfig: LearningConfig,
  learningEnabled: boolean,
): ExperimentCondition {
  return {
    seed: worldConfig.seed,
    size: worldConfig.size,
    agentCount: worldConfig.agentCount,
    initialFoodCount: worldConfig.initialFoodCount,
    foodRegenRate: worldConfig.foodRegenRate,
    obstacleDensity: worldConfig.obstacleDensity,
    resourceDistribution: worldConfig.resourceDistribution,
    terrainPreset: worldConfig.terrainPreset,
    initialBerryCount: worldConfig.initialBerryCount,
    initialRootCount: worldConfig.initialRootCount,
    forageRegenRate: worldConfig.forageRegenRate,
    initialBasketCount: worldConfig.initialBasketCount,
    initialStickCount: worldConfig.initialStickCount,
    initialSpearCount: worldConfig.initialSpearCount,
    initialShieldCount: worldConfig.initialShieldCount,
    learningEnabled,
    learningRate: learningConfig.learningRate,
    discountFactor: learningConfig.discountFactor,
    initialEpsilon: learningConfig.initialEpsilon,
    minEpsilon: learningConfig.minEpsilon,
    epsilonDecay: learningConfig.epsilonDecay,
  }
}

export function conditionFromSummary(
  item: Pick<ExperimentSummary, 'worldConfig' | 'learningConfig'> & {
    learningEnabled?: boolean
    statistics: { learningEnabled?: boolean }
  },
): ExperimentCondition {
  return experimentCondition(
    item.worldConfig,
    item.learningConfig,
    item.learningEnabled ?? item.statistics.learningEnabled ?? true,
  )
}

export function conditionFromRecord(record: ExperimentRecord): ExperimentCondition {
  return experimentCondition(record.worldConfig, record.learningConfig, record.learningEnabled)
}

export function conditionDifferences(conditions: ExperimentCondition[]): ConditionDifference[] {
  if (conditions.length < 2) return []
  const keys = Object.keys(CONDITION_LABELS) as Array<keyof ExperimentCondition>
  return keys.flatMap((key) => {
    const values = conditions.map((condition) => condition[key])
    const same = values.every((value) => value === values[0])
    return same ? [] : [{ key, label: CONDITION_LABELS[key], values }]
  })
}

export function classifyConditionMatch(conditions: ExperimentCondition[]): ConditionMatch {
  const diffs = conditionDifferences(conditions)
  if (diffs.length === 0) return 'matched'
  const onlyPolicy = diffs.every(
    (diff) =>
      diff.key === 'learningEnabled' ||
      diff.key === 'learningRate' ||
      diff.key === 'discountFactor' ||
      diff.key === 'initialEpsilon' ||
      diff.key === 'minEpsilon' ||
      diff.key === 'epsilonDecay',
  )
  const environmentMatches = ENVIRONMENT_KEYS.every((key) =>
    conditions.every((condition) => condition[key] === conditions[0]?.[key]),
  )
  return onlyPolicy && environmentMatches ? 'same-environment-different-policy' : 'different'
}

export function sameEnvironmentExceptSeed(conditions: ExperimentCondition[]): boolean {
  if (conditions.length < 2) return false
  const first = conditions[0]
  if (!first) return false
  const seedsDiffer = conditions.some((condition) => condition.seed !== first.seed)
  if (!seedsDiffer) return false
  const learningMatches = conditions.every(
    (condition) =>
      condition.learningEnabled === first.learningEnabled &&
      condition.learningRate === first.learningRate &&
      condition.discountFactor === first.discountFactor &&
      condition.initialEpsilon === first.initialEpsilon &&
      condition.minEpsilon === first.minEpsilon &&
      condition.epsilonDecay === first.epsilonDecay,
  )
  if (!learningMatches) return false
  return conditions.every((condition) =>
    ENVIRONMENT_KEYS.every((key) => key === 'seed' || condition[key] === first[key]),
  )
}

export function meanAndDeviation(values: Array<number | null>): { mean: number; deviation: number } | null {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value))
  if (finite.length < 2) return null
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length
  return { mean, deviation: Math.sqrt(variance) }
}
