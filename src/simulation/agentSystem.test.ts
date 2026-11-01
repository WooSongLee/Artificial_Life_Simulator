import { describe, expect, it } from 'vitest'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import { resetBrains } from '../learning/brain'
import { isInsideWorld } from './spatial'
import { energyDrainMultiplier, updateAgent } from './agentSystem'
import { DEFAULT_WORLD_CONFIG, SIMULATION_STEP_DT } from './constants'
import { sanitizeAgent } from './sanitize'
import { createInitialWorld } from './worldFactory'

function learningOff(rng = () => 0) {
  return {
    learningEnabled: false,
    learningConfig: DEFAULT_LEARNING_CONFIG,
    rewardConfig: DEFAULT_REWARD_CONFIG,
    rng,
  }
}

function readyAgent(overrides: Record<string, unknown> = {}) {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 1,
    obstacleDensity: 0,
    initialFoodCount: 4,
    initialBerryCount: 0,
    initialRootCount: 0,
    initialBasketCount: 0,
    initialStickCount: 0,
    initialSpearCount: 0,
    initialShieldCount: 0,
  })
  const agent = world.agents[0]
  if (!agent) throw new Error('expected an agent')
  const next = {
    ...agent,
    ...overrides,
    genome: {
      ...agent.genome,
      explorationRate: 1,
      ...(typeof overrides.genome === 'object' && overrides.genome !== null ? overrides.genome : {}),
    },
    position:
      overrides.position && typeof overrides.position === 'object'
        ? (overrides.position as { x: number; z: number })
        : { x: 0, z: 0 },
  }
  resetBrains([next], DEFAULT_LEARNING_CONFIG)
  return { world: { ...world, agents: [next] }, agent: next }
}

describe('agent movement', () => {
  it('moves forward along heading and stays inside the world', () => {
    const { world, agent } = readyAgent({ rotation: 0 })
    const result = updateAgent(agent, world, SIMULATION_STEP_DT, learningOff(() => 0))

    expect(result.agent.lastAction).toBe('MOVE_FORWARD')
    expect(result.agent.position.z).toBeGreaterThan(agent.position.z)
    expect(result.agent.position.x).toBeCloseTo(agent.position.x, 6)
    expect(isInsideWorld(result.agent.position.x, result.agent.position.z, world.config.size)).toBe(
      true,
    )
  })

  it('rejects a non-finite destination and keeps the previous position', () => {
    const { world, agent } = readyAgent({
      position: { x: 0, z: 0 },
      rotation: 0,
      speed: Number.NaN,
    })
    const result = updateAgent(agent, world, SIMULATION_STEP_DT, learningOff(() => 0))
    expect(result.agent.position).toEqual({ x: 0, z: 0 })
  })
})

describe('energy system', () => {
  it('drains more energy when moving than when resting', () => {
    expect(energyDrainMultiplier('MOVE_FORWARD')).toBeGreaterThan(energyDrainMultiplier('TURN_LEFT'))
    expect(energyDrainMultiplier('TURN_LEFT')).toBeGreaterThan(energyDrainMultiplier('REST'))

    const moving = readyAgent({ energy: 80, hunger: 10, rotation: 0 })
    const resting = readyAgent({ energy: 80, hunger: 10, rotation: 0 })
    const moved = updateAgent(moving.agent, moving.world, SIMULATION_STEP_DT, learningOff(() => 0))
    const rested = updateAgent(resting.agent, resting.world, SIMULATION_STEP_DT, learningOff(() => 0.95))

    expect(moved.agent.lastAction).toBe('MOVE_FORWARD')
    expect(rested.agent.lastAction).toBe('REST')
    expect(moved.agent.energy).toBeLessThan(rested.agent.energy)
    expect(moved.agent.energy).toBeGreaterThan(0)
    expect(moved.agent.energy).toBeLessThanOrEqual(100)
  })
})

describe('death condition', () => {
  it('does not let a dead agent act or consume food', () => {
    const { world, agent } = readyAgent({
      alive: false,
      health: 0,
      deathCause: 'health',
      energy: 8,
    })
    const food = world.objects.find((object) => object.type === 'food')
    const placed = {
      ...agent,
      position: food ? { x: food.position.x, z: food.position.z } : agent.position,
    }
    const result = updateAgent(placed, { ...world, agents: [placed] }, SIMULATION_STEP_DT, learningOff())

    expect(result.agent.alive).toBe(false)
    expect(result.consumedFoodId).toBeNull()
    expect(result.agent.position).toEqual(placed.position)
    expect(result.agent.lastAction).toBe(placed.lastAction)
  })

  it('kills an agent that reaches max lifespan', () => {
    const { world, agent } = readyAgent()
    const aged = { ...agent, age: agent.maxLifespan - SIMULATION_STEP_DT / 2 }
    const result = updateAgent(aged, { ...world, agents: [aged] }, SIMULATION_STEP_DT, learningOff())
    expect(result.agent.alive).toBe(false)
    expect(result.agent.deathCause).toBe('age')
    expect(result.agent.health).toBe(0)
  })

  it('does not kill by age when genetics is off', () => {
    const { world, agent } = readyAgent()
    const aged = { ...agent, age: agent.maxLifespan - SIMULATION_STEP_DT / 2 }
    const result = updateAgent(aged, { ...world, agents: [aged] }, SIMULATION_STEP_DT, {
      ...learningOff(),
      geneticsEnabled: false,
    })
    expect(result.agent.alive).toBe(true)
    expect(result.agent.deathCause).toBeNull()
    expect(result.agent.age).toBeGreaterThan(aged.age)
  })

  it('treats health <= 0 as death even if alive was still true', () => {
    const { world, agent } = readyAgent({ health: 0, alive: true })
    const result = updateAgent(agent, world, SIMULATION_STEP_DT, learningOff())
    expect(result.agent.alive).toBe(false)
    expect(result.agent.deathCause).toBe('health')
  })
})

describe('state sanitization', () => {
  it('repairs NaN energy and position before an agent is used', () => {
    const { agent } = readyAgent()
    const sanitized = sanitizeAgent({
      ...agent,
      energy: Number.NaN,
      position: { x: Number.POSITIVE_INFINITY, z: Number.NaN },
      health: 40,
      alive: true,
    })
    expect(sanitized.energy).toBe(0)
    expect(Number.isFinite(sanitized.position.x)).toBe(true)
    expect(Number.isFinite(sanitized.position.z)).toBe(true)
    expect(sanitized.alive).toBe(true)
  })
})
