import type {
  DoorInteractable,
  Interactable,
  LookoutInteractable,
  MovableBoxInteractable,
  RestBedInteractable,
  SwitchInteractable,
} from '../types/interactable'
import { isDoor, isLookout, isMovableBox, isRestBed, isSwitch } from '../types/interactable'
import type { Agent } from '../types/agent'
import type { TerrainGrid } from '../types/terrain'
import type { WorldConfig, WorldObject, WorldState } from '../types/world'
import { createId } from '../utils/id'
import { distanceSq, wrapAngle } from '../utils/math'
import { GATHER_RADIUS } from './constants'
import { effectsFromWorldConfig } from './labConditions'
import { isHumanBehaviorLab, clampSimulationMode } from './labMode'
import {
  collidesWithObstacles,
  isBlockedSpawn,
  isInsideWorld,
} from './spatial'
import { isTerrainWalkable } from './terrain'

/** Reuse gather reach so Action Mask / GATHER path stays schema-compatible. */
export const INTERACT_RADIUS = GATHER_RADIUS
export const DOOR_BLOCK_RADIUS = 1.35
export const BOX_BLOCK_RADIUS = 0.85
/** One successful GATHER push moves the box this far along agent facing. */
export const BOX_PUSH_DISTANCE = 1.45
/** Rest/lookout success flash window (sim ticks) — readable under normal Lab speed. */
export const DRIVE_SUCCESS_FLASH_TICKS = 18

export function findSwitchInInteractRange(
  agent: Agent,
  interactables: readonly Interactable[],
): SwitchInteractable | null {
  const reach = INTERACT_RADIUS * INTERACT_RADIUS
  let nearest: SwitchInteractable | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const item of interactables) {
    if (!isSwitch(item)) continue
    const dist = distanceSq(agent.position.x, agent.position.z, item.position.x, item.position.z)
    if (dist > reach || dist >= nearestDist) continue
    nearest = item
    nearestDist = dist
  }

  return nearest
}

export function findBoxInInteractRange(
  agent: Agent,
  interactables: readonly Interactable[],
): MovableBoxInteractable | null {
  const reach = INTERACT_RADIUS * INTERACT_RADIUS
  let nearest: MovableBoxInteractable | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const item of interactables) {
    if (!isMovableBox(item)) continue
    const dist = distanceSq(agent.position.x, agent.position.z, item.position.x, item.position.z)
    if (dist > reach || dist >= nearestDist) continue
    nearest = item
    nearestDist = dist
  }

  return nearest
}

export function findRestBedInInteractRange(
  agent: Agent,
  interactables: readonly Interactable[],
): RestBedInteractable | null {
  const reach = INTERACT_RADIUS * INTERACT_RADIUS
  let nearest: RestBedInteractable | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const item of interactables) {
    if (!isRestBed(item)) continue
    const dist = distanceSq(agent.position.x, agent.position.z, item.position.x, item.position.z)
    if (dist > reach || dist >= nearestDist) continue
    nearest = item
    nearestDist = dist
  }

  return nearest
}

export function findLookoutInInteractRange(
  agent: Agent,
  interactables: readonly Interactable[],
): LookoutInteractable | null {
  const reach = INTERACT_RADIUS * INTERACT_RADIUS
  let nearest: LookoutInteractable | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const item of interactables) {
    if (!isLookout(item)) continue
    const dist = distanceSq(agent.position.x, agent.position.z, item.position.x, item.position.z)
    if (dist > reach || dist >= nearestDist) continue
    nearest = item
    nearestDist = dist
  }

  return nearest
}

/**
 * Nearest interactable within detection range (Observation cue; Ecology empty list → always null).
 * When Lab drives are elevated, prefer rest_bed / lookout over tool props so the cue teaches.
 */
