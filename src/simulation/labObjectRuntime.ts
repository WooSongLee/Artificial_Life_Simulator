/**
 * Env-P1/P2 Lab object runtime — catalog-driven seed + thin affordance executor.
 * Uses existing AgentAction schema only (GATHER / EAT / PICK_UP / …). Ecology stays empty.
 *
 * Env-P2 chain: fridge open→retrieve → PICK_UP(hold) → stove operate | table consume.
 */

import type { Agent } from '../types/agent'
import type {
  LabAffordanceDefinition,
  LabAffordanceKind,
  LabObjectInstance,
  LabObjectState,
  LabObjectTypeDefinition,
} from '../types/labObject'
import type { AgentAction } from '../learning/types'
import type { WorldConfig } from '../types/world'
import { createId } from '../utils/id'
import { clampStat, distanceSq } from '../utils/math'
import { LAB_ARENA } from './interactables'
import { findAffordance, stateMatchesEquals } from './labAffordance'
import { isHumanBehaviorLab, clampSimulationMode } from './labMode'
import { getLabObjectType, requireLabObjectType } from './labObjectCatalog'

/** Kitchen appliance anchors (survival chamber / kitchen zone). Offset from food shelf. */
export const LAB_KITCHEN_ANCHORS = {
  refrigerator: { x: LAB_ARENA.survival.x - 2.15, z: LAB_ARENA.survival.z + 1.35 },
  stove: { x: LAB_ARENA.survival.x + 2.05, z: LAB_ARENA.survival.z + 1.25 },
  sink: { x: LAB_ARENA.survival.x + 2.05, z: LAB_ARENA.survival.z - 0.85 },
  dining_table: { x: LAB_ARENA.survival.x - 0.15, z: LAB_ARENA.survival.z - 1.45 },
  /** Drop point when food is retrieved from the fridge. */
  foodRetrieve: { x: LAB_ARENA.survival.x - 1.55, z: LAB_ARENA.survival.z + 0.55 },
} as const

const PASSIVE_AFFORDANCES: ReadonlySet<LabAffordanceKind> = new Set(['inspect', 'observe'])

export interface LabAffordanceResult {
  labObjects: LabObjectInstance[]
  target: LabObjectInstance
  affordance: LabAffordanceDefinition
  tags: readonly string[]
  /** Need deltas applied to the acting agent (positive = gain / relief of deficit). */
  needDeltas: NonNullable<NonNullable<LabAffordanceDefinition['effects']>['needs']>
  /**
   * When defined, overwrite `agent.heldLabObjectId`.
   * `undefined` = unchanged; `null` = clear; string = set.
   */
  heldLabObjectId?: string | null
  /** Affordance selected but blocked (e.g. missing held item) — no world mutation. */
  blocked?: boolean
}

export type LabAgentView = Pick<Agent, 'position' | 'heldLabObjectId'>

export function createLabObjectInstance(
  objectType: string,
  position: { x: number; z: number; y?: number },
  overrides: Partial<
    Pick<LabObjectInstance, 'id' | 'rotation' | 'scale' | 'objectState' | 'discoveryStatus' | 'objectRelations'>
  > = {},
): LabObjectInstance {
  const typeDef = requireLabObjectType(objectType)
  return {
    id: overrides.id ?? createId(objectType),
    objectType: typeDef.objectType,
    zoneId: typeDef.defaultZone,
    position: { x: position.x, y: position.y ?? 0, z: position.z },
    rotation: overrides.rotation ?? 0,
    scale: overrides.scale ?? 1,
    objectState: { ...typeDef.objectState, ...overrides.objectState },
    discoveryStatus: overrides.discoveryStatus ?? 'seen',
    durability: typeDef.durability,
    objectRelations: overrides.objectRelations ?? typeDef.objectRelations,
  }
}

/**
 * Seed Kitchen core appliances (+ dormant food until fridge retrieve).
 * Bedroom bed remains the legacy `rest_bed` Interactable.
 */
