import { MAX_DEAD_AGENTS } from '../evolution/constants'
import { GENOME_GENES } from '../evolution/types'
import { ACTION_SCHEMA_VERSION, OBSERVATION_SCHEMA_VERSION, V1_STATE_SPACE_LIMIT, V2_VISITED_STATE_LIMIT, actionCountForSchema } from '../learning/schema'
import { migrateExperimentRecord } from './migrate'
import { LEARNING_CONFIG_RANGES, REWARD_CONFIG_RANGES } from '../learning/constants'
import {
  MAX_AGENT_COUNT,
  MAX_BERRY_COUNT,
  MAX_FOOD_COUNT,
  MAX_FOOD_REGEN_RATE,
  MAX_FORAGE_REGEN_RATE,
  MAX_OBSTACLE_DENSITY,
  MAX_ROOT_COUNT,
  MAX_TOOL_COUNT,
  MAX_WORLD_SIZE,
  MIN_AGENT_COUNT,
  MIN_BERRY_COUNT,
  MIN_FOOD_COUNT,
  MIN_FOOD_REGEN_RATE,
  MIN_FORAGE_REGEN_RATE,
  MIN_ROOT_COUNT,
  MIN_TOOL_COUNT,
  MIN_OBSTACLE_DENSITY,
  MIN_WORLD_SIZE,
  MAX_SPEED,
  MAX_WORLD_SEED,
  MIN_SPEED,
  MIN_WORLD_SEED,
  TERRAIN_CELL_SIZE,
} from '../simulation/constants'
import { TERRAIN_PRESETS, TERRAIN_TYPES } from '../types/terrain'
import { LAB_CONDITIONS, RESOURCE_DISTRIBUTIONS, SIMULATION_MODES } from '../types/world'
import { cellsPerSide } from '../simulation/terrain'
import { EXPERIMENT_SCHEMA_VERSION, MAX_EXPERIMENT_JSON_BYTES, MAX_EXPERIMENT_NAME_LENGTH } from './constants'
import type { ExperimentRecord, ValidationIssue, ValidationResult } from './types'

function issue(path: string, message: string): ValidationIssue {
  return { path, message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 10 && !Number.isNaN(Date.parse(value))
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

function expectString(value: unknown, path: string, issues: ValidationIssue[], min = 1, max = 200): void {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    issues.push(issue(path, `must be a string of ${min}–${max} characters`))
  }
}

function expectNumber(value: unknown, path: string, issues: ValidationIssue[], min?: number, max?: number): void {
  if (!isFiniteNumber(value)) {
    issues.push(issue(path, 'must be a finite number'))
    return
  }
  if (min !== undefined && max !== undefined && !inRange(value, min, max)) {
    issues.push(issue(path, `must be between ${min} and ${max}`))
  }
}

function expectBoolean(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== 'boolean') {
    issues.push(issue(path, 'must be a boolean'))
  }
}

function expectArray(value: unknown, path: string, issues: ValidationIssue[]): value is unknown[] {
  if (!Array.isArray(value)) {
    issues.push(issue(path, 'must be an array'))
    return false
  }
  return true
}

