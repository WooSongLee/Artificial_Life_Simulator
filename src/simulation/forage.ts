import type { Agent } from '../types/agent'
import type { EquippedTool, ForageKind, ForageNode, ToolType, WorldTool } from '../types/forage'
import type { TerrainGrid, TerrainType } from '../types/terrain'
import { TERRAIN_TYPES } from '../types/terrain'
import type { WorldConfig, WorldObject, WorldState } from '../types/world'
import { createId } from '../utils/id'
import { clamp, clampStat, distanceSq } from '../utils/math'
import { mixSeed, mulberry32, randomInRange, type Rng } from '../utils/random'
import { GENE_DEFAULTS, TOOL_WEAR_COST_MAX, TOOL_WEAR_COST_MIN } from '../evolution/constants'
import { clampGene } from '../evolution/genome'
import {
  BERRY_BASKET_HUNGER_BONUS,
  BERRY_BASKET_YIELD,
  BERRY_BASE_YIELD,
  BERRY_ENERGY_PER_UNIT,
  BERRY_HUNGER_PER_UNIT,
  BERRY_MAX_QUANTITY,
  FORAGE_MIN_DISTANCE,
  FORAGE_SEED_SALT,
  GATHER_RADIUS,
  PICK_UP_RADIUS,
  ROOT_ENERGY_PER_UNIT,
  ROOT_HUNGER_PER_UNIT,
  ROOT_MAX_QUANTITY,
  ROOT_YIELD,
  TOOL_DURABILITY_COST,
  TOOL_MAX_DURABILITY,
  TOOL_MIN_DISTANCE,
  getForageSpawnInterval,
} from './constants'
import { createClusterCenters, findDistributedPosition, isBlockedSpawn } from './spatial'
import { getTerrainTypeAt, isTerrainWalkable } from './terrain'

const FORAGE_TERRAIN_WEIGHTS: Record<ForageKind, Record<TerrainType, number>> = {
  berry_bush: { grassland: 1, forest: 1.8, rocky: 0.25, wetland: 0.55, water: 0 },
  root_patch: { grassland: 0.7, forest: 0.85, rocky: 0.2, wetland: 1.85, water: 0 },
}

const TOOL_TERRAIN_WEIGHTS: Record<ToolType, Record<TerrainType, number>> = {
  basket: { grassland: 1, forest: 1.15, rocky: 0.45, wetland: 0.7, water: 0 },
  digging_stick: { grassland: 1, forest: 0.95, rocky: 0.85, wetland: 1.15, water: 0 },
  spear: { grassland: 1, forest: 0.7, rocky: 1.6, wetland: 0.4, water: 0 },
  shield: { grassland: 1.1, forest: 0.9, rocky: 1.2, wetland: 0.5, water: 0 },
}

export function isUsableTool(equipment: EquippedTool | null, toolType?: ToolType): boolean {
  if (!equipment || equipment.durability <= 0) return false
  return toolType === undefined || equipment.toolType === toolType
}

export function durabilityBand(equipment: EquippedTool | null): 'none' | 'high' | 'low' {
  if (!equipment || equipment.durability <= 0 || equipment.maxDurability <= 0) return 'none'
  return equipment.durability / equipment.maxDurability >= 0.5 ? 'high' : 'low'
}

export function findNearestForage(agent: Agent, world: WorldState): ForageNode | null {
  let nearest: ForageNode | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const node of world.forageNodes) {
    if (node.quantity <= 0) continue
    const dist = distanceSq(agent.position.x, agent.position.z, node.position.x, node.position.z)
    if (dist >= nearestDist) continue
    nearest = node
    nearestDist = dist
  }

  return nearest
}