export function findVisibleInteractable(
  agent: Agent,
  interactables: readonly Interactable[],
  canDetect: (x: number, z: number, dist: number) => boolean,
): Interactable | null {
  const preferRest =
    agent.fatigue !== undefined &&
    (agent.fatigue >= 55 || (agent.comfort !== undefined && agent.comfort <= 45))
  const preferLook =
    agent.curiosity !== undefined && agent.curiosity >= 55 && !preferRest

  let nearest: Interactable | null = null
  let nearestDist = Number.POSITIVE_INFINITY
  let preferred: Interactable | null = null
  let preferredDist = Number.POSITIVE_INFINITY

  for (const item of interactables) {
    const dist = distanceSq(agent.position.x, agent.position.z, item.position.x, item.position.z)
    if (!canDetect(item.position.x, item.position.z, dist)) continue
    if (dist < nearestDist) {
      nearest = item
      nearestDist = dist
    }
    const isPreferred =
      (preferRest && isRestBed(item)) || (preferLook && isLookout(item))
    if (isPreferred && dist < preferredDist) {
      preferred = item
      preferredDist = dist
    }
  }

  return preferred ?? nearest
}

export function canInteractSwitch(agent: Agent, world: WorldState): boolean {
  return findSwitchInInteractRange(agent, world.interactables ?? []) !== null
}

export function canPushBox(agent: Agent, world: WorldState): boolean {
  const box = findBoxInInteractRange(agent, world.interactables ?? [])
  if (!box) return false
  return previewBoxDestination(box, agent.rotation, world) !== null
}

export function canUseRestBed(agent: Agent, world: WorldState): boolean {
  return findRestBedInInteractRange(agent, world.interactables ?? []) !== null
}

export function canUseLookout(agent: Agent, world: WorldState): boolean {
  return findLookoutInInteractRange(agent, world.interactables ?? []) !== null
}

/** GATHER is legal for switch / box / rest bed / lookout (forage + Lab catalog checked separately). */
export function canInteractGatherTarget(agent: Agent, world: WorldState): boolean {
  return (
    canInteractSwitch(agent, world) ||
    canPushBox(agent, world) ||
    canUseRestBed(agent, world) ||
    canUseLookout(agent, world)
  )
}

/**
 * Toggle a switch and sync its linked door open state.
 * Returns null when nothing changed.
 */
export function applySwitchToggle(
  interactables: readonly Interactable[],
  switchId: string,
): { interactables: Interactable[]; switchItem: SwitchInteractable; door: DoorInteractable | null } | null {
  const target = interactables.find((item) => item.id === switchId)
  if (!target || !isSwitch(target)) return null

  const nextOn = !target.on
  let linkedDoor: DoorInteractable | null = null
  const next = interactables.map((item) => {
    if (item.id === target.id && isSwitch(item)) {
      return { ...item, on: nextOn }
    }
    if (item.id === target.controlsId && isDoor(item)) {
      linkedDoor = { ...item, open: nextOn }
      return linkedDoor
    }
    return item
  })

  const switchItem = next.find((item): item is SwitchInteractable => item.id === target.id && isSwitch(item))
  if (!switchItem) return null

  return { interactables: next, switchItem, door: linkedDoor }
}

function previewBoxDestination(
  box: MovableBoxInteractable,
  facingRotation: number,
  world: {
    objects: WorldState['objects']
    terrain: WorldState['terrain']
    config: WorldState['config']
    interactables: readonly Interactable[] | undefined
  },
): { x: number; z: number } | null {
  const rotation = wrapAngle(facingRotation)
  const x = box.position.x + Math.sin(rotation) * BOX_PUSH_DISTANCE
  const z = box.position.z + Math.cos(rotation) * BOX_PUSH_DISTANCE
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null

  const radius = BOX_BLOCK_RADIUS * box.scale
  if (!isInsideWorld(x, z, world.config.size)) return null
  if (!isTerrainWalkable(world.terrain, x, z, world.config.size)) return null
  if (collidesWithObstacles(x, z, radius, world.objects)) return null
  if (closedDoorBlocksPosition(x, z, radius, world.interactables)) return null
  if (movableBoxBlocksPosition(x, z, radius, world.interactables, box.id)) return null
  return { x, z }
}

/**
 * Push a movable box along the agent's facing direction.
 * Returns null when the destination is blocked (no world change / no reward).
 */
