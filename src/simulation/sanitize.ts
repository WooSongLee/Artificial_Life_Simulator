import { normalizeGenome } from '../evolution/genome'
import type { Genome } from '../evolution/types'
import type { Agent, DeathCause } from '../types/agent'
import type { WorldObject, WorldState } from '../types/world'
import { clamp, clampStat, finiteNumber, wrapAngle } from '../utils/math'
import { clampWorldConfig } from './constants'
import { sanitizeEquipment, sanitizeForageNode, sanitizeWorldTool } from './forage'
import { sanitizeInteractables } from './interactables'
import { enforceLabPopulation } from './labMode'
import { sanitizeOutcomeStats } from './outcomes'
import { generateTerrainGrid, isValidTerrainGrid } from './terrain'

export function sanitizeAgent(agent: Agent): Agent {
  const health = clampStat(agent.health)
  const alive = agent.alive && health > 0
  const x = finiteNumber(agent.position.x)
  const z = finiteNumber(agent.position.z)
  const genome = normalizeGenome(agent.genome)

  return {
    ...agent,
    position: { x, z },
    rotation: wrapAngle(agent.rotation),
    energy: clampStat(agent.energy),
    hunger: clampStat(agent.hunger),
    health: alive ? health : 0,
    speed: clamp(agent.speed, 0, 20),
    vision: clamp(agent.vision, 0, 40),
    age: Math.max(0, finiteNumber(agent.age)),
    maxLifespan: Math.max(1, finiteNumber(agent.maxLifespan, 1)),
    desire: clampStat(agent.desire),
    alive,
    deathCause: alive ? null : sanitizeDeathCause(agent.deathCause),
    matingPartnerId: alive ? agent.matingPartnerId : null,
    matingTimeLeft: alive ? Math.max(0, finiteNumber(agent.matingTimeLeft)) : 0,
    lastReward: finiteNumber(agent.lastReward),
    equipment: sanitizeEquipment(agent.equipment),
    defendTimeLeft: alive ? Math.max(0, finiteNumber(agent.defendTimeLeft)) : 0,
    attackCooldownLeft: alive ? Math.max(0, finiteNumber(agent.attackCooldownLeft)) : 0,
    lastAttackerId: typeof agent.lastAttackerId === 'string' ? agent.lastAttackerId : null,
    lastCombatTick: Math.max(0, Math.round(finiteNumber(agent.lastCombatTick))),
    combatCue: alive ? agent.combatCue : null,
    actionTarget: alive ? sanitizeActionTarget(agent.actionTarget) : null,
    genome,
    parentGenomes: sanitizeParentGenomes(agent.parentGenomes),
  }
}

function sanitizeParentGenomes(
  value: Agent['parentGenomes'] | undefined,
): [Genome, Genome] | null {
  if (!value || value.length !== 2) return null
  return [normalizeGenome(value[0]), normalizeGenome(value[1])]
}

export function sanitizeObject(object: WorldObject): WorldObject {
  return {
    ...object,
    position: {
      x: finiteNumber(object.position.x),
      y: finiteNumber(object.position.y),
      z: finiteNumber(object.position.z),
    },
    scale: clamp(object.scale, 0.1, 8),
    rotation: wrapAngle(object.rotation),
  }
}

export function sanitizeWorld(world: WorldState): WorldState {
  const config = clampWorldConfig(world.config)
  const terrain = isValidTerrainGrid(world.terrain, config.size)
    ? world.terrain
    : generateTerrainGrid(config)

  return enforceLabPopulation({
    ...world,
    config,
    terrain,
    foodSpawnCooldown: finiteNumber(world.foodSpawnCooldown),
    forageSpawnCooldown: finiteNumber(world.forageSpawnCooldown),
    generation: Math.max(1, Math.round(finiteNumber(world.generation, 1))),
    generationStartTick: Math.max(0, Math.round(finiteNumber(world.generationStartTick))),
    birthCount: Math.max(0, Math.round(finiteNumber(world.birthCount))),
    outcomeStats: sanitizeOutcomeStats(world.outcomeStats),
    objects: world.objects.map(sanitizeObject),
    forageNodes: (world.forageNodes ?? []).map(sanitizeForageNode),
    worldTools: (world.worldTools ?? []).map(sanitizeWorldTool),
    interactables: sanitizeInteractables(world.interactables),
    agents: world.agents.map(sanitizeAgent),
  })
}

function sanitizeActionTarget(value: Agent['actionTarget']): Agent['actionTarget'] {
  if (!value) return null
  const x = finiteNumber(value.x)
  const z = finiteNumber(value.z)
  return {
    kind: typeof value.kind === 'string' && value.kind.length > 0 ? value.kind : 'unknown',
    id: typeof value.id === 'string' ? value.id : null,
    x,
    z,
  }
}

function sanitizeDeathCause(cause: Agent['deathCause']): DeathCause {
  if (cause === 'age' || cause === 'combat' || cause === 'health') return cause
  return 'health'
}
