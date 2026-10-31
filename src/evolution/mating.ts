import { createAgent, pruneDeadAgents } from '../simulation/agentFactory'
import type { Agent } from '../types/agent'
import type { WorldState } from '../types/world'
import { distanceSq } from '../utils/math'
import type { Rng } from '../utils/random'
import {
  DESIRE_AFTER_MATING,
  DESIRE_MATE_THRESHOLD,
  MATING_DURATION,
  MATING_RANGE,
  MAX_DEAD_AGENTS,
} from './constants'
import { breedChild, canStartMating, isMating } from './reproduction'
import type { EvolutionConfig } from './types'

export interface MatingTickResult {
  world: WorldState
  born: Agent[]
  recordedGeneration: number | null
  recordedGenerationStartTick: number | null
  removedAgentIds: string[]
}

export function countMatingPairs(agents: readonly Agent[]): number {
  let pairs = 0
  const seen = new Set<string>()

  for (const agent of agents) {
    if (!isMating(agent) || !agent.matingPartnerId || seen.has(agent.id)) continue
    seen.add(agent.id)
    seen.add(agent.matingPartnerId)
    pairs += 1
  }

  return pairs
}

export function findNearestMate(agent: Agent, agents: readonly Agent[]): Agent | null {
  let nearest: Agent | null = null
  let best = Number.POSITIVE_INFINITY
  const visionSq = agent.vision * agent.vision

  for (const other of agents) {
    if (other.id === agent.id || !canStartMating(other)) continue
    const dist = distanceSq(agent.position.x, agent.position.z, other.position.x, other.position.z)
    if (dist > visionSq || dist >= best) continue
    best = dist
    nearest = other
  }

  return nearest
}

function pairNearbyMates(agents: Agent[]): Agent[] {
  const next = agents.slice()
  const claimed = new Set<string>()
  const matingRangeSq = MATING_RANGE * MATING_RANGE

  const eligible = next
    .map((agent, index) => ({ agent, index }))
    .filter(({ agent }) => canStartMating(agent))
    .sort((left, right) => right.agent.desire - left.agent.desire)

  for (const { agent, index } of eligible) {
    if (claimed.has(agent.id)) continue

    let partnerIndex = -1
    let best = Number.POSITIVE_INFINITY

    for (const candidate of eligible) {
      if (candidate.agent.id === agent.id || claimed.has(candidate.agent.id)) continue
      const dist = distanceSq(
        agent.position.x,
        agent.position.z,
        candidate.agent.position.x,
        candidate.agent.position.z,
      )
      if (dist > matingRangeSq || dist >= best) continue
      best = dist
      partnerIndex = candidate.index
    }

    if (partnerIndex < 0) continue
    const partner = next[partnerIndex]
    if (!partner) continue

    claimed.add(agent.id)
    claimed.add(partner.id)
    next[index] = {
      ...agent,
      matingPartnerId: partner.id,
      matingTimeLeft: MATING_DURATION,
    }
    next[partnerIndex] = {
      ...partner,
      matingPartnerId: agent.id,
      matingTimeLeft: MATING_DURATION,
    }
  }

  return next
}

function clearMating(agent: Agent, desire = agent.desire): Agent {
  return {
    ...agent,
    desire,
    matingPartnerId: null,
    matingTimeLeft: 0,
  }
}

function finishMatingPairs(
  world: WorldState,
  agents: Agent[],
  config: EvolutionConfig,
  rng: Rng,
): { agents: Agent[]; born: Agent[]; recordedGeneration: number | null; birthCount: number } {
  const next = agents.slice()
  const born: Agent[] = []
  let recordedGeneration: number | null = null
  let birthCount = world.birthCount
  const finished = new Set<string>()
  const livingCount = () => next.filter((agent) => agent.alive).length + born.filter((agent) => agent.alive).length

  for (let index = 0; index < next.length; index += 1) {
    const agent = next[index]
    if (!agent || finished.has(agent.id)) continue
    if (!agent.matingPartnerId || agent.matingTimeLeft > 0) continue

    const partnerIndex = next.findIndex((other) => other.id === agent.matingPartnerId)
    const partner = partnerIndex >= 0 ? next[partnerIndex] : undefined
    finished.add(agent.id)

    if (!partner || partner.matingPartnerId !== agent.id) {
      next[index] = clearMating(agent, DESIRE_AFTER_MATING)
      continue
    }

    finished.add(partner.id)
    const bothAlive = agent.alive && partner.alive
    next[index] = clearMating(agent, DESIRE_AFTER_MATING)
    next[partnerIndex] = clearMating(partner, DESIRE_AFTER_MATING)

    if (!bothAlive || livingCount() >= config.populationLimit) continue

    const blueprint = breedChild(agent, partner, config, rng)
    const child = createAgent(
      { ...world, agents: [...next, ...born] },
      [...next, ...born],
      rng,
      {
        genome: blueprint.genome,
        generation: Math.max(agent.generation, partner.generation) + 1,
        parentIds: blueprint.parentIds,
        inheritParentId: blueprint.inheritParentId,
        mutatedGenes: blueprint.mutatedGenes,
        near: {
          x: (agent.position.x + partner.position.x) / 2,
          z: (agent.position.z + partner.position.z) / 2,
        },
      },
    )
    born.push(child)
    birthCount += 1
    if (child.generation > world.generation && recordedGeneration === null) {
      recordedGeneration = world.generation
    }
  }

  return {
    agents: [...next, ...born],
    born,
    recordedGeneration,
    birthCount,
  }
}

export function processMating(
  world: WorldState,
  tick: number,
  config: EvolutionConfig,
  rng: Rng,
): MatingTickResult {
  const paired = pairNearbyMates(world.agents)
  const finished = finishMatingPairs({ ...world, agents: paired }, paired, config, rng)
  const generation = finished.born.reduce(
    (max, child) => Math.max(max, child.generation),
    world.generation,
  )
  const pruned = pruneDeadAgents(finished.agents, MAX_DEAD_AGENTS)

  return {
    world: {
      ...world,
      agents: pruned.agents,
      generation,
      generationStartTick: generation > world.generation ? tick : world.generationStartTick,
      birthCount: finished.birthCount,
    },
    born: finished.born,
    recordedGeneration: finished.recordedGeneration,
    recordedGenerationStartTick:
      finished.recordedGeneration === null ? null : world.generationStartTick,
    removedAgentIds: pruned.removedIds,
  }
}

export function shouldSeekMate(agent: Agent): boolean {
  return canStartMating(agent) && agent.desire >= DESIRE_MATE_THRESHOLD
}