export function applyBoxPush(
  interactables: readonly Interactable[],
  boxId: string,
  facingRotation: number,
  world: {
    objects: WorldState['objects']
    terrain: WorldState['terrain']
    config: WorldState['config']
    interactables?: readonly Interactable[]
  },
): { interactables: Interactable[]; box: MovableBoxInteractable } | null {
  const target = interactables.find((item) => item.id === boxId)
  if (!target || !isMovableBox(target)) return null

  const dest = previewBoxDestination(target, facingRotation, { ...world, interactables })
  if (!dest) return null

  const nextBox: MovableBoxInteractable = {
    ...target,
    position: { x: dest.x, y: target.position.y, z: dest.z },
  }
  const next = interactables.map((item) => (item.id === boxId ? nextBox : item))
  return { interactables: next, box: nextBox }
}

/** Toggle rest-bed used flag (non-survival comfort affordance). */
export function applyRestBedUse(
  interactables: readonly Interactable[],
  bedId: string,
  tick = 0,
): { interactables: Interactable[]; bed: RestBedInteractable } | null {
  const target = interactables.find((item) => item.id === bedId)
  if (!target || !isRestBed(target)) return null

  const nextBed: RestBedInteractable = {
    ...target,
    used: !target.used,
    lastUsedTick: Math.max(0, Math.floor(tick)),
  }
  const next = interactables.map((item) => (item.id === bedId ? nextBed : item))
  return { interactables: next, bed: nextBed }
}

/** Toggle lookout used flag (non-survival curiosity / vantage affordance). */
export function applyLookoutUse(
  interactables: readonly Interactable[],
  lookoutId: string,
  tick = 0,
): { interactables: Interactable[]; lookout: LookoutInteractable } | null {
  const target = interactables.find((item) => item.id === lookoutId)
  if (!target || !isLookout(target)) return null

  const nextLookout: LookoutInteractable = {
    ...target,
    used: !target.used,
    lastUsedTick: Math.max(0, Math.floor(tick)),
  }
  const next = interactables.map((item) => (item.id === lookoutId ? nextLookout : item))
  return { interactables: next, lookout: nextLookout }
}

/** True while success flash should read in-world (real lastUsedTick vs sim tick). */
export function isDriveSuccessFresh(
  lastUsedTick: number,
  tick: number,
  windowTicks = DRIVE_SUCCESS_FLASH_TICKS,
): boolean {
  if (lastUsedTick <= 0 || windowTicks <= 0) return false
  const age = tick - lastUsedTick
  return age >= 0 && age <= windowTicks
}

/** Any living agent within interact reach of xz (Lab reach cue). */
export function agentInInteractReach(
  x: number,
  z: number,
  agents: readonly { alive: boolean; position: { x: number; z: number } }[],
  radius = INTERACT_RADIUS,
): boolean {
  const reach = radius * radius
  for (const agent of agents) {
    if (!agent.alive) continue
    if (distanceSq(agent.position.x, agent.position.z, x, z) <= reach) return true
  }
  return false
}

export function closedDoorBlocksPosition(
  x: number,
  z: number,
  radius: number,
  interactables: readonly Interactable[] | undefined,
): boolean {
  if (!interactables || interactables.length === 0) return false
  for (const item of interactables) {
    if (!isDoor(item) || item.open) continue
    const doorRadius = DOOR_BLOCK_RADIUS * item.scale
    const minDistance = doorRadius + radius
    if (distanceSq(x, z, item.position.x, item.position.z) < minDistance * minDistance) {
      return true
    }
  }
  return false
}

export function movableBoxBlocksPosition(
  x: number,
  z: number,
  radius: number,
  interactables: readonly Interactable[] | undefined,
  excludeId?: string,
): boolean {
  if (!interactables || interactables.length === 0) return false
  for (const item of interactables) {
    if (!isMovableBox(item) || item.id === excludeId) continue
    const boxRadius = BOX_BLOCK_RADIUS * item.scale
    const minDistance = boxRadius + radius
    if (distanceSq(x, z, item.position.x, item.position.z) < minDistance * minDistance) {
      return true
    }
  }
  return false
}

