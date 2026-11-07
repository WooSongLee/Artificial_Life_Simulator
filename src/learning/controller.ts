import type { Agent } from '../types/agent'
import type { WorldState } from '../types/world'
import type { Rng } from '../utils/random'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from './constants'
import { ensureBrain, recordLearningStep, recordRewardTelemetry } from './brain'
import { isLegalAction, legalActionsFor } from './actionMask'
import { combineActionBias, driveActionBias, exploreWeightsFor, hasLabDrives } from './driveBias'
import { effectsFromWorldConfig } from '../simulation/labConditions'
import {
  curriculumEpsilonDecay,
  curriculumEpsilonFloor,
  curriculumSeekBias,
  isDriveReliefTarget,
  labLearningCurriculum,
  scaleCurriculumBias,
  scaleCurriculumExploreWeights,
  scaleCurriculumReward,
} from './labCurriculum'
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
import { computeRewardBreakdown } from './rewards'
import type {
  ActionOutcome,
  AgentAction,
  FoodDirection,
  LearningConfig,
  RewardConfig,
} from './types'

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
  const rawDriveBias = driveActionBias(agent, world)
  const rawExplore = exploreWeightsFor(agent, world)
  // Selection teacher follows world tick so Learning & Frozen share the same curriculum clock.
  const selectionCurriculum = hasLabDrives(agent)
    ? labLearningCurriculum(context.tick ?? brain.totalSteps)
    : null
  const driveBias = selectionCurriculum
    ? combineActionBias(
        scaleCurriculumBias(rawDriveBias, selectionCurriculum),
        curriculumSeekBias(agent, world, selectionCurriculum),
      )
    : rawDriveBias
  const exploreWeights = selectionCurriculum
    ? scaleCurriculumExploreWeights(rawExplore, selectionCurriculum)
    : rawExplore
  const selectionScores = selectionScoresFrom(qValues, combineActionBias(geneticBias, driveBias))
  const epsilon = selectionCurriculum
    ? Math.max(brain.epsilon, curriculumEpsilonFloor(selectionCurriculum))
    : brain.epsilon
  const selection = selectEpsilonGreedy(
    qValues,
    epsilon,
    context.rng,
    legalActions,
    selectionScores,
    exploreWeights,
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
  driveBefore?: { fatigue?: number; curiosity?: number; comfort?: number },
  seekBefore?: { foodDirection?: FoodDirection; previousAction?: AgentAction | null },
): number {
  const rewardContext = {
    action: outcome.action,
    ate: outcome.ate,
    collided: outcome.collided,
    died: outcome.died,
    energyBefore,
    hungerBefore,
    foodInEatRange,
    gatheredAmount: outcome.gatheredAmount,
    pickedUp: outcome.pickedUpToolId !== null,
    interacted: outcome.interactedId != null,
    targetKind: outcome.targetKind,
    fatigueBefore: driveBefore?.fatigue,
    curiosityBefore: driveBefore?.curiosity,
    comfortBefore: driveBefore?.comfort,
    foodDirection: seekBefore?.foodDirection,
    previousAction: seekBefore?.previousAction,
    damageDealt: outcome.damageDealt ?? 0,
    damageTaken: outcome.damageTaken ?? 0,
    damageReduced: outcome.damageReduced ?? 0,
    fledFarther: outcome.fledFarther ?? false,
    attackAttempted: outcome.action === 'ATTACK',
    attackHit: (outcome.damageDealt ?? 0) > 0,
  }
  const breakdown = computeRewardBreakdown(rewardContext, context.rewardConfig)
  const combined = breakdown.total
  // Match prior curriculum split: seek = approach/turn shaping + spin penalty.
  const seek = breakdown.components.survivalSeek + breakdown.components.spinPenalty
  let reward = combined

  const brain = ensureBrain(agent.id, context.learningConfig, agent.genome.explorationRate)
  const lab = hasLabDrives(agent)
  const curriculum = lab ? labLearningCurriculum(
    // Peek steps before this update so phase matches decideAction.
    brain.totalSteps,
  ) : null
  if (curriculum) {
    // Scale base events and survival-seek separately so collision ≠ approach.
    // Only amplify positive seek in survival_primer; keep anti-spin penalties unscaled
    // so turning toward food is not crushed during the hunger ramp.
    const conditionEffects = effectsFromWorldConfig(world.config)
    const base = combined - seek
    const scaledBase = scaleCurriculumReward(
      base,
      {
        ate: outcome.ate,
        driveRelief:
          outcome.interactedId != null && isDriveReliefTarget(outcome.targetKind),
      },
      curriculum,
      conditionEffects,
    )
    const scaledSeek =
      seek > 0
        ? scaleCurriculumReward(
            seek,
            { ate: false, driveRelief: false, survivalSeek: true },
            curriculum,
            conditionEffects,
          )
        : seek
    reward = scaledBase + scaledSeek
  }

  // Raw component sums + applied reward (Learning On and Frozen).
  recordRewardTelemetry(brain, breakdown.components, reward)

  if (!context.learningEnabled) {
    return reward
  }

  const legal = legalActions ?? legalActionsFor(agent, world)
  if (!isLegalAction(outcome.action, legal)) {
    return reward
  }
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

  const epsilonDecay = curriculum
    ? curriculumEpsilonDecay(context.learningConfig.epsilonDecay, curriculum)
    : context.learningConfig.epsilonDecay
  brain.epsilon = decayEpsilon(brain.epsilon, epsilonDecay, context.learningConfig.minEpsilon)
  recordLearningStep(brain, outcome.action, reward, explored)

  return reward
}
