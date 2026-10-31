import { MAX_DEAD_AGENTS } from '../evolution/constants'
import { GENOME_GENES } from '../evolution/types'
import { AGENT_ACTIONS } from '../learning/types'
import { LEARNING_CONFIG_RANGES, REWARD_CONFIG_RANGES } from '../learning/constants'
import {
  MAX_AGENT_COUNT,
  MAX_FOOD_COUNT,
  MAX_FOOD_REGEN_RATE,
  MAX_OBSTACLE_DENSITY,
  MAX_WORLD_SIZE,
  MIN_AGENT_COUNT,
  MIN_FOOD_COUNT,
  MIN_FOOD_REGEN_RATE,
  MIN_OBSTACLE_DENSITY,
  MIN_WORLD_SIZE,
  MAX_SPEED,
  MIN_SPEED,
} from '../simulation/constants'
import { RESOURCE_DISTRIBUTIONS } from '../types/world'
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
  expectNumber(value.initialFoodCount, `${path}.initialFoodCount`, issues, MIN_FOOD_COUNT, MAX_FOOD_COUNT)
  expectNumber(value.foodRegenRate, `${path}.foodRegenRate`, issues, MIN_FOOD_REGEN_RATE, MAX_FOOD_REGEN_RATE)
  expectNumber(value.obstacleDensity, `${path}.obstacleDensity`, issues, MIN_OBSTACLE_DENSITY, MAX_OBSTACLE_DENSITY)
  if (
    typeof value.resourceDistribution !== 'string' ||
    !RESOURCE_DISTRIBUTIONS.includes(value.resourceDistribution as (typeof RESOURCE_DISTRIBUTIONS)[number])
  ) {
    issues.push(issue(`${path}.resourceDistribution`, 'must be uniform, clustered, or edge'))
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

function validateWorld(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, 'must be an object'))
    return
  }
  issues.push(...validateWorldConfig(value.config, `${path}.config`))
  expectNumber(value.foodSpawnCooldown, `${path}.foodSpawnCooldown`, issues)
  expectNumber(value.generation, `${path}.generation`, issues, 1)
  expectNumber(value.generationStartTick, `${path}.generationStartTick`, issues, 0)
  expectNumber(value.birthCount, `${path}.birthCount`, issues, 0)
  if (expectArray(value.objects, `${path}.objects`, issues)) {
    if (value.objects.length > 400) {
      issues.push(issue(`${path}.objects`, 'contains too many objects'))
    }
    value.objects.forEach((object, index) => validateObject(object, `${path}.objects[${index}]`, issues))
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
  if (!expectArray(value.qTable, `${path}.qTable`, issues)) return
  if (value.qTable.length > 360) {
    issues.push(issue(`${path}.qTable`, 'has more states than the current encoding allows'))
  }
  for (const [index, entry] of value.qTable.entries()) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !Array.isArray(entry[1])) {
      issues.push(issue(`${path}.qTable[${index}]`, 'must be [stateKey, qValues]'))
      continue
    }
    if (entry[1].length !== AGENT_ACTIONS.length || entry[1].some((item) => !isFiniteNumber(item))) {
      issues.push(issue(`${path}.qTable[${index}][1]`, 'must be 5 finite Q values'))
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
}

export function validateExperimentRecord(value: unknown): ValidationResult<ExperimentRecord> {
  const issues: ValidationIssue[] = []
  if (!isRecord(value)) {
    return { ok: false, issues: [issue('', 'experiment must be an object')] }
  }

  if (value.schemaVersion !== EXPERIMENT_SCHEMA_VERSION) {
    issues.push(issue('schemaVersion', `unsupported version ${String(value.schemaVersion)}`))
  }
  expectString(value.id, 'id', issues)
  expectString(value.name, 'name', issues, 1, MAX_EXPERIMENT_NAME_LENGTH)
  if (!isIsoDate(value.createdAt)) issues.push(issue('createdAt', 'must be an ISO date'))
  if (!isIsoDate(value.updatedAt)) issues.push(issue('updatedAt', 'must be an ISO date'))
  issues.push(...validateWorldConfig(value.worldConfig))
  issues.push(...validateLearningConfig(value.learningConfig))
  issues.push(...validateRewardConfig(value.rewardConfig))
  if (!isRecord(value.evolutionConfig)) {
    issues.push(issue('evolutionConfig', 'must be an object'))
  } else {
    expectNumber(value.evolutionConfig.generationDuration, 'evolutionConfig.generationDuration', issues, 30, 300)
    expectNumber(value.evolutionConfig.mutationRate, 'evolutionConfig.mutationRate', issues, 0, 1)
    expectNumber(value.evolutionConfig.populationLimit, 'evolutionConfig.populationLimit', issues, MIN_AGENT_COUNT, MAX_AGENT_COUNT)
    expectBoolean(value.evolutionConfig.inheritQTable, 'evolutionConfig.inheritQTable', issues)
  }
  expectBoolean(value.learningEnabled, 'learningEnabled', issues)
  expectNumber(value.speed, 'speed', issues, MIN_SPEED, MAX_SPEED)
  if (value.status !== 'idle' && value.status !== 'running' && value.status !== 'paused' && value.status !== 'ended') {
    issues.push(issue('status', 'must be idle, running, paused, or ended'))
  }
  expectNumber(value.tick, 'tick', issues, 0)
  validateWorld(value.world, 'world', issues)
  if (expectArray(value.brains, 'brains', issues)) {
    value.brains.forEach((brain, index) => validateBrain(brain, `brains[${index}]`, issues))
  }
  if (!isRecord(value.learningHistory) || !Array.isArray(value.learningHistory.series) || !Array.isArray(value.learningHistory.earlySeries)) {
    issues.push(issue('learningHistory', 'must include series and earlySeries arrays'))
  }
  if (!expectArray(value.generationHistory, 'generationHistory', issues)) {
    // already recorded
  }
  validateStatistics(value.statistics, 'statistics', issues)

  if (issues.length > 0) {
    return { ok: false, issues }
  }

  return { ok: true, value: value as unknown as ExperimentRecord, issues: [] }
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
