import { TERRAIN_TYPES, type TerrainType } from '../types/terrain'
import { createEmptyActionCounts, totalActionCounts } from './actionEvents'
import { AGENT_ACTIONS } from './types'
import type { AgentAction } from './types'

export type CombatAction = 'ATTACK' | 'DEFEND' | 'FLEE'

export interface CombatActionStats {
  selected: number
  success: number
  failed: number
  noTarget: number
}

export interface ToolSuccessStats {
  attempts: number
  success: number
}

export interface IntervalActionAnalytics {
  counts: Record<AgentAction, number>
  total: number
  exploreCount: number
  exploitCount: number
  terrainCounts: Record<TerrainType, Record<AgentAction, number>>
  toolHeld: ToolSuccessStats
  toolEmpty: ToolSuccessStats
  combat: Record<CombatAction, CombatActionStats>
}

export interface ActionWindowAnalytics {
  decisions: number
  exploreCount: number
  exploitCount: number
  exploreRatio: number | null
  exploitRatio: number | null
  actionCounts: Record<AgentAction, number>
  actionRatios: Record<AgentAction, number> | null
  terrainShares: Record<TerrainType, Record<AgentAction, number> | null>
  terrainDecisions: Record<TerrainType, number>
  toolHeld: ToolSuccessStats
  toolEmpty: ToolSuccessStats
  toolHeldSuccessRate: number | null
  toolEmptySuccessRate: number | null
  combat: Record<CombatAction, CombatActionStats>
}

const COMBAT_ACTIONS: readonly CombatAction[] = ['ATTACK', 'DEFEND', 'FLEE']

export function emptyCombatStats(): CombatActionStats {
  return { selected: 0, success: 0, failed: 0, noTarget: 0 }
}

export function emptyTerrainActionCounts(): Record<TerrainType, Record<AgentAction, number>> {
  const counts = {} as Record<TerrainType, Record<AgentAction, number>>
  for (const terrain of TERRAIN_TYPES) {
    counts[terrain] = createEmptyActionCounts()
  }
  return counts
}

export function createEmptyIntervalAnalytics(): IntervalActionAnalytics {
  return {
    counts: createEmptyActionCounts(),
    total: 0,
    exploreCount: 0,
    exploitCount: 0,
    terrainCounts: emptyTerrainActionCounts(),
    toolHeld: { attempts: 0, success: 0 },
    toolEmpty: { attempts: 0, success: 0 },
    combat: {
      ATTACK: emptyCombatStats(),
      DEFEND: emptyCombatStats(),
      FLEE: emptyCombatStats(),
    },
  }
}

export function cloneIntervalAnalytics(value: IntervalActionAnalytics): IntervalActionAnalytics {
  return {
    counts: { ...value.counts },
    total: value.total,
    exploreCount: value.exploreCount,
    exploitCount: value.exploitCount,
    terrainCounts: Object.fromEntries(
      TERRAIN_TYPES.map((terrain) => [terrain, { ...value.terrainCounts[terrain] }]),
    ) as Record<TerrainType, Record<AgentAction, number>>,
    toolHeld: { ...value.toolHeld },
    toolEmpty: { ...value.toolEmpty },
    combat: {
      ATTACK: { ...value.combat.ATTACK },
      DEFEND: { ...value.combat.DEFEND },
      FLEE: { ...value.combat.FLEE },
    },
  }
}

export function addIntervalAnalytics(
  target: IntervalActionAnalytics,
  extra: IntervalActionAnalytics | undefined,
): IntervalActionAnalytics {
  if (!extra) return target
  for (const action of AGENT_ACTIONS) {
    target.counts[action] += extra.counts[action] ?? 0
  }
  target.total += extra.total
  target.exploreCount += extra.exploreCount
  target.exploitCount += extra.exploitCount
  for (const terrain of TERRAIN_TYPES) {
    for (const action of AGENT_ACTIONS) {
      target.terrainCounts[terrain][action] += extra.terrainCounts[terrain]?.[action] ?? 0
    }
  }
  target.toolHeld.attempts += extra.toolHeld.attempts
  target.toolHeld.success += extra.toolHeld.success
  target.toolEmpty.attempts += extra.toolEmpty.attempts
  target.toolEmpty.success += extra.toolEmpty.success
  for (const action of COMBAT_ACTIONS) {
    target.combat[action].selected += extra.combat[action].selected
    target.combat[action].success += extra.combat[action].success
    target.combat[action].failed += extra.combat[action].failed
    target.combat[action].noTarget += extra.combat[action].noTarget
  }
  return target
}

function ratio(part: number, total: number): number | null {
  return total > 0 ? part / total : null
}

function actionRatios(counts: Record<AgentAction, number>): Record<AgentAction, number> | null {
  const total = totalActionCounts(counts)
  if (total <= 0) return null
  const next = createEmptyActionCounts()
  for (const action of AGENT_ACTIONS) {
    next[action] = counts[action] / total
  }
  return next
}

export function summarizeActionAnalytics(
  snapshots: readonly IntervalActionAnalytics[],
): ActionWindowAnalytics | null {
  if (snapshots.length === 0) return null
  const combined = createEmptyIntervalAnalytics()
  for (const snapshot of snapshots) {
    addIntervalAnalytics(combined, snapshot)
  }
  if (combined.total <= 0 && combined.exploreCount + combined.exploitCount <= 0) {
    return combined.toolHeld.attempts + combined.toolEmpty.attempts > 0 ||
      COMBAT_ACTIONS.some((action) => combined.combat[action].selected > 0)
      ? toWindow(combined)
      : null
  }
  return toWindow(combined)
}

function toWindow(combined: IntervalActionAnalytics): ActionWindowAnalytics {
  const decisions = combined.total
  const exploreDecisions = combined.exploreCount + combined.exploitCount
  return {
    decisions,
    exploreCount: combined.exploreCount,
    exploitCount: combined.exploitCount,
    exploreRatio: ratio(combined.exploreCount, exploreDecisions),
    exploitRatio: ratio(combined.exploitCount, exploreDecisions),
    actionCounts: combined.counts,
    actionRatios: actionRatios(combined.counts),
    terrainShares: Object.fromEntries(
      TERRAIN_TYPES.map((terrain) => [terrain, actionRatios(combined.terrainCounts[terrain])]),
    ) as Record<TerrainType, Record<AgentAction, number> | null>,
    terrainDecisions: Object.fromEntries(
      TERRAIN_TYPES.map((terrain) => [terrain, totalActionCounts(combined.terrainCounts[terrain])]),
    ) as Record<TerrainType, number>,
    toolHeld: combined.toolHeld,
    toolEmpty: combined.toolEmpty,
    toolHeldSuccessRate: ratio(combined.toolHeld.success, combined.toolHeld.attempts),
    toolEmptySuccessRate: ratio(combined.toolEmpty.success, combined.toolEmpty.attempts),
    combat: combined.combat,
  }
}

export function isCombatAction(action: AgentAction): action is CombatAction {
  return action === 'ATTACK' || action === 'DEFEND' || action === 'FLEE'
}

export function isToolAction(action: AgentAction): boolean {
  return action === 'PICK_UP' || action === 'GATHER'
}
