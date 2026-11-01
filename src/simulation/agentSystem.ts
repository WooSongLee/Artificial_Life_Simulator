import {
  DESIRE_GAIN_PER_SEC,
  MATING_ENERGY_DRAIN_PER_SEC,
} from '../evolution/constants'
import { findNearestMate, shouldSeekMate } from '../evolution/mating'
import { isMating } from '../evolution/reproduction'
import {
  beginActionDecision,
  classifyActionOutcome,
  countActionDecision,
  shouldRecordActionEvent,
  snapshotQValues,
  completeActionOutcome,
  recordIntervalOutcome,
  simulationTimeAt,
} from '../learning/actionEvents'
import { applyLearningUpdate, decideAction, type LearningStepContext } from '../learning/controller'
import { findFoodInEatRange } from '../learning/observation'
import type { AgentAction } from '../learning/types'
import type { ActionTarget, Agent } from '../types/agent'
import type { AttackIntent } from '../types/combat'
import type { ForageNode, WorldTool } from '../types/forage'
import type { WorldObject, WorldState } from '../types/world'
import { clampStat, finiteNumber, rotateTowards, wrapAngle } from '../utils/math'
import {
  AGENT_RADIUS,
  ATTACK_ENERGY_DRAIN_MULTIPLIER,
  ENERGY_CRITICAL,
  ENERGY_DRAIN_PER_SEC,
  FOOD_ENERGY_RESTORE,
  FOOD_HUNGER_RELIEF,
  HEALTH_DRAIN_PER_SEC,
  HEALTH_REGEN_PER_SEC,
  HUNGER_DRAIN_THRESHOLD,
  HUNGER_GAIN_PER_SEC,
  HUNGRY_EXTRA_DRAIN_PER_SEC,
  MOVE_ENERGY_DRAIN_MULTIPLIER,
  REST_ENERGY_DRAIN_MULTIPLIER,
  getConfiguredFoodCount,
  getFoodSpawnInterval,
} from './constants'
import {
  applyDefend,
  applyFlee,
  createAttackIntent,
  finalizeDeath,
  fledFarther,
  resolveCombatTick,
  tickCombatTimers,
  type CombatTickResult,
} from './combat'
import {
  applyGather,
  applyPickup,
  findGatherableNode,
  findPickupTool,
} from './forage'
import { isBlockedWorldPosition } from './spatial'
import { getAgentTerrain, getAgentTerrainProfile } from './terrain'
import { createWorldObject } from './worldFactory'

function targetFromAgent(world: WorldState, agentId: string, kind: string): ActionTarget | null {
  const target = world.agents.find((item) => item.id === agentId)
  if (!target) return null
  return { kind, id: target.id, x: target.position.x, z: target.position.z }
}

export interface AgentTickResult {
  agent: Agent
  consumedFoodId: string | null
  pickedUpToolId: string | null
  gatheredNode: ForageNode | null
  gatheredAmount: number
  durabilityDelta: number
  targetKind: string | null
  affectedAgents: Agent[]
  droppedTools: WorldTool[]
  damageDealt: number
  damageTaken: number
  damageReduced: number
  combatTargetId: string | null
}

export interface AgentPlan {
  agent: Agent
  skipLearning: boolean
  consumedFoodId: string | null
  pickedUpToolId: string | null
  gatheredNode: ForageNode | null
  gatheredAmount: number
  durabilityDelta: number
  targetKind: string | null
  actionTarget: ActionTarget | null
  droppedTools: WorldTool[]
  energyBefore: number
  healthBefore: number
  hungerBefore: number
  foodInEatRange: boolean
  decision: ReturnType<typeof decideAction> | null
  eventId: string | null
  attackIntent: AttackIntent | null
  ate: boolean
  collided: boolean
  fleeDistanceBefore: number
  fleeDistanceAfter: number
}

function emptyTickResult(agent: Agent, extra: Partial<AgentTickResult> = {}): AgentTickResult {
  return {
    agent,
    consumedFoodId: null,
    pickedUpToolId: null,
    gatheredNode: null,
    gatheredAmount: 0,
    durabilityDelta: 0,
    targetKind: null,
    affectedAgents: [],
    droppedTools: [],
    damageDealt: 0,
    damageTaken: 0,
    damageReduced: 0,
    combatTargetId: null,
    ...extra,
  }
}

