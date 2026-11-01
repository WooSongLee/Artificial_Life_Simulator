import type { ViewerSettings } from '../types/simulation'
import type { TerrainPreset, TerrainProfile, TerrainRatioMap, TerrainType } from '../types/terrain'
import { TERRAIN_PRESETS } from '../types/terrain'
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

export const MIN_WORLD_SEED = 1
export const MAX_WORLD_SEED = 2_147_483_646
export const DEFAULT_TERRAIN_PRESET: TerrainPreset = 'balanced'
export const FORAGE_SEED_SALT = 0xf04a6e
export const MIN_BERRY_COUNT = 0
export const MAX_BERRY_COUNT = 24
export const DEFAULT_BERRY_COUNT = 12
export const MIN_ROOT_COUNT = 0
export const MAX_ROOT_COUNT = 20
export const DEFAULT_ROOT_COUNT = 10
export const MIN_FORAGE_REGEN_RATE = 0.1
export const MAX_FORAGE_REGEN_RATE = 2
export const DEFAULT_FORAGE_REGEN_RATE = 0.8
export const FORAGE_REGEN_RATE_PRESETS = [0.3, 0.6, 1, 1.5] as const
export const MIN_TOOL_COUNT = 0
export const MAX_TOOL_COUNT = 12
export const DEFAULT_BASKET_COUNT = 4
export const DEFAULT_STICK_COUNT = 4
export const DEFAULT_SPEAR_COUNT = 2
export const DEFAULT_SHIELD_COUNT = 2
export const GATHER_RADIUS = 1.6
export const PICK_UP_RADIUS = 1.6
export const ATTACK_RANGE = 2
export const SPEAR_ATTACK_RANGE = 2.8
export const ATTACK_BASE_DAMAGE = 6
export const SPEAR_DAMAGE_MULTIPLIER = 1.45
export const COMBAT_STRENGTH_DEFAULT = 1
export const ATTACK_COOLDOWN = 0.45
export const ATTACK_ENERGY_DRAIN_MULTIPLIER = 1.15
export const DEFEND_DURATION = 0.6
export const BASE_DEFEND_FACTOR = 0.72
export const SHIELD_DEFEND_FACTOR = 0.4
export const FLEE_SUCCESS_MARGIN = 0.08
export const BERRY_MAX_QUANTITY = 4
export const ROOT_MAX_QUANTITY = 3
export const BERRY_BASE_YIELD = 1
export const BERRY_BASKET_YIELD = 2
export const ROOT_YIELD = 1
export const BERRY_ENERGY_PER_UNIT = 10
export const BERRY_HUNGER_PER_UNIT = 12
export const BERRY_BASKET_HUNGER_BONUS = 4
export const ROOT_ENERGY_PER_UNIT = 16
export const ROOT_HUNGER_PER_UNIT = 18
export const TOOL_MAX_DURABILITY = 8
export const TOOL_DURABILITY_COST = 1
export const FORAGE_MIN_DISTANCE = 2.4
export const TOOL_MIN_DISTANCE = 2.1
export const TERRAIN_CELL_SIZE = 2
export const TERRAIN_SEED_SALT = 0x7e11a1
export const WETLAND_FOOD_BIAS = 0.35
export const TARGET_CONCEALMENT_VISION_SCALE = 0.5

export const TERRAIN_PRESET_RATIOS: Record<TerrainPreset, TerrainRatioMap> = {
  balanced: { grassland: 0.46, forest: 0.22, rocky: 0.14, wetland: 0.1, water: 0.08 },
  forest: { grassland: 0.28, forest: 0.42, rocky: 0.1, wetland: 0.12, water: 0.08 },
  rocky: { grassland: 0.32, forest: 0.12, rocky: 0.38, wetland: 0.08, water: 0.1 },
  wetland: { grassland: 0.28, forest: 0.14, rocky: 0.1, wetland: 0.36, water: 0.12 },
  lakes: { grassland: 0.4, forest: 0.18, rocky: 0.12, wetland: 0.1, water: 0.2 },
}

export const TERRAIN_PROFILES: Record<TerrainType, TerrainProfile> = {
  grassland: {
    moveSpeedMultiplier: 1,
    energyDrainMultiplier: 1,
    visionMultiplier: 1,
    concealment: 0,
    walkable: true,
    resourceSpawnWeights: { food: 1, tree: 0.4, rock: 0.35 },
  },
  forest: {
    moveSpeedMultiplier: 0.85,
    energyDrainMultiplier: 1.1,
    visionMultiplier: 0.7,
    concealment: 0.45,
    walkable: true,
    resourceSpawnWeights: { food: 1.35, tree: 2.2, rock: 0.2 },
  },
  rocky: {
    moveSpeedMultiplier: 0.7,
    energyDrainMultiplier: 1.25,
    visionMultiplier: 1,
    concealment: 0.12,
    walkable: true,
    resourceSpawnWeights: { food: 0.45, tree: 0.15, rock: 2.4 },
  },
  wetland: {
    moveSpeedMultiplier: 0.65,
    energyDrainMultiplier: 1.2,
    visionMultiplier: 0.9,
    concealment: 0.22,
    walkable: true,
    resourceSpawnWeights: { food: 1.45, tree: 0.5, rock: 0.15 },
  },
  water: {
    moveSpeedMultiplier: 0,
    energyDrainMultiplier: 1.3,
    visionMultiplier: 1,
    concealment: 0,
    walkable: false,
    resourceSpawnWeights: { food: 0, tree: 0, rock: 0 },
  },
}

