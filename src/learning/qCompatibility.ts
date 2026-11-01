import type { SerializedBrain } from './brain'
import { createEmptyActionCounts } from './actionEvents'
import {
  ACTION_SCHEMA_VERSION,
  OBSERVATION_SCHEMA_VERSION,
  actionCountForSchema,
  canPadActionSchema,
  isValidStateKeyForSchema,
} from './schema'
import { AGENT_ACTIONS } from './types'
import type { AgentAction } from './types'

export type QTableMigrationStatus = 'intact' | 'padded' | 'reset'

export interface BrainMigrationResult {
  brain: SerializedBrain
  status: QTableMigrationStatus
  reason: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function padRow(values: unknown, targetLength: number): number[] | null {
  if (!Array.isArray(values)) return null
  const row = new Array<number>(targetLength).fill(0)
  for (let index = 0; index < Math.min(values.length, targetLength); index += 1) {
    const value = values[index]
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    row[index] = value
  }
  return row
}

function emptyActionCountsFrom(value: unknown): Record<AgentAction, number> {
  const counts = createEmptyActionCounts()
  if (!isRecord(value)) return counts
  for (const action of AGENT_ACTIONS) {
    const next = value[action]
    counts[action] = typeof next === 'number' && Number.isFinite(next) ? next : 0
  }
  return counts
}

export function padQTableEntries(
  entries: unknown,
  fromActionVersion: number,
  toActionVersion: number,
  observationVersion: number,
): Array<[string, number[]]> | null {
  if (!Array.isArray(entries)) return null
  if (!canPadActionSchema(fromActionVersion, toActionVersion)) return null
  const targetLength = actionCountForSchema(toActionVersion)
  const next: Array<[string, number[]]> = []

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2) return null
    const [key, values] = entry
    if (!isValidStateKeyForSchema(key, observationVersion)) return null
    if (!Array.isArray(values) || values.length > targetLength) return null
    const row = padRow(values, targetLength)
    if (!row) return null
    next.push([key, row])
  }

  return next
}

export function resetSerializedBrain(
  brain: Record<string, unknown>,
  epsilon: number,
): SerializedBrain {
  return {
    agentId: typeof brain.agentId === 'string' ? brain.agentId : 'unknown',
    qTable: [],
    epsilon,
    totalSteps: Math.max(0, finiteNumber(brain.totalSteps, 0)),
    totalReward: finiteNumber(brain.totalReward, 0),
    recentRewards: [],
    recentExplored: [],
    actionCounts: emptyActionCountsFrom(brain.actionCounts),
    actionSchemaVersion: ACTION_SCHEMA_VERSION,
    observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
  }
}

export function migrateSerializedBrain(
  value: unknown,
  epsilonFallback: number,
): BrainMigrationResult {
  if (!isRecord(value)) {
    return {
      brain: resetSerializedBrain({}, epsilonFallback),
      status: 'reset',
      reason: 'Brain record was invalid. Q-Table was reset. World, Genome, and generation stats were kept.',
    }
  }

  const actionVersion = finiteNumber(value.actionSchemaVersion, 1)
  const observationVersion = finiteNumber(value.observationSchemaVersion, 1)
  const epsilon = finiteNumber(value.epsilon, epsilonFallback)
  const qTable = Array.isArray(value.qTable) ? value.qTable : []
  const hadEntries = qTable.length > 0

  const observationCompatible = observationVersion === OBSERVATION_SCHEMA_VERSION
  const keysCompatible =
    !hadEntries ||
    qTable.every(
      (entry) =>
        Array.isArray(entry) &&
        typeof entry[0] === 'string' &&
        isValidStateKeyForSchema(entry[0], OBSERVATION_SCHEMA_VERSION),
    )

  if (!observationCompatible || !keysCompatible) {
    return {
      brain: resetSerializedBrain(value, epsilonFallback),
      status: hadEntries ? 'reset' : 'intact',
      reason: hadEntries
        ? `Observation schema v${observationVersion} → v${OBSERVATION_SCHEMA_VERSION} cannot convert state keys. Q-Table was reset. World, Genome, and generation stats were kept.`
        : null,
    }
  }

  if (actionVersion === ACTION_SCHEMA_VERSION) {
    const padded = padQTableEntries(
      qTable,
      ACTION_SCHEMA_VERSION,
      ACTION_SCHEMA_VERSION,
      OBSERVATION_SCHEMA_VERSION,
    )
    if (!padded) {
      return {
        brain: resetSerializedBrain(value, epsilonFallback),
        status: hadEntries ? 'reset' : 'intact',
        reason: hadEntries
          ? 'Q-Table rows were not finite or did not match the current action schema. Q-Table was reset. World, Genome, and generation stats were kept.'
          : null,
      }
    }

    return {
      brain: {
        agentId: typeof value.agentId === 'string' ? value.agentId : 'unknown',
        qTable: padded,
        epsilon,
        totalSteps: Math.max(0, finiteNumber(value.totalSteps, 0)),
        totalReward: finiteNumber(value.totalReward, 0),
        recentRewards: Array.isArray(value.recentRewards)
          ? value.recentRewards.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
          : [],
        recentExplored: Array.isArray(value.recentExplored)
          ? value.recentExplored.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
          : [],
        actionCounts: emptyActionCountsFrom(value.actionCounts),
        actionSchemaVersion: ACTION_SCHEMA_VERSION,
        observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
      },
      status: 'intact',
      reason: null,
    }
  }

  if (canPadActionSchema(actionVersion, ACTION_SCHEMA_VERSION)) {
    const padded = padQTableEntries(
      qTable,
      actionVersion,
      ACTION_SCHEMA_VERSION,
      OBSERVATION_SCHEMA_VERSION,
    )
    if (padded) {
      return {
        brain: {
          agentId: typeof value.agentId === 'string' ? value.agentId : 'unknown',
          qTable: padded,
          epsilon,
          totalSteps: Math.max(0, finiteNumber(value.totalSteps, 0)),
          totalReward: finiteNumber(value.totalReward, 0),
          recentRewards: Array.isArray(value.recentRewards)
            ? value.recentRewards.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
            : [],
          recentExplored: Array.isArray(value.recentExplored)
            ? value.recentExplored.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
            : [],
          actionCounts: emptyActionCountsFrom(value.actionCounts),
          actionSchemaVersion: ACTION_SCHEMA_VERSION,
          observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
        },
        status: hadEntries ? 'padded' : 'intact',
        reason: hadEntries
          ? `Action schema v${actionVersion} → v${ACTION_SCHEMA_VERSION} padded new actions with 0. Existing Q values were kept.`
          : null,
      }
    }
  }

  return {
    brain: resetSerializedBrain(value, epsilonFallback),
    status: hadEntries ? 'reset' : 'intact',
    reason: hadEntries
      ? `Action schema v${actionVersion} cannot be converted to v${ACTION_SCHEMA_VERSION}. Q-Table was reset. World, Genome, and generation stats were kept.`
      : null,
  }
}

export function combineQTableStatus(
  current: QTableMigrationStatus,
  next: QTableMigrationStatus,
): QTableMigrationStatus {
  if (current === 'reset' || next === 'reset') return 'reset'
  if (current === 'padded' || next === 'padded') return 'padded'
  return 'intact'
}