function skippedPlan(agent: Agent, droppedTools: WorldTool[] = []): AgentPlan {
  return {
    agent,
    skipLearning: true,
    consumedFoodId: null,
    pickedUpToolId: null,
    gatheredNode: null,
    gatheredAmount: 0,
    durabilityDelta: 0,
    targetKind: null,
    actionTarget: null,
    droppedTools,
    energyBefore: agent.energy,
    healthBefore: agent.health,
    hungerBefore: agent.hunger,
    foodInEatRange: false,
    decision: null,
    eventId: null,
    attackIntent: null,
    ate: false,
    collided: false,
    fleeDistanceBefore: 0,
    fleeDistanceAfter: 0,
  }
}

export function energyDrainMultiplier(action: AgentAction): number {
  if (action === 'REST') return REST_ENERGY_DRAIN_MULTIPLIER
  if (action === 'MOVE_FORWARD' || action === 'FLEE') return MOVE_ENERGY_DRAIN_MULTIPLIER
  if (action === 'ATTACK') return ATTACK_ENERGY_DRAIN_MULTIPLIER
  return 1
}

function applyMetabolism(agent: Agent, dt: number, action: AgentAction, world?: WorldState): Agent {
  const efficiency = Math.max(agent.genome.energyEfficiency, 0.01)
  const terrainDrain = world ? getAgentTerrainProfile(agent, world).energyDrainMultiplier : 1
  const drainScale = (energyDrainMultiplier(action) * terrainDrain) / efficiency
  let energy = clampStat(agent.energy - ENERGY_DRAIN_PER_SEC * drainScale * dt)
  let hunger = clampStat(agent.hunger + HUNGER_GAIN_PER_SEC * dt)

  if (hunger >= HUNGER_DRAIN_THRESHOLD) {
    energy = clampStat(energy - HUNGRY_EXTRA_DRAIN_PER_SEC * dt / efficiency)
  }

  if (isMating(agent)) {
    energy = clampStat(energy - MATING_ENERGY_DRAIN_PER_SEC * dt / efficiency)
  }

  let health = agent.health
  if (energy <= ENERGY_CRITICAL) {
    const severity = 1 - energy / ENERGY_CRITICAL
    health = clampStat(health - HEALTH_DRAIN_PER_SEC * severity * dt)
  } else if (energy > 60 && hunger < 40) {
    health = clampStat(health + HEALTH_REGEN_PER_SEC * dt)
  }

  if (health <= 0) {
    return {
      ...agent,
      energy,
      hunger,
      health: 0,
      alive: false,
      deathCause: agent.deathCause ?? 'health',
      matingPartnerId: null,
      matingTimeLeft: 0,
    }
  }

  return {
    ...agent,
    energy,
    hunger,
    health,
    alive: true,
  }
}

function applyDrives(agent: Agent, dt: number, geneticsEnabled: boolean): Agent {
  const age = agent.age + dt
  if (geneticsEnabled && age >= agent.maxLifespan) {
    return {
      ...agent,
      age,
      health: 0,
      alive: false,
      deathCause: 'age',
      matingPartnerId: null,
      matingTimeLeft: 0,
    }
  }

  const matingTimeLeft = agent.matingPartnerId === null
    ? 0
    : Math.max(0, agent.matingTimeLeft - dt)
  const desire =
    !geneticsEnabled || agent.matingPartnerId !== null
      ? agent.desire
      : clampStat(agent.desire + DESIRE_GAIN_PER_SEC * agent.genome.libido * dt)

  return {
    ...agent,
    age,
    desire,
    matingTimeLeft,
  }
}

function seekMate(agent: Agent, world: WorldState, dt: number): Agent {
  const mate = findNearestMate(agent, world)
  if (!mate) return agent

  const target = Math.atan2(mate.position.x - agent.position.x, mate.position.z - agent.position.z)
  const turned = {
    ...agent,
    rotation: rotateTowards(agent.rotation, target, agent.turnRate * dt),
  }
  return moveForward(turned, world, dt).agent
}

