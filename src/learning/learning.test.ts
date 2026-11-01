import { describe, expect, it } from 'vitest'
import { getBrain, resetBrains } from './brain'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from './constants'
import { applyLearningUpdate } from './controller'
import { legalActionsFor } from './actionMask'
import { decodeObservation, encodeObservation, observeAgent } from './observation'
import { getOrCreateQValues, selectEpsilonGreedy, updateQValue } from './qLearning'
import { computeReward } from './rewards'
import { DEFAULT_WORLD_CONFIG } from '../simulation/constants'
import { createInitialWorld } from '../simulation/worldFactory'

function almostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-10
}

describe('q-learning update', () => {
  it('follows Q(s,a) += α(r + γ max Q(s′,a′) − Q(s,a))', () => {
    expect(almostEqual(updateQValue(0, 10, 4, 0.1, 0.95), 1.38)).toBe(true)
  })

  it('keeps the previous Q value when the update would be non-finite', () => {
    expect(updateQValue(2, Number.NaN, 4, 0.1, 0.95)).toBe(2)
    expect(updateQValue(Number.NaN, 10, 4, 0.1, 0.95)).toBeCloseTo(1.38)
  })

  it('explores at epsilon 1 and exploits at epsilon 0', () => {
    const explore = selectEpsilonGreedy([10, 0, 0, 0, 0], 1, () => 0)
    expect(explore.explored).toBe(true)

    const exploit = selectEpsilonGreedy([1, 9, 0, 0, 0], 0, () => 0.5)
    expect(exploit.explored).toBe(false)
    expect(exploit.action).toBe('TURN_LEFT')
  })

  it('does not write the Q-table when learning is off', () => {
    const world = createInitialWorld({ ...DEFAULT_WORLD_CONFIG, agentCount: 1 })
    const agent = world.agents[0]
    if (!agent) throw new Error('expected an agent')
    resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)

    applyLearningUpdate(
      agent,
      world,
      encodeObservation(observeAgent(agent, world)),
      {
        action: 'REST',
        ate: false,
        collided: false,
        died: false,
        consumedFoodId: null,
        pickedUpToolId: null,
        gatheredNodeId: null,
        gatheredAmount: 0,
        durabilityDelta: 0,
        targetKind: null,
      },
      agent.energy,
      agent.hunger,
      false,
      false,
      {
        learningEnabled: false,
        learningConfig: DEFAULT_LEARNING_CONFIG,
        rewardConfig: DEFAULT_REWARD_CONFIG,
        rng: () => 0.1,
      },
    )

    const brain = getBrain(agent.id)
    expect(brain?.qTable.size).toBe(0)
    expect(brain?.totalSteps).toBe(0)
    expect(brain?.epsilon).toBe(agent.genome.explorationRate)
  })

  it('keeps the Q-table sparse when a terrain observation is added', () => {
    const world = createInitialWorld({ ...DEFAULT_WORLD_CONFIG, agentCount: 1 })
    const agent = world.agents[0]
    if (!agent) throw new Error('expected an agent')
    resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)

    applyLearningUpdate(
      agent,
      world,
      encodeObservation(observeAgent(agent, world)),
      {
        action: 'REST',
        ate: false,
        collided: false,
        died: false,
        consumedFoodId: null,
        pickedUpToolId: null,
        gatheredNodeId: null,
        gatheredAmount: 0,
        durabilityDelta: 0,
        targetKind: null,
      },
      agent.energy,
      agent.hunger,
      false,
      false,
      {
        learningEnabled: true,
        learningConfig: DEFAULT_LEARNING_CONFIG,
        rewardConfig: DEFAULT_REWARD_CONFIG,
        rng: () => 0.1,
      },
    )

    const brain = getBrain(agent.id)
    expect(brain?.qTable.size).toBe(1)
    expect(encodeObservation(observeAgent(agent, world)).split('|')).toHaveLength(13)
    expect(decodeObservation(encodeObservation(observeAgent(agent, world)))?.heldTool).toBe('none')
  })

  it('does not store invalid state keys and does not update masked actions', () => {
    const table = new Map<string, number[]>()
    expect(getOrCreateQValues(table, 'low|NaN|forward|close|no|grassland|grassland|none|none|none|none|out|high').length).toBe(10)
    expect(table.size).toBe(0)

    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      agentCount: 1,
      initialFoodCount: 0,
      initialBerryCount: 0,
      initialRootCount: 0,
      initialBasketCount: 0,
      initialStickCount: 0,
      initialSpearCount: 0,
      initialShieldCount: 0,
    })
    const agent = world.agents[0]
    if (!agent) throw new Error('expected an agent')
    resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)
    const legal = legalActionsFor(agent, world)
    expect(legal.includes('EAT')).toBe(false)
    expect(legal.includes('ATTACK')).toBe(false)

    applyLearningUpdate(
      agent,
      world,
      encodeObservation(observeAgent(agent, world)),
      {
        action: 'EAT',
        ate: false,
        collided: false,
        died: false,
        consumedFoodId: null,
        pickedUpToolId: null,
        gatheredNodeId: null,
        gatheredAmount: 0,
        durabilityDelta: 0,
        targetKind: null,
      },
      agent.energy,
      agent.hunger,
      false,
      false,
      {
        learningEnabled: true,
        learningConfig: DEFAULT_LEARNING_CONFIG,
        rewardConfig: DEFAULT_REWARD_CONFIG,
        rng: () => 0.1,
      },
      legal,
    )

    expect(getBrain(agent.id)?.qTable.size).toBe(0)
    expect(getBrain(agent.id)?.totalSteps).toBe(0)
  })

  it('keeps masked actions out of epsilon-greedy selection', () => {
    const picked = selectEpsilonGreedy([0, 0, 0, 99, 0, 0, 0, 0, 0, 0], 0, () => 0.1, ['REST'])
    expect(picked.action).toBe('REST')
    expect(picked.explored).toBe(false)
  })
})

