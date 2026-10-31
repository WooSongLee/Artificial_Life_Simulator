import type { Agent } from '../types/agent'
import type { WorldObject, WorldState } from '../types/world'
import { clamp, clampStat, finiteNumber, wrapAngle } from '../utils/math'

export function sanitizeAgent(agent: Agent): Agent {
  const health = clampStat(agent.health)
  const alive = agent.alive && health > 0
  const x = finiteNumber(agent.position.x)
  const z = finiteNumber(agent.position.z)

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
    deathCause: alive ? null : (agent.deathCause ?? 'health'),
    matingPartnerId: alive ? agent.matingPartnerId : null,
    matingTimeLeft: alive ? Math.max(0, finiteNumber(agent.matingTimeLeft)) : 0,
    lastReward: finiteNumber(agent.lastReward),
  }
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
  return {
    ...world,
    foodSpawnCooldown: finiteNumber(world.foodSpawnCooldown),
    generation: Math.max(1, Math.round(finiteNumber(world.generation, 1))),
    generationStartTick: Math.max(0, Math.round(finiteNumber(world.generationStartTick))),
    birthCount: Math.max(0, Math.round(finiteNumber(world.birthCount))),
    objects: world.objects.map(sanitizeObject),
    agents: world.agents.map(sanitizeAgent),
  }
}
