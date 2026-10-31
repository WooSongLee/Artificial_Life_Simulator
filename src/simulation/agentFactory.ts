import type { Agent } from '../types/agent'
import type { WorldState } from '../types/world'
import { createId } from '../utils/id'
import { distanceSq } from '../utils/math'
import { randomInRange, type Rng } from '../utils/random'
import {
  INITIAL_AGENT_COUNT,
  AGENT_ENERGY_RANGE,
  AGENT_HEALTH_RANGE,
  AGENT_HUNGER_RANGE,
  AGENT_SPEED_RANGE,
  AGENT_TURN_RATE_RANGE,
  AGENT_VISION_RANGE,
  AGENT_WANDER_INTERVAL_RANGE,
} from './constants'
import { findOpenPosition, isBlockedSpawn } from './spatial'

const AGENT_SPACING = 1.7

function isTooCloseToAgents(agents: Agent[], x: number, z: number): boolean {
  return agents.some((agent) => {
    return distanceSq(agent.position.x, agent.position.z, x, z) < AGENT_SPACING * AGENT_SPACING
  })
}

export function createAgent(world: WorldState, existing: Agent[], rng: Rng): Agent {
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

  return {
    id: createId('agent'),
    position: { x, z },
    rotation: randomInRange(rng, 0, Math.PI * 2),
    energy: randomInRange(rng, AGENT_ENERGY_RANGE[0], AGENT_ENERGY_RANGE[1]),
    hunger: randomInRange(rng, AGENT_HUNGER_RANGE[0], AGENT_HUNGER_RANGE[1]),
    health: randomInRange(rng, AGENT_HEALTH_RANGE[0], AGENT_HEALTH_RANGE[1]),
    speed: randomInRange(rng, AGENT_SPEED_RANGE[0], AGENT_SPEED_RANGE[1]),
    vision: randomInRange(rng, AGENT_VISION_RANGE[0], AGENT_VISION_RANGE[1]),
    age: 0,
    alive: true,
    turnRate: randomInRange(rng, AGENT_TURN_RATE_RANGE[0], AGENT_TURN_RATE_RANGE[1]),
    turnBias: rng() < 0.5 ? -1 : 1,
    wanderTimer: randomInRange(rng, 0.1, wanderInterval),
    wanderInterval,
    lastAction: null,
    lastReward: 0,
    lastStateKey: null,
  }
}

export function createInitialAgents(world: WorldState, rng: Rng): Agent[] {
  const agents: Agent[] = []

  for (let i = 0; i < INITIAL_AGENT_COUNT; i += 1) {
    agents.push(createAgent(world, agents, rng))
  }

  return agents
}