export function validateWorldConfig(value: unknown, path = 'worldConfig'): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!isRecord(value)) {
    return [issue(path, 'must be an object')]
  }

  expectNumber(value.size, `${path}.size`, issues, MIN_WORLD_SIZE, MAX_WORLD_SIZE)
  expectNumber(value.gridDivisions, `${path}.gridDivisions`, issues, 8, 80)
  expectNumber(value.agentCount, `${path}.agentCount`, issues, MIN_AGENT_COUNT, MAX_AGENT_COUNT)
  if (
    typeof value.mode !== 'string' ||
    !(SIMULATION_MODES as readonly string[]).includes(value.mode)
  ) {
    issues.push(issue(`${path}.mode`, 'must be ecology or human_behavior_lab'))
  } else if (value.mode === 'human_behavior_lab' && value.agentCount !== 1) {
    issues.push(issue(`${path}.agentCount`, 'must be 1 in Human Behavior Lab'))
  }
  if (
    value.labCondition !== undefined &&
    (typeof value.labCondition !== 'string' ||
      !(LAB_CONDITIONS as readonly string[]).includes(value.labCondition))
  ) {
    issues.push(
      issue(
        `${path}.labCondition`,
        'must be baseline, food_scarce, rest_locked, curiosity_prime, or tradeoff_hard',
      ),
    )
  }
  expectNumber(value.initialFoodCount, `${path}.initialFoodCount`, issues, MIN_FOOD_COUNT, MAX_FOOD_COUNT)
  expectNumber(value.foodRegenRate, `${path}.foodRegenRate`, issues, MIN_FOOD_REGEN_RATE, MAX_FOOD_REGEN_RATE)
  expectNumber(value.initialBerryCount, `${path}.initialBerryCount`, issues, MIN_BERRY_COUNT, MAX_BERRY_COUNT)
  expectNumber(value.initialRootCount, `${path}.initialRootCount`, issues, MIN_ROOT_COUNT, MAX_ROOT_COUNT)
  expectNumber(value.forageRegenRate, `${path}.forageRegenRate`, issues, MIN_FORAGE_REGEN_RATE, MAX_FORAGE_REGEN_RATE)
  expectNumber(value.initialBasketCount, `${path}.initialBasketCount`, issues, MIN_TOOL_COUNT, MAX_TOOL_COUNT)
  expectNumber(value.initialStickCount, `${path}.initialStickCount`, issues, MIN_TOOL_COUNT, MAX_TOOL_COUNT)
  expectNumber(value.initialSpearCount, `${path}.initialSpearCount`, issues, MIN_TOOL_COUNT, MAX_TOOL_COUNT)
  expectNumber(value.initialShieldCount, `${path}.initialShieldCount`, issues, MIN_TOOL_COUNT, MAX_TOOL_COUNT)
  expectNumber(value.obstacleDensity, `${path}.obstacleDensity`, issues, MIN_OBSTACLE_DENSITY, MAX_OBSTACLE_DENSITY)
  if (
    typeof value.resourceDistribution !== 'string' ||
    !RESOURCE_DISTRIBUTIONS.includes(value.resourceDistribution as (typeof RESOURCE_DISTRIBUTIONS)[number])
  ) {
    issues.push(issue(`${path}.resourceDistribution`, 'must be uniform, clustered, or edge'))
  }
  expectNumber(value.seed, `${path}.seed`, issues, MIN_WORLD_SEED, MAX_WORLD_SEED)
  if (
    typeof value.terrainPreset !== 'string' ||
    !TERRAIN_PRESETS.includes(value.terrainPreset as (typeof TERRAIN_PRESETS)[number])
  ) {
    issues.push(issue(`${path}.terrainPreset`, 'must be a known terrain preset'))
  }

  return issues
}

export function validateLearningConfig(value: unknown, path = 'learningConfig'): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!isRecord(value)) {
    return [issue(path, 'must be an object')]
  }

  expectNumber(value.learningRate, `${path}.learningRate`, issues, LEARNING_CONFIG_RANGES.learningRate.min, LEARNING_CONFIG_RANGES.learningRate.max)
  expectNumber(value.discountFactor, `${path}.discountFactor`, issues, LEARNING_CONFIG_RANGES.discountFactor.min, LEARNING_CONFIG_RANGES.discountFactor.max)
  expectNumber(value.initialEpsilon, `${path}.initialEpsilon`, issues, LEARNING_CONFIG_RANGES.initialEpsilon.min, LEARNING_CONFIG_RANGES.initialEpsilon.max)
  expectNumber(value.minEpsilon, `${path}.minEpsilon`, issues, LEARNING_CONFIG_RANGES.minEpsilon.min, LEARNING_CONFIG_RANGES.minEpsilon.max)
  expectNumber(value.epsilonDecay, `${path}.epsilonDecay`, issues, LEARNING_CONFIG_RANGES.epsilonDecay.min, LEARNING_CONFIG_RANGES.epsilonDecay.max)

  if (
    isFiniteNumber(value.initialEpsilon) &&
    isFiniteNumber(value.minEpsilon) &&
    value.minEpsilon > value.initialEpsilon
  ) {
    issues.push(issue(`${path}.minEpsilon`, 'cannot be greater than initialEpsilon'))
  }

  return issues
}

