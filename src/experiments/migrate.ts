import { normalizeGenome } from '../evolution/genome'
import type { GenerationRecord, Genome } from '../evolution/types'
import { ACTION_SCHEMA_VERSION, OBSERVATION_SCHEMA_VERSION } from '../learning/schema'
import { combineQTableStatus, migrateSerializedBrain } from '../learning/qCompatibility'
import type { SerializedBrain } from '../learning/brain'
import { clampRewardConfig, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import type { RewardConfig } from '../learning/types'
import {
  clampTerrainPreset,
  clampWorldConfig,
  DEFAULT_WORLD_CONFIG,
  WORLD_SEED,
} from '../simulation/constants'
import { createForageContents, sanitizeEquipment } from '../simulation/forage'
import { createEmptyOutcomeStats, sanitizeOutcomeStats } from '../simulation/outcomes'
import {
  generateTerrainGrid,
  isValidTerrainGrid,
  relocateAgentsOffWater,
  terrainMatchesGeneration,
} from '../simulation/terrain'
import type { Agent } from '../types/agent'
import type { WorldConfig, WorldState } from '../types/world'
import { EXPERIMENT_SCHEMA_VERSION } from './constants'
import type { ExperimentRecord, QTableStatus } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function withSchemaVersions<T extends Record<string, unknown>>(value: T): T {
  return {
    ...value,
    actionSchemaVersion:
      typeof value.actionSchemaVersion === 'number' && Number.isFinite(value.actionSchemaVersion)
        ? value.actionSchemaVersion
        : 1,
    observationSchemaVersion:
      typeof value.observationSchemaVersion === 'number' && Number.isFinite(value.observationSchemaVersion)
        ? value.observationSchemaVersion
        : 1,
  }
}

export function formatMigrationNotice(record: Pick<
  ExperimentRecord,
  'qTableStatus' | 'qTableResetReason' | 'migrationWarnings'
>): string | null {
  const parts = [
    record.qTableResetReason,
    ...(record.migrationWarnings ?? []),
  ].filter((part): part is string => typeof part === 'string' && part.length > 0)
  return parts.length > 0 ? parts.join(' ') : null
}

export function migrateExperimentRecord(value: unknown): unknown {
  if (!isRecord(value)) return value

  const version = value.schemaVersion
  if (version === 1 || version === undefined) {
    return withPersonalityFields(
      migrateV5ToV6(
        migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(withSchemaVersions({ ...value }))))),
      ),
    )
  }
  if (version === 2) {
    return withPersonalityFields(
      migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(withSchemaVersions({ ...value }))))),
    )
  }
  if (version === 3) {
    return withPersonalityFields(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(withSchemaVersions({ ...value })))))
  }
  if (version === 4) {
    return withPersonalityFields(migrateV5ToV6(migrateV4ToV5(withSchemaVersions({ ...value }))))
  }
  if (version === 5) {
    return withPersonalityFields(migrateV5ToV6(withSchemaVersions({ ...value })))
  }
  if (version === EXPERIMENT_SCHEMA_VERSION) {
    return withPersonalityFields(ensureCurrentFields(withSchemaVersions({ ...value })))
  }
  return value
}

function migrateV1ToV2(record: Record<string, unknown>): Record<string, unknown> {
  const worldConfig = migrateWorldConfig(record.worldConfig)
  const migratedWorld = migrateWorld(record.world, worldConfig)
  const brains = migrateBrains(record.brains, migratedWorld.world)
  const warnings = [...migratedWorld.warnings]
  if (brains.reason) warnings.push(brains.reason)

  return {
    ...record,
    schemaVersion: 2,
    actionSchemaVersion: 1,
    observationSchemaVersion: 2,
    worldConfig,
    world: migratedWorld.world,
    rewardConfig: migrateRewardConfig(record.rewardConfig),
    brains: brains.brains,
    qTableStatus: combineQTableStatus(intactOrExisting(record.qTableStatus), brains.status),
    qTableResetReason: brains.reason ?? (typeof record.qTableResetReason === 'string' ? record.qTableResetReason : null),
    migrationWarnings: uniqueStrings(warnings),
  }
}

function migrateV2ToV3(record: Record<string, unknown>): Record<string, unknown> {
  const worldConfig = migrateWorldConfig(record.worldConfig)
  const migratedWorld = migrateWorld(record.world, worldConfig)
  const brains = migrateBrains(record.brains, migratedWorld.world)
  const warnings = [...(Array.isArray(record.migrationWarnings) ? record.migrationWarnings.filter((item) => typeof item === 'string') : []), ...migratedWorld.warnings]
  if (brains.reason) warnings.push(brains.reason)

  return {
    ...record,
    schemaVersion: 3,
    actionSchemaVersion: 2,
    observationSchemaVersion: 3,
    worldConfig,
    world: migratedWorld.world,
    rewardConfig: migrateRewardConfig(record.rewardConfig),
    brains: brains.brains,
    qTableStatus: combineQTableStatus(intactOrExisting(record.qTableStatus), brains.status),
    qTableResetReason: brains.reason ?? (typeof record.qTableResetReason === 'string' ? record.qTableResetReason : null),
    migrationWarnings: uniqueStrings(warnings),
  }
}

