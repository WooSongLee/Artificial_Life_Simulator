import { create } from 'zustand'
import { formatMigrationNotice } from '../experiments/migrate'
import { applyExperimentBrains, createExperimentIdentity } from '../experiments/snapshot'
import type { ExperimentRecord } from '../experiments/types'
import { DEFAULT_EVOLUTION_CONFIG } from '../evolution/constants'
import {
  appendGenerationRecord,
  collectGenerationRecord,
  hasGenerationRecord,
} from '../evolution/generations'
import { assignChildBrains } from '../evolution/inheritance'
import {
  clampLearningConfig,
  clampRewardConfig,
  DEFAULT_LEARNING_CONFIG,
  DEFAULT_REWARD_CONFIG,
} from '../learning/constants'
import {
  removeActionEvents,
  resetActionEvents,
  setActionEventRecordStride,
} from '../learning/actionEvents'
import { ensureBrain, removeBrains, resetBrains, setBrain } from '../learning/brain'
import type { LearningConfig } from '../learning/types'
import {
  clampAgentCount,
  clampSpeed,
  clampWorldConfig,
  DEFAULT_VIEWER_SETTINGS,
  MAX_AGENT_COUNT,
  MIN_AGENT_COUNT,
  SIMULATION_STEP_DT,
} from '../simulation/constants'
import { stepSimulation } from '../simulation/engine'
import { clampSimulationMode, isHumanBehaviorLab } from '../simulation/labMode'
import { sanitizeWorld } from '../simulation/sanitize'
import { createLearningHistory, recordLearningHistory } from '../simulation/metrics'
import { adjustWorldPopulation, createInitialWorld, createWorldObject } from '../simulation/worldFactory'
import type { SimulationActions, SimulationState, ViewerSettings } from '../types/simulation'
import type { WorldConfig, WorldObjectType, WorldState } from '../types/world'
import { clamp } from '../utils/math'
import { createAgentTrails, recordAgentTrails } from '../utils/agentTrail'
import { isPopulationExtinct } from '../utils/agentStats'
import { MAX_EXPERIMENT_NAME_LENGTH } from '../experiments/constants'
import type { GenerationRecord } from '../evolution/types'

const initialWorld = createInitialWorld(undefined, {
  learningDefaults: learningDefaultsFrom(DEFAULT_LEARNING_CONFIG),
  geneticsEnabled: DEFAULT_EVOLUTION_CONFIG.geneticsEnabled,
})
resetBrains(initialWorld.agents, DEFAULT_LEARNING_CONFIG)

/** Last Ecology agentCount before entering Lab, restored on Ecology↔Lab UI round-trip. */
let ecologyAgentCountResume = initialWorld.config.agentCount

function learningDefaultsFrom(config: LearningConfig) {
  return {
    learningRate: config.learningRate,
    explorationRate: config.initialEpsilon,
  }
}

function rememberEcologyAgentCount(config: WorldConfig, agentCount: number): void {
  if (!isHumanBehaviorLab(config.mode)) {
    ecologyAgentCountResume = agentCount
  }
}

function withModeRoundTripAgentCount(
  current: WorldConfig,
  partial: Partial<WorldConfig>,
): Partial<WorldConfig> {
  const nextMode = clampSimulationMode(partial.mode ?? current.mode)

  if (partial.mode !== undefined) {
    const enteringLab = isHumanBehaviorLab(partial.mode) && !isHumanBehaviorLab(current.mode)
    if (enteringLab) {
      ecologyAgentCountResume = current.agentCount
      return partial
    }

    const leavingLab = !isHumanBehaviorLab(partial.mode) && isHumanBehaviorLab(current.mode)
    if (leavingLab && partial.agentCount === undefined) {
      return { ...partial, agentCount: ecologyAgentCountResume }
    }
  }

  if (partial.agentCount !== undefined && !isHumanBehaviorLab(nextMode)) {
    rememberEcologyAgentCount({ ...current, mode: nextMode }, clampAgentCount(partial.agentCount))
  }

  return partial
}

function isSelectionPresent(id: string | null, world: WorldState): boolean {
  if (!id) return false
  return (
    world.objects.some((object) => object.id === id) ||
    world.agents.some((agent) => agent.id === id) ||
    world.forageNodes.some((node) => node.id === id) ||
    world.worldTools.some((tool) => tool.id === id) ||
    (world.interactables ?? []).some((item) => item.id === id)
  )
}

function clampPopulationLimit(limit: number): number {
  return Math.round(clamp(limit, MIN_AGENT_COUNT, MAX_AGENT_COUNT))
}

function markDirty(state: SimulationState): SimulationState['experiment'] {
  if (state.experiment.dirty) return state.experiment
  return {
    ...state.experiment,
    dirty: true,
  }
}

