/**
 * Bridge between existing Interactable runtime and Life Sandbox catalog (P0).
 * Does not replace Interactable storage — provides a read-only catalog view.
 */

import type { Interactable, InteractableKind } from '../types/interactable'
import type {
  LabDiscoveryStatus,
  LabObjectInstance,
  LabObjectState,
  LabObjectTypeDefinition,
  LabZoneId,
} from '../types/labObject'
import { bridgedLegacyObjectTypes, requireLabObjectType } from './labObjectCatalog'
import { resolveLabZone } from './labZones'

const KIND_TO_OBJECT_TYPE: Record<InteractableKind, string> = {
  door: 'door',
  switch: 'wall_switch',
  movable_box: 'crate',
  rest_bed: 'bed',
  lookout: 'lookout_window',
}

export function objectTypeForInteractableKind(kind: InteractableKind): string {
  return KIND_TO_OBJECT_TYPE[kind]
}

export function catalogTypeForInteractable(item: Interactable): LabObjectTypeDefinition {
  return requireLabObjectType(objectTypeForInteractableKind(item.kind))
}

/** Project Interactable kind-specific fields into catalog object_state. */
export function objectStateFromInteractable(item: Interactable): LabObjectState {
  const base = { ...catalogTypeForInteractable(item).objectState }
  switch (item.kind) {
    case 'door':
      return { ...base, open: item.open }
    case 'switch':
      return { ...base, powered: item.on }
    case 'movable_box':
      return { ...base }
    case 'rest_bed':
      return { ...base, used: item.used }
    case 'lookout':
      return { ...base, used: item.used }
    default:
      return base
  }
}

export function zoneForInteractable(item: Interactable): LabZoneId {
  return resolveLabZone(item.position.x, item.position.z) ?? catalogTypeForInteractable(item).defaultZone
}

/**
 * Read-only LabObjectInstance view over a live Interactable.
 * Not persisted; safe for HUD / probes / future planners.
 */
export function labInstanceFromInteractable(
  item: Interactable,
  discoveryStatus: LabDiscoveryStatus = 'seen',
): LabObjectInstance {
  const typeDef = catalogTypeForInteractable(item)
  return {
    id: item.id,
    objectType: typeDef.objectType,
    zoneId: zoneForInteractable(item),
    position: { ...item.position },
    rotation: item.rotation,
    scale: item.scale,
    objectState: objectStateFromInteractable(item),
    discoveryStatus,
    durability: typeDef.durability,
    objectRelations: typeDef.objectRelations,
    legacyInteractableId: item.id,
  }
}

export function labInstancesFromInteractables(
  interactables: readonly Interactable[],
): LabObjectInstance[] {
  return interactables.map((item) => labInstanceFromInteractable(item))
}

/** Ensure every InteractableKind has exactly one bridged catalog type. */
export function assertLegacyBridgeCoverage(): void {
  const bridged = bridgedLegacyObjectTypes()
  const kinds = new Set(bridged.map((entry) => entry.legacyInteractableKind))
  for (const kind of Object.keys(KIND_TO_OBJECT_TYPE) as InteractableKind[]) {
    if (!kinds.has(kind)) {
      throw new Error(`No catalog bridge for InteractableKind: ${kind}`)
    }
    const objectType = KIND_TO_OBJECT_TYPE[kind]
    const match = bridged.find((entry) => entry.objectType === objectType)
    if (!match || match.legacyInteractableKind !== kind) {
      throw new Error(`Bridge map mismatch for ${kind} → ${objectType}`)
    }
  }
}