export function createKitchenBedroomLabObjects(config: WorldConfig): LabObjectInstance[] {
  if (!isHumanBehaviorLab(clampSimulationMode(config.mode))) return []

  const fridge = createLabObjectInstance('refrigerator', LAB_KITCHEN_ANCHORS.refrigerator, {
    rotation: Math.PI / 2,
  })
  const stove = createLabObjectInstance('stove', LAB_KITCHEN_ANCHORS.stove, {
    rotation: -Math.PI / 2,
  })
  const sink = createLabObjectInstance('sink', LAB_KITCHEN_ANCHORS.sink, {
    rotation: -Math.PI / 2,
  })
  const table = createLabObjectInstance('dining_table', LAB_KITCHEN_ANCHORS.dining_table, {
    rotation: 0,
  })
  // Contained: locked until refrigerator retrieve; not EAT-able while locked.
  const food = createLabObjectInstance('food_item', LAB_KITCHEN_ANCHORS.refrigerator, {
    objectState: { freshness: 90, locked: true, used: false },
    objectRelations: [{ role: 'placed_on', targetId: fridge.id, targetType: 'refrigerator' }],
  })

  return [fridge, stove, sink, table, food]
}

export function getHeldLabObject(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
): LabObjectInstance | null {
  if (!agent.heldLabObjectId) return null
  return labObjects.find((item) => item.id === agent.heldLabObjectId) ?? null
}

/** Runtime kitchen types that may appear in observation cues. */
export type LabObjectCuePrefix = 'fridge' | 'stove' | 'sink' | 'table' | 'food'

export function labObjectCuePrefix(objectType: string): LabObjectCuePrefix | null {
  if (objectType === 'refrigerator') return 'fridge'
  if (objectType === 'stove') return 'stove'
  if (objectType === 'sink') return 'sink'
  if (objectType === 'dining_table') return 'table'
  if (objectType === 'food_item') return 'food'
  return null
}

/** Contained/depleted food is not a navigation cue (fridge is). */
export function isLabObjectObservable(item: LabObjectInstance): boolean {
  const typeDef = getLabObjectType(item.objectType)
  if (!typeDef || typeDef.implementation !== 'runtime') return false
  if (!labObjectCuePrefix(item.objectType)) return false
  if (item.objectType === 'food_item') {
    if (item.objectState.locked === true) return false
    if (typeof item.objectState.freshness === 'number' && item.objectState.freshness < 1) return false
  }
  return true
}

/**
 * Nearest detectable runtime Lab object (held excluded).
 * Detection callback matches forage/interactable sensing.
 */
export function findVisibleLabObject(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
  canDetect: (x: number, z: number, distSq: number) => boolean,
): LabObjectInstance | null {
  let nearest: LabObjectInstance | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const item of labObjects) {
    if (isHeldByAgent(agent, item)) continue
    if (!isLabObjectObservable(item)) continue
    const dist = distanceSq(agent.position.x, agent.position.z, item.position.x, item.position.z)
    if (!canDetect(item.position.x, item.position.z, dist)) continue
    if (dist >= nearestDist) continue
    nearest = item
    nearestDist = dist
  }

  return nearest
}

export function agentHoldsType(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
  types: readonly string[],
): boolean {
  const held = getHeldLabObject(agent, labObjects)
  return held !== null && types.includes(held.objectType)
}

function isHeldByAgent(agent: LabAgentView, item: LabObjectInstance): boolean {
  return agent.heldLabObjectId === item.id
}

export function findLabObjectInRange(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
  predicate?: (item: LabObjectInstance, typeDef: LabObjectTypeDefinition) => boolean,
): LabObjectInstance | null {
  let nearest: LabObjectInstance | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const item of labObjects) {
    if (isHeldByAgent(agent, item)) continue
    const typeDef = getLabObjectType(item.objectType)
    if (!typeDef || typeDef.implementation !== 'runtime') continue
    if (predicate && !predicate(item, typeDef)) continue
    const reach = typeDef.interactionRange * typeDef.interactionRange
    const dist = distanceSq(agent.position.x, agent.position.z, item.position.x, item.position.z)
    if (dist > reach || dist >= nearestDist) continue
    nearest = item
    nearestDist = dist
  }

  return nearest
}

function stateMinMet(
  state: LabObjectState,
  required: Partial<Record<string, number>> | undefined,
): boolean {
  if (!required) return true
  for (const [key, min] of Object.entries(required)) {
    const value = state[key as keyof LabObjectState]
    if (typeof value !== 'number' || value < min) return false
  }
  return true
}