export function validateRewardConfig(value: unknown, path = 'rewardConfig'): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!isRecord(value)) {
    return [issue(path, 'must be an object')]
  }

  expectNumber(value.eatSuccess, `${path}.eatSuccess`, issues, REWARD_CONFIG_RANGES.eatSuccess.min, REWARD_CONFIG_RANGES.eatSuccess.max)
  expectNumber(value.wastedEnergy, `${path}.wastedEnergy`, issues, REWARD_CONFIG_RANGES.wastedEnergy.min, REWARD_CONFIG_RANGES.wastedEnergy.max)
  expectNumber(value.collision, `${path}.collision`, issues, REWARD_CONFIG_RANGES.collision.min, REWARD_CONFIG_RANGES.collision.max)
  expectNumber(value.death, `${path}.death`, issues, REWARD_CONFIG_RANGES.death.min, REWARD_CONFIG_RANGES.death.max)
  expectNumber(value.efficientRest, `${path}.efficientRest`, issues, REWARD_CONFIG_RANGES.efficientRest.min, REWARD_CONFIG_RANGES.efficientRest.max)
  expectNumber(value.gatherUnit, `${path}.gatherUnit`, issues, REWARD_CONFIG_RANGES.gatherUnit.min, REWARD_CONFIG_RANGES.gatherUnit.max)
  expectNumber(value.pickupSuccess, `${path}.pickupSuccess`, issues, REWARD_CONFIG_RANGES.pickupSuccess.min, REWARD_CONFIG_RANGES.pickupSuccess.max)
  expectNumber(
    value.interactSuccess,
    `${path}.interactSuccess`,
    issues,
    REWARD_CONFIG_RANGES.interactSuccess.min,
    REWARD_CONFIG_RANGES.interactSuccess.max,
  )
  expectNumber(value.attackHitUnit, `${path}.attackHitUnit`, issues, REWARD_CONFIG_RANGES.attackHitUnit.min, REWARD_CONFIG_RANGES.attackHitUnit.max)
  expectNumber(value.attackMiss, `${path}.attackMiss`, issues, REWARD_CONFIG_RANGES.attackMiss.min, REWARD_CONFIG_RANGES.attackMiss.max)
  expectNumber(value.damageTakenUnit, `${path}.damageTakenUnit`, issues, REWARD_CONFIG_RANGES.damageTakenUnit.min, REWARD_CONFIG_RANGES.damageTakenUnit.max)
  expectNumber(value.defendReduceUnit, `${path}.defendReduceUnit`, issues, REWARD_CONFIG_RANGES.defendReduceUnit.min, REWARD_CONFIG_RANGES.defendReduceUnit.max)
  expectNumber(value.fleeSuccess, `${path}.fleeSuccess`, issues, REWARD_CONFIG_RANGES.fleeSuccess.min, REWARD_CONFIG_RANGES.fleeSuccess.max)
  return issues
}

function validateGenome(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, 'must be an object'))
    return
  }
  for (const gene of GENOME_GENES) {
    expectNumber(value[gene], `${path}.${gene}`, issues)
  }
}

function validateAgent(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, 'must be an object'))
    return
  }
  expectString(value.id, `${path}.id`, issues)
  if (!isRecord(value.position) || !isFiniteNumber(value.position.x) || !isFiniteNumber(value.position.z)) {
    issues.push(issue(`${path}.position`, 'must include finite x and z'))
  }
  expectNumber(value.rotation, `${path}.rotation`, issues)
  expectNumber(value.energy, `${path}.energy`, issues, 0, 100)
  expectNumber(value.hunger, `${path}.hunger`, issues, 0, 100)
  expectNumber(value.health, `${path}.health`, issues, 0, 100)
  expectNumber(value.speed, `${path}.speed`, issues)
  expectNumber(value.vision, `${path}.vision`, issues)
  expectNumber(value.age, `${path}.age`, issues, 0)
  expectNumber(value.maxLifespan, `${path}.maxLifespan`, issues, 0)
  expectNumber(value.desire, `${path}.desire`, issues, 0, 100)
  expectBoolean(value.alive, `${path}.alive`, issues)
  expectNumber(value.generation, `${path}.generation`, issues, 1)
  validateGenome(value.genome, `${path}.genome`, issues)
  if (value.equipment !== null && value.equipment !== undefined) {
    if (!isRecord(value.equipment)) {
      issues.push(issue(`${path}.equipment`, 'must be an object or null'))
    } else {
      if (
        value.equipment.toolType !== 'basket' &&
        value.equipment.toolType !== 'digging_stick' &&
        value.equipment.toolType !== 'spear' &&
        value.equipment.toolType !== 'shield'
      ) {
        issues.push(issue(`${path}.equipment.toolType`, 'must be a known tool'))
      }
      expectNumber(value.equipment.durability, `${path}.equipment.durability`, issues, 0, 64)
      expectNumber(value.equipment.maxDurability, `${path}.equipment.maxDurability`, issues, 1, 64)
    }
  }
}

