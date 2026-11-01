import { afterEach, describe, expect, it } from 'vitest'
import { resetBrains } from './brain'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from './constants'
import { AGENT_ACTIONS } from './types'
import {
  ACTION_EVENT_LIMIT_GLOBAL,
  ACTION_EVENT_LIMIT_PER_AGENT,
  beginActionDecision,
  classifyActionOutcome,
  completeActionOutcome,
  countActionDecision,
  consumeIntervalActionCounts,
  recordIntervalOutcome,
  getAgentActionEvents,
  getCompletedActionEvent,
  getPendingActionDecision,
  getRecentActionEvents,
  resetActionEvents,
} from './actionEvents'
import { updateAgent } from '../simulation/agentSystem'
import { DEFAULT_WORLD_CONFIG, SIMULATION_STEP_DT } from '../simulation/constants'
import { createInitialWorld } from '../simulation/worldFactory'

afterEach(() => {
  resetActionEvents()
})

function decisionInput(agentId = 'agent-1', action: (typeof AGENT_ACTIONS)[number] = 'MOVE_FORWARD') {
  return {
    tick: 4,
    simulationTime: 0.2,
    agentId,
    stateKey: 'low|mid|forward|close|no',
    selectedAction: action,
    decisionType: 'exploration' as const,
    epsilon: 0.8,
    qValues: [0.1, 0, 0, 2, 0],
  }
}

function outcomeInput(action: (typeof AGENT_ACTIONS)[number] = 'MOVE_FORWARD') {
  return {
    tick: 4,
    simulationTime: 0.2,
    agentId: 'agent-1',
    action,
    outcome: 'success' as const,
    targetId: null,
    targetKind: null,
    gatheredAmount: 0,
    durabilityDelta: 0,
    damageDealt: 0,
    damageReduced: 0,
    reward: 0,
    energyDelta: -0.05,
    healthDelta: 0,
  }
}

describe('action event linking', () => {
  it('does not store a reward on the decision and only attaches it after the outcome', () => {
    const eventId = beginActionDecision(decisionInput())
    const pending = getPendingActionDecision(eventId)
    expect(pending).toBeDefined()
    expect(pending && 'reward' in pending).toBe(false)
    expect(getCompletedActionEvent(eventId)).toBeUndefined()

    const completed = completeActionOutcome(eventId, { ...outcomeInput(), reward: 10 })
    expect(completed?.eventId).toBe(eventId)
    expect(completed?.reward).toBe(10)
    expect(completed?.selectedAction).toBe('MOVE_FORWARD')
    expect(completed?.decisionType).toBe('exploration')
    expect(getPendingActionDecision(eventId)).toBeUndefined()
    expect(getCompletedActionEvent(eventId)?.reward).toBe(10)
  })

  it('keeps per-agent and global rings within their caps', () => {
    for (let index = 0; index < ACTION_EVENT_LIMIT_PER_AGENT + 15; index += 1) {
      const eventId = beginActionDecision({
        ...decisionInput('agent-cap'),
        tick: index,
        simulationTime: index * 0.05,
      })
      completeActionOutcome(eventId, {
        ...outcomeInput(),
        agentId: 'agent-cap',
        tick: index,
        simulationTime: index * 0.05,
        reward: index,
      })
    }

    expect(getAgentActionEvents('agent-cap')).toHaveLength(ACTION_EVENT_LIMIT_PER_AGENT)
    expect(getAgentActionEvents('agent-cap')[0]?.reward).toBe(ACTION_EVENT_LIMIT_PER_AGENT + 14)

    for (let index = 0; index < ACTION_EVENT_LIMIT_GLOBAL + 20; index += 1) {
      const agentId = `agent-${index % 7}`
      const eventId = beginActionDecision({
        ...decisionInput(agentId),
        tick: 1000 + index,
        simulationTime: index,
      })
      completeActionOutcome(eventId, {
        ...outcomeInput(),
        agentId,
        tick: 1000 + index,
        simulationTime: index,
        reward: 1,
      })
    }

    expect(getRecentActionEvents().length).toBe(ACTION_EVENT_LIMIT_GLOBAL)
  })

  it('classifies current actions from the executed result instead of a guessed reward', () => {
    expect(classifyActionOutcome({ action: 'EAT', ate: false, collided: false, died: false })).toBe(
      'no-target',
    )
    expect(classifyActionOutcome({ action: 'EAT', ate: true, collided: false, died: false })).toBe(
      'success',
    )
    expect(
      classifyActionOutcome({ action: 'MOVE_FORWARD', ate: false, collided: true, died: false }),
    ).toBe('blocked')
    expect(
      classifyActionOutcome({ action: 'REST', ate: false, collided: false, died: true }),
    ).toBe('died')
  })
})