export function sanitizeInteractable(value: unknown): Interactable | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  const kind = source.kind
  const id = typeof source.id === 'string' && source.id.length > 0 ? source.id : null
  const position = source.position
  if (!id || typeof position !== 'object' || position === null) return null
  const pos = position as Record<string, unknown>
  const x = typeof pos.x === 'number' && Number.isFinite(pos.x) ? pos.x : null
  const z = typeof pos.z === 'number' && Number.isFinite(pos.z) ? pos.z : null
  if (x === null || z === null) return null
  const y = typeof pos.y === 'number' && Number.isFinite(pos.y) ? pos.y : 0
  const rotation = typeof source.rotation === 'number' && Number.isFinite(source.rotation) ? source.rotation : 0
  const scale =
    typeof source.scale === 'number' && Number.isFinite(source.scale) && source.scale > 0
      ? Math.min(source.scale, 8)
      : 1

  if (kind === 'door') {
    return {
      id,
      kind: 'door',
      position: { x, y, z },
      rotation,
      scale,
      open: source.open === true,
    }
  }
  if (kind === 'switch') {
    const controlsId = typeof source.controlsId === 'string' ? source.controlsId : ''
    return {
      id,
      kind: 'switch',
      position: { x, y, z },
      rotation,
      scale,
      on: source.on === true,
      controlsId,
    }
  }
  if (kind === 'movable_box') {
    return {
      id,
      kind: 'movable_box',
      position: { x, y, z },
      rotation,
      scale,
    }
  }
  if (kind === 'rest_bed') {
    const lastUsedTick =
      typeof source.lastUsedTick === 'number' &&
      Number.isFinite(source.lastUsedTick) &&
      source.lastUsedTick >= 0
        ? Math.floor(source.lastUsedTick)
        : 0
    return {
      id,
      kind: 'rest_bed',
      position: { x, y, z },
      rotation,
      scale,
      used: source.used === true,
      lastUsedTick,
    }
  }
  if (kind === 'lookout') {
    const lastUsedTick =
      typeof source.lastUsedTick === 'number' &&
      Number.isFinite(source.lastUsedTick) &&
      source.lastUsedTick >= 0
        ? Math.floor(source.lastUsedTick)
        : 0
    return {
      id,
      kind: 'lookout',
      position: { x, y, z },
      rotation,
      scale,
      used: source.used === true,
      lastUsedTick,
    }
  }
  return null
}

export function sanitizeInteractables(value: unknown): Interactable[] {
  if (!Array.isArray(value)) return []
  const items: Interactable[] = []
  for (const entry of value) {
    const sanitized = sanitizeInteractable(entry)
    if (sanitized) items.push(sanitized)
  }
  return items
}

function findOpenLabSpot(
  candidates: readonly { x: number; z: number }[],
  objects: readonly WorldObject[],
  terrain: TerrainGrid,
  worldSize: number,
  occupied: readonly { x: number; z: number }[],
  minSeparation = 1.8,
): { x: number; z: number } | null {
  const minSepSq = minSeparation * minSeparation
  for (const candidate of candidates) {
    if (
      !isTerrainWalkable(terrain, candidate.x, candidate.z, worldSize) ||
      isBlockedSpawn(candidate.x, candidate.z, objects, 0.4, terrain, worldSize)
    ) {
      continue
    }
    const tooClose = occupied.some(
      (spot) => distanceSq(candidate.x, candidate.z, spot.x, spot.z) < minSepSq,
    )
    if (tooClose) continue
    return candidate
  }
  return null
}

/**
 * Lab chamber layout (world xz). Vestibule spawn + three condition chambers.
 * +Z survival · −X rest · +X lookout. Ecology never uses these anchors.
 */
