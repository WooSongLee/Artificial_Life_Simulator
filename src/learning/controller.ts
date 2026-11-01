import type { Agent } from '../types/agent'
import type { WorldState } from '../types/world'
import type { Rng } from '../utils/random'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from './constants'
import { ensureBrain, recordLearningStep } from './brain'
import { isLegalAction, legalActionsFor } from './actionMask'
import { encodeObservation, observeAgent } from './observation'
import { geneticActionBias, selectionScoresFrom } from './geneticBias'
import {
  actionIndex,
  decayEpsilon,
  getOrCreateQValues,
  maxQValue,
  createEmptyQValues,
  peekQValues,
  selectEpsilonGreedy,
  updateQValue,
} from './qLearning'
import { computeReward } from './rewards'
import type { ActionOutcome, AgentAction, LearningConfig, RewardConfig } from './types'

export interface LearningStepContext {
  learningEnabled: boolean
  learningConfig: LearningConfig
  rewardConfig: RewardConfig
  rng: Rng
  tick?: number
  geneticsEnabled?: boolean
}

export const DEFAULT_LEARNING_CONTEXT: LearningStepContext = {
  learningEnabled: true,
  learningConfig: DEFAULT_LEARNING_CONFIG,
  rewardConfig: DEFAULT_REWARD_CONFIG,
  rng: Math.random,
  tick: 0,
}

export function decideAction(agent: Agent, world: WorldState, context: LearningStepContext) {
  const observation = observeAgent(agent, world)
  const stateKey = encodeObservation(observation)
  const brain = ensureBrain(agent.id, context.learningConfig, agent.genome.explorationRate)
  const qValues = peekQValues(brain.qTable, stateKey)
  const legalActions = legalActionsFor(agent, world)
  const geneticBias =
    context.geneticsEnabled === false ? createEmptyQValues() : geneticActionBias(agent, world)
  const selectionScores = selectionScoresFrom(qValues, geneticBias)
  const selection = selectEpsilonGreedy(
    qValues,
    brain.epsilon,
    context.rng,
    legalActions,
    selectionScores,
  )
  return {
    observation,
    stateKey,
    brain,
    selection,
    qValues,
    geneticBias,
    selectionScores,
    epsilon: brain.epsilon,
    legalActions,
  }
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
  legalActions?: readonly AgentAction[],
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
      gatheredAmount: outcome.gatheredAmount,
      pickedUp: outcome.pickedUpToolId !== null,
      damageDealt: outcome.damageDealt ?? 0,
      damageTaken: outcome.damageTaken ?? 0,
      damageReduced: outcome.damageReduced ?? 0,
      fledFarther: outcome.fledFarther ?? false,
      attackAttempted: outcome.action === 'ATTACK',
      attackHit: (outcome.damageDealt ?? 0) > 0,
    },
    context.rewardConfig,
  )

  if (!context.learningEnabled) {
    return reward
  }

  const legal = legalActions ?? legalActionsFor(agent, world)
  if (!isLegalAction(outcome.action, legal)) {
    return reward
  }

  const brain = ensureBrain(agent.id, context.learningConfig, agent.genome.explorationRate)
  const qValues = getOrCreateQValues(brain.qTable, previousStateKey)
  const index = actionIndex(outcome.action)
  const nextMax = outcome.died
    ? 0
    : maxQValue(
        peekQValues(brain.qTable, encodeObservation(observeAgent(agent, world))),
        legalActionsFor(agent, world),
      )

  qValues[index] = updateQValue(
    qValues[index] ?? 0,
    reward,
    nextMax,
    agent.genome.learningRate,
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
