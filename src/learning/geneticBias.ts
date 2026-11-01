import { CAUTION_HEALTH_THRESHOLD, GENE_DEFAULTS, GENETIC_BIAS_MAX, GENETIC_BIAS_SCALE } from '../evolution/constants'
import { clampGene } from '../evolution/genome'
import { agentSeparation, findNearestLivingAgent, isInAttackRange } from '../simulation/combat'
import type { Agent } from '../types/agent'
import type { WorldState } from '../types/world'
import { clamp } from '../utils/math'
import { actionIndex, ACTION_COUNT, createEmptyQValues } from './qLearning'
import { AGENT_ACTIONS, type AgentAction } from './types'

export function agentAggression(agent: Agent): number {
  const value = agent.genome.aggression
  return Number.isFinite(value) ? clampGene('aggression', value) : GENE_DEFAULTS.aggression
}

export function agentCaution(agent: Agent): number {
  const value = agent.genome.caution
  return Number.isFinite(value) ? clampGene('caution', value) : GENE_DEFAULTS.caution
}

export function clampGeneticBias(value: number): number {
  return clamp(value, -GENETIC_BIAS_MAX, GENETIC_BIAS_MAX)
}

export function personalityOffset(value: number): number {
  return clampGeneticBias((value - 1) * GENETIC_BIAS_SCALE)
}

export function hasCombatThreat(agent: Agent, world: WorldState): boolean {
  return findNearestLivingAgent(agent, world) !== null
}

export function hasCloseThreat(agent: Agent, world: WorldState): boolean {
  const threat = findNearestLivingAgent(agent, world)
  return threat !== null && isInAttackRange(agent, threat)
}

export function isLowHealth(agent: Agent): boolean {
  return agent.health <= CAUTION_HEALTH_THRESHOLD
}

export function geneticActionBias(agent: Agent, world: WorldState): number[] {
  const bias = createEmptyQValues()
  const threat = findNearestLivingAgent(agent, world)
  if (threat) {
    bias[actionIndex('ATTACK')] = personalityOffset(agentAggression(agent))
  }

  const closeThreat = threat !== null && (isInAttackRange(agent, threat) || agentSeparation(agent, threat) <= 2.8)
  if (isLowHealth(agent) || closeThreat) {
    const cautionBias = personalityOffset(agentCaution(agent))
    bias[actionIndex('DEFEND')] = cautionBias
    bias[actionIndex('FLEE')] = cautionBias
  }

  return bias
}

export function selectionScoresFrom(qValues: readonly number[], geneticBias: readonly number[]): number[] {
  const scores = new Array<number>(ACTION_COUNT)
  for (let index = 0; index < ACTION_COUNT; index += 1) {
    const q = qValues[index]
    const bias = geneticBias[index]
    scores[index] = (Number.isFinite(q) ? (q as number) : 0) + (Number.isFinite(bias) ? (bias as number) : 0)
  }
  return scores
}

export function biasByAction(geneticBias: readonly number[]): Record<AgentAction, number> {
  const record = {} as Record<AgentAction, number>
  for (const action of AGENT_ACTIONS) {
    const value = geneticBias[actionIndex(action)]
    record[action] = Number.isFinite(value) ? (value as number) : 0
  }
  return record
}
