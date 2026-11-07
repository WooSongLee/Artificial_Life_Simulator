import { TERRAIN_TYPES, type TerrainType } from '../types/terrain'

export const AGENT_ACTIONS = [
  'MOVE_FORWARD',
  'TURN_LEFT',
  'TURN_RIGHT',
  'EAT',
  'REST',
  'PICK_UP',
  'GATHER',
  'ATTACK',
  'DEFEND',
  'FLEE',
] as const

export type AgentAction = (typeof AGENT_ACTIONS)[number]

export const ENERGY_BANDS = ['low', 'mid', 'high'] as const
export const HUNGER_BANDS = ['low', 'mid', 'high'] as const
export const FOOD_DIRECTIONS = ['none', 'forward', 'back', 'left', 'right'] as const
export const FOOD_DISTANCES = ['close', 'mid', 'far', 'out'] as const
export const OBSTACLE_AHEAD_VALUES = ['yes', 'no'] as const
export const OBSERVATION_TERRAIN_VALUES = TERRAIN_TYPES
export const FORAGE_CUES = [
  'none',
  'berry_close',
  'berry_fwd',
  'berry_oth',
  'root_close',
  'root_fwd',
  'root_oth',
] as const
export const NEARBY_TOOLS = ['none', 'basket', 'stick', 'spear', 'shield'] as const
export const HELD_TOOLS = [
  'none',
  'basket_high',
  'basket_low',
  'stick_high',
  'stick_low',
  'spear_high',
  'spear_low',
  'shield_high',
  'shield_low',
] as const
export const AGENT_DIRECTIONS = ['none', 'forward', 'back', 'left', 'right'] as const
export const AGENT_DISTANCES = ['close', 'mid', 'far', 'out'] as const
export const HEALTH_BANDS = ['low', 'mid', 'high'] as const
/** Nearest visible interactable: kind + close/forward/other (forage-style). */
export const INTERACTABLE_CUES = [
  'none',
  'switch_close',
  'switch_fwd',
  'switch_oth',
  'door_close',
  'door_fwd',
  'door_oth',
  'box_close',
  'box_fwd',
  'box_oth',
  'rest_close',
  'rest_fwd',
  'rest_oth',
  'look_close',
  'look_fwd',
  'look_oth',
] as const
/**
 * Dominant Lab need for Q conditioning (Ecology → na).
 * surv = hunger/energy urgent; tired/curious = human drive; calm = drives ok.
 */
export const DRIVE_CUES = ['na', 'calm', 'tired', 'curious', 'surv'] as const

export type EnergyBand = (typeof ENERGY_BANDS)[number]
export type HungerBand = (typeof HUNGER_BANDS)[number]
export type FoodDirection = (typeof FOOD_DIRECTIONS)[number]
export type FoodDistance = (typeof FOOD_DISTANCES)[number]
export type ObstacleAhead = (typeof OBSTACLE_AHEAD_VALUES)[number]
export type ObservationTerrain = TerrainType
export type ForageCue = (typeof FORAGE_CUES)[number]
export type NearbyTool = (typeof NEARBY_TOOLS)[number]
export type HeldTool = (typeof HELD_TOOLS)[number]
export type AgentDirection = (typeof AGENT_DIRECTIONS)[number]
export type AgentDistance = (typeof AGENT_DISTANCES)[number]
export type HealthBand = (typeof HEALTH_BANDS)[number]
export type InteractableCue = (typeof INTERACTABLE_CUES)[number]
export type DriveCue = (typeof DRIVE_CUES)[number]

export interface Observation {
  energy: EnergyBand
  hunger: HungerBand
  foodDirection: FoodDirection
  foodDistance: FoodDistance
  obstacleAhead: ObstacleAhead
  terrain: ObservationTerrain
  terrainAhead: ObservationTerrain
  forage: ForageCue
  nearbyTool: NearbyTool
  heldTool: HeldTool
  agentDirection: AgentDirection
  agentDistance: AgentDistance
  health: HealthBand
  interactable: InteractableCue
  drive: DriveCue
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
  gatherUnit: number
  pickupSuccess: number
  /** Reward for a successful interactable use (switch toggle / box push). */
  interactSuccess: number
  attackHitUnit: number
  attackMiss: number
  damageTakenUnit: number
  defendReduceUnit: number
  fleeSuccess: number
}

export interface RewardContext {
  action: AgentAction
  ate: boolean
  collided: boolean
  died: boolean
  energyBefore: number
  hungerBefore: number
  foodInEatRange: boolean
  gatheredAmount: number
  pickedUp: boolean
  interacted?: boolean
  damageDealt?: number
  damageTaken?: number
  damageReduced?: number
  fledFarther?: boolean
  attackAttempted?: boolean
  attackHit?: boolean
}

export interface ActionOutcome {
  action: AgentAction
  ate: boolean
  collided: boolean
  died: boolean
  consumedFoodId: string | null
  pickedUpToolId: string | null
  gatheredNodeId: string | null
  gatheredAmount: number
  interactedId?: string | null
  durabilityDelta: number
  targetKind: string | null
  damageDealt?: number
  damageTaken?: number
  damageReduced?: number
  fledFarther?: boolean
  combatTargetId?: string | null
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
  actionSchemaVersion: number
  observationSchemaVersion: number
}

export interface LearningStats {
  totalLearningSteps: number
  currentEpsilon: number
  averageReward: number
  averageQValue: number
  explorationRate: number
  visitedStates: number
  maxVisitedStates: number
  averageVisitedStates: number
  qTableCells: number
  stateSpaceSize: number
  learningEnabled: boolean
  hasLearningSamples: boolean
  actionCounts: Record<AgentAction, number>
  agentActionCounts: Array<{
    agentId: string
    alive: boolean
    total: number
    visitedStates: number
    actionCounts: Record<AgentAction, number>
  }>
}

export interface QTableSummary {
  visitedStates: number
  stateSpaceSize: number
  coverage: number
  averageQ: number
  minQ: number
  maxQ: number
  averageQByAction: Record<AgentAction, number>
  preferredActionCounts: Record<AgentAction, number>
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
  recentRewards: number[]
  qTable: QTableSummary
  currentQByAction: Record<AgentAction, number> | null
  currentGeneticBiasByAction: Record<AgentAction, number> | null
  currentSelectionScoreByAction: Record<AgentAction, number> | null
}
