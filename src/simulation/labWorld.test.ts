import { describe, expect, it } from 'vitest'
import { INTERACTABLE_KINDS } from '../types/interactable'
import { LAB_ZONE_IDS } from '../types/labObject'
import { LAB_ARENA, createLabInteractables } from './interactables'
import { AFFORDANCE_EXECUTOR, executorActionFor } from './labAffordance'
import {
  assertLabObjectCatalogIntegrity,
  bridgedLegacyObjectTypes,
  createDefaultLabWorldLayout,
  getLabObjectType,
  LAB_OBJECT_TYPE_DEFINITIONS,
  LAB_OBJECT_TYPE_IDS,
  labObjectTypesInZone,
} from './labObjectCatalog'
import {
  assertLegacyBridgeCoverage,
  labInstancesFromInteractables,
  objectTypeForInteractableKind,
  zoneForInteractable,
} from './labObjectBridge'
import {
  activeLabZones,
  assertLabZoneCatalogIntegrity,
  LAB_ZONE_DEFINITIONS,
  plannedLabZones,
  resolveLabZone,
  zoneForLegacyAnchor,
} from './labZones'
import { createInitialWorld } from './worldFactory'
import { DEFAULT_WORLD_CONFIG } from './constants'
import { AGENT_ACTIONS } from '../learning/types'

describe('Life Sandbox P0 — zones', () => {
  it('defines all seven zones exactly once', () => {
    assertLabZoneCatalogIntegrity()
    expect(LAB_ZONE_DEFINITIONS.map((z) => z.id).sort()).toEqual([...LAB_ZONE_IDS].sort())
  })

  it('keeps four active zones inside the current facility mapping', () => {
    const active = activeLabZones().map((z) => z.id).sort()
    expect(active).toEqual(['bedroom', 'hallway', 'kitchen', 'workshop'].sort())
    expect(plannedLabZones()).toHaveLength(3)
  })

  it('resolves legacy LAB_ARENA anchors to zones', () => {
    expect(resolveLabZone(LAB_ARENA.spawn.x, LAB_ARENA.spawn.z)).toBe('hallway')
    expect(resolveLabZone(LAB_ARENA.survival.x, LAB_ARENA.survival.z)).toBe('kitchen')
    expect(resolveLabZone(LAB_ARENA.rest.x, LAB_ARENA.rest.z)).toBe('bedroom')
    expect(resolveLabZone(LAB_ARENA.lookout.x, LAB_ARENA.lookout.z)).toBe('workshop')
    expect(zoneForLegacyAnchor('tool')).toBe('hallway')
  })

  it('does not resolve planned zones unless asked', () => {
    // Living room planned AABB center
    expect(resolveLabZone(0, -4.3)).toBeNull()
    expect(resolveLabZone(0, -4.3, { includePlanned: true })).toBe('living_room')
  })
})

describe('Life Sandbox P0 — object catalog', () => {
  it('passes integrity checks with 35–40 types and full legacy bridge', () => {
    assertLabObjectCatalogIntegrity()
    assertLegacyBridgeCoverage()
    expect(LAB_OBJECT_TYPE_IDS.length).toBeGreaterThanOrEqual(35)
    expect(LAB_OBJECT_TYPE_IDS.length).toBeLessThanOrEqual(45)
    expect(bridgedLegacyObjectTypes()).toHaveLength(INTERACTABLE_KINDS.length)
  })

  it('maps every affordance executor onto Action schema v3', () => {
    for (const [kind, action] of Object.entries(AFFORDANCE_EXECUTOR)) {
      expect(AGENT_ACTIONS).toContain(action)
      expect(executorActionFor(kind as keyof typeof AFFORDANCE_EXECUTOR)).toBe(action)
    }
    for (const typeDef of LAB_OBJECT_TYPE_DEFINITIONS) {
      for (const aff of typeDef.affordances) {
        expect(AGENT_ACTIONS).toContain(aff.executorAction)
      }
    }
  })

  it('covers each zone with at least one default object type', () => {
    for (const zoneId of LAB_ZONE_IDS) {
      expect(labObjectTypesInZone(zoneId).length).toBeGreaterThan(0)
    }
  })

  it('exposes multi-affordance objects (bed, fridge, stove)', () => {
    expect(getLabObjectType('bed')!.affordances.length).toBeGreaterThanOrEqual(2)
    expect(getLabObjectType('refrigerator')!.affordances.map((a) => a.kind)).toEqual(
      expect.arrayContaining(['open', 'close', 'retrieve', 'store', 'inspect']),
    )
    expect(getLabObjectType('stove')!.affordances.map((a) => a.kind)).toEqual(
      expect.arrayContaining(['toggle', 'operate', 'inspect', 'clean']),
    )
  })

  it('builds a layout listing all catalog types', () => {
    const layout = createDefaultLabWorldLayout()
    expect(layout.version).toBe(1)
    expect(layout.zones).toHaveLength(7)
    expect(layout.objectTypeIds).toEqual(LAB_OBJECT_TYPE_IDS)
  })
})

describe('Life Sandbox P0 — interactable bridge', () => {
  it('projects Lab interactables into catalog instances without mutating world', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      agentCount: 1,
      seed: 42,
    })
    const before = structuredClone(world.interactables)
    const instances = labInstancesFromInteractables(world.interactables)

    expect(instances).toHaveLength(world.interactables.length)
    expect(instances.map((i) => i.objectType).sort()).toEqual(
      ['bed', 'crate', 'door', 'lookout_window', 'wall_switch'].sort(),
    )
    expect(world.interactables).toEqual(before)

    const bed = instances.find((i) => i.objectType === 'bed')!
    expect(zoneForInteractable(world.interactables.find((i) => i.kind === 'rest_bed')!)).toBe(
      'bedroom',
    )
    expect(bed.zoneId).toBe('bedroom')
    expect(bed.legacyInteractableId).toBeDefined()
  })

  it('maps every InteractableKind to a catalog object type', () => {
    for (const kind of INTERACTABLE_KINDS) {
      const objectType = objectTypeForInteractableKind(kind)
      expect(getLabObjectType(objectType)?.legacyInteractableKind).toBe(kind)
    }
  })

  it('leaves Ecology interactables empty (no sandbox seed)', () => {
    const ecology = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      seed: 7,
    })
    expect(ecology.interactables).toEqual([])
    expect(ecology.labObjects).toEqual([])
    expect(createLabInteractables(ecology.config, ecology.objects, ecology.terrain)).toEqual([])
  })
})

describe('Life Sandbox P1 — kitchen runtime readiness', () => {
  it('marks fridge/stove/sink/food/table as runtime implementation', () => {
    for (const objectType of [
      'refrigerator',
      'food_item',
      'stove',
      'sink',
      'dining_table',
    ] as const) {
      expect(getLabObjectType(objectType)?.implementation).toBe('runtime')
    }
    expect(getLabObjectType('bed')?.implementation).toBe('bridged_legacy')
  })
})

