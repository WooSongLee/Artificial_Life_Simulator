import { energyDrainMultiplier } from '../simulation/agentSystem'
import {
  DEFAULT_WORLD_CONFIG,
  FOOD_EAT_RADIUS,
  LEARNING_COMPARISON_WINDOW,
  LEARNING_HISTORY_MAX_POINTS,
  LEARNING_HISTORY_SAMPLE_TICKS,
  SIMULATION_STEP_DT,
} from '../simulation/constants'
import { stepSimulation } from '../simulation/engine'
import {
  compareLearningWindows,
  createEmptyLearningHistory,
  createLearningHistory,
  recordLearningHistory,
} from '../simulation/metrics'
import { createInitialWorld } from '../simulation/worldFactory'
import { isPopulationExtinct } from '../utils/agentStats'
import { mulberry32 } from '../utils/random'
import { getBrain, resetBrains } from './brain'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from './constants'
import { applyLearningUpdate } from './controller'
import { encodeObservation, observeAgent } from './observation'
import { pickWeightedAction, selectEpsilonGreedy, updateQValue } from './qLearning'
import { computeReward } from './rewards'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function almostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-10
}

function encodeIsDeterministic(): void {
  const world = createInitialWorld()
  const agent = world.agents[0]
  if (!agent) throw new Error('expected an agent')

  const first = encodeObservation(observeAgent(agent, world))
  const second = encodeObservation(observeAgent(agent, world))
  assert(first === second, 'same observation must encode to the same state key')
  assert(first.split('|').length === 13, 'state key must contain thirteen discrete features')
}

function qUpdateMatchesFormula(): void {
  const next = updateQValue(0, 10, 4, 0.1, 0.95)
  assert(almostEqual(next, 1.38), `Q-update produced ${next}, expected 1.38`)
}

function rewardsMatchEvents(): void {
  assert(
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
    ) === 10,
    'eat success must award +10',
  )
  assert(
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
    ) === 0,
    'searching movement must not take a reward penalty',
  )
  assert(
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
    ) === -1,
    'leaving food in eat range must award -1',
  )
  assert(
    computeReward(
      {
        action: 'TURN_LEFT',
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
    ) === 0,
    'turning must not earn a reward just for spinning',
  )
  assert(
    energyDrainMultiplier('MOVE_FORWARD') > energyDrainMultiplier('TURN_LEFT'),
    'forward movement must consume more energy than turning',
  )
  assert(
    energyDrainMultiplier('TURN_LEFT') > energyDrainMultiplier('REST'),
    'turning must consume more energy than rest',
  )
  assert(
    pickWeightedAction([0.48, 0.16, 0.16, 0.1, 0.1], () => 0.1) === 'MOVE_FORWARD',
    'exploration prior must prefer forward movement',
  )
  assert(
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
    ) === -2,
    'collision must award -2',
  )
  assert(
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
    ) === -20,
    'death must award -20',
  )
}

function epsilonGreedyExploresAndExploits(): void {
  const explore = selectEpsilonGreedy([10, 0, 0, 0, 0], 1, () => 0)
  assert(explore.explored, 'epsilon 1.0 must explore')

  const exploit = selectEpsilonGreedy([1, 9, 0, 0, 0], 0, () => 0.5)
  assert(!exploit.explored, 'epsilon 0 must exploit')
  assert(exploit.action === 'TURN_LEFT', `argmax should pick TURN_LEFT, got ${exploit.action}`)
}

function learningOffDoesNotWriteQTable(): void {
  const world = createInitialWorld()
  const agent = world.agents[0]
  if (!agent) throw new Error('expected an agent')
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)

  applyLearningUpdate(
    agent,
    world,
    'low|low|none|out|no',
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
  assert(brain !== undefined, 'brain should exist')
  assert(brain?.qTable.size === 0, 'learning off must not insert Q-table entries')
  assert(brain?.totalSteps === 0, 'learning off must not increment learning steps')
  assert(brain?.epsilon === agent.genome.explorationRate, 'learning off must not decay epsilon')
}

