import type { Agent } from '../types/agent'
import type { AttackIntent, CombatCue, CombatHit } from '../types/combat'
import type { WorldTool } from '../types/forage'
import type { WorldState } from '../types/world'
import { createId } from '../utils/id'
import { clampStat, distanceSq, rotateTowards } from '../utils/math'
import {
  ATTACK_BASE_DAMAGE,
  ATTACK_COOLDOWN,
  ATTACK_RANGE,
  BASE_DEFEND_FACTOR,
  COMBAT_STRENGTH_DEFAULT,
  DEFEND_DURATION,
  FLEE_SUCCESS_MARGIN,
  SHIELD_DEFEND_FACTOR,
  SPEAR_ATTACK_RANGE,
  SPEAR_DAMAGE_MULTIPLIER,
} from './constants'
import { isUsableTool, toolWearCost, wearEquipment } from './forage'
import { canDetectAt } from './terrain'

export function agentSeparation(a: Agent, b: Agent): number {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)
}

export function findNearestLivingAgent(agent: Agent, world: WorldState): Agent | null {
  let nearest: Agent | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const other of world.agents) {
    if (other.id === agent.id || !other.alive || other.health <= 0) continue
    const dist = distanceSq(agent.position.x, agent.position.z, other.position.x, other.position.z)
    if (dist >= nearestDist) continue
    if (!canDetectAt(agent, other.position.x, other.position.z, world, dist)) continue
    nearest = other
    nearestDist = dist
  }

  return nearest
}

export function attackRangeFor(agent: Agent): number {
  return isUsableTool(agent.equipment, 'spear') ? SPEAR_ATTACK_RANGE : ATTACK_RANGE
}

export function isInAttackRange(attacker: Agent, target: Agent): boolean {
  return agentSeparation(attacker, target) <= attackRangeFor(attacker)
}

export function canAttemptAttack(agent: Agent, world: WorldState): boolean {
  if (agent.attackCooldownLeft > 0) return false
  return findNearestLivingAgent(agent, world) !== null
}

export function canDefendOrFlee(agent: Agent, world: WorldState): boolean {
  return findNearestLivingAgent(agent, world) !== null
}

export function isDefending(agent: Agent): boolean {
  return agent.alive && agent.defendTimeLeft > 0
}

export function agentStrength(agent: Agent): number {
  const value = agent.genome.strength
  return Number.isFinite(value) ? value : COMBAT_STRENGTH_DEFAULT
}

export function rawAttackDamage(attacker: Agent): number {
  const spear = isUsableTool(attacker.equipment, 'spear')
  return ATTACK_BASE_DAMAGE * agentStrength(attacker) * (spear ? SPEAR_DAMAGE_MULTIPLIER : 1)
}

export function defendFactor(defender: Agent): number {
  if (!isDefending(defender)) return 1
  return isUsableTool(defender.equipment, 'shield') ? SHIELD_DEFEND_FACTOR : BASE_DEFEND_FACTOR
}

export function tickCombatTimers(agent: Agent, dt: number): Agent {
  return {
    ...agent,
    defendTimeLeft: Math.max(0, agent.defendTimeLeft - dt),
    attackCooldownLeft: Math.max(0, agent.attackCooldownLeft - dt),
  }
}

export function applyDefend(agent: Agent): Agent {
  return {
    ...agent,
    defendTimeLeft: DEFEND_DURATION,
    combatCue: cueAt('defend', agent.id, agent.position.x, agent.position.z),
  }
}

export function applyFlee(
  agent: Agent,
  world: WorldState,
  dt: number,
  moveForward: (current: Agent) => { agent: Agent; collided: boolean },
): {
  agent: Agent
  collided: boolean
  fromId: string | null
  distanceBefore: number
  distanceAfter: number
} {
  const threat = findNearestLivingAgent(agent, world)
  if (!threat) {
    return {
      agent: { ...agent, combatCue: null },
      collided: false,
      fromId: null,
      distanceBefore: 0,
      distanceAfter: 0,
    }
  }

  const distanceBefore = agentSeparation(agent, threat)
  const away = Math.atan2(agent.position.x - threat.position.x, agent.position.z - threat.position.z)
  const turned = {
    ...agent,
    rotation: rotateTowards(agent.rotation, away, agent.turnRate * dt),
    combatCue: cueAt('flee', threat.id, threat.position.x, threat.position.z),
  }
  const moved = moveForward(turned)
  const afterThreat = world.agents.find((item) => item.id === threat.id) ?? threat
  return {
    agent: moved.agent,
    collided: moved.collided,
    fromId: threat.id,
    distanceBefore,
    distanceAfter: agentSeparation(moved.agent, afterThreat),
  }
}

export function createAttackIntent(attacker: Agent, world: WorldState): {
  intent: AttackIntent | null
  agent: Agent
} {
  const target = findNearestLivingAgent(attacker, world)
  if (!target) {
    return { intent: null, agent: { ...attacker, combatCue: null } }
  }

  return {
    intent: {
      attackerId: attacker.id,
      targetId: target.id,
      inRange: isInAttackRange(attacker, target),
    },
    agent: {
      ...attacker,
      combatCue: cueAt('attack', target.id, target.position.x, target.position.z),
    },
  }
}

export function fledFarther(before: number, after: number): boolean {
  return after > before + FLEE_SUCCESS_MARGIN
}