function moveForward(agent: Agent, world: WorldState, dt: number): { agent: Agent; collided: boolean } {
  const moveScale = getAgentTerrainProfile(agent, world).moveSpeedMultiplier
  const distance = finiteNumber(agent.speed) * moveScale * dt
  const rotation = wrapAngle(agent.rotation)
  const x = agent.position.x + Math.sin(rotation) * distance
  const z = agent.position.z + Math.cos(rotation) * distance
  const collided =
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    isBlockedWorldPosition(x, z, world, AGENT_RADIUS)

  if (collided) {
    return { agent, collided: true }
  }

  return {
    agent: {
      ...agent,
      rotation,
      position: { x, z },
    },
    collided: false,
  }
}

function consumeNearbyFood(
  agent: Agent,
  objects: WorldObject[],
): { agent: Agent; ate: boolean; consumedFoodId: string | null } {
  const food = findFoodInEatRange(agent, objects)
  if (!food) {
    return { agent, ate: false, consumedFoodId: null }
  }

  return {
    agent: {
      ...agent,
      energy: clampStat(agent.energy + FOOD_ENERGY_RESTORE),
      hunger: clampStat(agent.hunger - FOOD_HUNGER_RELIEF),
    },
    ate: true,
    consumedFoodId: food.id,
  }
}

function executeAction(
  agent: Agent,
  action: AgentAction,
  world: WorldState,
  dt: number,
): {
  agent: Agent
  ate: boolean
  collided: boolean
  consumedFoodId: string | null
  pickedUpToolId: string | null
  gatheredNode: ForageNode | null
  gatheredAmount: number
  durabilityDelta: number
  targetKind: string | null
  actionTarget: ActionTarget | null
  attackIntent: AttackIntent | null
  fleeDistanceBefore: number
  fleeDistanceAfter: number
} {
  switch (action) {
    case 'MOVE_FORWARD': {
      const moved = moveForward(agent, world, dt)
      return withAutoEat(moved.agent, world.objects, { collided: moved.collided })
    }
    case 'TURN_LEFT': {
      const turned = { ...agent, rotation: wrapAngle(agent.rotation + agent.turnRate * dt) }
      return withAutoEat(turned, world.objects)
    }
    case 'TURN_RIGHT': {
      const turned = { ...agent, rotation: wrapAngle(agent.rotation - agent.turnRate * dt) }
      return withAutoEat(turned, world.objects)
    }
    case 'EAT':
      return withAutoEat(agent, world.objects)
    case 'REST':
      return withAutoEat(agent, world.objects)
    case 'PICK_UP': {
      const tool = findPickupTool(agent, world)
      if (!tool) return withAutoEat(agent, world.objects)
      const picked = applyPickup(agent, tool)
      return {
        ...withAutoEat(picked.agent, world.objects),
        pickedUpToolId: tool.id,
        targetKind: tool.toolType,
        actionTarget: { kind: tool.toolType, id: tool.id, x: tool.position.x, z: tool.position.z },
      }
    }
    case 'GATHER': {
      const node = findGatherableNode(agent, world)
      if (!node) return withAutoEat(agent, world.objects)
      const gathered = applyGather(agent, node)
      return {
        ...withAutoEat(gathered.agent, world.objects),
        gatheredNode: gathered.node,
        gatheredAmount: gathered.amount,
        durabilityDelta: gathered.durabilityDelta,
        targetKind: node.kind,
        actionTarget: { kind: node.kind, id: node.id, x: node.position.x, z: node.position.z },
      }
    }
    case 'ATTACK': {
      const aimed = createAttackIntent(agent, world)
      return {
        ...withAutoEat(aimed.agent, world.objects),
        attackIntent: aimed.intent,
        targetKind: aimed.intent ? 'agent' : null,
        actionTarget: aimed.intent
          ? targetFromAgent(world, aimed.intent.targetId, 'agent')
          : null,
      }
    }
    case 'DEFEND': {
      const defended = applyDefend(agent)
      return withAutoEat(defended, world.objects, {
        targetKind: defended.combatCue?.targetId ? 'agent' : null,
        actionTarget: defended.combatCue?.targetId
          ? targetFromAgent(world, defended.combatCue.targetId, 'agent')
          : defended.combatCue
            ? { kind: 'agent', id: defended.combatCue.targetId, x: defended.combatCue.x, z: defended.combatCue.z }
            : null,
      })
    }
    case 'FLEE': {
      const fled = applyFlee(agent, world, dt, (current) => moveForward(current, world, dt))
      return {
        ...withAutoEat(fled.agent, world.objects, { collided: fled.collided }),
        targetKind: fled.fromId ? 'agent' : null,
        actionTarget: fled.fromId ? targetFromAgent(world, fled.fromId, 'agent') : null,
        fleeDistanceBefore: fled.distanceBefore,
        fleeDistanceAfter: fled.distanceAfter,
      }
    }
  }
}

