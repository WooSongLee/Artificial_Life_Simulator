import { describe, expect, it } from 'vitest'
import { DEFAULT_EVOLUTION_CONFIG } from '../evolution/constants'
import { applyExperimentBrains, captureExperimentRecord, createExperimentIdentity } from './snapshot'
import { experimentToJson, prepareImportedExperiment } from './serialization'
import {
  classifyConditionMatch,
  conditionFromRecord,
  meanAndDeviation,
  sameEnvironmentExceptSeed,
} from './conditions'
import { migrateExperimentRecord } from './migrate'
import { parseExperimentJson, validateExperimentRecord, validateLearningConfig } from './validation'
import { ACTION_SCHEMA_VERSION, OBSERVATION_SCHEMA_VERSION } from '../learning/schema'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import { resetBrains } from '../learning/brain'
import { DEFAULT_WORLD_CONFIG } from '../simulation/constants'
import { createLearningHistory } from '../simulation/metrics'
import { terrainMatchesGeneration } from '../simulation/terrain'
import { createInitialWorld } from '../simulation/worldFactory'
import { useSimulationStore } from '../store/useSimulationStore'

function snapshotWorld(agentCount = 3) {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount,
    initialFoodCount: 8,
  })
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)
  return captureExperimentRecord({
    identity: createExperimentIdentity('Roundtrip Check'),
    simulation: {
      status: 'paused',
      tick: 12,
      speed: 2,
      world,
      learningHistory: createLearningHistory(12, world.agents, true),
      generationHistory: [],
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      evolutionConfig: DEFAULT_EVOLUTION_CONFIG,
      pendingWorldConfig: null,
    },
  })
}

