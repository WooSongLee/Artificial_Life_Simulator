import { describe, expect, it } from 'vitest'
import { getAgentActionEvents, resetActionEvents } from '../learning/actionEvents'
import { getBrain, resetBrains } from '../learning/brain'
import { legalActionsFor } from '../learning/actionMask'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import { computeReward } from '../learning/rewards'
import { encodeObservation, observeAgent } from '../learning/observation'
import { actionIndex, getOrCreateQValues } from '../learning/qLearning'
import type { Agent } from '../types/agent'
import type { EquippedTool } from '../types/forage'
import { updateAgent } from './agentSystem'
import {
  applyDefend,
  attackRangeFor,
  canAttemptAttack,
  createAttackIntent,
  dropEquippedTool,
  findNearestLivingAgent,
  fledFarther,
  rawAttackDamage,
  resolveCombatTick,
} from './combat'
import {
  ATTACK_BASE_DAMAGE,
  ATTACK_RANGE,
  DEFAULT_WORLD_CONFIG,
  SHIELD_DEFEND_FACTOR,
  SIMULATION_STEP_DT,
  SPEAR_ATTACK_RANGE,
  SPEAR_DAMAGE_MULTIPLIER,
  TOOL_MAX_DURABILITY,
} from './constants'
import { createInitialWorld } from './worldFactory'

function tool(type: EquippedTool['toolType'], durability = TOOL_MAX_DURABILITY): EquippedTool {
  return { toolType: type, durability, maxDurability: TOOL_MAX_DURABILITY }
}

function twoAgents() {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 2,
    obstacleDensity: 0,
    initialFoodCount: 0,
    initialBerryCount: 0,
    initialRootCount: 0,
    initialBasketCount: 0,
    initialStickCount: 0,
    initialSpearCount: 0,
    initialShieldCount: 0,
  })
  const [first, second] = world.agents
  if (!first || !second) throw new Error('expected two agents')
  const attacker: Agent = {
    ...first,
    desire: 0,
    health: 90,
    energy: 80,
    hunger: 10,
    position: { x: 0, z: 0 },
    rotation: 0,
    equipment: null,
    defendTimeLeft: 0,
    attackCooldownLeft: 0,
    genome: { ...first.genome, libido: 0, explorationRate: 0, strength: 1, toolAffinity: 1 },
  }
  const defender: Agent = {
    ...second,
    desire: 0,
    health: 90,
    energy: 80,
    hunger: 10,
    position: { x: 0, z: 1.2 },
    equipment: null,
    defendTimeLeft: 0,
    attackCooldownLeft: 0,
    genome: { ...second.genome, libido: 0, explorationRate: 0, strength: 1, toolAffinity: 1 },
  }
  const nextWorld = { ...world, agents: [attacker, defender] }
  resetBrains(nextWorld.agents, DEFAULT_LEARNING_CONFIG)
  return { world: nextWorld, attacker, defender }
}

