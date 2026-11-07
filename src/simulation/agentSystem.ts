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
import { labCurriculumDriveRates } from '../learning/labCurriculum'
import { findFoodInEatRange } from '../learning/observation'
import type { AgentAction } from '../learning/types'
import type { ActionTarget, Agent } from '../types/agent'
import type { AttackIntent } from '../types/combat'
import type { ForageNode, WorldTool } from '../types/forage'
import type { Interactable } from '../types/interactable'
import type { LabObjectInstance } from '../types/labObject'
import type { WorldObject, WorldState } from '../types/world'
import { createId } from '../utils/id'
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
import { applyLabEnvironmentDriveEffects } from './labEnvironment'
import {
  allowsDeath,
  applyLookoutDriveTradeoff,
  applyRestBedDriveTradeoff,
  isHumanBehaviorLab,
  keepLabAgentAlive,
  LAB_HEALTH_FLOOR,
  tickLabDrives,
} from './labMode'
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
import {
  applyBoxPush,
  applyLookoutUse,
  applyRestBedUse,
  applySwitchToggle,
  findBoxInInteractRange,
  findLookoutInInteractRange,
  findRestBedInInteractRange,
  findSwitchInInteractRange,
  pickLabFoodPosition,
} from './interactables'
import {
  applyHeldPatch,
  applyNeedDeltas,
  tryExecuteLabEat,
  tryExecuteLabGather,
  tryExecuteLabPickUp,
} from './labObjectRuntime'
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
  interactedId: string | null
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
  interactedId: string | null
  interactables: Interactable[] | null
  labObjects: LabObjectInstance[] | null
  durabilityDelta: number
  targetKind: string | null
  actionTarget: ActionTarget | null
  droppedTools: WorldTool[]
  energyBefore: number
  healthBefore: number
  hungerBefore: number
  fatigueBefore?: number
  curiosityBefore?: number
  comfortBefore?: number
  foodInEatRange: boolean
  /** Action on the agent before this tick's decision (for spin oscillation penalty). */
  previousAction: AgentAction | null
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
    interactedId: null,
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
    interactedId: null,
    interactables: null,
    labObjects: null,
    durabilityDelta: 0,
    targetKind: null,
    actionTarget: null,
    droppedTools,
    energyBefore: agent.energy,
    healthBefore: agent.health,
    hungerBefore: agent.hunger,
    foodInEatRange: false,
    previousAction: agent.lastAction,
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

  const labImmortal = world !== undefined && !allowsDeath(world.config.mode)
  if (health <= 0 && !labImmortal) {
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
    health: labImmortal ? Math.max(LAB_HEALTH_FLOOR, health) : health,
    alive: true,
    deathCause: labImmortal ? null : agent.deathCause,
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
  tick = 0,
): {
  agent: Agent
  ate: boolean
  collided: boolean
  consumedFoodId: string | null
  pickedUpToolId: string | null
  gatheredNode: ForageNode | null
  gatheredAmount: number
  interactedId: string | null
  interactables: Interactable[] | null
  labObjects: LabObjectInstance[] | null
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
    case 'EAT': {
      const ecologyEat = withAutoEat(agent, world.objects)
      if (ecologyEat.ate) return ecologyEat
      const labEat = tryExecuteLabEat(agent, world.labObjects ?? [])
      if (!labEat || labEat.blocked) return ecologyEat
      const afterNeeds = applyNeedDeltas(agent, labEat.needDeltas)
      return {
        ...withAutoEat(applyHeldPatch(afterNeeds, labEat.heldLabObjectId), world.objects),
        ate: true,
        interactedId: labEat.target.id,
        labObjects: labEat.labObjects,
        targetKind: labEat.target.objectType,
        actionTarget: {
          kind: labEat.target.objectType,
          id: labEat.target.id,
          x: labEat.target.position.x,
          z: labEat.target.position.z,
        },
      }
    }
    case 'REST':
      return withAutoEat(agent, world.objects)
    case 'PICK_UP': {
      // Env-P2: Lab held-slot pick/drop before Ecology tool equipment.
      const labPick = tryExecuteLabPickUp(agent, world.labObjects ?? [])
      if (labPick && !labPick.blocked) {
        return {
          ...withAutoEat(applyHeldPatch(agent, labPick.heldLabObjectId), world.objects),
          interactedId: labPick.target.id,
          labObjects: labPick.labObjects,
          targetKind: labPick.target.objectType,
          actionTarget: {
            kind: labPick.target.objectType,
            id: labPick.target.id,
            x: labPick.target.position.x,
            z: labPick.target.position.z,
          },
        }
      }
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
      if (node) {
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
      // Env-P1/P2: catalog Lab objects (fridge/stove/sink/table) before legacy drive props.
      const labGather = tryExecuteLabGather(agent, world.labObjects ?? [])
      if (labGather?.blocked) {
        // Env-P2: held-gated affordance in range but missing item — log via actionTarget.
        return {
          ...withAutoEat(agent, world.objects),
          interactedId: labGather.target.id,
          targetKind: `blocked:${labGather.target.objectType}`,
          actionTarget: {
            kind: labGather.tags.join(','),
            id: labGather.target.id,
            x: labGather.target.position.x,
            z: labGather.target.position.z,
          },
        }
      }
      if (labGather) {
        const afterNeeds = applyNeedDeltas(agent, labGather.needDeltas)
        return {
          ...withAutoEat(applyHeldPatch(afterNeeds, labGather.heldLabObjectId), world.objects),
          interactedId: labGather.target.id,
          labObjects: labGather.labObjects,
          targetKind: labGather.target.objectType,
          actionTarget: {
            kind: labGather.target.objectType,
            id: labGather.target.id,
            x: labGather.target.position.x,
            z: labGather.target.position.z,
          },
        }
      }
      // Lab drives: prefer rest/lookout over tool props when those drives dominate.
      const preferRest =
        agent.fatigue !== undefined &&
        (agent.fatigue >= 55 || (agent.comfort !== undefined && agent.comfort <= 45))
      const preferLook =
        agent.curiosity !== undefined && agent.curiosity >= 55 && !preferRest
      if (preferRest) {
        const nearbyBed = findRestBedInInteractRange(agent, world.interactables ?? [])
        if (nearbyBed) {
          const rested = applyRestBedUse(world.interactables ?? [], nearbyBed.id, tick)
          if (rested) {
            return {
              ...withAutoEat(applyRestBedDriveTradeoff(agent), world.objects),
              interactedId: rested.bed.id,
              interactables: rested.interactables,
              targetKind: 'rest_bed',
              actionTarget: {
                kind: 'rest_bed',
                id: rested.bed.id,
                x: rested.bed.position.x,
                z: rested.bed.position.z,
              },
            }
          }
        }
      }
      if (preferLook) {
        const nearbyLookout = findLookoutInInteractRange(agent, world.interactables ?? [])
        if (nearbyLookout) {
          const looked = applyLookoutUse(world.interactables ?? [], nearbyLookout.id, tick)
          if (looked) {
            return {
              ...withAutoEat(applyLookoutDriveTradeoff(agent), world.objects),
              interactedId: looked.lookout.id,
              interactables: looked.interactables,
              targetKind: 'lookout',
              actionTarget: {
                kind: 'lookout',
                id: looked.lookout.id,
                x: looked.lookout.position.x,
                z: looked.lookout.position.z,
              },
            }
          }
        }
      }
      const nearbySwitch = findSwitchInInteractRange(agent, world.interactables ?? [])
      if (nearbySwitch) {
        const toggled = applySwitchToggle(world.interactables ?? [], nearbySwitch.id)
        if (!toggled) return withAutoEat(agent, world.objects)
        return {
          ...withAutoEat(agent, world.objects),
          interactedId: toggled.switchItem.id,
          interactables: toggled.interactables,
          targetKind: 'switch',
          actionTarget: {
            kind: 'switch',
            id: toggled.switchItem.id,
            x: toggled.switchItem.position.x,
            z: toggled.switchItem.position.z,
          },
        }
      }
      const nearbyBox = findBoxInInteractRange(agent, world.interactables ?? [])
      if (nearbyBox) {
        const pushed = applyBoxPush(world.interactables ?? [], nearbyBox.id, agent.rotation, world)
        if (pushed) {
          return {
            ...withAutoEat(agent, world.objects),
            interactedId: pushed.box.id,
            interactables: pushed.interactables,
            targetKind: 'movable_box',
            actionTarget: {
              kind: 'movable_box',
              id: pushed.box.id,
              x: pushed.box.position.x,
              z: pushed.box.position.z,
            },
          }
        }
      }
      const nearbyBed = findRestBedInInteractRange(agent, world.interactables ?? [])
      if (nearbyBed) {
        const rested = applyRestBedUse(world.interactables ?? [], nearbyBed.id, tick)
        if (rested) {
          return {
            ...withAutoEat(applyRestBedDriveTradeoff(agent), world.objects),
            interactedId: rested.bed.id,
            interactables: rested.interactables,
            targetKind: 'rest_bed',
            actionTarget: {
              kind: 'rest_bed',
              id: rested.bed.id,
              x: rested.bed.position.x,
              z: rested.bed.position.z,
            },
          }
        }
      }
      const nearbyLookout = findLookoutInInteractRange(agent, world.interactables ?? [])
      if (!nearbyLookout) return withAutoEat(agent, world.objects)
      const looked = applyLookoutUse(world.interactables ?? [], nearbyLookout.id, tick)
      if (!looked) return withAutoEat(agent, world.objects)
      return {
        ...withAutoEat(applyLookoutDriveTradeoff(agent), world.objects),
        interactedId: looked.lookout.id,
        interactables: looked.interactables,
        targetKind: 'lookout',
        actionTarget: {
          kind: 'lookout',
          id: looked.lookout.id,
          x: looked.lookout.position.x,
          z: looked.lookout.position.z,
        },
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
    interactedId: string | null
    interactables: Interactable[] | null
    labObjects: LabObjectInstance[] | null
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
    interactedId: extra.interactedId ?? null,
    interactables: extra.interactables ?? null,
    labObjects: extra.labObjects ?? null,
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
  const labImmortal = !allowsDeath(world.config.mode)
  const starting = labImmortal ? keepLabAgentAlive(agent) : agent

  if (!labImmortal && (!starting.alive || starting.health <= 0)) {
    return skippedPlan(
      starting.alive
        ? takeDeathDrop({
            ...starting,
            health: 0,
            alive: false,
            deathCause: starting.deathCause ?? 'health',
            matingPartnerId: null,
            matingTimeLeft: 0,
          }, starting.deathCause ?? 'health').agent
        : starting,
    )
  }

  const geneticsEnabled = context.geneticsEnabled !== false
  const withLabDrives = isHumanBehaviorLab(world.config.mode)
    ? applyLabEnvironmentDriveEffects(
        tickLabDrives(starting, dt, labCurriculumDriveRates(context.tick ?? 0, world.config)),
        world.labEnvironment,
        dt,
      )
    : starting
  let driven = tickCombatTimers(applyDrives(withLabDrives, dt, geneticsEnabled), dt)
  if (!driven.alive) {
    if (labImmortal) {
      driven = keepLabAgentAlive(driven)
    } else {
      const death = takeDeathDrop(driven, 'age')
      return skippedPlan(death.agent, death.dropped ? [death.dropped] : [])
    }
  }

  const energyBefore = driven.energy
  const hungerBefore = driven.hunger
  const healthBefore = driven.health
  const fatigueBefore = driven.fatigue
  const curiosityBefore = driven.curiosity
  const comfortBefore = driven.comfort
  const previousAction = driven.lastAction
  const foodInEatRange = findFoodInEatRange(driven, world.objects) !== null
  const mating = geneticsEnabled && isMating(driven)
  const seeking = geneticsEnabled && !mating && shouldSeekMate(driven)

  if (mating || seeking) {
    const acted = mating
      ? consumeNearbyFood(driven, world.objects)
      : consumeNearbyFood(seekMate(driven, world, dt), world.objects)
    const nextAgent = applyMetabolism(acted.agent, dt, mating ? 'REST' : 'MOVE_FORWARD', world)
    const afterMetabolism = labImmortal ? keepLabAgentAlive(nextAgent) : nextAgent
    const death = takeDeathDrop(afterMetabolism, afterMetabolism.deathCause ?? 'health')
    return {
      ...skippedPlan(death.agent, death.dropped ? [death.dropped] : []),
      consumedFoodId: acted.consumedFoodId,
      ate: acted.consumedFoodId !== null,
      energyBefore,
      healthBefore,
      hungerBefore,
      fatigueBefore,
      curiosityBefore,
      comfortBefore,
      foodInEatRange,
      previousAction,
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

  const executed = executeAction(driven, decision.selection.action, world, dt, tick)
  const nextAgent = applyMetabolism(executed.agent, dt, decision.selection.action, world)
  const afterMetabolism = labImmortal ? keepLabAgentAlive(nextAgent) : nextAgent
  const death = takeDeathDrop(afterMetabolism, afterMetabolism.deathCause ?? 'health')

  return {
    agent: death.agent,
    skipLearning: false,
    consumedFoodId: executed.consumedFoodId,
    pickedUpToolId: executed.pickedUpToolId,
    gatheredNode: executed.gatheredNode,
    gatheredAmount: executed.gatheredAmount,
    interactedId: executed.interactedId,
    interactables: executed.interactables,
    labObjects: executed.labObjects,
    durabilityDelta: executed.durabilityDelta,
    targetKind: executed.targetKind,
    actionTarget: executed.actionTarget,
    droppedTools: death.dropped ? [death.dropped] : [],
    energyBefore,
    healthBefore,
    hungerBefore,
    fatigueBefore,
    curiosityBefore,
    comfortBefore,
    foodInEatRange,
    previousAction,
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
    interactables: plan.interactables ?? world.interactables ?? [],
    labObjects: plan.labObjects ?? world.labObjects ?? [],
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
      interactedId: plan.interactedId,
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
    {
      fatigue: plan.fatigueBefore,
      curiosity: plan.curiosityBefore,
      comfort: plan.comfortBefore,
    },
    {
      foodDirection: plan.decision.observation.foodDirection,
      previousAction: plan.previousAction,
    },
  )

  const outcome = classifyActionOutcome({
    action: plan.decision.selection.action,
    ate: plan.ate,
    collided: plan.collided,
    died,
    pickedUp: plan.pickedUpToolId !== null,
    gathered: plan.gatheredAmount > 0,
    interacted: plan.interactedId !== null,
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
      targetId:
        combatTargetId ??
        plan.pickedUpToolId ??
        plan.gatheredNode?.id ??
        plan.interactedId ??
        plan.consumedFoodId,
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
    interactedId: plan.interactedId,
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

    if (isHumanBehaviorLab(world.config.mode)) {
      const spot = pickLabFoodPosition(nextObjects, currentFood)
      nextObjects.push({
        id: createId('food'),
        type: 'food',
        position: { x: spot.x, y: 0, z: spot.z },
        scale: 1,
        rotation: 0,
      })
    } else {
      nextObjects.push(createWorldObject('food', world.config, nextObjects, Math.random, undefined, world.terrain))
    }
    cooldown += spawnInterval
  }

  return { objects: nextObjects, foodSpawnCooldown: cooldown }
}