export const TERRAIN_LABELS: Record<TerrainType, string> = {
  grassland: 'Grassland',
  forest: 'Forest',
  rocky: 'Rocky',
  wetland: 'Wetland',
  water: 'Water',
}

export const TERRAIN_PRESET_LABELS: Record<TerrainPreset, string> = {
  balanced: 'Balanced',
  forest: 'Forest',
  rocky: 'Rocky',
  wetland: 'Wetland',
  lakes: 'Lakes',
}

export const TERRAIN_COLORS: Record<TerrainType, string> = {
  grassland: '#7aa84e',
  forest: '#3d3a28',
  rocky: '#8a7a64',
  wetland: '#4a7a6a',
  water: '#3a6a88',
}

export const TERRAIN_HEIGHTS: Record<TerrainType, number> = {
  grassland: 0,
  forest: 0.045,
  rocky: 0.09,
  wetland: -0.05,
  water: -0.16,
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  size: 48,
  gridDivisions: 24,
  agentCount: INITIAL_AGENT_COUNT,
  initialFoodCount: 40,
  foodRegenRate: 2,
  obstacleDensity: DEFAULT_OBSTACLE_DENSITY,
  resourceDistribution: 'uniform',
  seed: WORLD_SEED,
  terrainPreset: DEFAULT_TERRAIN_PRESET,
  initialBerryCount: DEFAULT_BERRY_COUNT,
  initialRootCount: DEFAULT_ROOT_COUNT,
  forageRegenRate: DEFAULT_FORAGE_REGEN_RATE,
  initialBasketCount: DEFAULT_BASKET_COUNT,
  initialStickCount: DEFAULT_STICK_COUNT,
  initialSpearCount: DEFAULT_SPEAR_COUNT,
  initialShieldCount: DEFAULT_SHIELD_COUNT,
}

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  showGrid: true,
  showTrees: true,
  showRocks: true,
  showFood: true,
  showForage: true,
  showTools: true,
  showAgents: true,
  showAgentTrails: true,
  showVisionRange: true,
  showFoodSeek: true,
  showActionMarkers: true,
  showActionCues: true,
  followSelectedAgent: true,
}

export const ACTION_CUE_FULL_SPEED_MAX = 20

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

export const ENERGY_DRAIN_PER_SEC = 0.42
export const MOVE_ENERGY_DRAIN_MULTIPLIER = 1.25
export const HUNGER_GAIN_PER_SEC = 0.5
export const HUNGRY_EXTRA_DRAIN_PER_SEC = 0.16
export const HUNGER_DRAIN_THRESHOLD = 82
export const ENERGY_CRITICAL = 10
export const HEALTH_DRAIN_PER_SEC = 0.8
export const HEALTH_REGEN_PER_SEC = 1.6
export const SEEK_ENERGY_THRESHOLD = 52
export const SEEK_HUNGER_THRESHOLD = 42
export const FOOD_ENERGY_RESTORE = 58
export const FOOD_HUNGER_RELIEF = 68
export const FOOD_PER_AGENT = 2.2
export const MIN_TARGET_FOOD = 16
export const MAX_TARGET_FOOD = 56
export const FOOD_SPAWN_INTERVAL = 0.5
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

export function clampWorldSeed(seed: number): number {
  return Math.round(clamp(seed, MIN_WORLD_SEED, MAX_WORLD_SEED))
}

export function clampTerrainPreset(preset: TerrainPreset | string): TerrainPreset {
  return TERRAIN_PRESETS.includes(preset as TerrainPreset)
    ? (preset as TerrainPreset)
    : DEFAULT_TERRAIN_PRESET
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
    seed: clampWorldSeed(config.seed),
    terrainPreset: clampTerrainPreset(config.terrainPreset),
    initialBerryCount: clampCount(config.initialBerryCount, MIN_BERRY_COUNT, MAX_BERRY_COUNT),
    initialRootCount: clampCount(config.initialRootCount, MIN_ROOT_COUNT, MAX_ROOT_COUNT),
    forageRegenRate: clamp(config.forageRegenRate, MIN_FORAGE_REGEN_RATE, MAX_FORAGE_REGEN_RATE),
    initialBasketCount: clampCount(config.initialBasketCount, MIN_TOOL_COUNT, MAX_TOOL_COUNT),
    initialStickCount: clampCount(config.initialStickCount, MIN_TOOL_COUNT, MAX_TOOL_COUNT),
    initialSpearCount: clampCount(config.initialSpearCount, MIN_TOOL_COUNT, MAX_TOOL_COUNT),
    initialShieldCount: clampCount(config.initialShieldCount, MIN_TOOL_COUNT, MAX_TOOL_COUNT),
  }
}

function clampCount(value: number | undefined, min: number, max: number): number {
  return Math.round(clamp(typeof value === 'number' ? value : min, min, max))
}

export function getForageSpawnInterval(config: WorldConfig): number {
  return 1 / clamp(config.forageRegenRate, MIN_FORAGE_REGEN_RATE, MAX_FORAGE_REGEN_RATE)
}
