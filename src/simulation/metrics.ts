import { mean, summarizeLearning } from '../learning/brain'
import type { Agent } from '../types/agent'
import type { LearningHistoryPoint, LearningHistoryState } from '../types/simulation'
import { summarizeAgents } from '../utils/agentStats'
import {
  LEARNING_COMPARISON_WINDOW,
  LEARNING_HISTORY_MAX_POINTS,
  LEARNING_HISTORY_SAMPLE_TICKS,
  SIMULATION_STEP_DT,
} from './constants'

export interface ComparisonWindow {
  fromTime: number
  toTime: number
  sampleCount: number
  averageReward: number | null
  averageSurvivalTime: number | null
  averageEnergy: number
  explorationRate: number | null
  learningSteps: number
  populationSize: number
}

export interface LearningComparison {
  early: ComparisonWindow
  current: ComparisonWindow
}

export function createEmptyLearningHistory(): LearningHistoryState {
  return {
    series: [],
    earlySeries: [],
  }
}

export function collectLearningSample(
  tick: number,
  agents: Agent[],
  learningEnabled: boolean,
): LearningHistoryPoint {
  const learning = summarizeLearning(agents, learningEnabled)
  const population = summarizeAgents(agents)

  return {
    tick,
    time: tick * SIMULATION_STEP_DT,
    averageReward: learning.averageReward,
    averageSurvivalTime: population.averageLifespan,
    averageEnergy: population.averageEnergy,
    learningSteps: learning.totalLearningSteps,
    explorationRate: learning.explorationRate,
    populationSize: population.aliveCount,
    hasLearningSamples: learning.hasLearningSamples,
    hasSurvivalSamples: population.deadCount > 0,
  }
}

export function createLearningHistory(
  tick: number,
  agents: Agent[],
  learningEnabled: boolean,
): LearningHistoryState {
  return recordLearningHistory(createEmptyLearningHistory(), tick, agents, learningEnabled, true)
}

export function recordLearningHistory(
  previous: LearningHistoryState,
  tick: number,
  agents: Agent[],
  learningEnabled: boolean,
  force = false,
): LearningHistoryState {
  if (!force && tick % LEARNING_HISTORY_SAMPLE_TICKS !== 0) {
    return previous
  }

  const last = previous.series[previous.series.length - 1]
  if (last && last.tick === tick) {
    return previous
  }

  const point = collectLearningSample(tick, agents, learningEnabled)
  const series =
    previous.series.length < LEARNING_HISTORY_MAX_POINTS
      ? [...previous.series, point]
      : [...previous.series.slice(previous.series.length - LEARNING_HISTORY_MAX_POINTS + 1), point]
  const earlySeries =
    previous.earlySeries.length >= LEARNING_COMPARISON_WINDOW
      ? previous.earlySeries
      : [...previous.earlySeries, point]

  return { series, earlySeries }
}

export function summarizeWindow(points: readonly LearningHistoryPoint[]): ComparisonWindow | null {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return null

  const rewardPoints = points.filter((point) => point.hasLearningSamples)
  const survivalPoints = points.filter((point) => point.hasSurvivalSamples)
  const explorePoints = points.filter((point) => point.hasLearningSamples)

  return {
    fromTime: first.time,
    toTime: last.time,
    sampleCount: points.length,
    averageReward: rewardPoints.length === 0 ? null : mean(rewardPoints.map((point) => point.averageReward)),
    averageSurvivalTime:
      survivalPoints.length === 0 ? null : mean(survivalPoints.map((point) => point.averageSurvivalTime)),
    averageEnergy: mean(points.map((point) => point.averageEnergy)),
    explorationRate:
      explorePoints.length === 0 ? null : mean(explorePoints.map((point) => point.explorationRate)),
    learningSteps: last.learningSteps - first.learningSteps,
    populationSize: mean(points.map((point) => point.populationSize)),
  }
}

export function compareLearningWindows(history: LearningHistoryState): LearningComparison | null {
  if (history.earlySeries.length < LEARNING_COMPARISON_WINDOW) return null
  if (history.series.length < LEARNING_COMPARISON_WINDOW) return null

  const recent = history.series.slice(-LEARNING_COMPARISON_WINDOW)
  const earlyEnd = history.earlySeries[history.earlySeries.length - 1]
  const recentStart = recent[0]
  if (!earlyEnd || !recentStart || recentStart.tick <= earlyEnd.tick) {
    return null
  }

  const early = summarizeWindow(history.earlySeries)
  const current = summarizeWindow(recent)
  if (!early || !current) return null

  return { early, current }
}
