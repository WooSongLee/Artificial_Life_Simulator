export const AGENT_ACTIONS = [
  'MOVE_FORWARD',
  'TURN_LEFT',
  'TURN_RIGHT',
  'EAT',
  'REST',
] as const

export type AgentAction = (typeof AGENT_ACTIONS)[number]

export const ENERGY_BANDS = ['low', 'mid', 'high'] as const
export const HUNGER_BANDS = ['low', 'mid', 'high'] as const
export const FOOD_DIRECTIONS = ['none', 'forward', 'back', 'left', 'right'] as const
export const FOOD_DISTANCES = ['close', 'mid', 'far', 'out'] as const
export const OBSTACLE_AHEAD_VALUES = ['yes', 'no'] as const

export type EnergyBand = (typeof ENERGY_BANDS)[number]
export type HungerBand = (typeof HUNGER_BANDS)[number]
export type FoodDirection = (typeof FOOD_DIRECTIONS)[number]
export type FoodDistance = (typeof FOOD_DISTANCES)[number]
export type ObstacleAhead = (typeof OBSTACLE_AHEAD_VALUES)[number]

export interface Observation {
  energy: EnergyBand
  hunger: HungerBand
  foodDirection: FoodDirection
  foodDistance: FoodDistance
  obstacleAhead: ObstacleAhead
}

export type StateKey = string

export interface LearningConfig {
  learningRate: number
  discountFactor: number
  initialEpsilon: number
  minEpsilon: number
  epsilonDecay: number
}

export interface RewardConfig {
  eatSuccess: number
  wastedEnergy: number
  collision: number
  death: number
  efficientRest: number
}

export interface RewardContext {
  action: AgentAction
  ate: boolean
  collided: boolean
  died: boolean
  energyBefore: number
  hungerBefore: number
  foodInEatRange: boolean
}

export interface ActionOutcome {
  action: AgentAction
  ate: boolean
  collided: boolean
  died: boolean
  consumedFoodId: string | null
}

export interface ActionSelection {
  action: AgentAction
  explored: boolean
}

export interface AgentPolicy {
  readonly name: string
  selectAction: (qValues: readonly number[], epsilon: number, rng: () => number) => ActionSelection
}

export interface AgentBrain {
  qTable: Map<StateKey, number[]>
  epsilon: number
  totalSteps: number
  totalReward: number
  recentRewards: number[]
  recentExplored: number[]
  actionCounts: Record<AgentAction, number>
}

export interface LearningStats {
  totalLearningSteps: number
  currentEpsilon: number
  averageReward: number
  averageQValue: number
  explorationRate: number
  visitedStates: number
  learningEnabled: boolean
}

export interface AgentLearningView {
  lastAction: AgentAction | null
  lastReward: number
  lastStateKey: StateKey | null
  epsilon: number
  totalSteps: number
  totalReward: number
  averageReward: number
  averageQValue: number
  explorationRate: number
  visitedStates: number
  actionCounts: Record<AgentAction, number>
}