function recordFinishedGeneration(
  history: GenerationRecord[],
  world: SimulationState['world'],
  tick: number,
  generation: number,
  reason: GenerationRecord['endReason'],
  mutationRate: number,
  generationStartTick = world.generationStartTick,
): GenerationRecord[] {
  if (hasGenerationRecord(history, generation)) return history
  return appendGenerationRecord(
    history,
    collectGenerationRecord(
      { ...world, generationStartTick },
      tick,
      reason,
      mutationRate,
      generation,
    ),
  )
}

function applySimulationSteps(
  state: SimulationState,
  steps: number,
  dt: number,
  budgetMs?: number,
): Partial<SimulationState> {
  if (steps <= 0 || state.status === 'ended') return state

  let tick = state.tick
  let world = state.world
  let status: SimulationState['status'] = state.status
  let generationHistory = state.generationHistory
  let learningHistory = state.learningHistory
  const started = budgetMs === undefined ? 0 : performance.now()
  setActionEventRecordStride(Math.max(1, Math.ceil(steps / 8)))

  try {
    for (let step = 0; step < steps; step += 1) {
    const next = stepSimulation(
      { tick, world },
      dt,
      {
        learningEnabled: state.learningEnabled,
        learningConfig: state.learningConfig,
        rewardConfig: state.rewardConfig,
        evolutionConfig: state.evolutionConfig,
        rng: Math.random,
      },
    )

    tick = next.tick
    world = next.world

    if (next.born.length > 0) {
      assignChildBrains(
        next.born,
        state.evolutionConfig.inheritQTable,
        state.learningConfig,
        setBrain,
      )
    }
    if (next.removedAgentIds.length > 0) {
      removeBrains(next.removedAgentIds)
      removeActionEvents(next.removedAgentIds)
    }
    if (next.recordedGeneration !== null) {
      generationHistory = recordFinishedGeneration(
        generationHistory,
        world,
        tick,
        next.recordedGeneration,
        'birth',
        state.evolutionConfig.mutationRate,
        next.recordedGenerationStartTick ?? world.generationStartTick,
      )
    }

    if (isPopulationExtinct(world.agents)) {
      generationHistory = recordFinishedGeneration(
        generationHistory,
        world,
        tick,
        world.generation,
        'extinction',
        state.evolutionConfig.mutationRate,
      )
      status = 'ended'
      learningHistory = recordLearningHistory(learningHistory, tick, world.agents, state.learningEnabled)
      break
    }

    learningHistory = recordLearningHistory(learningHistory, tick, world.agents, state.learningEnabled)

    if (budgetMs !== undefined && performance.now() - started >= budgetMs) {
      break
    }
  }
  } finally {
    setActionEventRecordStride(1)
  }

  return {
    tick,
    world,
    status,
    selectedObjectId: isSelectionPresent(state.selectedObjectId, world)
      ? state.selectedObjectId
      : null,
    agentTrails: recordAgentTrails(state.agentTrails, world.agents),
    learningHistory,
    generationHistory,
    experiment: markDirty(state),
  }
}

function rebuildWorld(
  config: WorldConfig,
  learningConfig: LearningConfig,
  learningEnabled: boolean,
  geneticsEnabled = DEFAULT_EVOLUTION_CONFIG.geneticsEnabled,
) {
  const world = createInitialWorld(config, {
    learningDefaults: learningDefaultsFrom(learningConfig),
    geneticsEnabled,
  })
  resetBrains(world.agents, learningConfig)
  resetActionEvents()
  return {
    world,
    selectedObjectId: null,
    agentTrails: createAgentTrails(world.agents),
    learningHistory: createLearningHistory(0, world.agents, learningEnabled),
    generationHistory: [] as SimulationState['generationHistory'],
    pendingWorldConfig: null,
  }
}

function canRebuildWorld(state: SimulationState): boolean {
  return state.status === 'idle' && state.tick === 0
}

function activeWorldConfig(state: Pick<SimulationState, 'pendingWorldConfig' | 'world'>): WorldConfig {
  return state.pendingWorldConfig ?? state.world.config
}

