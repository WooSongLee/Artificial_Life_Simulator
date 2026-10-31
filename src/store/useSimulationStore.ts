import { create } from 'zustand'
import {
  DEFAULT_EVOLUTION_CONFIG,
  MAX_GENERATION_DURATION,
  MIN_GENERATION_DURATION,
} from '../evolution/constants'
import {
  appendGenerationRecord,
  collectGenerationRecord,
  createNextGeneration,
  shouldEndGeneration,
} from '../evolution/generations'
import { assignChildBrains } from '../evolution/inheritance'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import { ensureBrain, removeBrains, resetBrains, setBrain } from '../learning/brain'
import {
  clampAgentCount,
  DEFAULT_VIEWER_SETTINGS,
  MAX_AGENT_COUNT,
  MIN_AGENT_COUNT,
  SIMULATION_STEP_DT,
} from '../simulation/constants'
import { stepSimulation } from '../simulation/engine'
import { createLearningHistory, recordLearningHistory } from '../simulation/metrics'
import { adjustWorldPopulation, createInitialWorld, createWorldObject } from '../simulation/worldFactory'
import type { SimulationActions, SimulationState, ViewerSettings } from '../types/simulation'
import type { WorldObjectType, WorldState } from '../types/world'
import { clamp } from '../utils/math'
import { createAgentTrails, recordAgentTrails } from '../utils/agentTrail'

const initialWorld = createInitialWorld()
resetBrains(initialWorld.agents, DEFAULT_LEARNING_CONFIG)

function isSelectionPresent(id: string | null, world: WorldState): boolean {
  if (!id) return false
  return (
    world.objects.some((object) => object.id === id) ||
    world.agents.some((agent) => agent.id === id)
  )
}

function clampPopulationLimit(limit: number): number {
  return Math.round(clamp(limit, MIN_AGENT_COUNT, MAX_AGENT_COUNT))
}

function clampGenerationDuration(seconds: number): number {
  return Math.round(clamp(seconds, MIN_GENERATION_DURATION, MAX_GENERATION_DURATION))
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
  evolutionConfig: DEFAULT_EVOLUTION_CONFIG,

  play: () =>
    set((state) => (state.status === 'ended' ? state : { status: 'running' as const })),
  pause: () =>
    set((state) => (state.status === 'ended' ? state : { status: 'paused' as const })),
  reset: () =>
    set((state) => {
      const world = createInitialWorld(state.world.config)
      resetBrains(world.agents, state.learningConfig)
      return {
        status: 'idle' as const,
        tick: 0,
        world,
        selectedObjectId: null,
        agentTrails: createAgentTrails(world.agents),
        learningHistory: createLearningHistory(0, world.agents, state.learningEnabled),
        generationHistory: [],
      }
    }),
  step: (dt = SIMULATION_STEP_DT) =>
    set((state) => {
      const next = stepSimulation({ tick: state.tick, world: state.world }, dt, {
        learningEnabled: state.learningEnabled,
        learningConfig: state.learningConfig,
        rewardConfig: DEFAULT_REWARD_CONFIG,
        rng: Math.random,
      })

      const endReason = shouldEndGeneration(next.world, next.tick, state.evolutionConfig)
      let world = next.world
      let status = state.status
      let generationHistory = state.generationHistory
      let agentTrails = recordAgentTrails(state.agentTrails, next.world.agents)

      if (endReason) {
        generationHistory = appendGenerationRecord(
          generationHistory,
          collectGenerationRecord(next.world, next.tick, endReason, state.evolutionConfig.mutationRate),
        )

        if (endReason === 'extinction') {
          status = 'ended'
        } else {
          const advanced = createNextGeneration(next.world, next.tick, state.evolutionConfig, Math.random)
          if (!advanced) {
            status = 'ended'
          } else {
            assignChildBrains(
              advanced.world.agents,
              state.evolutionConfig.inheritQTable,
              state.learningConfig,
              setBrain,
            )
            removeBrains(advanced.previousAgentIds)
            world = advanced.world
            agentTrails = createAgentTrails(world.agents)
          }
        }
      }

      return {
        tick: next.tick,
        world,
        status,
        selectedObjectId: isSelectionPresent(state.selectedObjectId, world)
          ? state.selectedObjectId
          : null,
        agentTrails,
        learningHistory: recordLearningHistory(
          state.learningHistory,
          next.tick,
          world.agents,
          state.learningEnabled,
        ),
        generationHistory,
      }
    }),
  setSpeed: (speed) => set({ speed }),
  selectObject: (id) => set({ selectedObjectId: id }),
  setSetting: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        [key]: value,
      } satisfies ViewerSettings,
    })),
  setLearningEnabled: (enabled) => set({ learningEnabled: enabled }),
  setInheritQTable: (enabled) =>
    set((state) => ({
      evolutionConfig: {
        ...state.evolutionConfig,
        inheritQTable: enabled,
      },
    })),
  setPopulationLimit: (limit) =>
    set((state) => ({
      evolutionConfig: {
        ...state.evolutionConfig,
        populationLimit: clampPopulationLimit(limit),
      },
    })),
  setGenerationDuration: (seconds) =>
    set((state) => ({
      evolutionConfig: {
        ...state.evolutionConfig,
        generationDuration: clampGenerationDuration(seconds),
      },
    })),
  setAgentCount: (count) =>
    set((state) => {
      const agentCount = clampAgentCount(count)
      if (agentCount === state.world.config.agentCount && state.world.agents.length === agentCount) {
        return state
      }

      if (state.status === 'idle' && state.tick === 0) {
        const world = createInitialWorld({
          ...state.world.config,
          agentCount,
        })
        resetBrains(world.agents, state.learningConfig)
        return {
          world,
          selectedObjectId: null,
          agentTrails: createAgentTrails(world.agents),
          learningHistory: createLearningHistory(0, world.agents, state.learningEnabled),
          generationHistory: [],
        }
      }

      const { world, removedAgentIds } = adjustWorldPopulation(state.world, agentCount)
      removeBrains(removedAgentIds)
      for (const agent of world.agents) {
        ensureBrain(agent.id, state.learningConfig, agent.genome.explorationRate)
      }

      return {
        world,
        selectedObjectId: isSelectionPresent(state.selectedObjectId, world)
          ? state.selectedObjectId
          : null,
        agentTrails: recordAgentTrails(state.agentTrails, world.agents),
      }
    }),
  addObject: (type: WorldObjectType) =>
    set((state) => ({
      world: {
        ...state.world,
        objects: [
          ...state.world.objects,
          createWorldObject(type, state.world.config, state.world.objects),
        ],
      },
    })),
  resetCamera: () =>
    set((state) => ({
      cameraResetToken: state.cameraResetToken + 1,
    })),
}))
