import { SIMULATION_STEP_DT } from '../simulation/constants'
import { stepSimulation } from '../simulation/engine'
import { createInitialWorld } from '../simulation/worldFactory'
import { mulberry32 } from '../utils/random'
import { getBrain, resetBrains } from './brain'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from './constants'
import { applyLearningUpdate } from './controller'
import { encodeObservation, observeAgent } from './observation'
import { selectEpsilonGreedy, updateQValue } from './qLearning'
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
  assert(first.split('|').length === 5, 'state key must contain five discrete features')
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
      },
      DEFAULT_REWARD_CONFIG,
    ) === -1,
    'unnecessary movement must award -1',
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
  assert(brain?.epsilon === DEFAULT_LEARNING_CONFIG.initialEpsilon, 'learning off must not decay epsilon')
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

export function runLearningChecks(): void {
  encodeIsDeterministic()
  qUpdateMatchesFormula()
  rewardsMatchEvents()
  epsilonGreedyExploresAndExploits()
  learningOffDoesNotWriteQTable()
  simulationUpdatesAndFreezes()
}

runLearningChecks()
console.log('learning checks passed')