function validateForageNode(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, 'must be an object'))
    return
  }
  expectString(value.id, `${path}.id`, issues)
  if (value.kind !== 'berry_bush' && value.kind !== 'root_patch') {
    issues.push(issue(`${path}.kind`, 'must be berry_bush or root_patch'))
  }
  if (
    !isRecord(value.position) ||
    !isFiniteNumber(value.position.x) ||
    !isFiniteNumber(value.position.y) ||
    !isFiniteNumber(value.position.z)
  ) {
    issues.push(issue(`${path}.position`, 'must include finite x, y, z'))
  }
  expectNumber(value.quantity, `${path}.quantity`, issues, 0, 32)
  expectNumber(value.maxQuantity, `${path}.maxQuantity`, issues, 1, 32)
}

function validateInteractable(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, 'must be an object'))
    return
  }
  expectString(value.id, `${path}.id`, issues)
  if (
    value.kind !== 'door' &&
    value.kind !== 'switch' &&
    value.kind !== 'movable_box' &&
    value.kind !== 'rest_bed' &&
    value.kind !== 'lookout'
  ) {
    issues.push(issue(`${path}.kind`, 'must be door, switch, movable_box, rest_bed, or lookout'))
  }
  if (
    !isRecord(value.position) ||
    !isFiniteNumber(value.position.x) ||
    !isFiniteNumber(value.position.y) ||
    !isFiniteNumber(value.position.z)
  ) {
    issues.push(issue(`${path}.position`, 'must include finite x, y, z'))
  }
  expectNumber(value.rotation, `${path}.rotation`, issues)
  expectNumber(value.scale, `${path}.scale`, issues, 0.1, 8)
  if (value.kind === 'door' && typeof value.open !== 'boolean') {
    issues.push(issue(`${path}.open`, 'must be a boolean'))
  }
  if (value.kind === 'switch') {
    if (typeof value.on !== 'boolean') {
      issues.push(issue(`${path}.on`, 'must be a boolean'))
    }
    expectString(value.controlsId, `${path}.controlsId`, issues)
  }
  if (value.kind === 'rest_bed' && typeof value.used !== 'boolean') {
    issues.push(issue(`${path}.used`, 'must be a boolean'))
  }
  if (value.kind === 'lookout' && typeof value.used !== 'boolean') {
    issues.push(issue(`${path}.used`, 'must be a boolean'))
  }
}

function validateWorldTool(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, 'must be an object'))
    return
  }
  expectString(value.id, `${path}.id`, issues)
  if (
    value.toolType !== 'basket' &&
    value.toolType !== 'digging_stick' &&
    value.toolType !== 'spear' &&
    value.toolType !== 'shield'
  ) {
    issues.push(issue(`${path}.toolType`, 'must be a known tool'))
  }
  if (
    !isRecord(value.position) ||
    !isFiniteNumber(value.position.x) ||
    !isFiniteNumber(value.position.y) ||
    !isFiniteNumber(value.position.z)
  ) {
    issues.push(issue(`${path}.position`, 'must include finite x, y, z'))
  }
  expectNumber(value.durability, `${path}.durability`, issues, 0, 64)
  expectNumber(value.maxDurability, `${path}.maxDurability`, issues, 1, 64)
}

function validateObject(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, 'must be an object'))
    return
  }
  expectString(value.id, `${path}.id`, issues)
  if (value.type !== 'tree' && value.type !== 'rock' && value.type !== 'food') {
    issues.push(issue(`${path}.type`, 'must be tree, rock, or food'))
  }
  if (
    !isRecord(value.position) ||
    !isFiniteNumber(value.position.x) ||
    !isFiniteNumber(value.position.y) ||
    !isFiniteNumber(value.position.z)
  ) {
    issues.push(issue(`${path}.position`, 'must include finite x, y, z'))
  }
}