function stateMaxMet(
  state: LabObjectState,
  required: Partial<Record<string, number>> | undefined,
): boolean {
  if (!required) return true
  for (const [key, max] of Object.entries(required)) {
    const value = state[key as keyof LabObjectState]
    if (typeof value !== 'number' || value > max) return false
  }
  return true
}

export function affordancePreconditionsMet(
  affordance: LabAffordanceDefinition,
  instance: LabObjectInstance,
  agent?: LabAgentView | null,
  labObjects: readonly LabObjectInstance[] = [],
): boolean {
  // Held-slot mutual exclusion for pick/drop (Env-P2).
  if (affordance.kind === 'pick' && agent?.heldLabObjectId) return false
  if (affordance.kind === 'drop') {
    if (!agent?.heldLabObjectId || agent.heldLabObjectId !== instance.id) return false
  }

  const pre = affordance.preconditions
  if (!pre) return true
  if (!stateMatchesEquals(instance.objectState, pre.stateEquals)) return false
  if (!stateMinMet(instance.objectState, pre.stateMin)) return false
  if (!stateMaxMet(instance.objectState, pre.stateMax)) return false
  if (pre.zoneIn && !pre.zoneIn.includes(instance.zoneId)) return false
  if (pre.requiresHeldType && pre.requiresHeldType.length > 0) {
    if (!agent || !agentHoldsType(agent, labObjects, pre.requiresHeldType)) return false
  }
  return true
}

/** State/relation gates only — used to detect blocked-by-held failures. */
function affordanceStatePreconditionsMet(
  affordance: LabAffordanceDefinition,
  instance: LabObjectInstance,
): boolean {
  const pre = affordance.preconditions
  if (!pre) return true
  if (!stateMatchesEquals(instance.objectState, pre.stateEquals)) return false
  if (!stateMinMet(instance.objectState, pre.stateMin)) return false
  if (!stateMaxMet(instance.objectState, pre.stateMax)) return false
  if (pre.zoneIn && !pre.zoneIn.includes(instance.zoneId)) return false
  return true
}

function transitionMatches(
  typeDef: LabObjectTypeDefinition,
  kind: LabAffordanceKind,
  state: LabObjectState,
): LabObjectState | null {
  for (const transition of typeDef.stateTransitions) {
    if (transition.via !== kind) continue
    if (!stateMatchesEquals(state, transition.from)) continue
    return transition.to
  }
  return null
}

/** Rank: productive verbs beat toggles; held-gated operate/consume preferred when available. */
function affordancePriority(
  affordance: LabAffordanceDefinition,
  typeDef: LabObjectTypeDefinition,
  state: LabObjectState,
): number {
  let score = PASSIVE_AFFORDANCES.has(affordance.kind) ? 0 : 10
  if (transitionMatches(typeDef, affordance.kind, state)) score += 5
  if (affordance.effects?.setState) score += 2
  if (affordance.kind === 'retrieve' || affordance.kind === 'consume') score += 10
  if (affordance.kind === 'operate' || affordance.kind === 'prepare') score += 8
  if (affordance.kind === 'pick') score += 6
  if (affordance.kind === 'toggle') score += 1
  return score
}

export function selectAffordanceForAction(
  instance: LabObjectInstance,
  action: AgentAction,
  agent?: LabAgentView | null,
  labObjects: readonly LabObjectInstance[] = [],
): { typeDef: LabObjectTypeDefinition; affordance: LabAffordanceDefinition } | null {
  const typeDef = getLabObjectType(instance.objectType)
  if (!typeDef || typeDef.implementation !== 'runtime') return null

  const candidates = typeDef.affordances.filter(
    (aff) =>
      aff.executorAction === action &&
      affordancePreconditionsMet(aff, instance, agent, labObjects),
  )
  if (candidates.length === 0) return null

  candidates.sort(
    (a, b) =>
      affordancePriority(b, typeDef, instance.objectState) -
      affordancePriority(a, typeDef, instance.objectState),
  )
  return { typeDef, affordance: candidates[0]! }
}