export function findVisibleForage(
  agent: Agent,
  world: WorldState,
  canDetect: (x: number, z: number, dist: number) => boolean,
): ForageNode | null {
  let nearest: ForageNode | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const node of world.forageNodes) {
    if (node.quantity <= 0) continue
    const dist = distanceSq(agent.position.x, agent.position.z, node.position.x, node.position.z)
    if (dist >= nearestDist) continue
    if (!canDetect(node.position.x, node.position.z, dist)) continue
    nearest = node
    nearestDist = dist
  }

  return nearest
}

export function findForageInGatherRange(agent: Agent, nodes: readonly ForageNode[]): ForageNode | null {
  const reach = GATHER_RADIUS * GATHER_RADIUS
  for (const node of nodes) {
    if (node.quantity <= 0) continue
    const dist = distanceSq(agent.position.x, agent.position.z, node.position.x, node.position.z)
    if (dist <= reach) return node
  }
  return null
}

export function canGatherNode(agent: Agent, node: ForageNode | null): node is ForageNode {
  if (!node || node.quantity <= 0) return false
  if (node.kind === 'berry_bush') return true
  return isUsableTool(agent.equipment, 'digging_stick')
}

export function findGatherableNode(agent: Agent, world: WorldState): ForageNode | null {
  const node = findForageInGatherRange(agent, world.forageNodes)
  return canGatherNode(agent, node) ? node : null
}

export function findNearestTool(agent: Agent, tools: readonly WorldTool[]): WorldTool | null {
  let nearest: WorldTool | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const tool of tools) {
    const dist = distanceSq(agent.position.x, agent.position.z, tool.position.x, tool.position.z)
    if (dist >= nearestDist) continue
    nearest = tool
    nearestDist = dist
  }

  return nearest
}

export function findVisibleTool(
  agent: Agent,
  tools: readonly WorldTool[],
  canDetect: (x: number, z: number, dist: number) => boolean,
): WorldTool | null {
  let nearest: WorldTool | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const tool of tools) {
    const dist = distanceSq(agent.position.x, agent.position.z, tool.position.x, tool.position.z)
    if (dist >= nearestDist) continue
    if (!canDetect(tool.position.x, tool.position.z, dist)) continue
    nearest = tool
    nearestDist = dist
  }

  return nearest
}

export function findToolInPickupRange(agent: Agent, tools: readonly WorldTool[]): WorldTool | null {
  const reach = PICK_UP_RADIUS * PICK_UP_RADIUS
  for (const tool of tools) {
    const dist = distanceSq(agent.position.x, agent.position.z, tool.position.x, tool.position.z)
    if (dist <= reach) return tool
  }
  return null
}

export function canPickUpTool(agent: Agent, tool: WorldTool | null): tool is WorldTool {
  return tool !== null && agent.equipment === null
}

export function findPickupTool(agent: Agent, world: WorldState): WorldTool | null {
  const tool = findToolInPickupRange(agent, world.worldTools)
  return canPickUpTool(agent, tool) ? tool : null
}

export function agentToolAffinity(agent: Agent): number {
  const value = agent.genome.toolAffinity
  return Number.isFinite(value) ? clampGene('toolAffinity', value) : GENE_DEFAULTS.toolAffinity
}

export function toolWearCost(agent: Agent): number {
  return clamp(TOOL_DURABILITY_COST / agentToolAffinity(agent), TOOL_WEAR_COST_MIN, TOOL_WEAR_COST_MAX)
}

export function berryYield(agent: Agent, available: number): number {
  const requested = isUsableTool(agent.equipment, 'basket') ? BERRY_BASKET_YIELD : BERRY_BASE_YIELD
  return Math.min(available, requested)
}

export function gatherYield(agent: Agent, node: ForageNode): number {
  if (node.kind === 'berry_bush') return berryYield(agent, node.quantity)
  if (!isUsableTool(agent.equipment, 'digging_stick')) return 0
  return Math.min(node.quantity, ROOT_YIELD)
}

