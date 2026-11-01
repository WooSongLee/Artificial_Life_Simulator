import { describe, expect, it } from 'vitest'
import { migrateSerializedBrain, padQTableEntries } from './qCompatibility'
import { ACTION_SCHEMA_VERSION, OBSERVATION_SCHEMA_VERSION, isValidStateKeyForSchema } from './schema'
import { decodeObservation, encodeObservation } from './observation'
import type { Observation } from './types'

const currentKey =
  'mid|high|forward|close|no|grassland|forest|none|none|none|none|out|high'

describe('q-table compatibility', () => {
  it('pads append-only action rows and keeps existing Q values', () => {
    const padded = padQTableEntries(
      [[currentKey, [1, 2, 3, 4, 5, 6, 7]]],
      2,
      ACTION_SCHEMA_VERSION,
      OBSERVATION_SCHEMA_VERSION,
    )
    expect(padded?.[0]?.[1]).toEqual([1, 2, 3, 4, 5, 6, 7, 0, 0, 0])
  })

  it('resets Q-tables when observation tokens cannot be converted and keeps learning totals', () => {
    const migrated = migrateSerializedBrain(
      {
        agentId: 'a1',
        qTable: [['low|mid|forward|close|no', [1, 0, 0, 0, 0]]],
        epsilon: 0.1,
        totalSteps: 12,
        totalReward: 4,
        recentRewards: [1],
        recentExplored: [1],
        actionCounts: { MOVE_FORWARD: 9 },
        actionSchemaVersion: 1,
        observationSchemaVersion: 1,
      },
      0.8,
    )
    expect(migrated.status).toBe('reset')
    expect(migrated.brain.qTable).toEqual([])
    expect(migrated.brain.totalSteps).toBe(12)
    expect(migrated.brain.totalReward).toBe(4)
    expect(migrated.brain.actionCounts.MOVE_FORWARD).toBe(9)
    expect(migrated.brain.epsilon).toBe(0.8)
    expect(migrated.reason).toContain('Q-Table was reset')
  })

  it('pads current-observation brains that only lack newer actions', () => {
    const migrated = migrateSerializedBrain(
      {
        agentId: 'a2',
        qTable: [[currentKey, [0.5, 0, 0, 1, 0, 0, 0]]],
        epsilon: 0.2,
        totalSteps: 3,
        totalReward: 1,
        recentRewards: [],
        recentExplored: [],
        actionCounts: {},
        actionSchemaVersion: 2,
        observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
      },
      1,
    )
    expect(migrated.status).toBe('padded')
    expect(migrated.brain.qTable[0]?.[1]).toEqual([0.5, 0, 0, 1, 0, 0, 0, 0, 0, 0])
    expect(migrated.brain.actionSchemaVersion).toBe(ACTION_SCHEMA_VERSION)
  })

  it('rejects undefined, NaN, Infinity, and colliding observation keys', () => {
    expect(isValidStateKeyForSchema('low|mid|forward|close|no|NaN|forest|none|none|none|none|out|high', 4)).toBe(false)
    expect(isValidStateKeyForSchema('low|mid|forward|close|no|undefined|forest|none|none|none|none|out|high', 4)).toBe(false)
    expect(isValidStateKeyForSchema('low|mid|forward|close|no|Infinity|forest|none|none|none|none|out|high', 4)).toBe(false)
    expect(isValidStateKeyForSchema(undefined, 4)).toBe(false)
    expect(decodeObservation('low|mid|forward|close|no')).toBeNull()

    const first: Observation = {
      energy: 'low',
      hunger: 'mid',
      foodDirection: 'forward',
      foodDistance: 'close',
      obstacleAhead: 'no',
      terrain: 'grassland',
      terrainAhead: 'forest',
      forage: 'none',
      nearbyTool: 'none',
      heldTool: 'none',
      agentDirection: 'none',
      agentDistance: 'out',
      health: 'high',
    }
    const second = { ...first, terrain: 'wetland' as const }
    expect(encodeObservation(first)).not.toBe(encodeObservation(second))
    expect(decodeObservation(encodeObservation(first))).toEqual(first)
  })
})