function withAutoEat(
  agent: Agent,
  objects: WorldObject[],
  extra: Partial<{
    collided: boolean
    pickedUpToolId: string | null
    gatheredNode: ForageNode | null
    gatheredAmount: number
    durabilityDelta: number
    targetKind: string | null
    actionTarget: ActionTarget | null
    attackIntent: AttackIntent | null
    fleeDistanceBefore: number
    fleeDistanceAfter: number
  }> = {},
) {
  const eaten = consumeNearbyFood(agent, objects)
  return {
    agent: eaten.agent,
    ate: eaten.ate,
    collided: extra.collided ?? false,
    consumedFoodId: eaten.consumedFoodId,
    pickedUpToolId: extra.pickedUpToolId ?? null,
    gatheredNode: extra.gatheredNode ?? null,
    gatheredAmount: extra.gatheredAmount ?? 0,
    durabilityDelta: extra.durabilityDelta ?? 0,
    targetKind: extra.targetKind ?? null,
    actionTarget: extra.actionTarget ?? null,
    attackIntent: extra.attackIntent ?? null,
    fleeDistanceBefore: extra.fleeDistanceBefore ?? 0,
    fleeDistanceAfter: extra.fleeDistanceAfter ?? 0,
  }
}

function takeDeathDrop(agent: Agent, cause: NonNullable<Agent['deathCause']>): {
  agent: Agent
  dropped: WorldTool | null
} {
  if (agent.alive) return { agent, dropped: null }
  return finalizeDeath(agent, cause)
}

export function beginAgentTick(
  agent: Agent,
  world: WorldState,
  dt: number,
  context: LearningStepContext,
): AgentPlan {
  if (!agent.alive || agent.health <= 0) {
    return skippedPlan(
      agent.alive
        ? takeDeathDrop({
            ...agent,
            health: 0,
            alive: false,
            deathCause: agent.deathCause ?? 'health',
            matingPartnerId: null,
            matingTimeLeft: 0,
          }, agent.deathCause ?? 'health').agent
        : agent,
    )
  }

  const geneticsEnabled = context.geneticsEnabled !== false
  const driven = tickCombatTimers(applyDrives(agent, dt, geneticsEnabled), dt)
  if (!driven.alive) {
    const death = takeDeathDrop(driven, 'age')
    return skippedPlan(death.agent, death.dropped ? [death.dropped] : [])
  }

  const energyBefore = driven.energy
  const hungerBefore = driven.hunger
  const healthBefore = driven.health
  const foodInEatRange = findFoodInEatRange(driven, world.objects) !== null
  const mating = geneticsEnabled && isMating(driven)
  const seeking = geneticsEnabled && !mating && shouldSeekMate(driven)

  if (mating || seeking) {
    const acted = mating
      ? consumeNearbyFood(driven, world.objects)
      : consumeNearbyFood(seekMate(driven, world, dt), world.objects)
    const nextAgent = applyMetabolism(acted.agent, dt, mating ? 'REST' : 'MOVE_FORWARD', world)
    const death = takeDeathDrop(nextAgent, nextAgent.deathCause ?? 'health')
    return {
      ...skippedPlan(death.agent, death.dropped ? [death.dropped] : []),
      consumedFoodId: acted.consumedFoodId,
      ate: acted.consumedFoodId !== null,
      energyBefore,
      healthBefore,
      hungerBefore,
      foodInEatRange,
      agent: {
        ...death.agent,
        lastAction: mating ? 'REST' : 'MOVE_FORWARD',
        lastReward: 0,
        lastStateKey: driven.lastStateKey,
      },
    }
  }

  const tick = context.tick ?? 0
  const simulationTime = simulationTimeAt(tick)
  const decision = decideAction(driven, world, context)
  const eventId = shouldRecordActionEvent()
    ? beginActionDecision({
        tick,
        simulationTime,
        agentId: driven.id,
        stateKey: decision.stateKey,
        selectedAction: decision.selection.action,
        legalActions: decision.legalActions,
        decisionType: decision.selection.explored ? 'exploration' : 'exploitation',
        epsilon: decision.epsilon,
        qValues: snapshotQValues(decision.qValues),
        geneticBias: snapshotQValues(decision.geneticBias),
      })
    : null
  countActionDecision(decision.selection.action, {
    explored: decision.selection.explored,
    terrain: getAgentTerrain(driven, world),
    heldTool: driven.equipment !== null,
  })

  const executed = executeAction(driven, decision.selection.action, world, dt)
  const nextAgent = applyMetabolism(executed.agent, dt, decision.selection.action, world)
  const death = takeDeathDrop(nextAgent, nextAgent.deathCause ?? 'health')

  return {
    agent: death.agent,
    skipLearning: false,
    consumedFoodId: executed.consumedFoodId,
    pickedUpToolId: executed.pickedUpToolId,
    gatheredNode: executed.gatheredNode,
    gatheredAmount: executed.gatheredAmount,
    durabilityDelta: executed.durabilityDelta,
    targetKind: executed.targetKind,
    actionTarget: executed.actionTarget,
    droppedTools: death.dropped ? [death.dropped] : [],
    energyBefore,
    healthBefore,
    hungerBefore,
    foodInEatRange,
    decision,
    eventId,
    attackIntent: nextAgent.alive ? executed.attackIntent : null,
    ate: executed.ate,
    collided: executed.collided,
    fleeDistanceBefore: executed.fleeDistanceBefore,
    fleeDistanceAfter: executed.fleeDistanceAfter,
  }
}