describe('combat targeting and damage', () => {
  it('picks the nearest living agent and ignores dead ones', () => {
    const { world, attacker, defender } = twoAgents()
    const farther = { ...defender, id: 'farther', position: { x: 0, z: 4 } }
    const dead = { ...defender, id: 'dead', alive: false, health: 0, position: { x: 0, z: 0.4 } }
    const nextWorld = { ...world, agents: [attacker, defender, farther, dead] }
    expect(findNearestLivingAgent(attacker, nextWorld)?.id).toBe(defender.id)
  })

  it('does not apply damage when the target is out of range', () => {
    const { attacker, defender } = twoAgents()
    const far = { ...defender, position: { x: 0, z: 8 } }
    const resolved = resolveCombatTick(
      [{ attackerId: attacker.id, targetId: far.id, inRange: false }],
      [attacker, far],
      1,
    )
    expect(resolved.hits).toHaveLength(0)
    expect(resolved.agents.find((agent) => agent.id === far.id)?.health).toBe(90)
  })

  it('applies one hit per attacker and increases spear range and damage', () => {
    const { attacker, defender } = twoAgents()
    expect(attackRangeFor(attacker)).toBe(ATTACK_RANGE)
    expect(rawAttackDamage(attacker)).toBe(ATTACK_BASE_DAMAGE)

    const withSpear = { ...attacker, equipment: tool('spear') }
    expect(attackRangeFor(withSpear)).toBe(SPEAR_ATTACK_RANGE)
    expect(rawAttackDamage(withSpear)).toBe(ATTACK_BASE_DAMAGE * SPEAR_DAMAGE_MULTIPLIER)

    const resolved = resolveCombatTick(
      [
        { attackerId: attacker.id, targetId: defender.id, inRange: true },
        { attackerId: attacker.id, targetId: defender.id, inRange: true },
      ],
      [attacker, defender],
      3,
    )
    expect(resolved.hits).toHaveLength(1)
    expect(resolved.hits[0]?.damage).toBe(ATTACK_BASE_DAMAGE)
    expect(resolved.agents.find((agent) => agent.id === defender.id)?.health).toBe(
      90 - ATTACK_BASE_DAMAGE,
    )
  })

  it('scales hit damage with the attacker Strength gene without changing Q values', () => {
    const { attacker, defender } = twoAgents()
    const strong = { ...attacker, genome: { ...attacker.genome, strength: 1.4 } }
    const weak = { ...attacker, id: 'weak', genome: { ...attacker.genome, strength: 0.6 } }
    expect(rawAttackDamage(strong)).toBeCloseTo(ATTACK_BASE_DAMAGE * 1.4)
    expect(rawAttackDamage(weak)).toBeCloseTo(ATTACK_BASE_DAMAGE * 0.6)

    const strongHit = resolveCombatTick(
      [{ attackerId: strong.id, targetId: defender.id, inRange: true }],
      [strong, defender],
      1,
    )
    const otherDefender = { ...defender, id: 'other' }
    const weakHit = resolveCombatTick(
      [{ attackerId: weak.id, targetId: otherDefender.id, inRange: true }],
      [weak, otherDefender],
      1,
    )
    expect(strongHit.hits[0]?.rawDamage).toBeCloseTo(ATTACK_BASE_DAMAGE * 1.4)
    expect(weakHit.hits[0]?.rawDamage).toBeCloseTo(ATTACK_BASE_DAMAGE * 0.6)
    expect(strongHit.hits[0]?.rawDamage).toBeGreaterThan(weakHit.hits[0]?.rawDamage ?? 0)
  })

  it('reduces damage more with a shield while defending than with bare defend', () => {
    const { attacker, defender } = twoAgents()
    const bare = applyDefend(defender)
    const shielded = applyDefend({ ...defender, id: 'shielded', equipment: tool('shield') })
    const resolved = resolveCombatTick(
      [
        { attackerId: attacker.id, targetId: bare.id, inRange: true },
      ],
      [attacker, bare],
      1,
    )
    const otherAttacker = { ...attacker, id: 'attacker-2' }
    const shieldedResolved = resolveCombatTick(
      [{ attackerId: otherAttacker.id, targetId: shielded.id, inRange: true }],
      [otherAttacker, shielded],
      1,
    )

    const bareDamage = resolved.hits[0]?.damage ?? 0
    const shieldDamage = shieldedResolved.hits[0]?.damage ?? 0
    expect(bareDamage).toBeLessThan(ATTACK_BASE_DAMAGE)
    expect(shieldDamage).toBeCloseTo(ATTACK_BASE_DAMAGE * SHIELD_DEFEND_FACTOR)
    expect(shieldDamage).toBeLessThan(bareDamage)
    expect(shieldedResolved.hits[0]?.usedShield).toBe(true)
    expect(shieldedResolved.agents.find((agent) => agent.id === shielded.id)?.equipment?.durability).toBe(
      TOOL_MAX_DURABILITY - 1,
    )
  })

  it('kills through the existing death path, drops the tool once, and stops the corpse', () => {
    const { world, attacker, defender } = twoAgents()
    const fragile = { ...defender, health: 4, equipment: tool('basket') }
    const resolved = resolveCombatTick(
      [{ attackerId: attacker.id, targetId: fragile.id, inRange: true }],
      [attacker, fragile],
      8,
    )
    const dead = resolved.agents.find((agent) => agent.id === fragile.id)
    expect(dead?.alive).toBe(false)
    expect(dead?.deathCause).toBe('combat')
    expect(dead?.equipment).toBeNull()
    expect(resolved.droppedTools).toHaveLength(1)
    expect(resolved.droppedTools[0]?.toolType).toBe('basket')
    expect(dropEquippedTool(dead!).tool).toBeNull()

    resetActionEvents()
    const after = updateAgent(dead!, { ...world, agents: resolved.agents }, SIMULATION_STEP_DT, {
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      rng: () => 0,
      tick: 9,
    })
    expect(after.agent.alive).toBe(false)
    expect(after.agent.lastAction).toBe(dead?.lastAction ?? null)
    expect(after.consumedFoodId).toBeNull()
    expect(after.droppedTools).toHaveLength(0)
  })
})