describe('reward calculation', () => {
  it('awards only the events that actually happened', () => {
    expect(
      computeReward(
        {
          action: 'EAT',
          ate: true,
          collided: false,
          died: false,
          energyBefore: 20,
          hungerBefore: 80,
          foodInEatRange: true,
          gatheredAmount: 0,
          pickedUp: false,
        },
        DEFAULT_REWARD_CONFIG,
      ),
    ).toBe(10)

    expect(
      computeReward(
        {
          action: 'MOVE_FORWARD',
          ate: false,
          collided: false,
          died: false,
          energyBefore: 80,
          hungerBefore: 10,
          foodInEatRange: false,
          gatheredAmount: 0,
          pickedUp: false,
        },
        DEFAULT_REWARD_CONFIG,
      ),
    ).toBe(0)

    expect(
      computeReward(
        {
          action: 'MOVE_FORWARD',
          ate: false,
          collided: false,
          died: false,
          energyBefore: 80,
          hungerBefore: 10,
          foodInEatRange: true,
          gatheredAmount: 0,
          pickedUp: false,
        },
        DEFAULT_REWARD_CONFIG,
      ),
    ).toBe(-1)

    expect(
      computeReward(
        {
          action: 'MOVE_FORWARD',
          ate: false,
          collided: true,
          died: false,
          energyBefore: 80,
          hungerBefore: 10,
          foodInEatRange: false,
          gatheredAmount: 0,
          pickedUp: false,
        },
        DEFAULT_REWARD_CONFIG,
      ),
    ).toBe(-2)

    expect(
      computeReward(
        {
          action: 'MOVE_FORWARD',
          ate: false,
          collided: false,
          died: true,
          energyBefore: 2,
          hungerBefore: 90,
          foodInEatRange: false,
          gatheredAmount: 0,
          pickedUp: false,
        },
        DEFAULT_REWARD_CONFIG,
      ),
    ).toBe(-20)
  })
})
