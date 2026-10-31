import type { ViewerSettings } from '../types/simulation'
import type { WorldConfig } from '../types/world'
import { clamp } from '../utils/math'

export const WORLD_SEED = 20261031

export const MIN_AGENT_COUNT = 1
export const MAX_AGENT_COUNT = 50
export const INITIAL_AGENT_COUNT = 20
export const AGENT_COUNT_PRESETS = [5, 12, 20, 40] as const

export const MIN_WORLD_SIZE = 32
export const MAX_WORLD_SIZE = 80
export const WORLD_SIZE_PRESETS = [32, 48, 64, 80] as const

export const MIN_FOOD_COUNT = 4
export const MAX_FOOD_COUNT = 60
export const MIN_FOOD_REGEN_RATE = 0.2
export const MAX_FOOD_REGEN_RATE = 4
export const MIN_OBSTACLE_DENSITY = 0
export const MAX_OBSTACLE_DENSITY = 1
export const DEFAULT_OBSTACLE_DENSITY = 0.5
export const FOOD_REGEN_RATE_PRESETS = [0.5, 1, 1.4, 2] as const
export const OBSTACLE_DENSITY_PRESETS = [0, 0.25, 0.5, 0.75, 1] as const

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  size: 48,
  gridDivisions: 24,
  agentCount: INITIAL_AGENT_COUNT,
  initialFoodCount: 32,
  foodRegenRate: 1 / 0.7,
  obstacleDensity: DEFAULT_OBSTACLE_DENSITY,
  resourceDistribution: 'uniform',
}

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  showGrid: true,
  showTrees: true,
  showRocks: true,
  showFood: true,
  showAgents: true,
  showAgentTrails: true,
  showVisionRange: true,
  showFoodSeek: true,
  showActionMarkers: true,
}

export const LEARNING_HISTORY_SAMPLE_TICKS = 20
export const LEARNING_HISTORY_MAX_POINTS = 180
export const LEARNING_COMPARISON_WINDOW = 30

export const DEFAULT_CAMERA_POSITION = [18, 22, 18] as const
export const DEFAULT_CAMERA_TARGET = [0, 0, 0] as const
export const DEFAULT_CAMERA_FOV = 40

export const CAMERA_MIN_DISTANCE = 10
export const CAMERA_MAX_DISTANCE = 90
export const CAMERA_MIN_POLAR = 0.22
export const CAMERA_MAX_POLAR = 1.15

export const TICKS_PER_SECOND = 20
export const SIMULATION_STEP_DT = 1 / TICKS_PER_SECOND
export const MIN_SPEED = 1
export const MAX_SPEED = 100_000_000
export const SPEED_PRESETS = [1, 10, 100, 1_000, 10_000, 1_000_000, 100_000_000] as const
export const MIN_STEPS_PER_FRAME = 8
export const MAX_STEPS_PER_FRAME = 80_000
export const FRAME_STEP_BUDGET_MS = 14

export function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return MIN_SPEED
  return clamp(Math.round(speed), MIN_SPEED, MAX_SPEED)
}

export function getMaxStepsPerFrame(speed: number): number {
  return clamp(Math.ceil((speed * TICKS_PER_SECOND) / 30), MIN_STEPS_PER_FRAME, MAX_STEPS_PER_FRAME)
}

export const MAX_TRAIL_POINTS = 80
export const TRAIL_MIN_DISTANCE = 0.08

export const INITIAL_OBJECT_COUNTS = {
  tree: 16,
  rock: 10,
} as const

export const WORLD_EDGE_MARGIN = 1.2
export const AGENT_RADIUS = 0.38
export const TREE_COLLISION_RADIUS = 0.74
export const ROCK_COLLISION_RADIUS = 0.56
export const FOOD_EAT_RADIUS = 1.6
export const AGENT_LOOKAHEAD = 0.85

export const ENERGY_DRAIN_PER_SEC = 0.7
export const MOVE_ENERGY_DRAIN_MULTIPLIER = 1.4
export const HUNGER_GAIN_PER_SEC = 0.85
export const HUNGRY_EXTRA_DRAIN_PER_SEC = 0.28
export const HUNGER_DRAIN_THRESHOLD = 82
export const ENERGY_CRITICAL = 10
export const HEALTH_DRAIN_PER_SEC = 1.35
export const HEALTH_REGEN_PER_SEC = 1.6
export const SEEK_ENERGY_THRESHOLD = 52
export const SEEK_HUNGER_THRESHOLD = 42
export const FOOD_ENERGY_RESTORE = 46
export const FOOD_HUNGER_RELIEF = 56
export const FOOD_PER_AGENT = 1.6
export const MIN_TARGET_FOOD = 12
export const MAX_TARGET_FOOD = 48
export const FOOD_SPAWN_INTERVAL = 0.7
export const WANDER_TURN_MAX = 1.35
export const REST_ENERGY_DRAIN_MULTIPLIER = 0.4

export const AGENT_SPEED_RANGE = [1.35, 2.75] as const
export const AGENT_VISION_RANGE = [6.5, 13] as const
export const AGENT_TURN_RATE_RANGE = [2.2, 4.2] as const
export const AGENT_ENERGY_RANGE = [82, 100] as const
export const AGENT_HUNGER_RANGE = [4, 18] as const
export const AGENT_HEALTH_RANGE = [92, 100] as const
export const AGENT_WANDER_INTERVAL_RANGE = [0.7, 2.2] as const

export function getTargetFoodCount(agentCount: number): number {
  return clamp(Math.round(agentCount * FOOD_PER_AGENT), MIN_TARGET_FOOD, MAX_TARGET_FOOD)
}

export function getConfiguredFoodCount(config: WorldConfig): number {
  return clamp(Math.round(config.initialFoodCount), MIN_FOOD_COUNT, MAX_FOOD_COUNT)
}

export function getFoodSpawnInterval(config: WorldConfig): number {
  return 1 / clamp(config.foodRegenRate, MIN_FOOD_REGEN_RATE, MAX_FOOD_REGEN_RATE)
}

export function getObstacleCounts(config: WorldConfig): { tree: number; rock: number } {
  const areaScale = (config.size / DEFAULT_WORLD_CONFIG.size) ** 2
  const density = clamp(config.obstacleDensity, MIN_OBSTACLE_DENSITY, MAX_OBSTACLE_DENSITY)
  return {
    tree: Math.round(32 * density * areaScale),
    rock: Math.round(20 * density * areaScale),
  }
}

export function gridDivisionsForSize(size: number): number {
  return Math.max(8, Math.round(size / 2))
}

export function clampWorldSize(size: number): number {
  return Math.round(clamp(size, MIN_WORLD_SIZE, MAX_WORLD_SIZE))
}

export function clampAgentCount(count: number): number {
  return Math.round(clamp(count, MIN_AGENT_COUNT, MAX_AGENT_COUNT))
}

export function clampWorldConfig(config: WorldConfig): WorldConfig {
  const size = clampWorldSize(config.size)
  return {
    size,
    gridDivisions: gridDivisionsForSize(size),
    agentCount: clampAgentCount(config.agentCount),
    initialFoodCount: getConfiguredFoodCount(config),
    foodRegenRate: clamp(config.foodRegenRate, MIN_FOOD_REGEN_RATE, MAX_FOOD_REGEN_RATE),
    obstacleDensity: clamp(config.obstacleDensity, MIN_OBSTACLE_DENSITY, MAX_OBSTACLE_DENSITY),
    resourceDistribution: config.resourceDistribution,
  }
}