describe('experiment save/load', () => {
  it('round-trips a valid snapshot through JSON', () => {
    const record = snapshotWorld()
    const parsed = parseExperimentJson(experimentToJson(record))
    expect(parsed.ok).toBe(true)
    expect(parsed.value?.world.agents).toHaveLength(3)
    expect(parsed.value?.brains).toHaveLength(3)
    expect(parsed.value?.schemaVersion).toBe(6)
    expect(parsed.value?.worldConfig.mode).toBe('ecology')
    expect(parsed.value?.world.config.mode).toBe('ecology')
    expect(parsed.value?.world.forageNodes.length).toBeGreaterThan(0)
    expect(parsed.value?.world.worldTools.length).toBeGreaterThan(0)
    expect(parsed.value?.world.agents.every((agent) => agent.equipment === null || agent.equipment.durability > 0)).toBe(true)
    expect(parsed.value?.world.terrain.cells.length).toBeGreaterThan(0)
    expect(parsed.value?.worldConfig.seed).toBeDefined()
    expect(parsed.value?.qTableStatus).toBe('intact')

    applyExperimentBrains(parsed.value!)
    const imported = prepareImportedExperiment(parsed.value!)
    expect(imported.id).not.toBe(record.id)
    expect(imported.name.includes('imported')).toBe(true)
  })

  it('migrates schemaVersion 1 records, keeps the world, and resets incompatible Q-tables', () => {
    const record = snapshotWorld()
    const firstAgent = record.world.agents[0]
    if (!firstAgent) throw new Error('expected an agent')
    const legacyBrains = record.brains.map((brain, index) => {
      const { actionSchemaVersion: _action, observationSchemaVersion: _observation, ...rest } = brain
      return index === 0
        ? { ...rest, qTable: [['low|mid|forward|close|no', [1, 0, 0, 0, 0]]] }
        : rest
    })
    const {
      actionSchemaVersion: _action,
      observationSchemaVersion: _observation,
      qTableStatus: _status,
      qTableResetReason: _reason,
      migrationWarnings: _warnings,
      ...legacyRecord
    } = record
    const { terrain: _terrain, ...legacyWorld } = record.world
    const { seed: _seed, terrainPreset: _preset, ...legacyWorldConfig } = record.worldConfig

    const legacy = {
      ...legacyRecord,
      schemaVersion: 1,
      worldConfig: legacyWorldConfig,
      world: {
        ...legacyWorld,
        config: legacyWorldConfig,
      },
      brains: legacyBrains,
    }

    const migrated = migrateExperimentRecord(legacy) as typeof record
    expect(migrated.schemaVersion).toBe(6)
    expect(migrated.worldConfig.mode).toBe('ecology')
    expect(migrated.observationSchemaVersion).toBe(OBSERVATION_SCHEMA_VERSION)
    expect(migrated.actionSchemaVersion).toBe(ACTION_SCHEMA_VERSION)
    expect(migrated.world.terrain.cells.length).toBeGreaterThan(0)
    expect(migrated.world.forageNodes.length).toBeGreaterThan(0)
    expect(migrated.world.worldTools.length).toBeGreaterThan(0)
    expect(migrated.world.agents[0]?.id).toBe(firstAgent.id)
    expect(migrated.world.agents[0]?.genome).toEqual(firstAgent.genome)
    expect(migrated.world.agents[0]?.equipment).toBeNull()
    expect(migrated.brains[0]?.qTable).toEqual([])
    expect(migrated.qTableStatus).toBe('reset')
    expect(migrated.qTableResetReason).toContain('Observation schema')

    const validated = validateExperimentRecord(legacy)
    expect(validated.ok).toBe(true)
    expect(validated.value?.world.agents[0]?.genome).toEqual(firstAgent.genome)
    expect(validated.value?.brains[0]?.qTable).toEqual([])
    expect(validated.value?.schemaVersion).toBe(6)
  })

  it('migrates schemaVersion 2 records by seeding forage/tools and resetting Q-tables', () => {
    const record = snapshotWorld()
    const v2 = {
      ...record,
      schemaVersion: 2,
      actionSchemaVersion: 1,
      observationSchemaVersion: 2,
      world: {
        ...record.world,
        forageNodes: undefined,
        worldTools: undefined,
        forageSpawnCooldown: undefined,
      },
      worldConfig: {
        ...record.worldConfig,
        initialBerryCount: undefined,
        initialRootCount: undefined,
        forageRegenRate: undefined,
        initialBasketCount: undefined,
        initialStickCount: undefined,
      },
      brains: record.brains.map((brain) => ({
        ...brain,
        qTable: [['low|mid|forward|close|no|grassland|grassland', [1, 0, 0, 0, 0]]],
      })),
    }

    const migrated = migrateExperimentRecord(v2) as typeof record
    expect(migrated.schemaVersion).toBe(6)
    expect(migrated.worldConfig.mode).toBe('ecology')
    expect(migrated.world.forageNodes.length).toBeGreaterThan(0)
    expect(migrated.world.worldTools.length).toBeGreaterThan(0)
    expect(migrated.brains[0]?.qTable).toEqual([])
    expect(migrated.qTableStatus).toBe('reset')
    expect(migrated.rewardConfig.gatherUnit).toBeDefined()
    expect(validateExperimentRecord(v2).ok).toBe(true)
  })

  it('migrates schemaVersion 3 records by resetting Q-tables for observation bump', () => {
    const record = snapshotWorld()
    const v3 = {
      ...record,
      schemaVersion: 3,
      actionSchemaVersion: 2,
      observationSchemaVersion: 3,
      brains: record.brains.map((brain) => ({
        ...brain,
        actionSchemaVersion: 2,
        observationSchemaVersion: 3,
        qTable: [['low|mid|forward|close|no|grassland|grassland|none|none|none', [1, 0, 0, 0, 0, 0, 0]]],
      })),
    }

    const migrated = migrateExperimentRecord(v3) as typeof record
    expect(migrated.schemaVersion).toBe(6)
    expect(migrated.worldConfig.mode).toBe('ecology')
    expect(migrated.observationSchemaVersion).toBe(OBSERVATION_SCHEMA_VERSION)
    expect(migrated.actionSchemaVersion).toBe(ACTION_SCHEMA_VERSION)
    expect(migrated.brains[0]?.qTable).toEqual([])
    expect(migrated.qTableStatus).toBe('reset')
    expect(migrated.qTableResetReason).toContain('Observation schema')
    expect(validateExperimentRecord(v3).ok).toBe(true)
  })

  it('fills missing personality genes and leaves old generation averages unrecorded', () => {
    const record = snapshotWorld()
    const first = record.world.agents[0]
    if (!first) throw new Error('expected an agent')
    const {
      strength: _strength,
      aggression: _aggression,
      caution: _caution,
      toolAffinity: _toolAffinity,
      ...legacyGenome
    } = first.genome
    const legacy = {
      ...record,
      world: {
        ...record.world,
        agents: record.world.agents.map((agent) => ({
          ...agent,
          genome: legacyGenome,
          parentGenomes: undefined,
        })),
      },
      statistics: {
        ...record.statistics,
        averageGenome: legacyGenome,
      },
      generationHistory: [
        {
          generation: 1,
          populationSize: 3,
          aliveCount: 3,
          survivalRate: 1,
          averageLifespan: 12,
          averageReward: 0.2,
          averageSpeed: 2,
          averageVision: 8,
          averageEnergyEfficiency: 1,
          averageLearningRate: 0.1,
          averageExplorationRate: 0.8,
          hasLearningSamples: true,
          mutation: { mutatedAgentCount: 0, mutatedGeneCount: 0, mutationRate: 0.15 },
          endedAtTick: 10,
          endedAtTime: 0.5,
          duration: 0.5,
          endReason: 'birth',
        },
      ],
    }

    const migrated = migrateExperimentRecord(legacy) as typeof record
    expect(migrated.world.agents[0]?.genome.strength).toBe(1)
    expect(migrated.world.agents[0]?.genome.aggression).toBe(1)
    expect(migrated.world.agents[0]?.genome.caution).toBe(1)
    expect(migrated.world.agents[0]?.genome.toolAffinity).toBe(1)
    expect(migrated.world.agents[0]?.genome.speed).toBe(first.genome.speed)
    expect(migrated.statistics.averageGenome.strength).toBe(1)
    expect(migrated.generationHistory[0]?.averageStrength).toBeNull()
    expect(migrated.generationHistory[0]?.averageAggression).toBeNull()
    expect(migrated.generationHistory[0]?.averageCaution).toBeNull()
    expect(migrated.generationHistory[0]?.averageToolAffinity).toBeNull()
    expect(validateExperimentRecord(legacy).ok).toBe(true)
  })

  it('preserves personality genes through JSON export and import', () => {
    const record = snapshotWorld()
    const first = record.world.agents[0]
    if (!first) throw new Error('expected an agent')
    first.genome.strength = 1.25
    first.genome.aggression = 1.4
    first.genome.caution = 0.55
    first.genome.toolAffinity = 1.1
    const parsed = parseExperimentJson(experimentToJson(record))
    expect(parsed.ok).toBe(true)
    expect(parsed.value?.world.agents[0]?.genome.strength).toBeCloseTo(1.25)
    expect(parsed.value?.world.agents[0]?.genome.aggression).toBeCloseTo(1.4)
    expect(parsed.value?.world.agents[0]?.genome.caution).toBeCloseTo(0.55)
    expect(parsed.value?.world.agents[0]?.genome.toolAffinity).toBeCloseTo(1.1)
  })

  it('pads Q-tables when only newer actions were appended', () => {
    const record = snapshotWorld()
    const currentKey =
      'mid|high|forward|close|no|grassland|grassland|none|none|none|none|out|high|none|na|na|na|na'
    const compatible = {
      ...record,
      actionSchemaVersion: 2,
      observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
      brains: record.brains.map((brain) => ({
        ...brain,
        actionSchemaVersion: 2,
        observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
        qTable: [[currentKey, [1, 0, 0, 0, 0, 2, 0]]],
      })),
    }

    const migrated = migrateExperimentRecord(compatible) as typeof record
    expect(migrated.qTableStatus).toBe('padded')
    expect(migrated.brains[0]?.qTable[0]?.[1]).toEqual([1, 0, 0, 0, 0, 2, 0, 0, 0, 0])
    expect(migrated.qTableResetReason).toContain('padded')
    expect(validateExperimentRecord(compatible).ok).toBe(true)
  })

  it('does not treat different seeds as equivalent experiments', () => {
    const first = snapshotWorld()
    const second = {
      ...first,
      id: 'other',
      name: 'Other',
      worldConfig: { ...first.worldConfig, seed: first.worldConfig.seed + 1 },
      learningEnabled: false,
    }
    expect(classifyConditionMatch([conditionFromRecord(first), conditionFromRecord(second)])).toBe('different')

    const sameWorld = {
      ...first,
      id: 'policy',
      name: 'Policy',
      learningEnabled: false,
    }
    expect(classifyConditionMatch([conditionFromRecord(first), conditionFromRecord(sameWorld)])).toBe(
      'same-environment-different-policy',
    )
    expect(sameEnvironmentExceptSeed([conditionFromRecord(first), conditionFromRecord(sameWorld)])).toBe(false)
    expect(sameEnvironmentExceptSeed([conditionFromRecord(first), conditionFromRecord(second)])).toBe(false)

    const sameSettingsDifferentSeed = {
      ...first,
      id: 'repeat',
      name: 'Repeat',
      worldConfig: { ...first.worldConfig, seed: first.worldConfig.seed + 2 },
    }
    expect(sameEnvironmentExceptSeed([conditionFromRecord(first), conditionFromRecord(sameSettingsDifferentSeed)])).toBe(
      true,
    )
    expect(meanAndDeviation([1, 3, 5])?.mean).toBe(3)
  })

  it('fills missing geneticsEnabled as true so old experiments keep genetics', () => {
    const record = snapshotWorld()
    const { geneticsEnabled: _ignored, ...legacyEvolution } = record.evolutionConfig
    const migrated = migrateExperimentRecord({
      ...record,
      evolutionConfig: legacyEvolution,
    }) as typeof record
    expect(migrated.evolutionConfig.geneticsEnabled).toBe(true)
  })

  it('migrates schemaVersion 4 records to v6 with Ecology mode and resets Q for Observation v5', () => {
    const record = snapshotWorld()
    const { mode: _mode, ...legacyWorldConfig } = record.worldConfig
    const { mode: _worldMode, ...legacyWorldInnerConfig } = record.world.config
    const v4Key = 'mid|high|forward|close|no|grassland|grassland|none|none|none|none|out|high'
    const legacy = {
      ...record,
      schemaVersion: 4,
      observationSchemaVersion: 4,
      worldConfig: legacyWorldConfig,
      world: {
        ...record.world,
        config: legacyWorldInnerConfig,
      },
      brains: record.brains.map((brain) => ({
        ...brain,
        observationSchemaVersion: 4,
        qTable: [[v4Key, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]]],
      })),
      qTableStatus: 'intact' as const,
      qTableResetReason: null,
      migrationWarnings: [],
    }
    const migrated = migrateExperimentRecord(legacy) as typeof record
    expect(migrated.schemaVersion).toBe(6)
    expect(migrated.worldConfig.mode).toBe('ecology')
    expect(migrated.world.config.mode).toBe('ecology')
    expect(migrated.observationSchemaVersion).toBe(OBSERVATION_SCHEMA_VERSION)
    expect(migrated.qTableStatus).toBe('reset')
    expect(migrated.brains[0]?.qTable).toEqual([])
    expect(migrated.qTableResetReason).toMatch(/v4 → v\d+/)
    expect(migrated.migrationWarnings.some((warning) => warning.includes('Simulation mode'))).toBe(true)
  })

  it('migrates schemaVersion 5 records to v6 and resets Q-tables for interactable Observation cue', () => {
    const record = snapshotWorld()
    const v4Key = 'mid|high|forward|close|no|grassland|grassland|none|none|none|none|out|high'
    const legacy = {
      ...record,
      schemaVersion: 5,
      observationSchemaVersion: 4,
      brains: record.brains.map((brain) => ({
        ...brain,
        observationSchemaVersion: 4,
        qTable: [[v4Key, [0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0]]],
      })),
      qTableStatus: 'intact' as const,
      qTableResetReason: null,
    }
    const migrated = migrateExperimentRecord(legacy) as typeof record
    expect(migrated.schemaVersion).toBe(6)
    expect(migrated.observationSchemaVersion).toBe(OBSERVATION_SCHEMA_VERSION)
    expect(migrated.qTableStatus).toBe('reset')
    expect(migrated.brains[0]?.qTable).toEqual([])
    expect(migrated.qTableResetReason).toMatch(/v4 → v\d+/)
  })

  it('preserves Lab mode through JSON save and schema v5→v6 migrate', () => {
    const labWorld = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      agentCount: 1,
      initialFoodCount: 4,
    })
    resetBrains(labWorld.agents, DEFAULT_LEARNING_CONFIG)
    const record = captureExperimentRecord({
      identity: createExperimentIdentity('Lab Mode Roundtrip'),
      simulation: {
        status: 'paused',
        tick: 3,
        speed: 1,
        world: labWorld,
        learningHistory: createLearningHistory(3, labWorld.agents, true),
        generationHistory: [],
        learningEnabled: true,
        learningConfig: DEFAULT_LEARNING_CONFIG,
        rewardConfig: DEFAULT_REWARD_CONFIG,
        evolutionConfig: DEFAULT_EVOLUTION_CONFIG,
        pendingWorldConfig: null,
      },
    })

    const parsed = parseExperimentJson(experimentToJson(record))
    expect(parsed.ok).toBe(true)
    expect(parsed.value?.schemaVersion).toBe(6)
    expect(parsed.value?.worldConfig.mode).toBe('human_behavior_lab')
    expect(parsed.value?.world.config.mode).toBe('human_behavior_lab')
    expect(parsed.value?.worldConfig.agentCount).toBe(1)
    expect(parsed.value?.world.agents).toHaveLength(1)

    const legacy = {
      ...record,
      schemaVersion: 5,
      observationSchemaVersion: 4,
      brains: record.brains.map((brain) => ({
        ...brain,
        observationSchemaVersion: 4,
        qTable: [],
      })),
    }
    const migrated = migrateExperimentRecord(legacy) as typeof record
    expect(migrated.schemaVersion).toBe(6)
    expect(migrated.worldConfig.mode).toBe('human_behavior_lab')
    expect(migrated.world.config.mode).toBe('human_behavior_lab')
    expect(migrated.worldConfig.agentCount).toBe(1)
    expect(migrated.observationSchemaVersion).toBe(OBSERVATION_SCHEMA_VERSION)
    expect(validateExperimentRecord(migrated).ok).toBe(true)
  })

  it('rejects invalid learning rates, schema versions, and incomplete records', () => {
    expect(validateLearningConfig({ ...DEFAULT_LEARNING_CONFIG, learningRate: 4 }).length).toBeGreaterThan(0)
    expect(parseExperimentJson('{"schemaVersion":999}').ok).toBe(false)
    expect(
      validateExperimentRecord({
        schemaVersion: 1,
        id: 'x',
        name: 'Broken',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).ok,
    ).toBe(false)
  })

  it('resets tick, status, selection, and histories back to a clean world', () => {
    const store = useSimulationStore.getState()
    store.play()
    store.step()
    store.selectObject(store.world.agents[0]?.id ?? null)
    expect(useSimulationStore.getState().tick).toBeGreaterThan(0)

    useSimulationStore.getState().reset()
    const next = useSimulationStore.getState()
    expect(next.status).toBe('idle')
    expect(next.tick).toBe(0)
    expect(next.selectedObjectId).toBeNull()
    expect(next.generationHistory).toEqual([])
    expect(next.world.generation).toBe(1)
    expect(next.world.agents.every((agent) => agent.alive)).toBe(true)
    expect(next.world.agents.every((agent) => Number.isFinite(agent.energy))).toBe(true)
    expect(terrainMatchesGeneration(next.world.terrain, next.world.config)).toBe(true)
  })
})
