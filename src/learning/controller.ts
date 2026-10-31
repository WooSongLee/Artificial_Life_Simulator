import type { Agent } from '../types/agent'
import type { WorldState } from '../types/world'
import type { Rng } from '../utils/random'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from './constants'
import { ensureBrain, recordLearningStep } from './brain'
import { encodeObservation, observeAgent } from './observation'
import {
  actionIndex,
  decayEpsilon,
  getOrCreateQValues,
  maxQValue,
  peekQValues,
  selectEpsilonGreedy,
  updateQValue,
} from './qLearning'
import { computeReward } from './rewards'
import type { ActionOutcome, LearningConfig, RewardConfig } from './types'

export interface LearningStepContext {
  learningEnabled: boolean
  learningConfig: LearningConfig
  rewardConfig: RewardConfig
  rng: Rng
}

export const DEFAULT_LEARNING_CONTEXT: LearningStepContext = {
  learningEnabled: true,
  learningConfig: DEFAULT_LEARNING_CONFIG,
  rewardConfig: DEFAULT_REWARD_CONFIG,
  rng: Math.random,
}

export function decideAction(agent: Agent, world: WorldState, context: LearningStepContext) {
  const observation = observeAgent(agent, world)
  const stateKey = encodeObservation(observation)
  const brain = ensureBrain(agent.id, context.learningConfig)
  const qValues = peekQValues(brain.qTable, stateKey)
  const selection = selectEpsilonGreedy(qValues, brain.epsilon, context.rng)
  return { observation, stateKey, brain, selection }
}

export function applyLearningUpdate(
  agent: Agent,
  world: WorldState,
  previousStateKey: string,
  outcome: ActionOutcome,
  energyBefore: number,
  hungerBefore: number,
  foodInEatRange: boolean,
  explored: boolean,
  context: LearningStepContext,
): number {
  const reward = computeReward(
    {
      action: outcome.action,
      ate: outcome.ate,
      collided: outcome.collided,
      died: outcome.died,
      energyBefore,
      hungerBefore,
      foodInEatRange,
    },
    context.rewardConfig,
  )

  if (!context.learningEnabled) {
    return reward
  }

  const brain = ensureBrain(agent.id, context.learningConfig)
  const qValues = getOrCreateQValues(brain.qTable, previousStateKey)
  const index = actionIndex(outcome.action)
  const nextMax = outcome.died ? 0 : maxQValue(peekQValues(brain.qTable, encodeObservation(observeAgent(agent, world))))

  qValues[index] = updateQValue(
    qValues[index] ?? 0,
    reward,
    nextMax,
    context.learningConfig.learningRate,
    context.learningConfig.discountFactor,
  )

  brain.epsilon = decayEpsilon(
    brain.epsilon,
    context.learningConfig.epsilonDecay,
    context.learningConfig.minEpsilon,
  )
  recordLearningStep(brain, outcome.action, reward, explored)

  return reward
}