export function gatherRestore(agent: Agent, kind: ForageKind, amount: number): {
  energy: number
  hunger: number
} {
  if (amount <= 0) return { energy: 0, hunger: 0 }
  if (kind === 'berry_bush') {
    const usedBasket = isUsableTool(agent.equipment, 'basket')
    const hungerBonus = usedBasket ? BERRY_BASKET_HUNGER_BONUS : 0
    const affinity = usedBasket ? agentToolAffinity(agent) : 1
    return {
      energy: amount * BERRY_ENERGY_PER_UNIT * affinity,
      hunger: amount * (BERRY_HUNGER_PER_UNIT + hungerBonus) * affinity,
    }
  }
  const affinity = isUsableTool(agent.equipment, 'digging_stick') ? agentToolAffinity(agent) : 1
  return {
    energy: amount * ROOT_ENERGY_PER_UNIT * affinity,
    hunger: amount * ROOT_HUNGER_PER_UNIT * affinity,
  }
}

export function applyGather(
  agent: Agent,
  node: ForageNode,
): {
  agent: Agent
  node: ForageNode
  amount: number
  durabilityDelta: number
} {
  const amount = gatherYield(agent, node)
  if (amount <= 0) {
    return { agent, node, amount: 0, durabilityDelta: 0 }
  }

  const restore = gatherRestore(agent, node.kind, amount)
  const used = usedToolForGather(agent, node.kind)
  const worn = used
    ? wearEquipment(agent.equipment, toolWearCost(agent))
    : { equipment: agent.equipment, durabilityDelta: 0 }

  return {
    agent: {
      ...agent,
      energy: clampStat(agent.energy + restore.energy),
      hunger: clampStat(agent.hunger - restore.hunger),
      equipment: worn.equipment,
    },
    node: {
      ...node,
      quantity: Math.max(0, node.quantity - amount),
    },
    amount,
    durabilityDelta: worn.durabilityDelta,
  }
}

export function applyPickup(agent: Agent, tool: WorldTool): { agent: Agent; equipment: EquippedTool } {
  const equipment: EquippedTool = {
    toolType: tool.toolType,
    durability: tool.durability,
    maxDurability: tool.maxDurability,
  }
  return {
    agent: {
      ...agent,
      equipment,
    },
    equipment,
  }
}

function usedToolForGather(agent: Agent, kind: ForageKind): boolean {
  if (kind === 'berry_bush') return isUsableTool(agent.equipment, 'basket')
  return isUsableTool(agent.equipment, 'digging_stick')
}

export function wearEquipment(
  equipment: EquippedTool | null,
  cost: number,
): { equipment: EquippedTool | null; durabilityDelta: number } {
  if (!equipment || equipment.durability <= 0 || cost <= 0) {
    return { equipment, durabilityDelta: 0 }
  }
  const nextDurability = Math.max(0, equipment.durability - cost)
  if (nextDurability <= 0) {
    return { equipment: null, durabilityDelta: -equipment.durability }
  }
  return {
    equipment: {
      ...equipment,
      durability: nextDurability,
    },
    durabilityDelta: nextDurability - equipment.durability,
  }
}

export function createForageNode(
  kind: ForageKind,
  config: WorldConfig,
  existing: readonly ForageNode[],
  objects: readonly WorldObject[],
  tools: readonly WorldTool[],
  terrain: TerrainGrid,
  rng: Rng,
): ForageNode {
  const maxQuantity = kind === 'berry_bush' ? BERRY_MAX_QUANTITY : ROOT_MAX_QUANTITY
  const { x, z } = pickPlacedPoint(
    rng,
    config,
    terrain,
    FORAGE_TERRAIN_WEIGHTS[kind],
    (px, pz) => isForageBlocked(px, pz, existing, objects, tools, terrain, config.size, FORAGE_MIN_DISTANCE),
  )
  return {
    id: createId(kind),
    kind,
    position: { x, y: 0, z },
    scale: randomInRange(rng, 0.85, 1.2),
    rotation: randomInRange(rng, 0, Math.PI * 2),
    quantity: maxQuantity,
    maxQuantity,
  }
}

