import { describe, expect, it } from 'vitest'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import { encodeObservation, observeAgent, observeEnv } from '../learning/observation'
import { DEFAULT_WORLD_CONFIG, SIMULATION_STEP_DT } from './constants'
import { stepSimulation } from './engine'
import {
  createDefaultLabEnvironment,
  LAB_ENV_DAY_LENGTH_SEC,
  LAB_ENV_HOURS_PER_SEC,
  periodFromHours,
  sunLightingFromHours,
  temperatureTargetForHours,
  tickLabEnvironment,
} from './labEnvironment'
import { createInitialWorld } from './worldFactory'

describe('Lab environment Env-P3', () => {
  it('seeds Lab worlds with ambient state and leaves Ecology null', () => {
    const lab = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      agentCount: 1,
      seed: 7,
    })
    expect(lab.labEnvironment).not.toBeNull()
    expect(lab.labEnvironment?.period).toBe('day')
    expect(observeEnv(lab.labEnvironment)).toBe('day_brt_wrm')

    const eco = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      agentCount: 1,
      seed: 7,
    })
    expect(eco.labEnvironment).toBeNull()
    expect(observeEnv(eco.labEnvironment)).toBe('na')
  })

  it('advances time, lighting, and temperature over a day cycle', () => {
    let env = createDefaultLabEnvironment({ timeOfDayHours: 9 })
    expect(periodFromHours(env.timeOfDayHours)).toBe('day')
    expect(sunLightingFromHours(12)).toBeGreaterThan(sunLightingFromHours(0))
    expect(temperatureTargetForHours(12)).toBeGreaterThan(temperatureTargetForHours(0))

    // One full day in simulated seconds.
    env = tickLabEnvironment(env, LAB_ENV_DAY_LENGTH_SEC)
    expect(env.timeOfDayHours).toBeCloseTo(9, 5)
    expect(env.periodTransitions).toBeGreaterThanOrEqual(3)

    // Night mid-cycle from morning start (~30s → ~21:00).
    const mid = tickLabEnvironment(createDefaultLabEnvironment({ timeOfDayHours: 9 }), 30)
    expect(mid.period).toBe('night')
    expect(mid.lighting).toBeLessThan(0.45)
    expect(observeEnv(mid)).toMatch(/^nit_/)
  })

  it('ticks through the simulation engine and exposes env in observation', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      agentCount: 1,
      seed: 11,
    })
    const agent = world.agents[0]
    if (!agent) throw new Error('expected agent')

    const before = observeAgent(agent, world)
    const beforeKey = encodeObservation(before)
    expect(beforeKey.split('|')).toHaveLength(18)
    expect(before.env).toBe('day_brt_wrm')
    expect(before.labObject).not.toBe('na')
    expect(before.heldLab).toBe('none')

    let snapshot = { tick: 0, world }
    const context = {
      learningEnabled: false,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      rng: () => 0.5,
    }
    // ~35s → past dusk into night (day length 60s from hour 9).
    const steps = Math.ceil(35 / SIMULATION_STEP_DT)
    for (let i = 0; i < steps; i += 1) {
      snapshot = stepSimulation(snapshot, SIMULATION_STEP_DT, context)
    }

    expect(snapshot.world.labEnvironment?.period).toBe('night')
    expect(snapshot.world.labEnvironment?.periodTransitions).toBeGreaterThan(0)
    const after = observeAgent(snapshot.world.agents[0]!, snapshot.world)
    expect(after.env.startsWith('nit_')).toBe(true)
  })

  it('does not advance Ecology labEnvironment', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      agentCount: 1,
      seed: 3,
    })
    const stepped = stepSimulation({ tick: 0, world }, SIMULATION_STEP_DT, {
      learningEnabled: false,
    })
    expect(stepped.world.labEnvironment).toBeNull()
    expect(LAB_ENV_HOURS_PER_SEC).toBeCloseTo(24 / 60)
  })
})