function gatherCandidatesByState(
  instance: LabObjectInstance,
  typeDef: LabObjectTypeDefinition,
): LabAffordanceDefinition[] {
  const candidates = typeDef.affordances.filter(
    (aff) => aff.executorAction === 'GATHER' && affordanceStatePreconditionsMet(aff, instance),
  )
  candidates.sort(
    (a, b) =>
      affordancePriority(b, typeDef, instance.objectState) -
      affordancePriority(a, typeDef, instance.objectState),
  )
  return candidates
}

/** Stove cook is skipped once held food is already prepared — frees toggle to power off. */
function stoveOperateUseful(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
  affordance: LabAffordanceDefinition,
): boolean {
  if (affordance.kind !== 'operate') return true
  const held = getHeldLabObject(agent, labObjects)
  if (!held || held.objectType !== 'food_item') return true
  return held.objectState.used !== true
}

function patchState(state: LabObjectState, patch: LabObjectState | undefined): LabObjectState {
  if (!patch) return state
  return { ...state, ...patch }
}

function releaseContainedFood(
  labObjects: LabObjectInstance[],
  fridge: LabObjectInstance,
): LabObjectInstance[] {
  const drop = LAB_KITCHEN_ANCHORS.foodRetrieve
  let released = false
  const next = labObjects.map((item) => {
    if (item.objectType !== 'food_item') return item
    if (item.objectState.locked !== true) return item
    released = true
    return {
      ...item,
      position: { x: drop.x, y: 0, z: drop.z },
      objectState: { ...item.objectState, locked: false, freshness: 90, used: false },
      objectRelations: [{ role: 'placed_on' as const, targetType: 'refrigerator', targetId: fridge.id }],
      discoveryStatus: 'seen' as const,
    }
  })
  if (released) return next
  return [
    ...next,
    createLabObjectInstance('food_item', drop, {
      objectState: { freshness: 90, locked: false, used: false },
      objectRelations: [{ role: 'placed_on', targetType: 'refrigerator', targetId: fridge.id }],
    }),
  ]
}

function cookHeldFood(
  labObjects: LabObjectInstance[],
  agent: LabAgentView,
): { labObjects: LabObjectInstance[]; tags: string[] } {
  const held = getHeldLabObject(agent, labObjects)
  if (!held || held.objectType !== 'food_item') {
    return { labObjects: [...labObjects], tags: [] }
  }
  const freshness =
    typeof held.objectState.freshness === 'number'
      ? Math.min(100, Math.max(held.objectState.freshness, 95))
      : 95
  return {
    labObjects: labObjects.map((item) =>
      item.id === held.id
        ? {
            ...item,
            objectState: { ...item.objectState, used: true, freshness },
            discoveryStatus: 'inspected' as const,
          }
        : item,
    ),
    tags: ['food_cooked'],
  }
}

function consumeHeldFood(
  labObjects: LabObjectInstance[],
  agent: LabAgentView,
  cookedBonus: boolean,
): {
  labObjects: LabObjectInstance[]
  heldLabObjectId: null
  needDeltas: LabAffordanceResult['needDeltas']
  tags: string[]
  target: LabObjectInstance
} | null {
  const held = getHeldLabObject(agent, labObjects)
  if (!held || held.objectType !== 'food_item') return null
  if (held.objectState.locked === true) return null
  if (typeof held.objectState.freshness === 'number' && held.objectState.freshness < 1) return null

  const cooked = held.objectState.used === true
  const needDeltas: LabAffordanceResult['needDeltas'] = cookedBonus
    ? {
        hunger: cooked ? -40 : -35,
        energy: cooked ? 14 : 12,
        comfort: cooked ? 10 : 6,
      }
    : {
        hunger: -35,
        energy: 12,
      }

  const nextFood: LabObjectInstance = {
    ...held,
    objectState: { ...held.objectState, freshness: 0 },
    discoveryStatus: 'inspected',
  }
  return {
    labObjects: labObjects.map((item) => (item.id === held.id ? nextFood : item)),
    heldLabObjectId: null,
    needDeltas,
    tags: cooked && cookedBonus ? ['eat_cooked'] : [],
    target: nextFood,
  }
}

