import { describe, expect, it } from 'vitest'
import { getBrain, resetBrains } from './brain'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG, EXPLORE_ACTION_WEIGHTS } from './constants'
import { applyLearningUpdate, decideAction } from './controller'
import {
  driveActionBias,
  exploreWeightsFor,
  LAB_DRIVE_GATHER_BIAS,
  LAB_DRIVE_MATCH_BIAS,
  LAB_DRIVE_MATCH_EXPLORE_WEIGHT,
  LAB_DRIVE_TURN_BIAS,
} from './driveBias'
import { legalActionsFor } from './actionMask'
import { curriculumSeekBias, labLearningCurriculum } from './labCurriculum'
import { decodeObservation, encodeObservation, observeAgent, observeDrive } from './observation'
import { actionIndex, getOrCreateQValues, selectEpsilonGreedy, updateQValue } from './qLearning'
import {
  APPROACH_FOOD_REWARD,
  CORRECT_TURN_REWARD,
  computeReward,
  computeRewardBreakdown,
  SPIN_OSCILLATION_PENALTY,
  survivalSeekReward,
  WRONG_TURN_PENALTY,
} from './rewards'
import { DEFAULT_WORLD_CONFIG } from '../simulation/constants'
import { createInitialWorld } from '../simulation/worldFactory'
import type { Agent } from '../types/agent'
import type { RestBedInteractable } from '../types/interactable'

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
    expect(encodeObservation(observeAgent(agent, world)).split('|')).toHaveLength(18)
    expect(decodeObservation(encodeObservation(observeAgent(agent, world)))?.heldTool).toBe('none')
    expect(decodeObservation(encodeObservation(observeAgent(agent, world)))?.drive).toBe('na')
    expect(decodeObservation(encodeObservation(observeAgent(agent, world)))?.env).toBe('na')
    expect(decodeObservation(encodeObservation(observeAgent(agent, world)))?.labObject).toBe('na')
    expect(decodeObservation(encodeObservation(observeAgent(agent, world)))?.heldLab).toBe('na')
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

  it('wires Lab drive cue + match bias so non-survival GATHER wins near rest_bed', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      agentCount: 1,
    })
    const bed = world.interactables.find((item) => item.kind === 'rest_bed') as RestBedInteractable
    const agent = {
      ...world.agents[0]!,
      position: { x: bed.position.x, z: bed.position.z },
      energy: 80,
      hunger: 20,
      fatigue: 70,
      curiosity: 40,
      comfort: 30,
    } as Agent
    const withAgent = { ...world, agents: [agent] }

    expect(observeDrive(agent)).toBe('tired')
    expect(legalActionsFor(agent, withAgent)).toContain('GATHER')
    expect(driveActionBias(agent, withAgent)[actionIndex('GATHER')]).toBe(
      LAB_DRIVE_GATHER_BIAS + LAB_DRIVE_MATCH_BIAS,
    )
    expect(exploreWeightsFor(agent, withAgent)[actionIndex('GATHER')]).toBe(
      LAB_DRIVE_MATCH_EXPLORE_WEIGHT,
    )
    expect(exploreWeightsFor(agent, withAgent)[actionIndex('GATHER')]).toBeGreaterThan(
      EXPLORE_ACTION_WEIGHTS[actionIndex('GATHER')]!,
    )

    resetBrains([agent], DEFAULT_LEARNING_CONFIG)
    const brain = getBrain(agent.id)
    if (!brain) throw new Error('expected brain')
    brain.epsilon = 0
    const decision = decideAction(agent, withAgent, {
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      rng: () => 0.99,
      geneticsEnabled: false,
      // Drive-discovery tick so survival-primer curriculum does not suppress GATHER.
      tick: 700,
    })
    expect(decision.legalActions).toContain('GATHER')
    expect(decision.selection.action).toBe('GATHER')
    expect(decision.selection.explored).toBe(false)
    const tokens = decision.stateKey.split('|')
    expect(tokens).toHaveLength(18)
    expect(tokens.at(-4)).toBe('tired')
    expect(tokens.at(-3)).toMatch(/^(day|nit)_/)
    expect(tokens.at(-2)).not.toBe('na')
    expect(tokens.at(-1)).toBe('none')

    const ecology = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      agentCount: 1,
    })
    const eco = ecology.agents[0]!
    expect(observeDrive(eco)).toBe('na')
    expect(observeAgent(eco, ecology).labObject).toBe('na')
    expect(observeAgent(eco, ecology).heldLab).toBe('na')
    expect(driveActionBias(eco, ecology)[actionIndex('GATHER')]).toBe(0)
    expect(exploreWeightsFor(eco, ecology)).toBe(EXPLORE_ACTION_WEIGHTS)
  })

  it('biases only one turn for off-axis rest_bed (no L+R spin teacher)', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      agentCount: 1,
    })
    const bed = world.interactables.find((item) => item.kind === 'rest_bed') as RestBedInteractable
    const agent = {
      ...world.agents[0]!,
      // Stand off-axis so cue is rest_oth, facing +Z while bed is to the side.
      position: { x: bed.position.x - 4, z: bed.position.z },
      rotation: 0,
      energy: 80,
      hunger: 20,
      fatigue: 70,
      curiosity: 10,
      comfort: 80,
    } as Agent
    const withAgent = { ...world, agents: [agent] }
    expect(observeAgent(agent, withAgent).interactable).toBe('rest_oth')

    const bias = driveActionBias(agent, withAgent)
    const turnL = bias[actionIndex('TURN_LEFT')] ?? 0
    const turnR = bias[actionIndex('TURN_RIGHT')] ?? 0
    expect(turnL > 0 || turnR > 0).toBe(true)
    expect(turnL > 0 && turnR > 0).toBe(false)
    expect(Math.max(turnL, turnR)).toBe(LAB_DRIVE_TURN_BIAS)

    const curriculum = labLearningCurriculum(700)
    const seek = curriculumSeekBias(agent, withAgent, curriculum)
    const seekL = seek[actionIndex('TURN_LEFT')] ?? 0
    const seekR = seek[actionIndex('TURN_RIGHT')] ?? 0
    expect(seekL > 0 && seekR > 0).toBe(false)
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

  it('shapes Lab survival seek: approach, correct/wrong turn, spin oscillation', () => {
    const labBase = {
      ate: false,
      collided: false,
      died: false,
      energyBefore: 60,
      hungerBefore: 50,
      foodInEatRange: false,
      gatheredAmount: 0,
      pickedUp: false,
      fatigueBefore: 10,
      curiosityBefore: 10,
      comfortBefore: 80,
    } as const

    expect(
      survivalSeekReward({
        ...labBase,
        action: 'MOVE_FORWARD',
        foodDirection: 'forward',
      }),
    ).toBe(APPROACH_FOOD_REWARD)

    expect(
      survivalSeekReward({
        ...labBase,
        action: 'TURN_LEFT',
        foodDirection: 'left',
      }),
    ).toBe(CORRECT_TURN_REWARD)

    expect(
      survivalSeekReward({
        ...labBase,
        action: 'TURN_RIGHT',
        foodDirection: 'left',
      }),
    ).toBe(WRONG_TURN_PENALTY)

    expect(
      survivalSeekReward({
        ...labBase,
        action: 'TURN_LEFT',
        foodDirection: 'forward',
      }),
    ).toBe(WRONG_TURN_PENALTY)

    expect(
      survivalSeekReward({
        ...labBase,
        action: 'TURN_LEFT',
        foodDirection: 'forward',
        previousAction: 'TURN_RIGHT',
      }),
    ).toBe(SPIN_OSCILLATION_PENALTY + WRONG_TURN_PENALTY)

    // Blind explore L↔R (no food sensed) is not penalized as spin.
    expect(
      survivalSeekReward({
        ...labBase,
        action: 'TURN_LEFT',
        foodDirection: 'none',
        previousAction: 'TURN_RIGHT',
      }),
    ).toBe(0)

    // Ecology / no Lab drive snapshot → no seek shaping
    expect(
      survivalSeekReward({
        action: 'MOVE_FORWARD',
        ate: false,
        collided: false,
        died: false,
        energyBefore: 60,
        hungerBefore: 50,
        foodInEatRange: false,
        gatheredAmount: 0,
        pickedUp: false,
        foodDirection: 'forward',
        previousAction: 'TURN_RIGHT',
      }),
    ).toBe(0)

    expect(
      computeReward(
        {
          ...labBase,
          action: 'MOVE_FORWARD',
          foodDirection: 'forward',
        },
        DEFAULT_REWARD_CONFIG,
      ),
    ).toBe(APPROACH_FOOD_REWARD)
  })

  it('exposes named reward component breakdown that sums to total', () => {
    const breakdown = computeRewardBreakdown(
      {
        action: 'TURN_LEFT',
        ate: true,
        collided: true,
        died: false,
        energyBefore: 60,
        hungerBefore: 50,
        foodInEatRange: false,
        gatheredAmount: 0,
        pickedUp: false,
        fatigueBefore: 10,
        curiosityBefore: 10,
        comfortBefore: 80,
        foodDirection: 'forward',
        previousAction: 'TURN_RIGHT',
      },
      DEFAULT_REWARD_CONFIG,
    )
    expect(breakdown.components.eat).toBe(DEFAULT_REWARD_CONFIG.eatSuccess)
    expect(breakdown.components.collision).toBe(DEFAULT_REWARD_CONFIG.collision)
    expect(breakdown.components.spinPenalty).toBe(SPIN_OSCILLATION_PENALTY)
    expect(breakdown.components.survivalSeek).toBe(WRONG_TURN_PENALTY)
    expect(breakdown.total).toBe(
      breakdown.components.eat +
        breakdown.components.collision +
        breakdown.components.spinPenalty +
        breakdown.components.survivalSeek,
    )
    expect(computeReward(
      {
        action: 'TURN_LEFT',
        ate: true,
        collided: true,
        died: false,
        energyBefore: 60,
        hungerBefore: 50,
        foodInEatRange: false,
        gatheredAmount: 0,
        pickedUp: false,
        fatigueBefore: 10,
        curiosityBefore: 10,
        comfortBefore: 80,
        foodDirection: 'forward',
        previousAction: 'TURN_RIGHT',
      },
      DEFAULT_REWARD_CONFIG,
    )).toBe(breakdown.total)
  })
})