function simulationUpdatesAndFreezes(): void {
  const world = createInitialWorld()
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)

  let snapshot = { tick: 0, world }
  const learnContext = {
    learningEnabled: true,
    learningConfig: DEFAULT_LEARNING_CONFIG,
    rewardConfig: DEFAULT_REWARD_CONFIG,
    rng: mulberry32(7),
  }

  for (let i = 0; i < 80; i += 1) {
    snapshot = stepSimulation(snapshot, SIMULATION_STEP_DT, learnContext)
  }

  const trained = snapshot.world.agents.map((agent) => getBrain(agent.id))
  const learnedSteps = trained.reduce((sum, brain) => sum + (brain?.totalSteps ?? 0), 0)
  const learnedStates = trained.reduce((sum, brain) => sum + (brain?.qTable.size ?? 0), 0)
  const qChanged = trained.some((brain) => {
    if (!brain) return false
    for (const values of brain.qTable.values()) {
      if (values.some((value) => value !== 0)) return true
    }
    return false
  })

  assert(learnedSteps > 0, 'learning steps should increase while learning is on')
  assert(learnedStates > 0, 'visited states should grow while learning is on')
  assert(qChanged, 'Q-table values should change after real experience')

  const frozenTables = trained.map((brain) => {
    const copy = new Map<string, number[]>()
    if (!brain) return copy
    for (const [key, values] of brain.qTable) {
      copy.set(key, values.slice())
    }
    return copy
  })
  const frozenSteps = trained.map((brain) => brain?.totalSteps ?? 0)
  const frozenEpsilon = trained.map((brain) => brain?.epsilon ?? 0)

  const frozenContext = {
    ...learnContext,
    learningEnabled: false,
    rng: mulberry32(99),
  }

  for (let i = 0; i < 40; i += 1) {
    snapshot = stepSimulation(snapshot, SIMULATION_STEP_DT, frozenContext)
  }

  snapshot.world.agents.forEach((agent, index) => {
    const brain = getBrain(agent.id)
    const previous = frozenTables[index]
    if (!brain || !previous) {
      throw new Error('brain should still exist after freeze')
    }
    assert(brain.totalSteps === frozenSteps[index], 'learning steps must freeze when learning is off')
    assert(brain.epsilon === frozenEpsilon[index], 'epsilon must freeze when learning is off')
    assert(brain.qTable.size === previous.size, 'Q-table size must freeze when learning is off')

    for (const [key, values] of brain.qTable) {
      const beforeValues = previous.get(key)
      if (!beforeValues) {
        throw new Error('Q-table keys must not change when learning is off')
      }
      assert(
        values.every((value, valueIndex) => value === beforeValues[valueIndex]),
        'Q-table values must not change when learning is off',
      )
    }
  })
}

function nearbyFoodIsConsumedWithoutEatAction(): void {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 1,
  })
  const agent = world.agents[0]
  const food = world.objects.find((object) => object.type === 'food')
  if (!agent || !food) {
    throw new Error('expected an agent and food')
  }

  const placed = {
    ...agent,
    position: { x: food.position.x + FOOD_EAT_RADIUS * 0.4, z: food.position.z },
    energy: 40,
    hunger: 70,
  }

  let calls = 0
  const snapshot = stepSimulation(
    { tick: 0, world: { ...world, agents: [placed] } },
    SIMULATION_STEP_DT,
    {
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      rng: () => {
        calls += 1
        if (calls === 1) return 0
        if (calls === 2) return 0.95
        return 0.5
      },
    },
  )

  const nextAgent = snapshot.world.agents[0]
  assert(nextAgent !== undefined, 'agent should still exist after contact eat')
  assert(nextAgent?.lastAction === 'REST', `expected REST, got ${nextAgent?.lastAction}`)
  assert(nextAgent !== undefined && nextAgent.energy > 40, 'contact eat must restore energy')
  assert(
    snapshot.world.objects.every((object) => object.id !== food.id),
    'food next to an agent must be consumed',
  )
}