function migrateV3ToV4(record: Record<string, unknown>): Record<string, unknown> {
  const worldConfig = migrateWorldConfig(record.worldConfig)
  const migratedWorld = migrateWorld(record.world, worldConfig)
  const brains = migrateBrains(record.brains, migratedWorld.world)
  const warnings = [
    ...(Array.isArray(record.migrationWarnings)
      ? record.migrationWarnings.filter((item) => typeof item === 'string')
      : []),
    ...migratedWorld.warnings,
  ]
  if (brains.reason) warnings.push(brains.reason)

  return {
    ...record,
    schemaVersion: 4,
    actionSchemaVersion: ACTION_SCHEMA_VERSION,
    // Historical STEP 12 observation version; later steps bump via migrateV5ToV6.
    observationSchemaVersion: 4,
    worldConfig,
    world: migratedWorld.world,
    rewardConfig: migrateRewardConfig(record.rewardConfig),
    brains: brains.brains,
    qTableStatus: combineQTableStatus(intactOrExisting(record.qTableStatus), brains.status),
    qTableResetReason: brains.reason ?? (typeof record.qTableResetReason === 'string' ? record.qTableResetReason : null),
    migrationWarnings: uniqueStrings(warnings),
  }
}

function migrateV4ToV5(record: Record<string, unknown>): Record<string, unknown> {
  const worldConfig = migrateWorldConfig(record.worldConfig)
  const migratedWorld = migrateWorld(record.world, worldConfig)
  const warnings = [
    ...(Array.isArray(record.migrationWarnings)
      ? record.migrationWarnings.filter((item) => typeof item === 'string')
      : []),
    ...migratedWorld.warnings,
  ]
  if (!isRecord(record.worldConfig) || record.worldConfig.mode === undefined) {
    warnings.push('Simulation mode was missing; defaulted to Ecology.')
  }

  return {
    ...record,
    schemaVersion: 5,
    actionSchemaVersion: ACTION_SCHEMA_VERSION,
    // Keep Observation v4 here; STEP 16 interactable cue bumps in migrateV5ToV6.
    observationSchemaVersion:
      typeof record.observationSchemaVersion === 'number' && Number.isFinite(record.observationSchemaVersion)
        ? record.observationSchemaVersion
        : 4,
    worldConfig,
    world: migratedWorld.world,
    rewardConfig: migrateRewardConfig(record.rewardConfig),
    // Mode-only step: leave brains for migrateV5ToV6 (Observation v5 reset).
    brains: record.brains,
    qTableStatus: intactOrExisting(record.qTableStatus),
    qTableResetReason: typeof record.qTableResetReason === 'string' ? record.qTableResetReason : null,
    migrationWarnings: uniqueStrings(warnings),
  }
}

function migrateV5ToV6(record: Record<string, unknown>): Record<string, unknown> {
  const worldConfig = migrateWorldConfig(record.worldConfig)
  const migratedWorld = migrateWorld(record.world, worldConfig)
  const brains = migrateBrains(record.brains, migratedWorld.world)
  const warnings = [
    ...(Array.isArray(record.migrationWarnings)
      ? record.migrationWarnings.filter((item) => typeof item === 'string')
      : []),
    ...migratedWorld.warnings,
  ]
  if (brains.reason) warnings.push(brains.reason)

  return {
    ...record,
    schemaVersion: EXPERIMENT_SCHEMA_VERSION,
    actionSchemaVersion: ACTION_SCHEMA_VERSION,
    observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
    worldConfig,
    world: migratedWorld.world,
    rewardConfig: migrateRewardConfig(record.rewardConfig),
    brains: brains.brains,
    qTableStatus: combineQTableStatus(intactOrExisting(record.qTableStatus), brains.status),
    qTableResetReason: brains.reason ?? (typeof record.qTableResetReason === 'string' ? record.qTableResetReason : null),
    migrationWarnings: uniqueStrings(warnings),
  }
}