export function applyLabAffordance(
  labObjects: readonly LabObjectInstance[],
  instanceId: string,
  kind: LabAffordanceKind,
  agent?: LabAgentView | null,
): LabAffordanceResult | null {
  const target = labObjects.find((item) => item.id === instanceId)
  if (!target) return null
  const typeDef = getLabObjectType(target.objectType)
  if (!typeDef || typeDef.implementation !== 'runtime') return null
  const affordance = findAffordance(typeDef, kind)
  if (!affordance) return null
  if (!affordancePreconditionsMet(affordance, target, agent, labObjects)) return null

  const actor: LabAgentView = agent ?? { position: { x: target.position.x, z: target.position.z }, heldLabObjectId: null }

  // ── pick / drop (held slot) ──────────────────────────────────────────
  if (kind === 'pick') {
    if (actor.heldLabObjectId) return null
    return {
      labObjects: labObjects.map((item) =>
        item.id === target.id ? { ...item, discoveryStatus: 'inspected' as const } : item,
      ),
      target,
      affordance,
      tags: affordance.effects?.tags ?? ['food_pick'],
      needDeltas: affordance.effects?.needs ?? {},
      heldLabObjectId: target.id,
    }
  }

  if (kind === 'drop') {
    const held = getHeldLabObject(actor, labObjects)
    if (!held) return null
    const dropped: LabObjectInstance = {
      ...held,
      position: { x: actor.position.x, y: 0, z: actor.position.z },
      discoveryStatus: 'seen',
    }
    return {
      labObjects: labObjects.map((item) => (item.id === held.id ? dropped : item)),
      target: dropped,
      affordance,
      tags: affordance.effects?.tags ?? ['food_drop'],
      needDeltas: {},
      heldLabObjectId: null,
    }
  }

  const fromTransition = transitionMatches(typeDef, kind, target.objectState)
  let nextState = patchState(target.objectState, fromTransition ?? undefined)
  nextState = patchState(nextState, affordance.effects?.setState)

  let nextObjects = labObjects.map((item) =>
    item.id === target.id
      ? { ...item, objectState: nextState, discoveryStatus: 'inspected' as const }
      : item,
  )
  const updatedTarget = nextObjects.find((item) => item.id === target.id)!
  let tags = [...(affordance.effects?.tags ?? [])]
  let needDeltas = { ...(affordance.effects?.needs ?? {}) }
  let heldLabObjectId: string | null | undefined

  if (kind === 'retrieve' && target.objectType === 'refrigerator') {
    nextObjects = releaseContainedFood(nextObjects, updatedTarget)
  }

  // Stove cook: mark held food prepared/cooked while keeping it held.
  if (kind === 'operate' && target.objectType === 'stove') {
    const cooked = cookHeldFood(nextObjects, actor)
    nextObjects = cooked.labObjects
    tags = [...tags, ...cooked.tags]
  }

  // Food prepare (on the item itself while held or in range): mark used.
  if (kind === 'prepare' && target.objectType === 'food_item') {
    tags = [...tags, 'food_prepped']
  }

  // Dining table consume: eat held food with comfort (bonus if cooked).
  if (kind === 'consume' && target.objectType === 'dining_table') {
    const eaten = consumeHeldFood(nextObjects, actor, true)
    if (!eaten) return null
    nextObjects = eaten.labObjects
    needDeltas = eaten.needDeltas
    heldLabObjectId = eaten.heldLabObjectId
    tags = [...tags, ...eaten.tags]
  }

  // Direct food consume (ground or held).
  if (kind === 'consume' && target.objectType === 'food_item') {
    if (isHeldByAgent(actor, target) || actor.heldLabObjectId === target.id) {
      heldLabObjectId = null
    }
  }

  return {
    labObjects: nextObjects,
    target: nextObjects.find((item) => item.id === target.id)!,
    affordance,
    tags,
    needDeltas,
    heldLabObjectId,
  }
}

export function applyNeedDeltas(
  agent: Agent,
  deltas: LabAffordanceResult['needDeltas'],
): Agent {
  let next = agent
  if (deltas.energy !== undefined) next = { ...next, energy: clampStat(next.energy + deltas.energy) }
  if (deltas.hunger !== undefined) next = { ...next, hunger: clampStat(next.hunger + deltas.hunger) }
  if (deltas.health !== undefined) next = { ...next, health: clampStat(next.health + deltas.health) }
  if (deltas.fatigue !== undefined && next.fatigue !== undefined) {
    next = { ...next, fatigue: clampStat(next.fatigue + deltas.fatigue) }
  }
  if (deltas.curiosity !== undefined && next.curiosity !== undefined) {
    next = { ...next, curiosity: clampStat(next.curiosity + deltas.curiosity) }
  }
  if (deltas.comfort !== undefined && next.comfort !== undefined) {
    next = { ...next, comfort: clampStat(next.comfort + deltas.comfort) }
  }
  return next
}

