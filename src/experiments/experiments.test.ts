import { describe, expect, it } from 'vitest'
import { DEFAULT_EVOLUTION_CONFIG } from '../evolution/constants'
import { applyExperimentBrains, captureExperimentRecord, createExperimentIdentity } from './snapshot'
import { experimentToJson, prepareImportedExperiment } from './serialization'
import { parseExperimentJson, validateExperimentRecord, validateLearningConfig } from './validation'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import { resetBrains } from '../learning/brain'
import { DEFAULT_WORLD_CONFIG } from '../simulation/constants'
import { createLearningHistory } from '../simulation/metrics'
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
    expect(parsed.value?.schemaVersion).toBe(1)

    applyExperimentBrains(parsed.value!)
    const imported = prepareImportedExperiment(parsed.value!)
    expect(imported.id).not.toBe(record.id)
    expect(imported.name.includes('imported')).toBe(true)
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
  })
})
