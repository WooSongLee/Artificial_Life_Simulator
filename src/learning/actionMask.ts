import { canAttemptAttack, canDefendOrFlee } from '../simulation/combat'
import { findGatherableNode, findPickupTool } from '../simulation/forage'
import { canInteractGatherTarget } from '../simulation/interactables'
import { allowsCombat, clampSimulationMode } from '../simulation/labMode'
import type { Agent } from '../types/agent'
import type { WorldState } from '../types/world'
import { findFoodInEatRange } from './observation'
import { AGENT_ACTIONS } from './types'
import type { AgentAction } from './types'

const ALWAYS_LEGAL: readonly AgentAction[] = ['MOVE_FORWARD', 'TURN_LEFT', 'TURN_RIGHT', 'REST']

export function legalActionsFor(agent: Agent, world: WorldState): AgentAction[] {
  const legal = [...ALWAYS_LEGAL]
  if (findFoodInEatRange(agent, world.objects)) {
    legal.push('EAT')
  }
  if (findPickupTool(agent, world)) {
    legal.push('PICK_UP')
  }
  if (findGatherableNode(agent, world) || canInteractGatherTarget(agent, world)) {
    // STEP 16: reuse GATHER for switch toggle / box push (no Action schema bump).
    legal.push('GATHER')
  }
  if (allowsCombat(clampSimulationMode(world.config.mode))) {
    if (canAttemptAttack(agent, world)) {
      legal.push('ATTACK')
    }
    if (canDefendOrFlee(agent, world)) {
      legal.push('DEFEND', 'FLEE')
    }
  }
  return legal
}

export function isLegalAction(action: AgentAction, legal: readonly AgentAction[]): boolean {
  return legal.includes(action)
}

export function fallbackLegalAction(legal: readonly AgentAction[]): AgentAction {
  return legal[0] ?? 'REST'
}

export function allActionsLegal(legal: readonly AgentAction[]): boolean {
  return legal.length === AGENT_ACTIONS.length
}