export function applyHeldPatch(
  agent: Agent,
  heldLabObjectId: string | null | undefined,
): Agent {
  if (heldLabObjectId === undefined) return agent
  return { ...agent, heldLabObjectId }
}

export function canUseLabGatherTarget(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
): boolean {
  const nearby = findLabObjectInRange(agent, labObjects)
  if (!nearby) return false
  return selectAffordanceForAction(nearby, 'GATHER', agent, labObjects) !== null
}

export function canConsumeLabFood(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
): boolean {
  const held = getHeldLabObject(agent, labObjects)
  if (held?.objectType === 'food_item') {
    if (selectAffordanceForAction(held, 'EAT', agent, labObjects)) return true
  }
  const table = findLabObjectInRange(
    agent,
    labObjects,
    (item) => item.objectType === 'dining_table',
  )
  if (table && selectAffordanceForAction(table, 'EAT', agent, labObjects)) return true

  const food = findLabObjectInRange(agent, labObjects, (item) => item.objectType === 'food_item')
  if (!food) return false
  return selectAffordanceForAction(food, 'EAT', agent, labObjects) !== null
}

export function canPickOrDropLabObject(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
): boolean {
  if (getHeldLabObject(agent, labObjects)) {
    const held = getHeldLabObject(agent, labObjects)!
    return selectAffordanceForAction(held, 'PICK_UP', agent, labObjects) !== null
  }
  const pickable = findLabObjectInRange(agent, labObjects, (item, typeDef) =>
    typeDef.affordances.some(
      (aff) =>
        aff.kind === 'pick' &&
        aff.executorAction === 'PICK_UP' &&
        affordancePreconditionsMet(aff, item, agent, labObjects),
    ),
  )
  return pickable !== null
}

function blockedGatherOn(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
  nearby: LabObjectInstance,
): LabAffordanceResult | null {
  const typeDef = getLabObjectType(nearby.objectType)
  if (!typeDef || typeDef.implementation !== 'runtime') return null
  const ranked = gatherCandidatesByState(nearby, typeDef).filter((aff) =>
    stoveOperateUseful(agent, labObjects, aff),
  )
  const top = ranked[0]
  if (!top?.preconditions?.requiresHeldType?.length) return null
  if (affordancePreconditionsMet(top, nearby, agent, labObjects)) return null
  const required = top.preconditions.requiresHeldType
  return {
    labObjects: [...labObjects],
    target: nearby,
    affordance: top,
    tags: [`blocked_affordance`, `requires_held:${required.join('|') || 'any'}`],
    needDeltas: {},
    blocked: true,
  }
}

export function findBlockedLabGather(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
): LabAffordanceResult | null {
  const nearby = findLabObjectInRange(agent, labObjects)
  if (!nearby) return null
  return blockedGatherOn(agent, labObjects, nearby)
}

export function tryExecuteLabGather(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
): LabAffordanceResult | null {
  const nearby = findLabObjectInRange(agent, labObjects, (item, typeDef) =>
    typeDef.affordances.some(
      (aff) =>
        aff.executorAction === 'GATHER' && affordanceStatePreconditionsMet(aff, item),
    ),
  )
  if (!nearby) return null

  // Prefer held-gated top affordance: if it is blocked, surface blocked instead of
  // falling through to a lower-priority toggle (keeps cook dependency learnable).
  const blocked = blockedGatherOn(agent, labObjects, nearby)
  if (blocked) return blocked

  const typeDef = getLabObjectType(nearby.objectType)
  if (!typeDef) return null
  const selected = selectAffordanceForAction(nearby, 'GATHER', agent, labObjects)
  if (!selected) return null
  if (!stoveOperateUseful(agent, labObjects, selected.affordance)) {
    const fallback = typeDef.affordances
      .filter(
        (aff) =>
          aff.executorAction === 'GATHER' &&
          aff.kind !== 'operate' &&
          affordancePreconditionsMet(aff, nearby, agent, labObjects),
      )
      .sort(
        (a, b) =>
          affordancePriority(b, typeDef, nearby.objectState) -
          affordancePriority(a, typeDef, nearby.objectState),
      )[0]
    if (!fallback) return null
    return applyLabAffordance(labObjects, nearby.id, fallback.kind, agent)
  }
  return applyLabAffordance(labObjects, nearby.id, selected.affordance.kind, agent)
}

