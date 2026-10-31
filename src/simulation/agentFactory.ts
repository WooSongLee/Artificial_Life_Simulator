import { createRandomGenome } from '../evolution/genome'
import type { Genome, GenomeGene } from '../evolution/types'
import type { Agent, AgentPosition } from '../types/agent'
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
import { findOpenPosition, isBlockedSpawn, isInsideWorld } from './spatial'

export interface CreateAgentOptions {
  genome?: Genome
  generation?: number
  parentIds?: [string, string] | null
  inheritParentId?: string | null
  mutatedGenes?: GenomeGene[]
  learningDefaults?: Pick<Genome, 'learningRate' | 'explorationRate'>
  near?: AgentPosition
}

const AGENT_SPACING = 1.7

function isTooCloseToAgents(agents: Agent[], x: number, z: number): boolean {
  return agents.some((agent) => {
    return distanceSq(agent.position.x, agent.position.z, x, z) < AGENT_SPACING * AGENT_SPACING
  })
}

function pickSpawnPosition(
  world: WorldState,
  existing: Agent[],
  rng: Rng,
  near?: AgentPosition,
): AgentPosition {
  const isBlocked = (px: number, pz: number) =>
    isBlockedSpawn(px, pz, world.objects) || isTooCloseToAgents(existing, px, pz)

  if (near) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const angle = rng() * Math.PI * 2
      const distance = randomInRange(rng, 0.8, 2.4)
      const x = near.x + Math.sin(angle) * distance
      const z = near.z + Math.cos(angle) * distance
      if (isInsideWorld(x, z, world.config.size) && !isBlocked(x, z)) {
        return { x, z }
      }
    }
  }

  return findOpenPosition(rng, world.config, isBlocked, 0.4)
}

export function createAgent(
  world: WorldState,
  existing: Agent[],
  rng: Rng,
  options: CreateAgentOptions = {},
): Agent {
  const { x, z } = pickSpawnPosition(world, existing, rng, options.near)

  const wanderInterval = randomInRange(
    rng,
    AGENT_WANDER_INTERVAL_RANGE[0],
    AGENT_WANDER_INTERVAL_RANGE[1],
  )
  const genome = options.genome ?? createRandomGenome(rng, options.learningDefaults)

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
    maxLifespan: genome.lifespan,
    desire: randomInRange(rng, 0, 22),
    alive: true,
    deathCause: null,
    generation: options.generation ?? world.generation,
    parentIds: options.parentIds ?? null,
    inheritParentId: options.inheritParentId ?? null,
    genome,
    mutatedGenes: options.mutatedGenes ?? [],
    turnRate: randomInRange(rng, AGENT_TURN_RATE_RANGE[0], AGENT_TURN_RATE_RANGE[1]),
    turnBias: rng() < 0.5 ? -1 : 1,
    wanderTimer: randomInRange(rng, 0.1, wanderInterval),
    wanderInterval,
    matingPartnerId: null,
    matingTimeLeft: 0,
    lastAction: null,
    lastReward: 0,
    lastStateKey: null,
  }
}

export function pruneDeadAgents(agents: Agent[], maxDead: number): {
  agents: Agent[]
  removedIds: string[]
} {
  const living = agents.filter((agent) => agent.alive)
  const dead = agents.filter((agent) => !agent.alive)
  if (dead.length <= maxDead) {
    return { agents, removedIds: [] }
  }

  const removed = dead.slice(0, dead.length - maxDead)
  const keptDead = dead.slice(dead.length - maxDead)
  return {
    agents: [...living, ...keptDead],
    removedIds: removed.map((agent) => agent.id),
  }
}

export function createInitialAgents(
  world: WorldState,
  rng: Rng,
  count = world.config.agentCount,
  learningDefaults?: CreateAgentOptions['learningDefaults'],
): Agent[] {
  const agents: Agent[] = []

  for (let i = 0; i < count; i += 1) {
    agents.push(createAgent(world, agents, rng, { learningDefaults }))
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
