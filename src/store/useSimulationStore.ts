import { create } from 'zustand'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import { resetBrains } from '../learning/brain'
import { DEFAULT_VIEWER_SETTINGS, SIMULATION_STEP_DT } from '../simulation/constants'
import { stepSimulation } from '../simulation/engine'
import { createInitialWorld, createWorldObject } from '../simulation/worldFactory'
import type { SimulationActions, SimulationState, ViewerSettings } from '../types/simulation'
import type { WorldObjectType, WorldState } from '../types/world'
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

export const useSimulationStore = create<SimulationState & SimulationActions>((set) => ({
  status: 'idle',
  tick: 0,
  speed: 1,
  world: initialWorld,
  selectedObjectId: null,
  agentTrails: createAgentTrails(initialWorld.agents),
  settings: DEFAULT_VIEWER_SETTINGS,
  cameraResetToken: 0,
  learningEnabled: true,
  learningConfig: DEFAULT_LEARNING_CONFIG,

  play: () => set({ status: 'running' }),
  pause: () => set({ status: 'paused' }),
  reset: () =>
    set((state) => {
      const world = createInitialWorld()
      resetBrains(world.agents, state.learningConfig)
      return {
        status: 'idle' as const,
        tick: 0,
        world,
        selectedObjectId: null,
        agentTrails: createAgentTrails(world.agents),
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
      return {
        tick: next.tick,
        world: next.world,
        selectedObjectId: isSelectionPresent(state.selectedObjectId, next.world)
          ? state.selectedObjectId
          : null,
        agentTrails: recordAgentTrails(state.agentTrails, next.world.agents),
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
  setEpsilonDecay: (decay) =>
    set((state) => ({
      learningConfig: {
        ...state.learningConfig,
        epsilonDecay: decay,
      },
    })),
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
