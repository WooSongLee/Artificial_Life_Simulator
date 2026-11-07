/**
 * Affordance helpers for the Life Sandbox catalog.
 * Maps catalog verbs → existing AgentAction schema (no new actions).
 */

import type { AgentAction } from '../learning/types'
import {
  LAB_AFFORDANCE_KINDS,
  type LabAffordanceDefinition,
  type LabAffordanceKind,
  type LabObjectState,
  type LabObjectTypeDefinition,
} from '../types/labObject'

/** Default executor mapping — keep Action schema v3 stable. */
export const AFFORDANCE_EXECUTOR: Record<LabAffordanceKind, AgentAction> = {
  open: 'GATHER',
  close: 'GATHER',
  pick: 'PICK_UP',
  drop: 'PICK_UP',
  store: 'GATHER',
  retrieve: 'GATHER',
  toggle: 'GATHER',
  operate: 'GATHER',
  inspect: 'GATHER',
  observe: 'GATHER',
  consume: 'EAT',
  prepare: 'GATHER',
  combine: 'GATHER',
  repair: 'GATHER',
  clean: 'GATHER',
  move_object: 'GATHER',
  wait: 'REST',
  rest_use: 'GATHER',
}

export function executorActionFor(kind: LabAffordanceKind): AgentAction {
  return AFFORDANCE_EXECUTOR[kind]
}

export function isLabAffordanceKind(value: unknown): value is LabAffordanceKind {
  return typeof value === 'string' && (LAB_AFFORDANCE_KINDS as readonly string[]).includes(value)
}

/** Build a catalog affordance with schema-safe executor filled in. */
export function defineAffordance(
  kind: LabAffordanceKind,
  partial: Omit<LabAffordanceDefinition, 'kind' | 'executorAction' | 'label'> & {
    label?: string
    executorAction?: AgentAction
  } = {},
): LabAffordanceDefinition {
  const { label, executorAction, ...rest } = partial
  return {
    kind,
    label: label ?? kind,
    executorAction: executorAction ?? executorActionFor(kind),
    ...rest,
  }
}

export function affordanceKindsOn(typeDef: LabObjectTypeDefinition): LabAffordanceKind[] {
  return typeDef.affordances.map((entry) => entry.kind)
}

export function findAffordance(
  typeDef: LabObjectTypeDefinition,
  kind: LabAffordanceKind,
): LabAffordanceDefinition | null {
  return typeDef.affordances.find((entry) => entry.kind === kind) ?? null
}

/** Simple state predicate used by future executors (P2). */
export function stateMatchesEquals(
  state: LabObjectState,
  required: LabObjectState | undefined,
): boolean {
  if (!required) return true
  for (const [key, expected] of Object.entries(required)) {
    if (state[key as keyof LabObjectState] !== expected) return false
  }
  return true
}

/** All executor actions referenced by a type (for mask / docs). */
export function executorActionsForType(typeDef: LabObjectTypeDefinition): AgentAction[] {
  const set = new Set<AgentAction>()
  for (const aff of typeDef.affordances) {
    set.add(aff.executorAction)
  }
  return [...set]
}