export function createWorldTool(
  toolType: ToolType,
  config: WorldConfig,
  existing: readonly WorldTool[],
  objects: readonly WorldObject[],
  nodes: readonly ForageNode[],
  terrain: TerrainGrid,
  rng: Rng,
): WorldTool {
  const { x, z } = pickPlacedPoint(
    rng,
    config,
    terrain,
    TOOL_TERRAIN_WEIGHTS[toolType],
    (px, pz) => isForageBlocked(px, pz, nodes, objects, existing, terrain, config.size, TOOL_MIN_DISTANCE),
  )
  return {
    id: createId(toolType),
    toolType,
    position: { x, y: 0, z },
    scale: randomInRange(rng, 0.9, 1.15),
    rotation: randomInRange(rng, 0, Math.PI * 2),
    durability: TOOL_MAX_DURABILITY,
    maxDurability: TOOL_MAX_DURABILITY,
  }
}

export function createForageContents(
  config: WorldConfig,
  objects: readonly WorldObject[],
  terrain: TerrainGrid,
  rng: Rng = mulberry32(mixSeed(config.seed, FORAGE_SEED_SALT)),
): { forageNodes: ForageNode[]; worldTools: WorldTool[] } {
  const forageNodes: ForageNode[] = []
  const worldTools: WorldTool[] = []

  for (let i = 0; i < config.initialBerryCount; i += 1) {
    forageNodes.push(createForageNode('berry_bush', config, forageNodes, objects, worldTools, terrain, rng))
  }
  for (let i = 0; i < config.initialRootCount; i += 1) {
    forageNodes.push(createForageNode('root_patch', config, forageNodes, objects, worldTools, terrain, rng))
  }
  for (let i = 0; i < config.initialBasketCount; i += 1) {
    worldTools.push(createWorldTool('basket', config, worldTools, objects, forageNodes, terrain, rng))
  }
  for (let i = 0; i < config.initialStickCount; i += 1) {
    worldTools.push(createWorldTool('digging_stick', config, worldTools, objects, forageNodes, terrain, rng))
  }
  for (let i = 0; i < config.initialSpearCount; i += 1) {
    worldTools.push(createWorldTool('spear', config, worldTools, objects, forageNodes, terrain, rng))
  }
  for (let i = 0; i < config.initialShieldCount; i += 1) {
    worldTools.push(createWorldTool('shield', config, worldTools, objects, forageNodes, terrain, rng))
  }

  return { forageNodes, worldTools }
}

export function regenerateForage(
  nodes: ForageNode[],
  world: WorldState,
  dt: number,
): { forageNodes: ForageNode[]; forageSpawnCooldown: number } {
  const interval = getForageSpawnInterval(world.config)
  const depleted = nodes.some((node) => node.quantity < node.maxQuantity)
  if (!depleted) {
    return { forageNodes: nodes, forageSpawnCooldown: interval }
  }

  let cooldown = world.forageSpawnCooldown - dt
  const nextNodes = nodes.map((node) => ({ ...node }))

  while (cooldown <= 0) {
    const target = nextNodes.find((node) => node.quantity < node.maxQuantity)
    if (!target) {
      cooldown = interval
      break
    }
    target.quantity = Math.min(target.maxQuantity, target.quantity + 1)
    cooldown += interval
  }

  return { forageNodes: nextNodes, forageSpawnCooldown: cooldown }
}

export function replaceForageNode(nodes: ForageNode[], next: ForageNode): ForageNode[] {
  return nodes.map((node) => (node.id === next.id ? next : node))
}

export function removeWorldTool(tools: WorldTool[], toolId: string): WorldTool[] {
  return tools.filter((tool) => tool.id !== toolId)
}

