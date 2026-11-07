import { TERRAIN_TYPES, type TerrainType } from '../types/terrain'

/** Named terms produced by `computeRewardBreakdown` (raw, pre-curriculum). */
export const REWARD_COMPONENT_KEYS = [
  'eat',
  'gather',
  'pickup',
  'interact',
  'death',
  'collision',
  'wastedEnergy',
  'efficientRest',
  'driveRelief',
  'survivalSeek',
  'spinPenalty',
  'attack',
  'damageTaken',
  'defend',
  'flee',
] as const

export type RewardComponentKey = (typeof REWARD_COMPONENT_KEYS)[number]
export type RewardComponents = Record<RewardComponentKey, number>

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
/**
 * Compact Lab ambient cue (Env-P3): period × light × temp.
 * Ecology → na. day|nit × brt|dim × wrm|cld.
 */
export const ENV_CUES = [
  'na',
  'day_brt_wrm',
  'day_brt_cld',
  'day_dim_wrm',
  'day_dim_cld',
  'nit_brt_wrm',
  'nit_brt_cld',
  'nit_dim_wrm',
  'nit_dim_cld',
] as const
/**
 * Nearest runtime Lab object (Env-P2 cue): kind + close/forward/other.
 * Ecology → na. Locked/contained food is hidden (fridge is the cue).
 */
export const LAB_OBJECT_CUES = [
  'na',
  'none',
  'fridge_close',
  'fridge_fwd',
  'fridge_oth',
  'stove_close',
  'stove_fwd',
  'stove_oth',
  'sink_close',
  'sink_fwd',
  'sink_oth',
  'table_close',
  'table_fwd',
  'table_oth',
  'food_close',
  'food_fwd',
  'food_oth',
] as const
/**
 * Lab held-slot band (separate from Ecology equipment heldTool).
 * Ecology → na. food_ck = prepared/cooked food_item.
 */
export const HELD_LAB_CUES = ['na', 'none', 'food', 'food_ck', 'other'] as const

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
export type EnvCue = (typeof ENV_CUES)[number]
export type LabObjectCue = (typeof LAB_OBJECT_CUES)[number]
export type HeldLabCue = (typeof HELD_LAB_CUES)[number]

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
  /** Lab ambient time/light/temp band; Ecology = na. */
  env: EnvCue
  /** Nearest Lab object direction band; Ecology = na. */
  labObject: LabObjectCue
  /** Lab held-slot band; Ecology = na. */
  heldLab: HeldLabCue
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
  /**
   * Runtime telemetry: raw (pre-curriculum) reward component sums.
   * Not persisted in SerializedBrain; reset with the brain.
   */
  rewardComponentSums: RewardComponents
  /** Ticks where a reward was computed (includes Frozen / learning-off). */
  rewardTicks: number
  /** Sum of applied (post-curriculum) rewards across rewardTicks. */
  rewardSumApplied: number
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