function earlyLearningDoesNotWipeOut(): void {
  const world = createInitialWorld()
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)

  let snapshot = { tick: 0, world }
  const learnContext = {
    learningEnabled: true,
    learningConfig: DEFAULT_LEARNING_CONFIG,
    rewardConfig: DEFAULT_REWARD_CONFIG,
    rng: mulberry32(7),
  }

  for (let i = 0; i < 90 * 20; i += 1) {
    snapshot = stepSimulation(snapshot, SIMULATION_STEP_DT, learnContext)
  }

  const aliveCount = snapshot.world.agents.filter((agent) => agent.alive).length
  assert(!isPopulationExtinct(snapshot.world.agents), 'early learning must not wipe out the population')
  assert(aliveCount >= 16, `expected at least 16 survivors after 90s, got ${aliveCount}`)
}

function learningHistoryIsCappedAndHonest(): void {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 4,
  })
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)

  let history = createLearningHistory(0, world.agents, true)
  assert(history.series.length === 1, 'reset/create should record a real baseline sample')
  assert(compareLearningWindows(history) === null, 'comparison must wait for non-overlapping windows')

  const lastTick = LEARNING_HISTORY_SAMPLE_TICKS * (LEARNING_HISTORY_MAX_POINTS + 8)
  for (let tick = LEARNING_HISTORY_SAMPLE_TICKS; tick <= lastTick; tick += LEARNING_HISTORY_SAMPLE_TICKS) {
    history = recordLearningHistory(history, tick, world.agents, true)
  }

  assert(
    history.series.length === LEARNING_HISTORY_MAX_POINTS,
    `history must stay capped at ${LEARNING_HISTORY_MAX_POINTS}, got ${history.series.length}`,
  )
  assert(
    history.earlySeries.length === LEARNING_COMPARISON_WINDOW,
    'early window must freeze after the first comparison window',
  )

  const sameTick = recordLearningHistory(
    history,
    history.series[history.series.length - 1]?.tick ?? 0,
    world.agents,
    true,
  )
  assert(sameTick === history, 'the same tick must not append another sample')

  const skipped = recordLearningHistory(history, lastTick + 1, world.agents, true)
  assert(skipped === history, 'off-interval ticks must not append samples')

  const comparison = compareLearningWindows(history)
  assert(comparison !== null, 'non-overlapping early/current windows should produce a comparison')
  assert(
    comparison !== null && comparison.current.fromTime > comparison.early.toTime,
    'current window must start after the frozen early window',
  )
}

function emptyHistoryDoesNotInventImprovement(): void {
  const history = createEmptyLearningHistory()
  assert(compareLearningWindows(history) === null, 'empty history must not invent a comparison')
}

function extinctPopulationIsDetected(): void {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 2,
  })
  assert(!isPopulationExtinct(world.agents), 'fresh world must have living agents')
  assert(
    isPopulationExtinct(world.agents.map((agent) => ({ ...agent, alive: false, health: 0 }))),
    'all-dead population must be extinct',
  )
}

export function runLearningChecks(): void {
  encodeIsDeterministic()
  qUpdateMatchesFormula()
  rewardsMatchEvents()
  epsilonGreedyExploresAndExploits()
  learningOffDoesNotWriteQTable()
  simulationUpdatesAndFreezes()
  nearbyFoodIsConsumedWithoutEatAction()
  earlyLearningDoesNotWipeOut()
  learningHistoryIsCappedAndHonest()
  emptyHistoryDoesNotInventImprovement()
  extinctPopulationIsDetected()
}

runLearningChecks()
console.log('learning checks passed')
