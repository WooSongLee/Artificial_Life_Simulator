import { describe, expect, it } from 'vitest'
import { GENETIC_BIAS_MAX } from '../evolution/constants'
import { DEFAULT_WORLD_CONFIG } from '../simulation/constants'
import { createInitialWorld } from '../simulation/worldFactory'
import type { Agent } from '../types/agent'
import { resetBrains, getBrain } from './brain'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from './constants'
import { decideAction } from './controller'
import { geneticActionBias } from './geneticBias'
import { actionIndex, getOrCreateQValues } from './qLearning'

function nearbyPair() {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 2,
    obstacleDensity: 0,
    initialFoodCount: 0,
    initialBerryCount: 0,
    initialRootCount: 0,
    initialBasketCount: 0,
    initialStickCount: 0,
    initialSpearCount: 0,
    initialShieldCount: 0,
  })
  const [first, second] = world.agents
  if (!first || !second) throw new Error('expected two agents')

  const agent: Agent = {
    ...first,
    desire: 0,
    health: 90,
    energy: 80,
    position: { x: 0, z: 0 },
    attackCooldownLeft: 0,
    genome: { ...first.genome, explorationRate: 0, libido: 0, aggression: 1, caution: 1 },
  }
  const other: Agent = {
    ...second,
    desire: 0,
    health: 90,
    energy: 80,
    position: { x: 0, z: 1.2 },
    genome: { ...second.genome, explorationRate: 0, libido: 0 },
  }
  const nextWorld = { ...world, agents: [agent, other] }
  resetBrains(nextWorld.agents, DEFAULT_LEARNING_CONFIG)
  return { world: nextWorld, agent, other }
}

describe('genetic action bias', () => {
  it('adds a capped ATTACK bias in a threat without writing the Q-table', () => {
    const { world, agent } = nearbyPair()
    const aggressive = {
      ...agent,
      genome: { ...agent.genome, aggression: 1.6, caution: 0.4 },
    }
    const bias = geneticActionBias(aggressive, { ...world, agents: [aggressive, world.agents[1]!] })
    expect(bias[actionIndex('ATTACK')]).toBeGreaterThan(0)
    expect(bias[actionIndex('ATTACK')]).toBeLessThanOrEqual(GENETIC_BIAS_MAX)
    expect(bias[actionIndex('MOVE_FORWARD')]).toBe(0)

    const decision = decideAction(aggressive, { ...world, agents: [aggressive, world.agents[1]!] }, {
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      rng: () => 0.5,
    })
    expect(decision.selection.explored).toBe(false)
    expect(decision.selection.action).toBe('ATTACK')
    expect(decision.qValues[actionIndex('ATTACK')]).toBe(0)
    expect(getBrain(aggressive.id)?.qTable.size).toBe(0)
  })

  it('adds DEFEND/FLEE bias when health is low and does not overwrite Q', () => {
    const { world, agent } = nearbyPair()
    const cautious = {
      ...agent,
      health: 20,
      genome: { ...agent.genome, aggression: 0.4, caution: 1.6 },
    }
    const nextWorld = { ...world, agents: [cautious, world.agents[1]!] }
    const bias = geneticActionBias(cautious, nextWorld)
    expect(bias[actionIndex('DEFEND')]).toBeGreaterThan(0)
    expect(bias[actionIndex('FLEE')]).toBeGreaterThan(0)
    expect(bias[actionIndex('ATTACK')]).toBeLessThan(0)

    const brain = getBrain(cautious.id)
    if (!brain) throw new Error('expected a brain')
    const stateKey = decideAction(cautious, nextWorld, {
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      rng: () => 0.5,
    }).stateKey
    const qValues = getOrCreateQValues(brain.qTable, stateKey)
    qValues[actionIndex('ATTACK')] = 4
    qValues[actionIndex('DEFEND')] = 3.9
    qValues[actionIndex('FLEE')] = 3.8

    const decision = decideAction(cautious, nextWorld, {
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      rng: () => 0.5,
    })
    expect(decision.selection.explored).toBe(false)
    expect(decision.selection.action === 'DEFEND' || decision.selection.action === 'FLEE').toBe(true)
    expect(decision.qValues[actionIndex('ATTACK')]).toBe(4)
    expect(decision.qValues[actionIndex('DEFEND')]).toBe(3.9)
  })

  it('does not apply genetic bias when genetics is off', () => {
    const { world, agent } = nearbyPair()
    const aggressive = {
      ...agent,
      genome: { ...agent.genome, aggression: 1.6, caution: 0.4 },
    }
    const nextWorld = { ...world, agents: [aggressive, world.agents[1]!] }
    const decision = decideAction(aggressive, nextWorld, {
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      rng: () => 0.5,
      geneticsEnabled: false,
    })
    expect(decision.geneticBias.every((value) => value === 0)).toBe(true)
    expect(decision.selectionScores).toEqual(decision.qValues)
  })
})