export function finishAgentTick(
  plan: AgentPlan,
  combat: CombatTickResult,
  world: WorldState,
  context: LearningStepContext,
): AgentTickResult {
  const afterCombat = combat.agents.find((item) => item.id === plan.agent.id) ?? plan.agent
  const hitDealt = combat.hitsByAttacker.get(plan.agent.id)
  const hitsTaken = combat.hitsByDefender.get(plan.agent.id) ?? []
  const damageDealt = hitDealt?.damage ?? 0
  const damageTaken = hitsTaken.reduce((sum, hit) => sum + hit.damage, 0)
  const damageReduced = hitsTaken.reduce((sum, hit) => sum + hit.reduced, 0)
  const combatTargetId = hitDealt?.defenderId ?? plan.attackIntent?.targetId ?? null
  const durabilityDelta =
    plan.durabilityDelta +
    (hitDealt?.attackerDurabilityDelta ?? 0) +
    hitsTaken.reduce((sum, hit) => sum + hit.defenderDurabilityDelta, 0)
  const droppedIds = new Set<string>()
  const droppedTools: WorldTool[] = []
  for (const tool of [...plan.droppedTools, ...combat.droppedTools]) {
    if (droppedIds.has(tool.id)) continue
    droppedIds.add(tool.id)
    droppedTools.push(tool)
  }

  if (plan.skipLearning || !plan.decision) {
    return emptyTickResult(afterCombat, {
      consumedFoodId: plan.consumedFoodId,
      droppedTools: plan.droppedTools,
    })
  }

  const died = !afterCombat.alive
  const nextWorld: WorldState = {
    ...world,
    agents: combat.agents,
    objects: plan.consumedFoodId
      ? world.objects.filter((object) => object.id !== plan.consumedFoodId)
      : world.objects,
    worldTools: plan.pickedUpToolId
      ? world.worldTools.filter((tool) => tool.id !== plan.pickedUpToolId)
      : world.worldTools,
    forageNodes: plan.gatheredNode
      ? world.forageNodes.map((node) => (node.id === plan.gatheredNode?.id ? plan.gatheredNode : node))
      : world.forageNodes,
  }

  const reward = applyLearningUpdate(
    afterCombat,
    nextWorld,
    plan.decision.stateKey,
    {
      action: plan.decision.selection.action,
      ate: plan.ate,
      collided: plan.collided,
      died,
      consumedFoodId: plan.consumedFoodId,
      pickedUpToolId: plan.pickedUpToolId,
      gatheredNodeId: plan.gatheredNode?.id ?? null,
      gatheredAmount: plan.gatheredAmount,
      durabilityDelta,
      targetKind: plan.targetKind,
      damageDealt,
      damageTaken,
      damageReduced,
      fledFarther: fledFarther(plan.fleeDistanceBefore, plan.fleeDistanceAfter),
      combatTargetId,
    },
    plan.energyBefore,
    plan.hungerBefore,
    plan.foodInEatRange,
    plan.decision.selection.explored,
    context,
    plan.decision.legalActions,
  )

  const outcome = classifyActionOutcome({
    action: plan.decision.selection.action,
    ate: plan.ate,
    collided: plan.collided,
    died,
    pickedUp: plan.pickedUpToolId !== null,
    gathered: plan.gatheredAmount > 0,
    attackHit: damageDealt > 0,
    attackAttempted: plan.decision.selection.action === 'ATTACK',
    fledFarther: fledFarther(plan.fleeDistanceBefore, plan.fleeDistanceAfter),
  })
  recordIntervalOutcome({
    action: plan.decision.selection.action,
    outcome,
    heldTool: plan.agent.equipment !== null,
  })

  if (plan.eventId) {
    const tick = context.tick ?? 0
    completeActionOutcome(plan.eventId, {
      tick,
      simulationTime: simulationTimeAt(tick),
      agentId: plan.agent.id,
      action: plan.decision.selection.action,
      outcome,
      targetId: combatTargetId ?? plan.pickedUpToolId ?? plan.gatheredNode?.id ?? plan.consumedFoodId,
      targetKind: plan.targetKind,
      gatheredAmount: plan.gatheredAmount,
      durabilityDelta,
      damageDealt,
      damageReduced,
      reward,
      energyDelta: afterCombat.energy - plan.energyBefore,
      healthDelta: afterCombat.health - plan.healthBefore,
    })
  }

  const affectedAgents = combat.agents.filter((item) => item.id !== plan.agent.id && (
    combat.hitsByDefender.has(item.id) || combat.hitsByAttacker.has(item.id)
  ))

  return {
    agent: {
      ...afterCombat,
      lastAction: plan.decision.selection.action,
      lastReward: reward,
      lastStateKey: plan.decision.stateKey,
      actionTarget:
        combatTargetId
          ? targetFromAgent({ ...world, agents: combat.agents }, combatTargetId, 'agent') ?? plan.actionTarget
          : plan.actionTarget,
    },
    consumedFoodId: plan.consumedFoodId,
    pickedUpToolId: plan.pickedUpToolId,
    gatheredNode: plan.gatheredNode,
    gatheredAmount: plan.gatheredAmount,
    durabilityDelta,
    targetKind: plan.targetKind,
    affectedAgents,
    droppedTools,
    damageDealt,
    damageTaken,
    damageReduced,
    combatTargetId,
  }
}