export const LAB_ARENA = {
  /** Central vestibule — agent spawn. */
  spawn: { x: 0, z: 0 },
  /** Survival chamber center (food station). */
  survival: { x: 0, z: 5.4 },
  survivalGate: { x: 0, z: 2.7 },
  /** Rest chamber center (cot). */
  rest: { x: -5.4, z: 0 },
  restGate: { x: -2.7, z: 0 },
  /** Lookout chamber center (observation booth). */
  lookout: { x: 5.4, z: 0 },
  lookoutGate: { x: 2.7, z: 0 },
  /** Vestibule control panel (switch) — near rest gate. */
  tool: { x: -1.55, z: 1.15 },
} as const

/**
 * Outer Lab facility AABB (matches procedural chamber shell).
 * Keeps the learner inside the experiment — Ecology ignores this.
 */
export const LAB_FACILITY_BOUNDS = {
  minX: -7.9,
  maxX: 7.9,
  minZ: -2.95,
  maxZ: 7.75,
} as const

/** True when a circle would leave the Lab facility shell. */
export function labFacilityBlocksPosition(x: number, z: number, radius: number): boolean {
  const r = Math.max(0, radius)
  return (
    x - r < LAB_FACILITY_BOUNDS.minX ||
    x + r > LAB_FACILITY_BOUNDS.maxX ||
    z - r < LAB_FACILITY_BOUNDS.minZ ||
    z + r > LAB_FACILITY_BOUNDS.maxZ
  )
}

/** Shelf slots inside the survival chamber (readable food station). */
const LAB_FOOD_RING = [
  { x: -0.55, z: 0.15 },
  { x: 0.55, z: 0.15 },
  { x: -0.95, z: -0.55 },
  { x: 0, z: -0.55 },
  { x: 0.95, z: -0.55 },
  { x: -0.55, z: -1.15 },
  { x: 0.55, z: -1.15 },
  { x: 0, z: 0.65 },
] as const

/** Food spawn on the survival-chamber shelf. */
export function pickLabFoodPosition(
  existing: readonly { position: { x: number; z: number } }[],
  index = 0,
): { x: number; z: number } {
  const ring = LAB_FOOD_RING[index % LAB_FOOD_RING.length]!
  const base = {
    x: LAB_ARENA.survival.x + ring.x,
    z: LAB_ARENA.survival.z + ring.z,
  }
  const minSepSq = 0.55 * 0.55
  const conflict = existing.some(
    (spot) => distanceSq(spot.position.x, spot.position.z, base.x, base.z) < minSepSq,
  )
  if (!conflict) return base
  const angle = (index + 1) * 1.35
  return {
    x: LAB_ARENA.survival.x + Math.cos(angle) * 1.05,
    z: LAB_ARENA.survival.z + Math.sin(angle) * 0.85 - 0.2,
  }
}

/**
 * Human Behavior Lab only: rest-gate door+switch, lookout-path box, cot, booth.
 * Condition presets control whether the rest door starts locked.
 * Ecology keeps an empty list so baseline worlds stay unchanged.
 */