export function dropEquippedTool(agent: Agent): { agent: Agent; tool: WorldTool | null } {
  const equipment = agent.equipment
  if (!equipment || equipment.durability <= 0) {
    return { agent: { ...agent, equipment: null }, tool: null }
  }

  const tool: WorldTool = {
    id: createId(equipment.toolType),
    toolType: equipment.toolType,
    position: { x: agent.position.x, y: 0, z: agent.position.z },
    scale: 1,
    rotation: agent.rotation,
    durability: equipment.durability,
    maxDurability: equipment.maxDurability,
  }

  return {
    agent: { ...agent, equipment: null },
    tool,
  }
}

export function finalizeDeath(
  agent: Agent,
  cause: NonNullable<Agent['deathCause']>,
): { agent: Agent; dropped: WorldTool | null } {
  const dropped = dropEquippedTool(agent)
  return {
    agent: {
      ...dropped.agent,
      health: 0,
      alive: false,
      deathCause: agent.deathCause ?? cause,
      matingPartnerId: null,
      matingTimeLeft: 0,
      defendTimeLeft: 0,
      attackCooldownLeft: 0,
      combatCue: null,
    },
    dropped: dropped.tool,
  }
}

export interface CombatTickResult {
  agents: Agent[]
  droppedTools: WorldTool[]
  hits: CombatHit[]
  hitsByAttacker: Map<string, CombatHit>
  hitsByDefender: Map<string, CombatHit[]>
}

export function resolveCombatTick(
  intents: readonly AttackIntent[],
  agents: readonly Agent[],
  tick: number,
): CombatTickResult {
  const byId = new Map(agents.map((agent) => [agent.id, agent]))
  const hits: CombatHit[] = []
  const hitsByAttacker = new Map<string, CombatHit>()
  const hitsByDefender = new Map<string, CombatHit[]>()
  const droppedTools: WorldTool[] = []
  const applied = new Set<string>()

  for (const intent of intents) {
    if (applied.has(intent.attackerId)) continue
    applied.add(intent.attackerId)

    const attacker = byId.get(intent.attackerId)
    const defender = byId.get(intent.targetId)
    if (!attacker?.alive || attacker.health <= 0) continue
    if (!defender?.alive || defender.health <= 0) continue
    if (!intent.inRange) continue

    const resolved = applyHit(attacker, defender, tick)
    byId.set(attacker.id, resolved.attacker)
    byId.set(defender.id, resolved.defender)
    hits.push(resolved.hit)
    hitsByAttacker.set(attacker.id, resolved.hit)
    const taken = hitsByDefender.get(defender.id) ?? []
    taken.push(resolved.hit)
    hitsByDefender.set(defender.id, taken)
    if (resolved.dropped) droppedTools.push(resolved.dropped)
  }

  return {
    agents: agents.map((agent) => byId.get(agent.id) ?? agent),
    droppedTools,
    hits,
    hitsByAttacker,
    hitsByDefender,
  }
}

function applyHit(
  attacker: Agent,
  defender: Agent,
  tick: number,
): { attacker: Agent; defender: Agent; hit: CombatHit; dropped: WorldTool | null } {
  const usedSpear = isUsableTool(attacker.equipment, 'spear')
  const usedShield = isUsableTool(defender.equipment, 'shield')
  const rawDamage = rawAttackDamage(attacker)
  const factor = defendFactor(defender)
  const damage = Math.max(0, rawDamage * factor)
  const reduced = Math.max(0, rawDamage - damage)
  const defended = isDefending(defender) && reduced > 0

  const wornAttacker = usedSpear && damage > 0
    ? wearEquipment(attacker.equipment, toolWearCost(attacker))
    : { equipment: attacker.equipment, durabilityDelta: 0 }
  const wornDefender = usedShield && defended
    ? wearEquipment(defender.equipment, toolWearCost(defender))
    : { equipment: defender.equipment, durabilityDelta: 0 }

  const nextHealth = clampStat(defender.health - damage)
  const died = nextHealth <= 0
  let nextDefender: Agent = {
    ...defender,
    health: died ? 0 : nextHealth,
    equipment: wornDefender.equipment,
    lastAttackerId: attacker.id,
    lastCombatTick: tick,
  }
  let dropped: WorldTool | null = null
  if (died) {
    const killed = finalizeDeath(nextDefender, 'combat')
    nextDefender = killed.agent
    dropped = killed.dropped
  }

  const nextAttacker: Agent = {
    ...attacker,
    equipment: wornAttacker.equipment,
    attackCooldownLeft: ATTACK_COOLDOWN,
    lastCombatTick: tick,
  }

  return {
    attacker: nextAttacker,
    defender: nextDefender,
    dropped,
    hit: {
      attackerId: attacker.id,
      defenderId: defender.id,
      rawDamage,
      damage,
      reduced,
      defended,
      usedSpear,
      usedShield,
      attackerDurabilityDelta: wornAttacker.durabilityDelta,
      defenderDurabilityDelta: wornDefender.durabilityDelta,
      died,
    },
  }
}

function cueAt(
  kind: CombatCue['kind'],
  targetId: string | null,
  x: number,
  z: number,
): CombatCue {
  return {
    kind,
    targetId,
    x,
    z,
  }
}