describe('interval action counts', () => {
  it('keeps interval totals until they are consumed by a history sample', () => {
    countActionDecision('EAT')
    countActionDecision('EAT')
    countActionDecision('MOVE_FORWARD')
    const snapshot = consumeIntervalActionCounts()
    expect(snapshot.total).toBe(3)
    expect(snapshot.counts.EAT).toBe(2)
    expect(snapshot.counts.MOVE_FORWARD).toBe(1)
    expect(consumeIntervalActionCounts().total).toBe(0)
  })

  it('normalizes interval explore, terrain, and tool outcomes by decision counts', () => {
    countActionDecision('GATHER', { explored: true, terrain: 'forest', heldTool: true })
    countActionDecision('ATTACK', { explored: false, terrain: 'grassland', heldTool: false })
    recordIntervalOutcome({ action: 'GATHER', outcome: 'success', heldTool: true })
    recordIntervalOutcome({ action: 'ATTACK', outcome: 'failed', heldTool: false })
    const snapshot = consumeIntervalActionCounts()
    expect(snapshot.analytics.exploreCount).toBe(1)
    expect(snapshot.analytics.exploitCount).toBe(1)
    expect(snapshot.analytics.terrainCounts.forest.GATHER).toBe(1)
    expect(snapshot.analytics.toolHeld.attempts).toBe(1)
    expect(snapshot.analytics.toolHeld.success).toBe(1)
    expect(snapshot.analytics.combat.ATTACK.selected).toBe(1)
    expect(snapshot.analytics.combat.ATTACK.failed).toBe(1)
  })
})

describe('agent update records linked events', () => {
  it('records every current action with the computed reward and outcome', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      agentCount: 1,
      obstacleDensity: 0,
      initialFoodCount: 0,
      initialBerryCount: 0,
      initialRootCount: 0,
      initialBasketCount: 0,
      initialStickCount: 0,
      initialSpearCount: 0,
      initialShieldCount: 0,
    })
    const agent = world.agents[0]
    if (!agent) throw new Error('expected an agent')
    const ready = {
      ...agent,
      desire: 0,
      genome: { ...agent.genome, explorationRate: 1, libido: 0 },
    }
    resetBrains([ready], DEFAULT_LEARNING_CONFIG)
    resetActionEvents()

    const selections = [
      { rng: () => 0, action: 'MOVE_FORWARD' },
      { rng: () => 0.6, action: 'TURN_LEFT' },
      { rng: () => 0.8, action: 'TURN_RIGHT' },
      { rng: () => 0.95, action: 'REST' },
    ] as const

    let current = ready
    for (const [index, selection] of selections.entries()) {
      const result = updateAgent(current, { ...world, agents: [current] }, SIMULATION_STEP_DT, {
        learningEnabled: true,
        learningConfig: DEFAULT_LEARNING_CONFIG,
        rewardConfig: DEFAULT_REWARD_CONFIG,
        rng: () => selection.rng(),
        tick: index + 1,
      })
      expect(result.agent.lastAction).toBe(selection.action)
      current = result.agent
    }

    const events = getAgentActionEvents(ready.id)
    expect(events).toHaveLength(4)
    const recorded = new Set(events.map((event) => event.selectedAction))
    expect(recorded.has('MOVE_FORWARD')).toBe(true)
    expect(recorded.has('TURN_LEFT')).toBe(true)
    expect(recorded.has('TURN_RIGHT')).toBe(true)
    expect(recorded.has('REST')).toBe(true)
    expect(recorded.has('EAT')).toBe(false)
    expect(recorded.has('PICK_UP')).toBe(false)
    expect(recorded.has('GATHER')).toBe(false)
    for (const event of events) {
      expect(event.reward).toBeTypeOf('number')
      expect(event.outcome).toBeTruthy()
      expect(event.decisionType === 'exploration' || event.decisionType === 'exploitation').toBe(true)
      expect(getCompletedActionEvent(event.eventId)?.eventId).toBe(event.eventId)
    }
  })
})