export function createLabInteractables(
  config: WorldConfig,
  objects: readonly WorldObject[],
  terrain: TerrainGrid,
): Interactable[] {
  if (!isHumanBehaviorLab(clampSimulationMode(config.mode))) return []

  const effects = effectsFromWorldConfig(config)
  const half = config.size * 0.5
  const clampInArena = (x: number, z: number) => ({
    x: Math.max(-half + 2, Math.min(half - 2, x)),
    z: Math.max(-half + 2, Math.min(half - 2, z)),
  })

  const restGate = clampInArena(LAB_ARENA.restGate.x, LAB_ARENA.restGate.z)
  const rest = clampInArena(LAB_ARENA.rest.x, LAB_ARENA.rest.z)
  const look = clampInArena(LAB_ARENA.lookout.x, LAB_ARENA.lookout.z)
  const lookGate = clampInArena(LAB_ARENA.lookoutGate.x, LAB_ARENA.lookoutGate.z)
  const panel = clampInArena(LAB_ARENA.tool.x, LAB_ARENA.tool.z)

  const doorCandidates = [
    restGate,
    { x: restGate.x, z: restGate.z + 0.6 },
    { x: restGate.x, z: restGate.z - 0.6 },
    { x: restGate.x - 0.4, z: restGate.z },
  ]
  let doorPos = findOpenLabSpot(doorCandidates, objects, terrain, config.size, [])
  if (!doorPos) doorPos = restGate

  const switchCandidates = [
    panel,
    { x: doorPos.x + 1.35, z: doorPos.z + 0.85 },
    { x: doorPos.x + 1.55, z: 0.4 },
    { x: -1.2, z: 1.4 },
  ]
  let switchPos = findOpenLabSpot(switchCandidates, objects, terrain, config.size, [doorPos])
  if (!switchPos) switchPos = panel

  const boxClearance = DOOR_BLOCK_RADIUS + BOX_BLOCK_RADIUS + 0.4
  const boxCandidates = [
    { x: lookGate.x - 0.15, z: lookGate.z + 1.35 },
    { x: lookGate.x - 0.15, z: lookGate.z - 1.35 },
    { x: lookGate.x + 0.8, z: lookGate.z + 1.1 },
    { x: 2.1, z: 1.6 },
  ]
  let boxPos = findOpenLabSpot(
    boxCandidates,
    objects,
    terrain,
    config.size,
    [doorPos, switchPos],
    boxClearance,
  )
  if (!boxPos) boxPos = { x: lookGate.x - 0.1, z: lookGate.z + 1.35 }

  const bedCandidates = [
    rest,
    { x: rest.x - 0.4, z: rest.z },
    { x: rest.x, z: rest.z + 0.8 },
    { x: rest.x, z: rest.z - 0.8 },
  ]
  let bedPos = findOpenLabSpot(bedCandidates, objects, terrain, config.size, [
    doorPos,
    switchPos,
    boxPos,
  ])
  if (!bedPos) bedPos = rest

  const lookoutCandidates = [
    look,
    { x: look.x + 0.4, z: look.z },
    { x: look.x, z: look.z + 0.8 },
    { x: look.x, z: look.z - 0.8 },
  ]
  let lookoutPos = findOpenLabSpot(lookoutCandidates, objects, terrain, config.size, [
    doorPos,
    switchPos,
    boxPos,
    bedPos,
  ])
  if (!lookoutPos) lookoutPos = look

  const doorId = createId('door')
  const switchId = createId('switch')
  const boxId = createId('box')
  const bedId = createId('bed')
  const lookoutId = createId('lookout')

  const restLocked = effects.restDoorStartsClosed

  const door: DoorInteractable = {
    id: doorId,
    kind: 'door',
    position: { x: doorPos.x, y: 0, z: doorPos.z },
    // Face vestibule so the panel swings across the rest corridor.
    rotation: Math.PI / 2,
    scale: 1,
    open: !restLocked,
  }

  const sw: SwitchInteractable = {
    id: switchId,
    kind: 'switch',
    position: { x: switchPos.x, y: 0, z: switchPos.z },
    rotation: Math.atan2(doorPos.x - switchPos.x, doorPos.z - switchPos.z),
    scale: 1,
    on: !restLocked,
    controlsId: doorId,
  }

  const box: MovableBoxInteractable = {
    id: boxId,
    kind: 'movable_box',
    position: { x: boxPos.x, y: 0, z: boxPos.z },
    rotation: 0,
    scale: 1,
  }

  // Face vestibule (east toward center).
  const bed: RestBedInteractable = {
    id: bedId,
    kind: 'rest_bed',
    position: { x: bedPos.x, y: 0, z: bedPos.z },
    rotation: Math.PI / 2,
    scale: 1,
    used: false,
    lastUsedTick: 0,
  }

  // Face outward (+X) — observation window to the “outside”.
  const lookout: LookoutInteractable = {
    id: lookoutId,
    kind: 'lookout',
    position: { x: lookoutPos.x, y: 0, z: lookoutPos.z },
    rotation: Math.PI / 2,
    scale: 1,
    used: false,
    lastUsedTick: 0,
  }

  return [door, sw, box, bed, lookout]
}
