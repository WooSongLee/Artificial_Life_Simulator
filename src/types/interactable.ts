import type { Vec3 } from './world'

/** STEP 16–18 interactable kinds. */
export const INTERACTABLE_KINDS = [
  'door',
  'switch',
  'movable_box',
  'rest_bed',
  'lookout',
] as const

export type InteractableKind = (typeof INTERACTABLE_KINDS)[number]

export interface DoorInteractable {
  id: string
  kind: 'door'
  position: Vec3
  rotation: number
  scale: number
  /** Closed doors block movement. Opening is a real world-state change. */
  open: boolean
}

export interface SwitchInteractable {
  id: string
  kind: 'switch'
  position: Vec3
  rotation: number
  scale: number
  on: boolean
  /** Linked door id toggled when this switch is used. */
  controlsId: string
}

/** Pushable obstacle; position is authoritative world state. */
export interface MovableBoxInteractable {
  id: string
  kind: 'movable_box'
  position: Vec3
  rotation: number
  scale: number
}

/**
 * Non-survival rest affordance (STEP 18).
 * GATHER nearby toggles `used` — comfort choice, not forage/tool.
 */
export interface RestBedInteractable {
  id: string
  kind: 'rest_bed'
  position: Vec3
  rotation: number
  scale: number
  /** Visual / world-state flip on each successful use. */
  used: boolean
  /** Sim tick of last successful GATHER use (0 = never). Drives success flash. */
  lastUsedTick: number
}

/**
 * Non-survival lookout / curiosity affordance (STEP 18).
 * GATHER nearby toggles `used` — anti-survival-adjacent choice, not forage/tool.
 */
export interface LookoutInteractable {
  id: string
  kind: 'lookout'
  position: Vec3
  rotation: number
  scale: number
  /** Visual / world-state flip on each successful use. */
  used: boolean
  /** Sim tick of last successful GATHER use (0 = never). Drives success flash. */
  lastUsedTick: number
}

export type Interactable =
  | DoorInteractable
  | SwitchInteractable
  | MovableBoxInteractable
  | RestBedInteractable
  | LookoutInteractable

export function isDoor(item: Interactable): item is DoorInteractable {
  return item.kind === 'door'
}

export function isSwitch(item: Interactable): item is SwitchInteractable {
  return item.kind === 'switch'
}

export function isMovableBox(item: Interactable): item is MovableBoxInteractable {
  return item.kind === 'movable_box'
}

export function isRestBed(item: Interactable): item is RestBedInteractable {
  return item.kind === 'rest_bed'
}

export function isLookout(item: Interactable): item is LookoutInteractable {
  return item.kind === 'lookout'
}