function validateTerrain(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  worldSize?: number,
): void {
  if (!isRecord(value)) {
    issues.push(issue(path, 'must be an object'))
    return
  }
  expectNumber(value.cellSize, `${path}.cellSize`, issues, TERRAIN_CELL_SIZE, TERRAIN_CELL_SIZE)
  const expectedSize = worldSize === undefined ? undefined : cellsPerSide(worldSize)
  expectNumber(value.size, `${path}.size`, issues, 8, 80)
  if (!expectArray(value.cells, `${path}.cells`, issues)) return
  if (expectedSize !== undefined && value.size !== expectedSize) {
    issues.push(issue(`${path}.size`, `must be ${expectedSize} for this world size`))
  }
  if (typeof value.size === 'number' && value.cells.length !== value.size * value.size) {
    issues.push(issue(`${path}.cells`, 'length must equal size squared'))
  }
  if (value.cells.some((cell) => typeof cell !== 'string' || !TERRAIN_TYPES.includes(cell as (typeof TERRAIN_TYPES)[number]))) {
    issues.push(issue(`${path}.cells`, 'must contain only known terrain types'))
  }
}

function validateWorld(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, 'must be an object'))
    return
  }
  issues.push(...validateWorldConfig(value.config, `${path}.config`))
  expectNumber(value.foodSpawnCooldown, `${path}.foodSpawnCooldown`, issues)
  expectNumber(value.forageSpawnCooldown, `${path}.forageSpawnCooldown`, issues)
  expectNumber(value.generation, `${path}.generation`, issues, 1)
  expectNumber(value.generationStartTick, `${path}.generationStartTick`, issues, 0)
  expectNumber(value.birthCount, `${path}.birthCount`, issues, 0)
  const worldSize = isRecord(value.config) && isFiniteNumber(value.config.size) ? value.config.size : undefined
  validateTerrain(value.terrain, `${path}.terrain`, issues, worldSize)
  if (expectArray(value.objects, `${path}.objects`, issues)) {
    if (value.objects.length > 400) {
      issues.push(issue(`${path}.objects`, 'contains too many objects'))
    }
    value.objects.forEach((object, index) => validateObject(object, `${path}.objects[${index}]`, issues))
  }
  if (expectArray(value.forageNodes, `${path}.forageNodes`, issues)) {
    if (value.forageNodes.length > 200) {
      issues.push(issue(`${path}.forageNodes`, 'contains too many forage nodes'))
    }
    value.forageNodes.forEach((node, index) => validateForageNode(node, `${path}.forageNodes[${index}]`, issues))
  }
  if (expectArray(value.worldTools, `${path}.worldTools`, issues)) {
    if (value.worldTools.length > 80) {
      issues.push(issue(`${path}.worldTools`, 'contains too many tools'))
    }
    value.worldTools.forEach((tool, index) => validateWorldTool(tool, `${path}.worldTools[${index}]`, issues))
  }
  if (value.interactables !== undefined) {
    if (expectArray(value.interactables, `${path}.interactables`, issues)) {
      if (value.interactables.length > 40) {
        issues.push(issue(`${path}.interactables`, 'contains too many interactables'))
      }
      value.interactables.forEach((item, index) =>
        validateInteractable(item, `${path}.interactables[${index}]`, issues),
      )
    }
  }
  if (expectArray(value.agents, `${path}.agents`, issues)) {
    if (value.agents.length > MAX_AGENT_COUNT + MAX_DEAD_AGENTS) {
      issues.push(issue(`${path}.agents`, `cannot exceed ${MAX_AGENT_COUNT + MAX_DEAD_AGENTS} agents`))
    }
    value.agents.forEach((agent, index) => validateAgent(agent, `${path}.agents[${index}]`, issues))
  }
}

