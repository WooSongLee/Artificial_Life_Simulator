/**
 * Human Life Sandbox zone layout (P0).
 *
 * Active zones map onto the current Lab chamber shell (vestibule / rest /
 * survival / lookout) so resolveLabZone works without resizing the facility.
 * Planned zones carry intended AABBs for a future shell expansion (P1+).
 */

import {
  LAB_ZONE_IDS,
  type LabZoneBounds,
  type LabZoneDefinition,
  type LabZoneId,
  type LabWorldLayout,
} from '../types/labObject'
import { LAB_ARENA, LAB_FACILITY_BOUNDS } from './interactables'

/** Shared half-width helpers aligned with LabChamberShell corridors. */
const GATE = 2.7

/**
 * Active zone AABBs stay inside LAB_FACILITY_BOUNDS.
 * Planned zones may extend outside — they must not be treated as walkable yet.
 */
export const LAB_ZONE_DEFINITIONS: readonly LabZoneDefinition[] = [
  {
    id: 'hallway',
    label: 'Hallway / Entrance',
    presence: 'active',
    bounds: { minX: -GATE, maxX: GATE, minZ: -2.5, maxZ: GATE },
    legacyAnchor: 'spawn',
    description: 'Central vestibule connecting chambers; spawn and control panel.',
  },
  {
    id: 'bedroom',
    label: 'Bedroom',
    presence: 'active',
    bounds: {
      minX: LAB_FACILITY_BOUNDS.minX,
      maxX: -GATE,
      minZ: -2.5,
      maxZ: 2.5,
    },
    legacyAnchor: 'rest',
    description: 'Rest chamber — bed / comfort affordances (legacy rest_bed).',
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    presence: 'active',
    bounds: {
      minX: -GATE,
      maxX: GATE,
      minZ: GATE,
      maxZ: LAB_FACILITY_BOUNDS.maxZ,
    },
    legacyAnchor: 'survival',
    description: 'Survival chamber — food station; future cook / fridge chain.',
  },
  {
    id: 'workshop',
    label: 'Workshop',
    presence: 'active',
    bounds: {
      minX: GATE,
      maxX: LAB_FACILITY_BOUNDS.maxX,
      minZ: -2.5,
      maxZ: 2.5,
    },
    legacyAnchor: 'lookout',
    description: 'East chamber — currently lookout; future tools / repair bench.',
  },
  {
    id: 'living_room',
    label: 'Living Room',
    presence: 'planned',
    bounds: { minX: -GATE, maxX: GATE, minZ: -6.2, maxZ: -2.5 },
    description: 'Planned south lounge — sofa, lamp, books, leisure.',
  },
  {
    id: 'bathroom',
    label: 'Bathroom',
    presence: 'planned',
    bounds: { minX: -7.9, maxX: -GATE, minZ: 2.5, maxZ: 5.4 },
    description: 'Planned hygiene room — sink, shower, towel, mirror.',
  },
  {
    id: 'garden',
    label: 'Garden',
    presence: 'planned',
    bounds: { minX: GATE, maxX: 7.9, minZ: 2.5, maxZ: 7.75 },
    description: 'Planned outdoor plot — plants, soil, water can, weather exposure.',
  },
] as const

export const LAB_LAYOUT_VERSION = 1 as const

export function labZoneById(id: LabZoneId): LabZoneDefinition {
  const zone = LAB_ZONE_DEFINITIONS.find((entry) => entry.id === id)
  if (!zone) {
    throw new Error(`Unknown Lab zone: ${id}`)
  }
  return zone
}

export function activeLabZones(): readonly LabZoneDefinition[] {
  return LAB_ZONE_DEFINITIONS.filter((zone) => zone.presence === 'active')
}

export function plannedLabZones(): readonly LabZoneDefinition[] {
  return LAB_ZONE_DEFINITIONS.filter((zone) => zone.presence === 'planned')
}

export function pointInBounds(x: number, z: number, bounds: LabZoneBounds): boolean {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ
}

/**
 * Resolve zone for a world xz. Prefers active zones; planned zones only if
 * `includePlanned` is true (debug / future layout preview).
 * Overlaps: hallway is checked after chamber-sized zones so chamber interiors win.
 */
export function resolveLabZone(
  x: number,
  z: number,
  options: { includePlanned?: boolean } = {},
): LabZoneId | null {
  const includePlanned = options.includePlanned === true
  const candidates = LAB_ZONE_DEFINITIONS.filter(
    (zone) => zone.presence === 'active' || includePlanned,
  )

  // Prefer non-hallway (chamber) hits first for gate-edge clarity.
  let hallwayHit: LabZoneId | null = null
  for (const zone of candidates) {
    if (!pointInBounds(x, z, zone.bounds)) continue
    if (zone.id === 'hallway') {
      hallwayHit = zone.id
      continue
    }
    return zone.id
  }
  return hallwayHit
}

/** Legacy LAB_ARENA anchor → zone id (compatibility). */
export function zoneForLegacyAnchor(
  anchor: keyof typeof LAB_ARENA,
): LabZoneId | null {
  switch (anchor) {
    case 'spawn':
    case 'tool':
      return 'hallway'
    case 'survival':
    case 'survivalGate':
      return 'kitchen'
    case 'rest':
    case 'restGate':
      return 'bedroom'
    case 'lookout':
    case 'lookoutGate':
      return 'workshop'
    default:
      return null
  }
}

export function createLabWorldLayout(objectTypeIds: readonly string[]): LabWorldLayout {
  return {
    version: LAB_LAYOUT_VERSION,
    zones: LAB_ZONE_DEFINITIONS,
    objectTypeIds,
  }
}

/** Sanity: every declared zone id appears exactly once. */
export function assertLabZoneCatalogIntegrity(): void {
  if (LAB_ZONE_DEFINITIONS.length !== LAB_ZONE_IDS.length) {
    throw new Error(
      `Lab zone count mismatch: defs=${LAB_ZONE_DEFINITIONS.length} ids=${LAB_ZONE_IDS.length}`,
    )
  }
  const seen = new Set<string>()
  for (const zone of LAB_ZONE_DEFINITIONS) {
    if (seen.has(zone.id)) throw new Error(`Duplicate Lab zone id: ${zone.id}`)
    seen.add(zone.id)
  }
  for (const id of LAB_ZONE_IDS) {
    if (!seen.has(id)) throw new Error(`Missing Lab zone definition: ${id}`)
  }
}
