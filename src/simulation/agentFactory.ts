import { createRandomGenome } from '../evolution/genome'
import type { Genome, GenomeGene } from '../evolution/types'
import type { Agent } from '../types/agent'
import type { WorldState } from '../types/world'
import { createId } from '../utils/id'
import { distanceSq } from '../utils/math'
import { randomInRange, type Rng } from '../utils/random'
import {
  AGENT_ENERGY_RANGE,
  AGENT_HEALTH_RANGE,
  AGENT_HUNGER_RANGE,
  AGENT_TURN_RATE_RANGE,
  AGENT_WANDER_INTERVAL_RANGE,
} from './constants'
import { findOpenPosition, isBlockedSpawn } from './spatial'

export interface CreateAgentOptions {
  genome?: Genome
  generation?: number
  parentIds?: [string, string] | null
  inheritParentId?: string | null
  mutatedGenes?: GenomeGene[]
}

const AGENT_SPACING = 1.7

function isTooCloseToAgents(agents: Agent[], x: number, z: number): boolean {
  return agents.some((agent) => {
    return distanceSq(agent.position.x, agent.position.z, x, z) < AGENT_SPACING * AGENT_SPACING
  })
}

export function createAgent(
  world: WorldState,
  existing: Agent[],
  rng: Rng,
  options: CreateAgentOptions = {},
): Agent {
  const { x, z } = findOpenPosition(
    rng,
    world.config,
    (px, pz) => isBlockedSpawn(px, pz, world.objects) || isTooCloseToAgents(existing, px, pz),
    0.4,
  )

  const wanderInterval = randomInRange(
    rng,
    AGENT_WANDER_INTERVAL_RANGE[0],
    AGENT_WANDER_INTERVAL_RANGE[1],
  )
  const genome = options.genome ?? createRandomGenome(rng)

  return {
    id: createId('agent'),
    position: { x, z },
    rotation: randomInRange(rng, 0, Math.PI * 2),
    energy: randomInRange(rng, AGENT_ENERGY_RANGE[0], AGENT_ENERGY_RANGE[1]),
    hunger: randomInRange(rng, AGENT_HUNGER_RANGE[0], AGENT_HUNGER_RANGE[1]),
    health: randomInRange(rng, AGENT_HEALTH_RANGE[0], AGENT_HEALTH_RANGE[1]),
    speed: genome.speed,
    vision: genome.vision,
    age: 0,
    alive: true,
    generation: options.generation ?? world.generation,
    parentIds: options.parentIds ?? null,
    inheritParentId: options.inheritParentId ?? null,
    genome,
    mutatedGenes: options.mutatedGenes ?? [],
    turnRate: randomInRange(rng, AGENT_TURN_RATE_RANGE[0], AGENT_TURN_RATE_RANGE[1]),
    turnBias: rng() < 0.5 ? -1 : 1,
    wanderTimer: randomInRange(rng, 0.1, wanderInterval),
    wanderInterval,
    lastAction: null,
    lastReward: 0,
    lastStateKey: null,
  }
}

export function createInitialAgents(
  world: WorldState,
  rng: Rng,
  count = world.config.agentCount,
): Agent[] {
  const agents: Agent[] = []

  for (let i = 0; i < count; i += 1) {
    agents.push(createAgent(world, agents, rng))
  }

  return agents
}

export function trimAgents(agents: Agent[], count: number): Agent[] {
  if (agents.length <= count) return agents

  const alive = agents.filter((agent) => agent.alive)
  if (alive.length >= count) {
    return alive.slice(0, count)
  }

  const dead = agents.filter((agent) => !agent.alive)
  return [...alive, ...dead.slice(0, count - alive.length)]
}