function validateBrain(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, 'must be an object'))
    return
  }
  expectString(value.agentId, `${path}.agentId`, issues)
  expectNumber(value.epsilon, `${path}.epsilon`, issues, 0, 1)
  expectNumber(value.totalSteps, `${path}.totalSteps`, issues, 0)
  expectNumber(value.totalReward, `${path}.totalReward`, issues)
  const actionSchemaVersion =
    isFiniteNumber(value.actionSchemaVersion) ? value.actionSchemaVersion : ACTION_SCHEMA_VERSION
  const observationSchemaVersion =
    isFiniteNumber(value.observationSchemaVersion) ? value.observationSchemaVersion : OBSERVATION_SCHEMA_VERSION
  expectNumber(actionSchemaVersion, `${path}.actionSchemaVersion`, issues, 1, ACTION_SCHEMA_VERSION)
  expectNumber(
    observationSchemaVersion,
    `${path}.observationSchemaVersion`,
    issues,
    1,
    OBSERVATION_SCHEMA_VERSION,
  )
  if (!expectArray(value.qTable, `${path}.qTable`, issues)) return
  if (observationSchemaVersion === 1 && value.qTable.length > V1_STATE_SPACE_LIMIT) {
    issues.push(issue(`${path}.qTable`, 'has more states than observation schema v1 allows'))
  }
  if (observationSchemaVersion >= 2 && value.qTable.length > V2_VISITED_STATE_LIMIT) {
    issues.push(issue(`${path}.qTable`, `cannot exceed ${V2_VISITED_STATE_LIMIT} visited states`))
  }
  const expectedActions = actionCountForSchema(actionSchemaVersion)
  for (const [index, entry] of value.qTable.entries()) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !Array.isArray(entry[1])) {
      issues.push(issue(`${path}.qTable[${index}]`, 'must be [stateKey, qValues]'))
      continue
    }
    if (entry[1].length !== expectedActions || entry[1].some((item) => !isFiniteNumber(item))) {
      issues.push(issue(`${path}.qTable[${index}][1]`, `must be ${expectedActions} finite Q values`))
    }
  }
}

function validateStatistics(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, 'must be an object'))
    return
  }
  expectNumber(value.populationSurvival, `${path}.populationSurvival`, issues, 0, 1)
  if (value.averageReward !== null) {
    expectNumber(value.averageReward, `${path}.averageReward`, issues)
  }
  if (value.averageLifespan !== null) {
    expectNumber(value.averageLifespan, `${path}.averageLifespan`, issues, 0)
  }
  expectNumber(value.generationCount, `${path}.generationCount`, issues, 0)
  expectNumber(value.currentGeneration, `${path}.currentGeneration`, issues, 1)
  expectNumber(value.aliveCount, `${path}.aliveCount`, issues, 0)
  expectNumber(value.totalAgents, `${path}.totalAgents`, issues, 0)
  expectNumber(value.simulationTime, `${path}.simulationTime`, issues, 0)
  expectNumber(value.tick, `${path}.tick`, issues, 0)
  validateGenome(value.averageGenome, `${path}.averageGenome`, issues)
  expectNumber(value.foodEaten, `${path}.foodEaten`, issues, 0)
  expectNumber(value.resourcesGathered, `${path}.resourcesGathered`, issues, 0)
  expectNumber(value.toolUsageAttempts, `${path}.toolUsageAttempts`, issues, 0)
  expectNumber(value.toolUsageSuccesses, `${path}.toolUsageSuccesses`, issues, 0)
  if (value.toolUsageSuccessRate !== null) {
    expectNumber(value.toolUsageSuccessRate, `${path}.toolUsageSuccessRate`, issues, 0, 1)
  }
  expectNumber(value.damageDealt, `${path}.damageDealt`, issues, 0)
  expectNumber(value.damageReceived, `${path}.damageReceived`, issues, 0)
  expectNumber(value.combatDeaths, `${path}.combatDeaths`, issues, 0)
  if (value.combatSurvivalRate !== null) {
    expectNumber(value.combatSurvivalRate, `${path}.combatSurvivalRate`, issues, 0, 1)
  }
  expectNumber(value.reproductionCount, `${path}.reproductionCount`, issues, 0)
  expectNumber(value.visitedStates, `${path}.visitedStates`, issues, 0)
  expectBoolean(value.learningEnabled, `${path}.learningEnabled`, issues)
  if (
    value.policyMode !== 'learning' &&
    value.policyMode !== 'frozen-q' &&
    value.policyMode !== 'random-like'
  ) {
    issues.push(issue(`${path}.policyMode`, 'must be learning, frozen-q, or random-like'))
  }
}

