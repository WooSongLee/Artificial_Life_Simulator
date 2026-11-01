import type { WorldOutcomeStats } from '../types/world'

export type { WorldOutcomeStats }

export const EMPTY_OUTCOME_STATS: WorldOutcomeStats = {
  foodEaten: 0,
  resourcesGathered: 0,
  toolPickupAttempts: 0,
  toolPickupSuccesses: 0,
  gatherAttempts: 0,
  gatherSuccesses: 0,
  damageDealt: 0,
  damageReceived: 0,
  attackAttempts: 0,
  attackHits: 0,
  defendAttempts: 0,
  defendReductions: 0,
  fleeAttempts: 0,
  fleeSuccesses: 0,
}

function finiteCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

export function createEmptyOutcomeStats(): WorldOutcomeStats {
  return { ...EMPTY_OUTCOME_STATS }
}

export function sanitizeOutcomeStats(value: unknown): WorldOutcomeStats {
  if (typeof value !== 'object' || value === null) return createEmptyOutcomeStats()
  const source = value as Record<string, unknown>
  return {
    foodEaten: finiteCount(source.foodEaten),
    resourcesGathered: finiteCount(source.resourcesGathered),
    toolPickupAttempts: finiteCount(source.toolPickupAttempts),
    toolPickupSuccesses: finiteCount(source.toolPickupSuccesses),
    gatherAttempts: finiteCount(source.gatherAttempts),
    gatherSuccesses: finiteCount(source.gatherSuccesses),
    damageDealt: finiteCount(source.damageDealt),
    damageReceived: finiteCount(source.damageReceived),
    attackAttempts: finiteCount(source.attackAttempts),
    attackHits: finiteCount(source.attackHits),
    defendAttempts: finiteCount(source.defendAttempts),
    defendReductions: finiteCount(source.defendReductions),
    fleeAttempts: finiteCount(source.fleeAttempts),
    fleeSuccesses: finiteCount(source.fleeSuccesses),
  }
}

export function addOutcomeStats(left: WorldOutcomeStats, right: Partial<WorldOutcomeStats>): WorldOutcomeStats {
  return {
    foodEaten: left.foodEaten + (right.foodEaten ?? 0),
    resourcesGathered: left.resourcesGathered + (right.resourcesGathered ?? 0),
    toolPickupAttempts: left.toolPickupAttempts + (right.toolPickupAttempts ?? 0),
    toolPickupSuccesses: left.toolPickupSuccesses + (right.toolPickupSuccesses ?? 0),
    gatherAttempts: left.gatherAttempts + (right.gatherAttempts ?? 0),
    gatherSuccesses: left.gatherSuccesses + (right.gatherSuccesses ?? 0),
    damageDealt: left.damageDealt + (right.damageDealt ?? 0),
    damageReceived: left.damageReceived + (right.damageReceived ?? 0),
    attackAttempts: left.attackAttempts + (right.attackAttempts ?? 0),
    attackHits: left.attackHits + (right.attackHits ?? 0),
    defendAttempts: left.defendAttempts + (right.defendAttempts ?? 0),
    defendReductions: left.defendReductions + (right.defendReductions ?? 0),
    fleeAttempts: left.fleeAttempts + (right.fleeAttempts ?? 0),
    fleeSuccesses: left.fleeSuccesses + (right.fleeSuccesses ?? 0),
  }
}

export function toolUsageAttempts(stats: WorldOutcomeStats): number {
  return stats.toolPickupAttempts + stats.gatherAttempts
}

export function toolUsageSuccesses(stats: WorldOutcomeStats): number {
  return stats.toolPickupSuccesses + stats.gatherSuccesses
}

export function toolUsageSuccessRate(stats: WorldOutcomeStats): number | null {
  const attempts = toolUsageAttempts(stats)
  return attempts > 0 ? toolUsageSuccesses(stats) / attempts : null
}