export function updateAgent(
  agent: Agent,
  world: WorldState,
  dt: number,
  context: LearningStepContext,
): AgentTickResult {
  const plan = beginAgentTick(agent, world, dt, context)
  const plannedAgents = world.agents.map((item) => (item.id === plan.agent.id ? plan.agent : item))
  const combat = resolveCombatTick(
    plan.attackIntent ? [plan.attackIntent] : [],
    plannedAgents,
    context.tick ?? 0,
  )
  return finishAgentTick(plan, combat, world, context)
}

export function overlayAgents(base: readonly Agent[], overlay: readonly Agent[]): Agent[] {
  const byId = new Map(overlay.map((agent) => [agent.id, agent]))
  return base.map((agent) => byId.get(agent.id) ?? agent)
}

export function respawnFood(
  objects: WorldObject[],
  world: WorldState,
  dt: number,
): { objects: WorldObject[]; foodSpawnCooldown: number } {
  const targetFoodCount = getConfiguredFoodCount(world.config)
  const spawnInterval = getFoodSpawnInterval(world.config)
  const foodCount = objects.reduce((count, object) => count + (object.type === 'food' ? 1 : 0), 0)

  if (foodCount >= targetFoodCount) {
    return { objects, foodSpawnCooldown: spawnInterval }
  }

  let cooldown = world.foodSpawnCooldown - dt
  const nextObjects = [...objects]

  while (cooldown <= 0) {
    const currentFood = nextObjects.reduce(
      (count, object) => count + (object.type === 'food' ? 1 : 0),
      0,
    )
    if (currentFood >= targetFoodCount) {
      cooldown = spawnInterval
      break
    }

    nextObjects.push(createWorldObject('food', world.config, nextObjects, Math.random, undefined, world.terrain))
    cooldown += spawnInterval
  }

  return { objects: nextObjects, foodSpawnCooldown: cooldown }
}