export function validateExperimentRecord(value: unknown): ValidationResult<ExperimentRecord> {
  const issues: ValidationIssue[] = []
  const migrated = migrateExperimentRecord(value)
  if (!isRecord(migrated)) {
    return { ok: false, issues: [issue('', 'experiment must be an object')] }
  }
  const record = migrated

  if (record.schemaVersion !== EXPERIMENT_SCHEMA_VERSION) {
    issues.push(issue('schemaVersion', `unsupported version ${String(record.schemaVersion)}`))
  }
  expectNumber(record.actionSchemaVersion, 'actionSchemaVersion', issues, 1, ACTION_SCHEMA_VERSION)
  expectNumber(
    record.observationSchemaVersion,
    'observationSchemaVersion',
    issues,
    1,
    OBSERVATION_SCHEMA_VERSION,
  )
  expectString(record.id, 'id', issues)
  expectString(record.name, 'name', issues, 1, MAX_EXPERIMENT_NAME_LENGTH)
  if (!isIsoDate(record.createdAt)) issues.push(issue('createdAt', 'must be an ISO date'))
  if (!isIsoDate(record.updatedAt)) issues.push(issue('updatedAt', 'must be an ISO date'))
  issues.push(...validateWorldConfig(record.worldConfig))
  issues.push(...validateLearningConfig(record.learningConfig))
  issues.push(...validateRewardConfig(record.rewardConfig))
  if (!isRecord(record.evolutionConfig)) {
    issues.push(issue('evolutionConfig', 'must be an object'))
  } else {
    expectNumber(record.evolutionConfig.generationDuration, 'evolutionConfig.generationDuration', issues, 30, 300)
    expectNumber(record.evolutionConfig.mutationRate, 'evolutionConfig.mutationRate', issues, 0, 1)
    expectNumber(record.evolutionConfig.populationLimit, 'evolutionConfig.populationLimit', issues, MIN_AGENT_COUNT, MAX_AGENT_COUNT)
    expectBoolean(record.evolutionConfig.inheritQTable, 'evolutionConfig.inheritQTable', issues)
    expectBoolean(record.evolutionConfig.geneticsEnabled, 'evolutionConfig.geneticsEnabled', issues)
  }
  expectBoolean(record.learningEnabled, 'learningEnabled', issues)
  expectNumber(record.speed, 'speed', issues, MIN_SPEED, MAX_SPEED)
  if (record.status !== 'idle' && record.status !== 'running' && record.status !== 'paused' && record.status !== 'ended') {
    issues.push(issue('status', 'must be idle, running, paused, or ended'))
  }
  expectNumber(record.tick, 'tick', issues, 0)
  validateWorld(record.world, 'world', issues)
  if (expectArray(record.brains, 'brains', issues)) {
    record.brains.forEach((brain, index) => validateBrain(brain, `brains[${index}]`, issues))
  }
  if (!isRecord(record.learningHistory) || !Array.isArray(record.learningHistory.series) || !Array.isArray(record.learningHistory.earlySeries)) {
    issues.push(issue('learningHistory', 'must include series and earlySeries arrays'))
  }
  if (!expectArray(record.generationHistory, 'generationHistory', issues)) {
    // already recorded
  }
  validateStatistics(record.statistics, 'statistics', issues)
  if (
    record.qTableStatus !== 'intact' &&
    record.qTableStatus !== 'padded' &&
    record.qTableStatus !== 'reset'
  ) {
    issues.push(issue('qTableStatus', 'must be intact, padded, or reset'))
  }
  if (record.qTableResetReason !== null && typeof record.qTableResetReason !== 'string') {
    issues.push(issue('qTableResetReason', 'must be a string or null'))
  }
  if (!expectArray(record.migrationWarnings, 'migrationWarnings', issues)) {
    // already recorded
  }

  if (issues.length > 0) {
    return { ok: false, issues }
  }

  return { ok: true, value: record as unknown as ExperimentRecord, issues: [] }
}

export function parseExperimentJson(text: string): ValidationResult<ExperimentRecord> {
  if (new TextEncoder().encode(text).length > MAX_EXPERIMENT_JSON_BYTES) {
    return { ok: false, issues: [issue('', 'file is larger than 20 MB')] }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return { ok: false, issues: [issue('', 'file is not valid JSON')] }
  }

  return validateExperimentRecord(parsed)
}

export function formatValidationIssues(issues: ValidationIssue[]): string {
  return issues
    .slice(0, 8)
    .map((item) => (item.path ? `${item.path}: ${item.message}` : item.message))
    .join('\n')
}