function ensureCurrentFields(record: Record<string, unknown>): Record<string, unknown> {
  const worldConfig = migrateWorldConfig(record.worldConfig)
  const migratedWorld = migrateWorld(record.world, worldConfig)
  const brains = migrateBrains(record.brains, migratedWorld.world)

  return {
    ...record,
    schemaVersion: EXPERIMENT_SCHEMA_VERSION,
    actionSchemaVersion: ACTION_SCHEMA_VERSION,
    observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
    worldConfig,
    world: migratedWorld.world,
    rewardConfig: migrateRewardConfig(record.rewardConfig),
    brains: brains.brains,
    qTableStatus: combineQTableStatus(intactOrExisting(record.qTableStatus), brains.status),
    qTableResetReason: brains.reason ?? (typeof record.qTableResetReason === 'string' ? record.qTableResetReason : null),
    migrationWarnings: uniqueStrings([
      ...(Array.isArray(record.migrationWarnings) ? record.migrationWarnings.filter((item) => typeof item === 'string') : []),
      ...migratedWorld.warnings,
    ]),
  }
}

function migrateRewardConfig(value: unknown): RewardConfig {
  const source = isRecord(value) ? value : {}
  return clampRewardConfig({
    ...DEFAULT_REWARD_CONFIG,
    ...source,
  } as RewardConfig)
}

function migrateWorldConfig(value: unknown): WorldConfig {
  const source = isRecord(value) ? omitUndefined(value) : {}
  return clampWorldConfig({
    ...DEFAULT_WORLD_CONFIG,
    ...source,
    seed: typeof source.seed === 'number' && Number.isFinite(source.seed) ? source.seed : WORLD_SEED,
    terrainPreset: clampTerrainPreset(
      typeof source.terrainPreset === 'string' ? source.terrainPreset : DEFAULT_WORLD_CONFIG.terrainPreset,
    ),
  } as WorldConfig)
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}

function migrateWorld(
  value: unknown,
  fallbackConfig: WorldConfig,
): { world: WorldState; warnings: string[] } {
  const warnings: string[] = []
  if (!isRecord(value)) {
    const terrain = generateTerrainGrid(fallbackConfig)
    const forage = createForageContents(fallbackConfig, [], terrain)
    return {
      world: {
        config: fallbackConfig,
        objects: [],
        agents: [],
        forageNodes: forage.forageNodes,
        worldTools: forage.worldTools,
        interactables: [],
        labObjects: [],
        labEnvironment: null,
        foodSpawnCooldown: 0,
        forageSpawnCooldown: 0,
        generation: 1,
        generationStartTick: 0,
        birthCount: 0,
        terrain,
        outcomeStats: createEmptyOutcomeStats(),
      },
      warnings: ['Missing world was reconstructed from the world config.'],
    }
  }

  const config = migrateWorldConfig(value.config ?? fallbackConfig)
  const storedTerrain = isValidTerrainGrid(value.terrain, config.size) ? value.terrain : null
  const terrain = storedTerrain ?? generateTerrainGrid(config)
  if (!storedTerrain) {
    warnings.push('schemaVersion 1 had no terrain. Regenerated from seed and preset.')
  } else if (!terrainMatchesGeneration(terrain, config)) {
    warnings.push('Stored terrain does not match seed and preset. Using stored layout.')
  }

  const objects = Array.isArray(value.objects) ? (value.objects as WorldState['objects']) : []
  const agents = (Array.isArray(value.agents) ? (value.agents as Agent[]) : []).map((agent) => ({
    ...agent,
    genome: normalizeGenome(agent.genome),
    parentGenomes: migrateParentGenomes(agent.parentGenomes),
    equipment: sanitizeEquipment(agent.equipment),
    deathCause: agent.deathCause === 'combat' || agent.deathCause === 'age' || agent.deathCause === 'health'
      ? agent.deathCause
      : agent.alive
        ? null
        : (agent.deathCause ?? 'health'),
    defendTimeLeft: typeof agent.defendTimeLeft === 'number' ? agent.defendTimeLeft : 0,
    attackCooldownLeft: typeof agent.attackCooldownLeft === 'number' ? agent.attackCooldownLeft : 0,
    lastAttackerId: typeof agent.lastAttackerId === 'string' ? agent.lastAttackerId : null,
    lastCombatTick: typeof agent.lastCombatTick === 'number' ? agent.lastCombatTick : 0,
    combatCue: agent.combatCue ?? null,
    actionTarget: agent.actionTarget ?? null,
    heldLabObjectId:
      typeof agent.heldLabObjectId === 'string'
        ? agent.heldLabObjectId
        : agent.heldLabObjectId === null
          ? null
          : undefined,
  }))

  let forageNodes = Array.isArray(value.forageNodes) ? (value.forageNodes as WorldState['forageNodes']) : null
  let worldTools = Array.isArray(value.worldTools) ? (value.worldTools as WorldState['worldTools']) : null
  if (!forageNodes || !worldTools) {
    const seeded = createForageContents(config, objects, terrain)
    forageNodes = forageNodes ?? seeded.forageNodes
    worldTools = worldTools ?? seeded.worldTools
    warnings.push('Older save had no forage or tools. Seeded them from the world config.')
  }

  const interactables = Array.isArray(value.interactables)
    ? (value.interactables as WorldState['interactables'])
    : []
  if (!Array.isArray(value.interactables)) {
    warnings.push('Older save had no interactables. Defaulted to an empty list.')
  }

  const labObjects = Array.isArray(value.labObjects)
    ? (value.labObjects as WorldState['labObjects'])
    : []
  if (!Array.isArray(value.labObjects)) {
    warnings.push('Older save had no labObjects. Defaulted to an empty list.')
  }

  const labEnvironment =
    value.labEnvironment === null
      ? null
      : value.labEnvironment !== undefined
        ? (value.labEnvironment as WorldState['labEnvironment'])
        : null
  if (value.labEnvironment === undefined) {
    warnings.push('Older save had no labEnvironment. Defaulted to null (Lab sanitize will seed).')
  }

  const relocated = relocateAgentsOffWater({
    ...(value as unknown as WorldState),
    config,
    terrain,
    objects,
    agents,
    forageNodes,
    worldTools,
    interactables,
    labObjects,
    labEnvironment,
    foodSpawnCooldown: typeof value.foodSpawnCooldown === 'number' ? value.foodSpawnCooldown : 0,
    forageSpawnCooldown: typeof value.forageSpawnCooldown === 'number' ? value.forageSpawnCooldown : 0,
    outcomeStats: sanitizeOutcomeStats(value.outcomeStats),
  })
  if (relocated.relocated > 0) {
    warnings.push(`${relocated.relocated} agent(s) moved off water.`)
  }

  return {
    world: relocated.world,
    warnings,
  }
}