function isForageBlocked(
  x: number,
  z: number,
  nodes: readonly ForageNode[],
  objects: readonly WorldObject[],
  tools: readonly WorldTool[],
  terrain: TerrainGrid,
  worldSize: number,
  minDistance: number,
): boolean {
  if (!isTerrainWalkable(terrain, x, z, worldSize)) return true
  if (isBlockedSpawn(x, z, objects, undefined, terrain, worldSize)) return true
  if (isTooClose(nodes, x, z, minDistance) || isTooClose(tools, x, z, minDistance)) return true
  return false
}

function isTooClose(
  items: ReadonlyArray<{ position: { x: number; z: number } }>,
  x: number,
  z: number,
  minDistance: number,
): boolean {
  const reach = minDistance * minDistance
  return items.some((item) => distanceSq(item.position.x, item.position.z, x, z) < reach)
}

function pickPlacedPoint(
  rng: Rng,
  config: WorldConfig,
  terrain: TerrainGrid,
  weights: Record<TerrainType, number>,
  isBlocked: (x: number, z: number) => boolean,
): { x: number; z: number } {
  const centers = config.resourceDistribution === 'clustered' ? createClusterCenters(rng, config, 3) : undefined
  const maxWeight = Math.max(...TERRAIN_TYPES.map((type) => weights[type]))

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const point = findDistributedPosition(rng, config, isBlocked, centers)
    if (isBlocked(point.x, point.z)) continue
    const weight = weights[getTerrainTypeAt(terrain, point.x, point.z, config.size)]
    if (weight <= 0) continue
    if (maxWeight <= 0 || rng() * maxWeight <= weight) {
      return point
    }
  }

  return findDistributedPosition(rng, config, isBlocked, centers)
}

export function sanitizeEquipment(equipment: EquippedTool | null | undefined): EquippedTool | null {
  if (!equipment) return null
  if (
    equipment.toolType !== 'basket' &&
    equipment.toolType !== 'digging_stick' &&
    equipment.toolType !== 'spear' &&
    equipment.toolType !== 'shield'
  ) {
    return null
  }
  const maxDurability = Math.max(1, Math.round(Number.isFinite(equipment.maxDurability) ? equipment.maxDurability : TOOL_MAX_DURABILITY))
  const durability = clamp(Math.round(Number.isFinite(equipment.durability) ? equipment.durability : 0), 0, maxDurability)
  if (durability <= 0) return null
  return { toolType: equipment.toolType, durability, maxDurability }
}

export function sanitizeForageNode(node: ForageNode): ForageNode {
  const maxQuantity = Math.max(1, Math.round(Number.isFinite(node.maxQuantity) ? node.maxQuantity : 1))
  return {
    ...node,
    position: {
      x: Number.isFinite(node.position.x) ? node.position.x : 0,
      y: Number.isFinite(node.position.y) ? node.position.y : 0,
      z: Number.isFinite(node.position.z) ? node.position.z : 0,
    },
    scale: clamp(node.scale, 0.1, 8),
    rotation: Number.isFinite(node.rotation) ? node.rotation : 0,
    quantity: clamp(Math.round(Number.isFinite(node.quantity) ? node.quantity : 0), 0, maxQuantity),
    maxQuantity,
  }
}

export function sanitizeWorldTool(tool: WorldTool): WorldTool {
  const maxDurability = Math.max(1, Math.round(Number.isFinite(tool.maxDurability) ? tool.maxDurability : TOOL_MAX_DURABILITY))
  return {
    ...tool,
    position: {
      x: Number.isFinite(tool.position.x) ? tool.position.x : 0,
      y: Number.isFinite(tool.position.y) ? tool.position.y : 0,
      z: Number.isFinite(tool.position.z) ? tool.position.z : 0,
    },
    scale: clamp(tool.scale, 0.1, 8),
    rotation: Number.isFinite(tool.rotation) ? tool.rotation : 0,
    durability: clamp(Math.round(Number.isFinite(tool.durability) ? tool.durability : 0), 0, maxDurability),
    maxDurability,
  }
}