export function tryExecuteLabEat(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
): LabAffordanceResult | null {
  // Prefer table consume when holding food and in range (comfort path).
  const table = findLabObjectInRange(
    agent,
    labObjects,
    (item) => item.objectType === 'dining_table',
  )
  if (table) {
    const tableEat = selectAffordanceForAction(table, 'EAT', agent, labObjects)
    if (tableEat) {
      return applyLabAffordance(labObjects, table.id, tableEat.affordance.kind, agent)
    }
  }

  const held = getHeldLabObject(agent, labObjects)
  if (held?.objectType === 'food_item') {
    const heldEat = selectAffordanceForAction(held, 'EAT', agent, labObjects)
    if (heldEat) {
      return applyLabAffordance(labObjects, held.id, heldEat.affordance.kind, agent)
    }
  }

  const food = findLabObjectInRange(agent, labObjects, (item) => item.objectType === 'food_item')
  if (!food) return null
  const selected = selectAffordanceForAction(food, 'EAT', agent, labObjects)
  if (!selected) return null
  return applyLabAffordance(labObjects, food.id, selected.affordance.kind, agent)
}

export function tryExecuteLabPickUp(
  agent: LabAgentView,
  labObjects: readonly LabObjectInstance[],
): LabAffordanceResult | null {
  const held = getHeldLabObject(agent, labObjects)
  if (held) {
    const drop = selectAffordanceForAction(held, 'PICK_UP', agent, labObjects)
    if (!drop || drop.affordance.kind !== 'drop') return null
    return applyLabAffordance(labObjects, held.id, 'drop', agent)
  }

  const pickable = findLabObjectInRange(agent, labObjects, (item, typeDef) =>
    typeDef.affordances.some(
      (aff) =>
        aff.kind === 'pick' &&
        aff.executorAction === 'PICK_UP' &&
        affordancePreconditionsMet(aff, item, agent, labObjects),
    ),
  )
  if (!pickable) return null
  const selected = selectAffordanceForAction(pickable, 'PICK_UP', agent, labObjects)
  if (!selected || selected.affordance.kind !== 'pick') return null
  return applyLabAffordance(labObjects, pickable.id, 'pick', agent)
}

export function sanitizeLabObjectInstance(value: unknown): LabObjectInstance | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  const objectType = typeof source.objectType === 'string' ? source.objectType : null
  const id = typeof source.id === 'string' && source.id.length > 0 ? source.id : null
  if (!objectType || !id || !getLabObjectType(objectType)) return null
  const position = source.position
  if (typeof position !== 'object' || position === null) return null
  const pos = position as Record<string, unknown>
  const x = typeof pos.x === 'number' && Number.isFinite(pos.x) ? pos.x : null
  const z = typeof pos.z === 'number' && Number.isFinite(pos.z) ? pos.z : null
  if (x === null || z === null) return null
  try {
    return createLabObjectInstance(objectType, { x, y: typeof pos.y === 'number' ? pos.y : 0, z }, {
      id,
      rotation: typeof source.rotation === 'number' ? source.rotation : 0,
      scale: typeof source.scale === 'number' && source.scale > 0 ? source.scale : 1,
      objectState:
        typeof source.objectState === 'object' && source.objectState !== null
          ? (source.objectState as LabObjectState)
          : undefined,
    })
  } catch {
    return null
  }
}

export function sanitizeLabObjects(value: unknown): LabObjectInstance[] {
  if (!Array.isArray(value)) return []
  const items: LabObjectInstance[] = []
  for (const entry of value) {
    const sanitized = sanitizeLabObjectInstance(entry)
    if (sanitized) items.push(sanitized)
  }
  return items
}

export function sanitizeHeldLabObjectId(
  value: unknown,
  labObjects: readonly LabObjectInstance[],
): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string' || value.length === 0) return null
  return labObjects.some((item) => item.id === value) ? value : null
}