export const useSimulationStore = create<SimulationState & SimulationActions>((set) => ({
  status: 'idle',
  tick: 0,
  speed: 1,
  world: initialWorld,
  selectedObjectId: null,
  agentTrails: createAgentTrails(initialWorld.agents),
  learningHistory: createLearningHistory(0, initialWorld.agents, true),
  generationHistory: [],
  settings: DEFAULT_VIEWER_SETTINGS,
  cameraResetToken: 0,
  learningEnabled: true,
  learningConfig: DEFAULT_LEARNING_CONFIG,
  rewardConfig: DEFAULT_REWARD_CONFIG,
  evolutionConfig: DEFAULT_EVOLUTION_CONFIG,
  pendingWorldConfig: null,
  experiment: createExperimentIdentity(),
  hydrated: false,
  migrationNotice: null,

  play: () =>
    set((state) => (state.status === 'ended' ? state : { status: 'running' as const })),
  pause: () =>
    set((state) => (state.status === 'ended' ? state : { status: 'paused' as const })),
  reset: () =>
    set((state) => {
      const rebuilt = rebuildWorld(
        activeWorldConfig(state),
        state.learningConfig,
        state.learningEnabled,
        state.evolutionConfig.geneticsEnabled,
      )
      return {
        status: 'idle' as const,
        tick: 0,
        ...rebuilt,
        experiment: markDirty(state),
      }
    }),
  step: (dt = SIMULATION_STEP_DT) =>
    set((state) => applySimulationSteps(state, 1, dt)),
  advance: (steps, budgetMs) =>
    set((state) =>
      applySimulationSteps(state, Math.max(0, Math.floor(steps)), SIMULATION_STEP_DT, budgetMs),
    ),
  setSpeed: (speed) => set((state) => ({ speed: clampSpeed(speed), experiment: markDirty(state) })),
  selectObject: (id) => set({ selectedObjectId: id }),
  setSetting: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        [key]: value,
      } satisfies ViewerSettings,
    })),
  setLearningEnabled: (enabled) =>
    set((state) => ({ learningEnabled: enabled, experiment: markDirty(state) })),
  setGeneticsEnabled: (enabled) =>
    set((state) => {
      const evolutionConfig = {
        ...state.evolutionConfig,
        geneticsEnabled: enabled,
      }
      if (canRebuildWorld(state)) {
        return {
          evolutionConfig,
          ...rebuildWorld(
            activeWorldConfig(state),
            state.learningConfig,
            state.learningEnabled,
            enabled,
          ),
          experiment: markDirty(state),
        }
      }
      return {
        evolutionConfig,
        experiment: markDirty(state),
      }
    }),
  setInheritQTable: (enabled) =>
    set((state) => ({
      evolutionConfig: {
        ...state.evolutionConfig,
        inheritQTable: enabled,
      },
      experiment: markDirty(state),
    })),
  setPopulationLimit: (limit) =>
    set((state) => ({
      evolutionConfig: {
        ...state.evolutionConfig,
        populationLimit: clampPopulationLimit(limit),
      },
      experiment: markDirty(state),
    })),
  setAgentCount: (count) =>
    set((state) => {
      const agentCount = clampAgentCount(count)
      const currentConfig = activeWorldConfig(state)
      rememberEcologyAgentCount(currentConfig, agentCount)
      if (agentCount === currentConfig.agentCount && state.world.agents.length === agentCount) {
        return state
      }

      const nextConfig = clampWorldConfig({
        ...currentConfig,
        agentCount,
      })

      if (canRebuildWorld(state)) {
        return {
          ...rebuildWorld(
            nextConfig,
            state.learningConfig,
            state.learningEnabled,
            state.evolutionConfig.geneticsEnabled,
          ),
          experiment: markDirty(state),
        }
      }

      const { world, removedAgentIds } = adjustWorldPopulation(
        {
          ...state.world,
          config: {
            ...state.world.config,
            agentCount,
          },
        },
        agentCount,
        Math.random,
        learningDefaultsFrom(state.learningConfig),
        state.evolutionConfig.geneticsEnabled,
      )
      removeBrains(removedAgentIds)
      removeActionEvents(removedAgentIds)
      for (const agent of world.agents) {
        ensureBrain(agent.id, state.learningConfig, agent.genome.explorationRate)
      }

      return {
        world,
        pendingWorldConfig: state.pendingWorldConfig
          ? { ...state.pendingWorldConfig, agentCount }
          : null,
        selectedObjectId: isSelectionPresent(state.selectedObjectId, world)
          ? state.selectedObjectId
          : null,
        agentTrails: recordAgentTrails(state.agentTrails, world.agents),
        experiment: markDirty(state),
      }
    }),
  setWorldConfig: (partial) =>
    set((state) => {
      const current = activeWorldConfig(state)
      const patched = withModeRoundTripAgentCount(current, partial)
      const next = clampWorldConfig({
        ...current,
        ...patched,
      })
      const liveChanged =
        next.size !== state.world.config.size ||
        next.mode !== state.world.config.mode ||
        next.initialFoodCount !== state.world.config.initialFoodCount ||
        next.initialBerryCount !== state.world.config.initialBerryCount ||
        next.initialRootCount !== state.world.config.initialRootCount ||
        next.initialBasketCount !== state.world.config.initialBasketCount ||
        next.initialStickCount !== state.world.config.initialStickCount ||
        next.initialSpearCount !== state.world.config.initialSpearCount ||
        next.initialShieldCount !== state.world.config.initialShieldCount ||
        next.obstacleDensity !== state.world.config.obstacleDensity ||
        next.resourceDistribution !== state.world.config.resourceDistribution ||
        next.agentCount !== state.world.config.agentCount ||
        next.seed !== state.world.config.seed ||
        next.terrainPreset !== state.world.config.terrainPreset

      if (canRebuildWorld(state) && liveChanged) {
        return {
          ...rebuildWorld(
            next,
            state.learningConfig,
            state.learningEnabled,
            state.evolutionConfig.geneticsEnabled,
          ),
          cameraResetToken:
            next.size === state.world.config.size
              ? state.cameraResetToken
              : state.cameraResetToken + 1,
          experiment: markDirty(state),
        }
      }

      if (canRebuildWorld(state)) {
        return {
          world: {
            ...state.world,
            config: next,
          },
          pendingWorldConfig: null,
          experiment: markDirty(state),
        }
      }

      return {
        pendingWorldConfig: liveChanged
          ? next
          : state.pendingWorldConfig
            ? {
                ...state.pendingWorldConfig,
                foodRegenRate: next.foodRegenRate,
                forageRegenRate: next.forageRegenRate,
              }
            : null,
        world: {
          ...state.world,
          config: {
            ...state.world.config,
            foodRegenRate: next.foodRegenRate,
            forageRegenRate: next.forageRegenRate,
          },
        },
        experiment: markDirty(state),
      }
    }),
  setLearningConfig: (partial) =>
    set((state) => ({
      learningConfig: clampLearningConfig({
        ...state.learningConfig,
        ...partial,
      }),
      experiment: markDirty(state),
    })),
  setRewardConfig: (partial) =>
    set((state) => ({
      rewardConfig: clampRewardConfig({
        ...state.rewardConfig,
        ...partial,
      }),
      experiment: markDirty(state),
    })),
  setExperimentName: (name) =>
    set((state) => ({
      experiment: {
        ...state.experiment,
        name: name.trim().slice(0, MAX_EXPERIMENT_NAME_LENGTH) || state.experiment.name,
        dirty: true,
      },
    })),
  newExperiment: () =>
    set((state) => ({
      status: 'idle' as const,
      tick: 0,
      speed: state.speed,
      ...rebuildWorld(
        activeWorldConfig(state),
        state.learningConfig,
        state.learningEnabled,
        state.evolutionConfig.geneticsEnabled,
      ),
      experiment: createExperimentIdentity(),
      migrationNotice: null,
    })),
  loadExperimentRecord: (record: ExperimentRecord) =>
    set((state) => {
      applyExperimentBrains(record)
      resetActionEvents()
      const status = record.status === 'running' ? 'paused' : record.status
      return {
        status,
        tick: record.tick,
        speed: record.speed,
        world: sanitizeWorld(structuredClone(record.world)),
        selectedObjectId: null,
        agentTrails: createAgentTrails(record.world.agents),
        learningHistory: structuredClone(record.learningHistory),
        generationHistory: structuredClone(record.generationHistory),
        learningEnabled: record.learningEnabled,
        learningConfig: record.learningConfig,
        rewardConfig: record.rewardConfig,
        evolutionConfig: {
          ...DEFAULT_EVOLUTION_CONFIG,
          ...record.evolutionConfig,
          geneticsEnabled:
            typeof record.evolutionConfig.geneticsEnabled === 'boolean'
              ? record.evolutionConfig.geneticsEnabled
              : true,
        },
        pendingWorldConfig:
          JSON.stringify(record.worldConfig) === JSON.stringify(record.world.config)
            ? null
            : record.worldConfig,
        experiment: {
          id: record.id,
          name: record.name,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          dirty: false,
        },
        cameraResetToken: state.cameraResetToken + 1,
        hydrated: true,
        migrationNotice: formatMigrationNotice(record),
      }
    }),
  dismissMigrationNotice: () => set({ migrationNotice: null }),
  markSaved: (updatedAt) =>
    set((state) => ({
      experiment: {
        ...state.experiment,
        updatedAt,
        dirty: false,
      },
    })),
  markHydrated: () => set({ hydrated: true }),
  addObject: (type: WorldObjectType) =>
    set((state) => ({
      world: {
        ...state.world,
        objects: [
          ...state.world.objects,
          createWorldObject(type, state.world.config, state.world.objects, Math.random, undefined, state.world.terrain),
        ],
      },
      experiment: markDirty(state),
    })),
  resetCamera: () =>
    set((state) => ({
      cameraResetToken: state.cameraResetToken + 1,
    })),
}))

/** DEV/smoke: live store singleton for headed browser probes (not a public API). */
if (import.meta.env.DEV) {
  ;(globalThis as unknown as { __ALS_STORE__: typeof useSimulationStore }).__ALS_STORE__ =
    useSimulationStore
}