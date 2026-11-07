import type { Agent } from './agent'
import type { ForageNode, WorldTool } from './forage'
import type { Interactable } from './interactable'
import type { LabObjectInstance } from './labObject'
import type { TerrainGrid, TerrainPreset } from './terrain'

export interface WorldOutcomeStats {
  foodEaten: number
  resourcesGathered: number
  toolPickupAttempts: number
  toolPickupSuccesses: number
  gatherAttempts: number
  gatherSuccesses: number
  interactAttempts: number
  interactSuccesses: number
  /** Lab rest_bed / lookout successes (non-survival drive picks). */
  drivePicks: number
  /** Survival picks: EAT selections or successful food eats (drive tradeoff UI). */
  survivalPicks: number
  damageDealt: number
  damageReceived: number
  attackAttempts: number
  attackHits: number
  defendAttempts: number
  defendReductions: number
  fleeAttempts: number
  fleeSuccesses: number
}

export type WorldObjectType = 'tree' | 'rock' | 'food'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface WorldObject {
  id: string
  type: WorldObjectType
  position: Vec3
  scale: number
  rotation: number
}

export const RESOURCE_DISTRIBUTIONS = ['uniform', 'clustered', 'edge'] as const

export type ResourceDistribution = (typeof RESOURCE_DISTRIBUTIONS)[number]

/** Ecology preserves the multi-agent ecosystem. Human Behavior Lab is a single-agent sandbox. */
export const SIMULATION_MODES = ['ecology', 'human_behavior_lab'] as const

export type SimulationMode = (typeof SIMULATION_MODES)[number]

/** Lab-only experimental presets. Ecology ignores this field. */
export const LAB_CONDITIONS = [
  'baseline',
  'food_scarce',
  'rest_locked',
  'curiosity_prime',
  'tradeoff_hard',
] as const

export type LabCondition = (typeof LAB_CONDITIONS)[number]

/** Lab ambient clock bands (Env-P3). Ecology worlds omit environment state. */
export const LAB_TIME_PERIODS = ['dawn', 'day', 'dusk', 'night'] as const

export type LabTimePeriod = (typeof LAB_TIME_PERIODS)[number]

/**
 * Minimal Lab environment dynamics: time → lighting + temperature.
 * Seeded only in `human_behavior_lab`; Ecology keeps `null`.
 */
export interface LabEnvironmentState {
  /** Simulated clock hours in [0, 24). */
  timeOfDayHours: number
  period: LabTimePeriod
  /** Ambient light level in [0, 1]. */
  lighting: number
  /** Ambient temperature °C. */
  temperatureC: number
  /** Cumulative period changes (probe / logs). */
  periodTransitions: number
}

export interface WorldConfig {
  size: number
  gridDivisions: number
  agentCount: number
  /** Defaults to ecology for legacy saves; new sessions also start in ecology. */
  mode: SimulationMode
  /**
   * Human Behavior Lab experimental condition. Defaults to baseline.
   * Ecology worlds keep the field but never apply it.
   */
  labCondition: LabCondition
  initialFoodCount: number
  foodRegenRate: number
  obstacleDensity: number
  resourceDistribution: ResourceDistribution
  seed: number
  terrainPreset: TerrainPreset
  initialBerryCount: number
  initialRootCount: number
  forageRegenRate: number
  initialBasketCount: number
  initialStickCount: number
  initialSpearCount: number
  initialShieldCount: number
}

export interface WorldState {
  config: WorldConfig
  objects: WorldObject[]
  agents: Agent[]
  forageNodes: ForageNode[]
  worldTools: WorldTool[]
  /** Door/Switch/Box objects. Ecology defaults to []; Lab seeds a switch→door pair. */
  interactables: Interactable[]
  /**
   * Catalog-driven Lab sandbox objects (Env-P1+). Ecology defaults to [].
   * Legacy interactables remain authoritative for door/switch/box/bed/lookout.
   */
  labObjects: LabObjectInstance[]
  /**
   * Lab ambient time/lighting/temperature (Env-P3). Ecology = null.
   */
  labEnvironment: LabEnvironmentState | null
  foodSpawnCooldown: number
  forageSpawnCooldown: number
  generation: number
  generationStartTick: number
  birthCount: number
  terrain: TerrainGrid
  outcomeStats: WorldOutcomeStats
}

export interface ObjectDefinition {
  type: WorldObjectType
  label: string
  category: 'environment' | 'resource'
  description: string
}
