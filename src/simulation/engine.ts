import { DEFAULT_EVOLUTION_CONFIG } from '../evolution/constants'
import { processMating, type MatingTickResult } from '../evolution/mating'
import type { EvolutionConfig } from '../evolution/types'
import { DEFAULT_LEARNING_CONTEXT, type LearningStepContext } from '../learning/controller'
import type { Agent } from '../types/agent'
import type { SimulationSnapshot } from '../types/simulation'
import type { Rng } from '../utils/random'
import { beginAgentTick, finishAgentTick, overlayAgents, respawnFood } from './agentSystem'
import { resolveCombatTick, type CombatTickResult } from './combat'
import { regenerateForage, removeWorldTool, replaceForageNode } from './forage'
import { createDefaultLabEnvironment, tickLabEnvironment } from './labEnvironment'
import {
  allowsCombat,
  allowsMating,
  clampSimulationMode,
  effectiveGeneticsEnabled,
  isHumanBehaviorLab,
} from './labMode'
import { addOutcomeStats, createEmptyOutcomeStats, isDriveTargetKind } from './outcomes'

export interface SimulationStepContext extends Omit<LearningStepContext, 'rng'> {
  evolutionConfig?: EvolutionConfig
  rng?: Rng
}

export interface SimulationStepResult extends SimulationSnapshot {
  born: Agent[]
  recordedGeneration: number | null
  recordedGenerationStartTick: number | null
  removedAgentIds: string[]
}