function migrateBrains(
  value: unknown,
  world: WorldState,
): { brains: SerializedBrain[]; status: QTableStatus; reason: string | null } {
  if (!Array.isArray(value)) {
    return { brains: [], status: 'intact', reason: null }
  }

  const agents = new Map(world.agents.map((agent) => [agent.id, agent]))
  let status: QTableStatus = 'intact'
  let reason: string | null = null
  const brains = value.map((item) => {
    const agent = isRecord(item) && typeof item.agentId === 'string' ? agents.get(item.agentId) : undefined
    const migrated = migrateSerializedBrain(item, agent?.genome.explorationRate ?? 1)
    status = combineQTableStatus(status, migrated.status)
    reason = migrated.reason ?? reason
    return migrated.brain
  })

  return { brains, status, reason }
}

function intactOrExisting(value: unknown): QTableStatus {
  if (value === 'reset' || value === 'padded' || value === 'intact') return value
  return 'intact'
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))]
}

function withPersonalityFields(record: Record<string, unknown>): Record<string, unknown> {
  return {
    ...record,
    generationHistory: migrateGenerationHistory(record.generationHistory),
    statistics: migrateStatistics(record.statistics),
    evolutionConfig: migrateEvolutionConfig(record.evolutionConfig),
  }
}

function migrateEvolutionConfig(value: unknown): unknown {
  if (!isRecord(value)) return value
  return {
    ...value,
    geneticsEnabled: typeof value.geneticsEnabled === 'boolean' ? value.geneticsEnabled : true,
  }
}

function migrateParentGenomes(value: unknown): [Genome, Genome] | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  return [normalizeGenome(value[0]), normalizeGenome(value[1])]
}

function optionalAverage(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function migrateGenerationHistory(value: unknown): GenerationRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((record) => ({
    ...(record as unknown as GenerationRecord),
    averageStrength: optionalAverage(record.averageStrength),
    averageAggression: optionalAverage(record.averageAggression),
    averageCaution: optionalAverage(record.averageCaution),
    averageToolAffinity: optionalAverage(record.averageToolAffinity),
  }))
}

function migrateStatistics(value: unknown): unknown {
  if (!isRecord(value)) return value
  return {
    ...value,
    averageGenome: normalizeGenome(value.averageGenome),
    foodEaten: optionalCount(value.foodEaten),
    resourcesGathered: optionalCount(value.resourcesGathered),
    toolUsageAttempts: optionalCount(value.toolUsageAttempts),
    toolUsageSuccesses: optionalCount(value.toolUsageSuccesses),
    toolUsageSuccessRate: optionalAverage(value.toolUsageSuccessRate),
    damageDealt: optionalCount(value.damageDealt),
    damageReceived: optionalCount(value.damageReceived),
    combatDeaths: optionalCount(value.combatDeaths),
    combatSurvivalRate: optionalAverage(value.combatSurvivalRate),
    reproductionCount: optionalCount(value.reproductionCount),
    visitedStates: optionalCount(value.visitedStates),
    learningEnabled: typeof value.learningEnabled === 'boolean' ? value.learningEnabled : true,
    policyMode:
      value.policyMode === 'frozen-q' || value.policyMode === 'random-like' || value.policyMode === 'learning'
        ? value.policyMode
        : 'learning',
  }
}

function optionalCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}
