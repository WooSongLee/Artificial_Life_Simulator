import { afterEach, describe, expect, it } from 'vitest'
import { countActionDecision, resetActionEvents } from '../learning/actionEvents'
import { DEFAULT_LEARNING_CONFIG } from '../learning/constants'
import { resetBrains } from '../learning/brain'
import { DEFAULT_WORLD_CONFIG, LEARNING_HISTORY_SAMPLE_TICKS } from './constants'
import {
  compareLearningWindows,
  createEmptyLearningHistory,
  createLearningHistory,
  recordLearningHistory,
} from './metrics'
import { createInitialWorld } from './worldFactory'

afterEach(() => {
  resetActionEvents()
})

describe('learning history action samples', () => {
  it('stores interval action counts only on the 20-tick sample boundary', () => {
    const world = createInitialWorld({ ...DEFAULT_WORLD_CONFIG, agentCount: 1 })
    resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)
    resetActionEvents()

    countActionDecision('EAT')
    const skipped = recordLearningHistory(
      createEmptyLearningHistory(),
      LEARNING_HISTORY_SAMPLE_TICKS - 1,
      world.agents,
      true,
    )
    expect(skipped.series).toHaveLength(0)

    countActionDecision('MOVE_FORWARD')
    const sampled = recordLearningHistory(skipped, LEARNING_HISTORY_SAMPLE_TICKS, world.agents, true)
    expect(sampled.series).toHaveLength(1)
    expect(sampled.series[0]?.analytics?.total).toBe(2)
    expect(sampled.series[0]?.actionCounts).toEqual({
      MOVE_FORWARD: 1,
      TURN_LEFT: 0,
      TURN_RIGHT: 0,
      EAT: 1,
      REST: 0,
      PICK_UP: 0,
      GATHER: 0,
      ATTACK: 0,
      DEFEND: 0,
      FLEE: 0,
    })
  })

  it('does not invent early/late action shares before the windows stop overlapping', () => {
    const world = createInitialWorld({ ...DEFAULT_WORLD_CONFIG, agentCount: 1 })
    const history = createLearningHistory(0, world.agents, true)
    expect(compareLearningWindows(history)).toBeNull()
  })
})