export function stepSimulation(
  snapshot: SimulationSnapshot,
  dt: number,
  context: SimulationStepContext = DEFAULT_LEARNING_CONTEXT,
): SimulationStepResult {
  const objects = snapshot.world.objects.slice()
  let forageNodes = snapshot.world.forageNodes.slice()
  let worldTools = snapshot.world.worldTools.slice()
  let interactables = (snapshot.world.interactables ?? []).slice()
  let labObjects = (snapshot.world.labObjects ?? []).slice()
  const plans = []
  const plannedAgents: Agent[] = []
  const evolutionConfig = context.evolutionConfig ?? DEFAULT_EVOLUTION_CONFIG
  const mode = clampSimulationMode(snapshot.world.config.mode)
  const geneticsEnabled = effectiveGeneticsEnabled(mode, evolutionConfig.geneticsEnabled)
  const learningContext = {
    learningEnabled: context.learningEnabled,
    learningConfig: context.learningConfig,
    rewardConfig: context.rewardConfig,
    rng: context.rng ?? Math.random,
    tick: snapshot.tick + 1,
    geneticsEnabled,
  }

  for (const agent of snapshot.world.agents) {
    const worldView = {
      ...snapshot.world,
      objects,
      forageNodes,
      worldTools,
      interactables,
      labObjects,
      agents: overlayAgents(snapshot.world.agents, plannedAgents),
    }
    const plan = beginAgentTick(agent, worldView, dt, learningContext)
    plans.push(plan)
    plannedAgents.push(plan.agent)

    if (plan.consumedFoodId) {
      const index = objects.findIndex((object) => object.id === plan.consumedFoodId)
      if (index >= 0) {
        objects.splice(index, 1)
      }
    }
    if (plan.pickedUpToolId) {
      worldTools = removeWorldTool(worldTools, plan.pickedUpToolId)
    }
    if (plan.gatheredNode) {
      forageNodes = replaceForageNode(forageNodes, plan.gatheredNode)
    }
    if (plan.interactables) {
      interactables = plan.interactables
    }
    if (plan.labObjects) {
      labObjects = plan.labObjects
    }
    for (const dropped of plan.droppedTools) {
      worldTools = [...worldTools, dropped]
    }
  }

  const combat: CombatTickResult = allowsCombat(mode)
    ? resolveCombatTick(
        plans.flatMap((plan) => (plan.attackIntent ? [plan.attackIntent] : [])),
        plannedAgents,
        snapshot.tick + 1,
      )
    : {
        agents: plannedAgents,
        droppedTools: [],
        hits: [],
        hitsByAttacker: new Map(),
        hitsByDefender: new Map(),
      }
  for (const dropped of combat.droppedTools) {
    if (worldTools.some((tool) => tool.id === dropped.id)) continue
    worldTools = [...worldTools, dropped]
  }

  const agents: Agent[] = []
  const resolvedWorld = {
    ...snapshot.world,
    objects,
    forageNodes,
    worldTools,
    interactables,
    labObjects,
    agents: combat.agents,
  }
  let outcomeStats = snapshot.world.outcomeStats ?? createEmptyOutcomeStats()
  for (const plan of plans) {
    const result = finishAgentTick(plan, combat, resolvedWorld, learningContext)
    agents.push(result.agent)
    const action = plan.decision?.selection.action
    const interacted = result.interactedId !== null
    outcomeStats = addOutcomeStats(outcomeStats, {
      foodEaten: plan.ate ? 1 : 0,
      resourcesGathered: result.gatheredAmount,
      toolPickupAttempts: action === 'PICK_UP' ? 1 : 0,
      toolPickupSuccesses: result.pickedUpToolId ? 1 : 0,
      gatherAttempts: action === 'GATHER' && !interacted ? 1 : 0,
      gatherSuccesses: result.gatheredAmount > 0 ? 1 : 0,
      interactAttempts: interacted ? 1 : 0,
      interactSuccesses: interacted ? 1 : 0,
      drivePicks: isDriveTargetKind(result.targetKind) ? 1 : 0,
      // Lab survival signal: explicit EAT or auto-eat when food is reached.
      survivalPicks: action === 'EAT' || plan.ate ? 1 : 0,
      damageDealt: result.damageDealt,
      damageReceived: result.damageTaken,
      attackAttempts: action === 'ATTACK' ? 1 : 0,
      attackHits: result.damageDealt > 0 ? 1 : 0,
      defendAttempts: action === 'DEFEND' ? 1 : 0,
      defendReductions: result.damageReduced > 0 ? 1 : 0,
      fleeAttempts: action === 'FLEE' ? 1 : 0,
      fleeSuccesses:
        action === 'FLEE' && (plan.fleeDistanceAfter ?? 0) > (plan.fleeDistanceBefore ?? 0) ? 1 : 0,
    })
  }

  const afterSpawn = respawnFood(objects, snapshot.world, dt)
  const afterForage = regenerateForage(forageNodes, snapshot.world, dt)
  const labEnvironment = isHumanBehaviorLab(mode)
    ? tickLabEnvironment(snapshot.world.labEnvironment ?? createDefaultLabEnvironment(), dt)
    : null
  const nextWorld = {
    ...snapshot.world,
    agents,
    objects: afterSpawn.objects,
    forageNodes: afterForage.forageNodes,
    worldTools,
    interactables,
    labObjects,
    labEnvironment,
    foodSpawnCooldown: afterSpawn.foodSpawnCooldown,
    forageSpawnCooldown: afterForage.forageSpawnCooldown,
    outcomeStats,
  }

  if (!allowsMating(mode) || !geneticsEnabled) {
    return {
      tick: snapshot.tick + 1,
      world: nextWorld,
      born: [],
      recordedGeneration: null,
      recordedGenerationStartTick: null,
      removedAgentIds: [],
    }
  }

  const reproduced = processMating(
    nextWorld,
    snapshot.tick + 1,
    evolutionConfig,
    context.rng ?? Math.random,
  )

  return {
    tick: snapshot.tick + 1,
    world: reproduced.world,
    born: reproduced.born,
    recordedGeneration: reproduced.recordedGeneration,
    recordedGenerationStartTick: reproduced.recordedGenerationStartTick,
    removedAgentIds: reproduced.removedAgentIds,
  }
}

export type { MatingTickResult }