describe('combat rewards and exploits', () => {
  it('rewards actual damage, not attack attempts, and does not double the death penalty', () => {
    const hit = computeReward(
      {
        action: 'ATTACK',
        ate: false,
        collided: false,
        died: false,
        energyBefore: 80,
        hungerBefore: 10,
        foodInEatRange: false,
        gatheredAmount: 0,
        pickedUp: false,
        damageDealt: 10,
        attackAttempted: true,
        attackHit: true,
      },
      DEFAULT_REWARD_CONFIG,
    )
    const miss = computeReward(
      {
        action: 'ATTACK',
        ate: false,
        collided: false,
        died: false,
        energyBefore: 80,
        hungerBefore: 10,
        foodInEatRange: false,
        gatheredAmount: 0,
        pickedUp: false,
        attackAttempted: true,
        attackHit: false,
      },
      DEFAULT_REWARD_CONFIG,
    )
    const death = computeReward(
      {
        action: 'ATTACK',
        ate: false,
        collided: false,
        died: true,
        energyBefore: 80,
        hungerBefore: 10,
        foodInEatRange: false,
        gatheredAmount: 0,
        pickedUp: false,
        damageDealt: 10,
        damageTaken: 12,
        attackAttempted: true,
        attackHit: true,
      },
      DEFAULT_REWARD_CONFIG,
    )

    expect(hit).toBeCloseTo(DEFAULT_REWARD_CONFIG.attackHitUnit * 10)
    expect(miss).toBe(DEFAULT_REWARD_CONFIG.attackMiss)
    expect(hit).toBeLessThan(DEFAULT_REWARD_CONFIG.eatSuccess)
    expect(death).toBeCloseTo(DEFAULT_REWARD_CONFIG.death + DEFAULT_REWARD_CONFIG.attackHitUnit * 10)
  })

  it('does not pay defend or flee unless the world actually changed', () => {
    const idleDefend = computeReward(
      {
        action: 'DEFEND',
        ate: false,
        collided: false,
        died: false,
        energyBefore: 80,
        hungerBefore: 10,
        foodInEatRange: false,
        gatheredAmount: 0,
        pickedUp: false,
        damageReduced: 0,
      },
      DEFAULT_REWARD_CONFIG,
    )
    const usefulDefend = computeReward(
      {
        action: 'DEFEND',
        ate: false,
        collided: false,
        died: false,
        energyBefore: 80,
        hungerBefore: 10,
        foodInEatRange: false,
        gatheredAmount: 0,
        pickedUp: false,
        damageReduced: 6,
      },
      DEFAULT_REWARD_CONFIG,
    )
    const idleFlee = computeReward(
      {
        action: 'FLEE',
        ate: false,
        collided: false,
        died: false,
        energyBefore: 80,
        hungerBefore: 10,
        foodInEatRange: false,
        gatheredAmount: 0,
        pickedUp: false,
        fledFarther: false,
      },
      DEFAULT_REWARD_CONFIG,
    )
    const usefulFlee = computeReward(
      {
        action: 'FLEE',
        ate: false,
        collided: false,
        died: false,
        energyBefore: 80,
        hungerBefore: 10,
        foodInEatRange: false,
        gatheredAmount: 0,
        pickedUp: false,
        fledFarther: true,
      },
      DEFAULT_REWARD_CONFIG,
    )

    expect(idleDefend).toBe(0)
    expect(usefulDefend).toBeCloseTo(DEFAULT_REWARD_CONFIG.defendReduceUnit * 6)
    expect(idleFlee).toBe(0)
    expect(usefulFlee).toBe(DEFAULT_REWARD_CONFIG.fleeSuccess)
    expect(fledFarther(1, 1.02)).toBe(false)
    expect(fledFarther(1, 1.2)).toBe(true)
  })
})

describe('combat actions through the agent tick', () => {
  it('lets a nearby agent attack, defend, and flee, and records the event', () => {
    const { world, attacker, defender } = twoAgents()
    expect(legalActionsFor(attacker, world)).toEqual(expect.arrayContaining(['ATTACK', 'DEFEND', 'FLEE']))
    expect(canAttemptAttack(attacker, world)).toBe(true)
    expect(createAttackIntent(attacker, world).intent?.inRange).toBe(true)

    const brain = getBrain(attacker.id)
    if (!brain) throw new Error('expected a brain')
    const stateKey = encodeObservation(observeAgent(attacker, world))
    const qValues = getOrCreateQValues(brain.qTable, stateKey)
    qValues[actionIndex('ATTACK')] = 50
    brain.epsilon = 0
    resetActionEvents()

    const result = updateAgent(attacker, world, SIMULATION_STEP_DT, {
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      rng: () => 0.9,
      tick: 4,
    })

    expect(result.agent.lastAction).toBe('ATTACK')
    expect(result.damageDealt).toBeGreaterThan(0)
    expect(result.combatTargetId).toBe(defender.id)
    expect(result.affectedAgents.find((agent) => agent.id === defender.id)?.health).toBeLessThan(90)
    const events = getAgentActionEvents(attacker.id)
    expect(events[0]?.selectedAction).toBe('ATTACK')
    expect(events[0]?.damageDealt).toBeGreaterThan(0)
    expect(events[0]?.targetId).toBe(defender.id)
    expect(events[0]?.outcome).toBe('success')
  })
})
