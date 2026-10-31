import { applyLearningUpdate, decideAction, type LearningStepContext } from '../learning/controller'
import { findFoodInEatRange } from '../learning/observation'
import type { AgentAction } from '../learning/types'
import type { Agent } from '../types/agent'
import type { WorldObject, WorldState } from '../types/world'
import { clampStat, wrapAngle } from '../utils/math'
import {
  AGENT_RADIUS,
  ENERGY_CRITICAL,
  ENERGY_DRAIN_PER_SEC,
  FOOD_ENERGY_RESTORE,
  FOOD_HUNGER_RELIEF,
  FOOD_SPAWN_INTERVAL,
  HEALTH_DRAIN_PER_SEC,
  HEALTH_REGEN_PER_SEC,
  HUNGER_DRAIN_THRESHOLD,
  HUNGER_GAIN_PER_SEC,
  HUNGRY_EXTRA_DRAIN_PER_SEC,
  REST_ENERGY_DRAIN_MULTIPLIER,
  TARGET_FOOD_COUNT,
} from './constants'
import { collidesWithObstacles, isInsideWorld } from './spatial'
import { createWorldObject } from './worldFactory'

export interface AgentTickResult {
  agent: Agent
  consumedFoodId: string | null
}

function applyMetabolism(agent: Agent, dt: number, action: AgentAction): Agent {
  const drainScale = action === 'REST' ? REST_ENERGY_DRAIN_MULTIPLIER : 1
  let energy = clampStat(agent.energy - ENERGY_DRAIN_PER_SEC * drainScale * dt)
  let hunger = clampStat(agent.hunger + HUNGER_GAIN_PER_SEC * dt)

  if (hunger >= HUNGER_DRAIN_THRESHOLD) {
    energy = clampStat(energy - HUNGRY_EXTRA_DRAIN_PER_SEC * dt)
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

function moveForward(agent: Agent, world: WorldState, dt: number): { agent: Agent; collided: boolean } {
  const distance = agent.speed * dt
  const x = agent.position.x + Math.sin(agent.rotation) * distance
  const z = agent.position.z + Math.cos(agent.rotation) * distance
  const collided =
    !isInsideWorld(x, z, world.config.size) ||
    collidesWithObstacles(x, z, AGENT_RADIUS, world.objects)

  if (collided) {
    return { agent, collided: true }
  }

  return {
    agent: {
      ...agent,
      position: { x, z },
    },
    collided: false,
  }
}

function executeAction(
  agent: Agent,
  action: AgentAction,
  world: WorldState,
  dt: number,
): { agent: Agent; ate: boolean; collided: boolean; consumedFoodId: string | null } {
  switch (action) {
    case 'MOVE_FORWARD': {
      const moved = moveForward(agent, world, dt)
      return { agent: moved.agent, ate: false, collided: moved.collided, consumedFoodId: null }
    }
    case 'TURN_LEFT':
      return {
        agent: { ...agent, rotation: wrapAngle(agent.rotation + agent.turnRate * dt) },
        ate: false,
        collided: false,
        consumedFoodId: null,
      }
    case 'TURN_RIGHT':
      return {
        agent: { ...agent, rotation: wrapAngle(agent.rotation - agent.turnRate * dt) },
        ate: false,
        collided: false,
        consumedFoodId: null,
      }
    case 'EAT': {
      const food = findFoodInEatRange(agent, world.objects)
      if (!food) {
        return { agent, ate: false, collided: false, consumedFoodId: null }
      }

      return {
        agent: {
          ...agent,
          energy: clampStat(agent.energy + FOOD_ENERGY_RESTORE),
          hunger: clampStat(agent.hunger - FOOD_HUNGER_RELIEF),
        },
        ate: true,
        collided: false,
        consumedFoodId: food.id,
      }
    }
    case 'REST':
      return { agent, ate: false, collided: false, consumedFoodId: null }
  }
}

export function updateAgent(
  agent: Agent,
  world: WorldState,
  dt: number,
  context: LearningStepContext,
): AgentTickResult {
  if (!agent.alive) {
    return { agent, consumedFoodId: null }
  }

  const energyBefore = agent.energy
  const hungerBefore = agent.hunger
  const foodInEatRange = findFoodInEatRange(agent, world.objects) !== null
  const decision = decideAction(agent, world, context)
  const executed = executeAction(agent, decision.selection.action, world, dt)
  const aged: Agent = {
    ...executed.agent,
    age: agent.age + dt,
  }
  const nextAgent = applyMetabolism(aged, dt, decision.selection.action)
  const died = !nextAgent.alive

  const nextWorld: WorldState = executed.consumedFoodId
    ? {
        ...world,
        objects: world.objects.filter((object) => object.id !== executed.consumedFoodId),
      }
    : world

  const reward = applyLearningUpdate(
    nextAgent,
    nextWorld,
    decision.stateKey,
    {
      action: decision.selection.action,
      ate: executed.ate,
      collided: executed.collided,
      died,
      consumedFoodId: executed.consumedFoodId,
    },
    energyBefore,
    hungerBefore,
    foodInEatRange,
    decision.selection.explored,
    context,
  )

  return {
    agent: {
      ...nextAgent,
      lastAction: decision.selection.action,
      lastReward: reward,
      lastStateKey: decision.stateKey,
    },
    consumedFoodId: executed.consumedFoodId,
  }
}

export function respawnFood(
  objects: WorldObject[],
  world: WorldState,
  dt: number,
): { objects: WorldObject[]; foodSpawnCooldown: number } {
  const foodCount = objects.reduce((count, object) => count + (object.type === 'food' ? 1 : 0), 0)

  if (foodCount >= TARGET_FOOD_COUNT) {
    return { objects, foodSpawnCooldown: FOOD_SPAWN_INTERVAL }
  }

  let cooldown = world.foodSpawnCooldown - dt
  const nextObjects = [...objects]

  while (cooldown <= 0) {
    const currentFood = nextObjects.reduce(
      (count, object) => count + (object.type === 'food' ? 1 : 0),
      0,
    )
    if (currentFood >= TARGET_FOOD_COUNT) {
      cooldown = FOOD_SPAWN_INTERVAL
      break
    }

    nextObjects.push(createWorldObject('food', world.config, nextObjects))
    cooldown += FOOD_SPAWN_INTERVAL
  }

  return { objects: nextObjects, foodSpawnCooldown: cooldown }
}
