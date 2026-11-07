/**
 * Human Life Sandbox — data-driven Lab object / zone schema (P0).
 * Runtime execution still goes through existing Interactable + AgentAction paths.
 * New AgentActions are not introduced here.
 */

import type { AgentAction } from '../learning/types'
import type { InteractableKind } from './interactable'
import type { Vec3 } from './world'

/** Seven planned Life Sandbox zones. */
export const LAB_ZONE_IDS = [
  'hallway',
  'bedroom',
  'living_room',
  'kitchen',
  'bathroom',
  'workshop',
  'garden',
] as const

export type LabZoneId = (typeof LAB_ZONE_IDS)[number]

/** Whether the zone AABB is already inside the current Lab facility shell. */
export type LabZonePresence = 'active' | 'planned'

export interface LabZoneBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface LabZoneDefinition {
  id: LabZoneId
  label: string
  /** Maps onto current chamber layout when present. */
  presence: LabZonePresence
  bounds: LabZoneBounds
  /** Optional semantic link to legacy LAB_ARENA anchors. */
  legacyAnchor?: 'spawn' | 'survival' | 'rest' | 'lookout' | 'tool'
  description: string
}

/**
 * Affordance verbs. These are *not* new AgentActions —
 * each maps onto an existing schema action via `executorAction`.
 */
export const LAB_AFFORDANCE_KINDS = [
  'open',
  'close',
  'pick',
  'drop',
  'store',
  'retrieve',
  'toggle',
  'operate',
  'inspect',
  'observe',
  'consume',
  'prepare',
  'combine',
  'repair',
  'clean',
  'move_object',
  'wait',
  'rest_use',
] as const

export type LabAffordanceKind = (typeof LAB_AFFORDANCE_KINDS)[number]

export type LabDiscoveryStatus = 'unknown' | 'seen' | 'inspected' | 'mastered'

export type LabObjectCategory =
  | 'furniture'
  | 'appliance'
  | 'container'
  | 'tool'
  | 'consumable'
  | 'fixture'
  | 'decor'
  | 'plant'
  | 'portal'
  | 'control'

/** Scalar state keys used by catalog defaults and future transitions. */
export type LabObjectStateKey =
  | 'open'
  | 'powered'
  | 'cleanliness'
  | 'durability'
  | 'freshness'
  | 'growth'
  | 'filled'
  | 'used'
  | 'locked'
  | 'temperature'

export type LabObjectState = Partial<Record<LabObjectStateKey, number | boolean | string>>

export interface LabResourceCost {
  energy?: number
  hunger?: number
  timeTicks?: number
  /** Optional inventory / held item type ids. */
  requiresHeld?: readonly string[]
}

export interface LabAffordanceEffect {
  /** Need deltas (positive = relief / gain). Keys match agent fields when present. */
  needs?: Partial<
    Record<
      'energy' | 'hunger' | 'fatigue' | 'curiosity' | 'comfort' | 'health',
      number
    >
  >
  /** Object state patches applied on success. */
  setState?: LabObjectState
  /** Emit world / outcome tags for telemetry (not reward cheats). */
  tags?: readonly string[]
}

export interface LabAffordancePrecondition {
  /** Required object state predicates (simple equality / threshold). */
  stateEquals?: LabObjectState
  stateMin?: Partial<Record<LabObjectStateKey, number>>
  stateMax?: Partial<Record<LabObjectStateKey, number>>
  /** Other object ids/types that must satisfy a relation. */
  requiresRelation?: readonly LabObjectRelation[]
  /** Agent must hold one of these object types. */
  requiresHeldType?: readonly string[]
  /** Zone must match (optional). */
  zoneIn?: readonly LabZoneId[]
}

export interface LabStateTransition {
  from: LabObjectState
  to: LabObjectState
  /** Affordance that triggers this transition. */
  via: LabAffordanceKind
}

export interface LabObjectRelation {
  /** Relation role, e.g. contains, controls, adjacent, recipe_with. */
  role: 'contains' | 'controls' | 'adjacent' | 'placed_on' | 'recipe_with' | 'powered_by'
  /** Target object type id, or concrete instance id when known. */
  targetType?: string
  targetId?: string
}

export interface LabAffordanceDefinition {
  kind: LabAffordanceKind
  /** Existing AgentAction used to execute this affordance. */
  executorAction: AgentAction
  label: string
  preconditions?: LabAffordancePrecondition
  effects?: LabAffordanceEffect
  resourceCost?: LabResourceCost
  /** Duration in sim ticks (0 = instantaneous). */
  durationTicks?: number
  reversible?: boolean
}

/**
 * Catalog entry: one object *type*. Runtime instances reference `objectType`.
 * Field names mirror the Life Sandbox expansion spec.
 */
export interface LabObjectTypeDefinition {
  objectType: string
  label: string
  category: LabObjectCategory
  defaultZone: LabZoneId
  /** Default object_state seed. */
  objectState: LabObjectState
  affordances: readonly LabAffordanceDefinition[]
  preconditions?: LabAffordancePrecondition
  stateTransitions: readonly LabStateTransition[]
  effects?: LabAffordanceEffect
  resourceCost?: LabResourceCost
  /** 0–100; null = indestructible for now. */
  durability: number | null
  interactionRange: number
  objectRelations: readonly LabObjectRelation[]
  discoveryStatus: LabDiscoveryStatus
  description: string
  /**
   * When set, this catalog type is the data-model face of an existing
   * InteractableKind (compatibility bridge — no dual runtime yet).
   */
  legacyInteractableKind?: InteractableKind
  /** Implementation readiness for this type. */
  implementation: 'catalog_only' | 'bridged_legacy' | 'runtime'
}

/** Runtime instance (Env-P1+). Stored on WorldState.labObjects in Lab mode. */
export interface LabObjectInstance {
  id: string
  objectType: string
  zoneId: LabZoneId
  position: Vec3
  rotation: number
  scale: number
  objectState: LabObjectState
  discoveryStatus: LabDiscoveryStatus
  durability: number | null
  objectRelations: readonly LabObjectRelation[]
  /** When bridged, points at Interactable.id. */
  legacyInteractableId?: string
}

export interface LabWorldLayout {
  version: 1
  zones: readonly LabZoneDefinition[]
  /** Catalog object types available in this layout. */
  objectTypeIds: readonly string[]
}
