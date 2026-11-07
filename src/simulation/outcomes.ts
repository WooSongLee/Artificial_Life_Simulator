import type { WorldOutcomeStats } from '../types/world'

export type { WorldOutcomeStats }

export const EMPTY_OUTCOME_STATS: WorldOutcomeStats = {
  foodEaten: 0,
  resourcesGathered: 0,
  toolPickupAttempts: 0,
  toolPickupSuccesses: 0,
  gatherAttempts: 0,
  gatherSuccesses: 0,
  interactAttempts: 0,
  interactSuccesses: 0,
  drivePicks: 0,
  survivalPicks: 0,
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
    interactAttempts: finiteCount(source.interactAttempts),
    interactSuccesses: finiteCount(source.interactSuccesses),
    drivePicks: finiteCount(source.drivePicks),
    survivalPicks: finiteCount(source.survivalPicks),
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
    interactAttempts: left.interactAttempts + (right.interactAttempts ?? 0),
    interactSuccesses: left.interactSuccesses + (right.interactSuccesses ?? 0),
    drivePicks: left.drivePicks + (right.drivePicks ?? 0),
    survivalPicks: left.survivalPicks + (right.survivalPicks ?? 0),
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

export function interactSuccessRate(stats: WorldOutcomeStats): number | null {
  return stats.interactAttempts > 0 ? stats.interactSuccesses / stats.interactAttempts : null
}

/** Share of drive (rest/lookout) vs survival (EAT) picks among those two buckets. */
export function driveVsSurvivalPickRates(stats: WorldOutcomeStats): {
  drivePicks: number
  survivalPicks: number
  driveRate: number
  survivalRate: number
} | null {
  const drivePicks = stats.drivePicks
  const survivalPicks = stats.survivalPicks
  const total = drivePicks + survivalPicks
  if (total <= 0) return null
  return {
    drivePicks,
    survivalPicks,
    driveRate: drivePicks / total,
    survivalRate: survivalPicks / total,
  }
}

/** Lab choice counters used for Learning On vs Frozen Q capture/compare. */
export interface LabChoiceCounts {
  drivePicks: number
  survivalPicks: number
  interactAttempts: number
  interactSuccesses: number
}

export function emptyLabChoiceCounts(): LabChoiceCounts {
  return {
    drivePicks: 0,
    survivalPicks: 0,
    interactAttempts: 0,
    interactSuccesses: 0,
  }
}

export function labChoiceCountsFrom(stats: WorldOutcomeStats): LabChoiceCounts {
  return {
    drivePicks: stats.drivePicks,
    survivalPicks: stats.survivalPicks,
    interactAttempts: stats.interactAttempts,
    interactSuccesses: stats.interactSuccesses,
  }
}

export function labChoiceDriveSurvivalRates(counts: LabChoiceCounts): {
  drivePicks: number
  survivalPicks: number
  driveRate: number
  survivalRate: number
} | null {
  const total = counts.drivePicks + counts.survivalPicks
  if (total <= 0) return null
  return {
    drivePicks: counts.drivePicks,
    survivalPicks: counts.survivalPicks,
    driveRate: counts.drivePicks / total,
    survivalRate: counts.survivalPicks / total,
  }
}

export function labChoiceInteractRate(counts: LabChoiceCounts): number | null {
  return counts.interactAttempts > 0 ? counts.interactSuccesses / counts.interactAttempts : null
}

/** Side-by-side Lab choice rates: Learning On capture vs Frozen Q capture. */
export function compareLabOnVsFrozen(
  learning: LabChoiceCounts | null,
  frozen: LabChoiceCounts | null,
): {
  learningRates: ReturnType<typeof labChoiceDriveSurvivalRates>
  frozenRates: ReturnType<typeof labChoiceDriveSurvivalRates>
  learningInteractRate: number | null
  frozenInteractRate: number | null
  driveRateDelta: number | null
  survivalRateDelta: number | null
  interactRateDelta: number | null
} | null {
  if (!learning && !frozen) return null
  const learningRates = learning ? labChoiceDriveSurvivalRates(learning) : null
  const frozenRates = frozen ? labChoiceDriveSurvivalRates(frozen) : null
  const learningInteractRate = learning ? labChoiceInteractRate(learning) : null
  const frozenInteractRate = frozen ? labChoiceInteractRate(frozen) : null
  return {
    learningRates,
    frozenRates,
    learningInteractRate,
    frozenInteractRate,
    driveRateDelta:
      learningRates && frozenRates ? learningRates.driveRate - frozenRates.driveRate : null,
    survivalRateDelta:
      learningRates && frozenRates ? learningRates.survivalRate - frozenRates.survivalRate : null,
    interactRateDelta:
      learningInteractRate !== null && frozenInteractRate !== null
        ? learningInteractRate - frozenInteractRate
        : null,
  }
}

export function isDriveTargetKind(targetKind: string | null | undefined): boolean {
  return targetKind === 'rest_bed' || targetKind === 'lookout'
}

export type DriveVsSurvivalKind = 'drive' | 'survival'

export interface DriveVsSurvivalTrajectoryPoint {
  eventId: string
  simulationTime: number
  kind: DriveVsSurvivalKind
  label: string
  outcome: string | null
}

/** Classify one completed action as survival (EAT) or non-survival drive (rest/lookout). */
export function classifyDriveVsSurvivalEvent(event: {
  selectedAction: string
  targetKind?: string | null
}): DriveVsSurvivalKind | null {
  if (isDriveTargetKind(event.targetKind)) return 'drive'
  if (event.selectedAction === 'EAT') return 'survival'
  return null
}

/** Filter action events into a survival vs non-survival trajectory (newest-first input ok). */
export function driveVsSurvivalTrajectory(
  events: ReadonlyArray<{
    eventId: string
    simulationTime: number
    selectedAction: string
    targetKind: string | null
    outcome?: string
  }>,
): DriveVsSurvivalTrajectoryPoint[] {
  const points: DriveVsSurvivalTrajectoryPoint[] = []
  for (const event of events) {
    const kind = classifyDriveVsSurvivalEvent(event)
    if (!kind) continue
    points.push({
      eventId: event.eventId,
      simulationTime: event.simulationTime,
      kind,
      label:
        kind === 'drive'
          ? event.targetKind === 'lookout'
            ? 'Lookout'
            : 'Rest bed'
          : 'Eat',
      outcome: event.outcome ?? null,
    })
  }
  return points
}

export interface DriveVsSurvivalWindowRates {
  drivePicks: number
  survivalPicks: number
  driveRate: number | null
  survivalRate: number | null
}

export interface DriveVsSurvivalEarlyLate {
  early: DriveVsSurvivalWindowRates
  late: DriveVsSurvivalWindowRates
  /** True when late drive share rises vs early (or early was pure survival and late has drive). */
  driveShareShift: boolean
}

function windowRatesFromPoints(
  points: readonly DriveVsSurvivalTrajectoryPoint[],
): DriveVsSurvivalWindowRates {
  let drivePicks = 0
  let survivalPicks = 0
  for (const point of points) {
    if (point.kind === 'drive') drivePicks += 1
    else survivalPicks += 1
  }
  const total = drivePicks + survivalPicks
  return {
    drivePicks,
    survivalPicks,
    driveRate: total > 0 ? drivePicks / total : null,
    survivalRate: total > 0 ? survivalPicks / total : null,
  }
}

/**
 * Split chronological trajectory at `splitTime` (sim seconds).
 * Mirrors lab:probe early (≤ survival primer) vs late windows from real events.
 */
export function driveVsSurvivalEarlyLate(
  points: readonly DriveVsSurvivalTrajectoryPoint[],
  splitTime: number,
): DriveVsSurvivalEarlyLate | null {
  if (points.length === 0) return null
  const chronological = [...points].sort((a, b) => a.simulationTime - b.simulationTime)
  const earlyPts = chronological.filter((point) => point.simulationTime <= splitTime)
  const latePts = chronological.filter((point) => point.simulationTime > splitTime)
  const early = windowRatesFromPoints(earlyPts)
  const late = windowRatesFromPoints(latePts)
  const earlyDrive = early.driveRate
  const lateDrive = late.driveRate
  const driveShareShift =
    late.drivePicks + late.survivalPicks > 0 &&
    early.drivePicks + early.survivalPicks > 0 &&
    ((lateDrive !== null && earlyDrive !== null && lateDrive > earlyDrive + 0.05) ||
      (early.drivePicks === 0 && late.drivePicks > 0))
  return { early, late, driveShareShift }
}
