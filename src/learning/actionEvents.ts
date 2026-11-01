import { SIMULATION_STEP_DT } from '../simulation/constants'
import type { TerrainType } from '../types/terrain'
import {
  createEmptyIntervalAnalytics,
  isCombatAction,
  isToolAction,
  type IntervalActionAnalytics,
} from './analytics'
import { ACTION_SCHEMA_VERSION, OBSERVATION_SCHEMA_VERSION } from './schema'
import { AGENT_ACTIONS } from './types'
import type { AgentAction, StateKey } from './types'

export const ACTION_EVENT_LIMIT_PER_AGENT = 80
export const ACTION_EVENT_LIMIT_GLOBAL = 400

export type DecisionType = 'exploration' | 'exploitation'
export type ActionOutcomeStatus = 'success' | 'failed' | 'blocked' | 'no-target' | 'died'

export interface ActionDecisionEvent {
  eventId: string
  tick: number
  simulationTime: number
  agentId: string
  stateKey: StateKey
  selectedAction: AgentAction
  legalActions: readonly AgentAction[]
  decisionType: DecisionType
  epsilon: number
  qValues: number[]
  geneticBias: number[]
  actionSchemaVersion: number
  observationSchemaVersion: number
}

export interface ActionOutcomeFields {
  tick: number
  simulationTime: number
  agentId: string
  action: AgentAction
  outcome: ActionOutcomeStatus
  targetId: string | null
  targetKind: string | null
  gatheredAmount: number
  durabilityDelta: number
  damageDealt: number
  damageReduced: number
  reward: number
  energyDelta: number
  healthDelta: number
}

export interface ActionEvent extends ActionDecisionEvent {
  outcome: ActionOutcomeStatus
  targetId: string | null
  targetKind: string | null
  gatheredAmount: number
  durabilityDelta: number
  damageDealt: number
  damageReduced: number
  reward: number
  energyDelta: number
  healthDelta: number
}

export interface ActionCountSnapshot {
  counts: Record<AgentAction, number>
  total: number
  analytics: IntervalActionAnalytics
}

const agentEvents = new Map<string, ActionEvent[]>()
const globalEvents: ActionEvent[] = []
const pendingDecisions = new Map<string, ActionDecisionEvent>()

let intervalActionCounts = createEmptyActionCounts()
let intervalAnalytics = createEmptyIntervalAnalytics()
let eventSeq = 0
let recordStride = 1
let recordCursor = 0

export function createEmptyActionCounts(): Record<AgentAction, number> {
  const counts = {} as Record<AgentAction, number>
  for (const action of AGENT_ACTIONS) {
    counts[action] = 0
  }
  return counts
}

export function cloneActionCounts(
  counts: Record<AgentAction, number> | undefined,
): Record<AgentAction, number> | undefined {
  if (!counts) return undefined
  return { ...counts }
}

export function totalActionCounts(counts: Record<AgentAction, number> | null | undefined): number {
  if (!counts) return 0
  let total = 0
  for (const action of AGENT_ACTIONS) {
    total += counts[action] ?? 0
  }
  return total
}

export function actionCountRatios(
  counts: Record<AgentAction, number> | null | undefined,
): Record<AgentAction, number> | null {
  const total = totalActionCounts(counts ?? undefined)
  if (!counts || total <= 0) return null

  const ratios = createEmptyActionCounts()
  for (const action of AGENT_ACTIONS) {
    ratios[action] = (counts[action] ?? 0) / total
  }
  return ratios
}

export function sumActionCounts(
  snapshots: ReadonlyArray<Record<AgentAction, number> | undefined>,
): Record<AgentAction, number> | null {
  const sums = createEmptyActionCounts()
  let found = false

  for (const snapshot of snapshots) {
    if (!snapshot) continue
    found = true
    for (const action of AGENT_ACTIONS) {
      sums[action] += snapshot[action] ?? 0
    }
  }

  return found ? sums : null
}

export function snapshotQValues(qValues: readonly number[]): number[] {
  const copied = new Array<number>(AGENT_ACTIONS.length)
  for (let index = 0; index < AGENT_ACTIONS.length; index += 1) {
    const value = qValues[index]
    copied[index] = Number.isFinite(value) ? (value as number) : 0
  }
  return copied
}

export function qValuesByAction(qValues: readonly number[]): Record<AgentAction, number> {
  const record = createEmptyActionCounts()
  for (let index = 0; index < AGENT_ACTIONS.length; index += 1) {
    const action = AGENT_ACTIONS[index]
    if (!action) continue
    const value = qValues[index]
    record[action] = Number.isFinite(value) ? (value as number) : 0
  }
  return record
}

export function simulationTimeAt(tick: number): number {
  return tick * SIMULATION_STEP_DT
}

export function classifyActionOutcome(input: {
  action: AgentAction
  ate: boolean
  collided: boolean
  died: boolean
  pickedUp?: boolean
  gathered?: boolean
  attackHit?: boolean
  attackAttempted?: boolean
  fledFarther?: boolean
}): ActionOutcomeStatus {
  if (input.died) return 'died'
  if (input.collided) return 'blocked'
  if (input.action === 'EAT') return input.ate ? 'success' : 'no-target'
  if (input.action === 'PICK_UP') return input.pickedUp ? 'success' : 'no-target'
  if (input.action === 'GATHER') return input.gathered ? 'success' : 'no-target'
  if (input.action === 'ATTACK') {
    if (input.attackHit) return 'success'
    return input.attackAttempted ? 'failed' : 'no-target'
  }
  if (input.action === 'DEFEND') return 'success'
  if (input.action === 'FLEE') return input.fledFarther ? 'success' : 'failed'
  if (input.action === 'MOVE_FORWARD' || input.action === 'TURN_LEFT' || input.action === 'TURN_RIGHT') {
    return 'success'
  }
  if (input.action === 'REST') return 'success'
  return input.ate ? 'success' : 'failed'
}

export function setActionEventRecordStride(stride: number): void {
  recordStride = Math.max(1, Math.floor(Number.isFinite(stride) ? stride : 1))
}

export function getActionEventRecordStride(): number {
  return recordStride
}

export function shouldRecordActionEvent(): boolean {
  recordCursor += 1
  return recordCursor % recordStride === 0
}

export function countActionDecision(
  action: AgentAction,
  meta?: {
    explored?: boolean
    terrain?: TerrainType
    heldTool?: boolean
  },
): void {
  intervalActionCounts[action] += 1
  intervalAnalytics.counts[action] += 1
  intervalAnalytics.total += 1
  if (meta?.explored === true) intervalAnalytics.exploreCount += 1
  if (meta?.explored === false) intervalAnalytics.exploitCount += 1
  if (meta?.terrain) {
    intervalAnalytics.terrainCounts[meta.terrain][action] += 1
  }
  if (isCombatAction(action)) {
    intervalAnalytics.combat[action].selected += 1
  }
  if (isToolAction(action)) {
    const bucket = meta?.heldTool ? intervalAnalytics.toolHeld : intervalAnalytics.toolEmpty
    bucket.attempts += 1
  }
}

export function recordIntervalOutcome(input: {
  action: AgentAction
  outcome: ActionOutcomeStatus
  heldTool?: boolean
}): void {
  if (isToolAction(input.action) && input.outcome === 'success') {
    const bucket = input.heldTool ? intervalAnalytics.toolHeld : intervalAnalytics.toolEmpty
    bucket.success += 1
  }
  if (isCombatAction(input.action)) {
    if (input.outcome === 'success') intervalAnalytics.combat[input.action].success += 1
    else if (input.outcome === 'no-target') intervalAnalytics.combat[input.action].noTarget += 1
    else if (input.outcome === 'failed' || input.outcome === 'blocked') {
      intervalAnalytics.combat[input.action].failed += 1
    }
  }
}

export function consumeIntervalActionCounts(): ActionCountSnapshot {
  const counts = intervalActionCounts
  const total = totalActionCounts(counts)
  const analytics = intervalAnalytics
  intervalActionCounts = createEmptyActionCounts()
  intervalAnalytics = createEmptyIntervalAnalytics()
  return { counts, total, analytics }
}

export function peekIntervalActionCounts(): ActionCountSnapshot {
  return {
    counts: { ...intervalActionCounts },
    total: totalActionCounts(intervalActionCounts),
    analytics: intervalAnalytics,
  }
}

export function nextActionEventId(tick: number, agentId: string): string {
  eventSeq += 1
  return `${tick}:${agentId}:${eventSeq}`
}

export function beginActionDecision(
  input: Omit<
    ActionDecisionEvent,
    'eventId' | 'legalActions' | 'actionSchemaVersion' | 'observationSchemaVersion' | 'geneticBias'
  > & {
    eventId?: string
    legalActions?: readonly AgentAction[]
    actionSchemaVersion?: number
    observationSchemaVersion?: number
    geneticBias?: number[]
  },
): string {
  const eventId = input.eventId ?? nextActionEventId(input.tick, input.agentId)
  pendingDecisions.set(eventId, {
    eventId,
    tick: input.tick,
    simulationTime: input.simulationTime,
    agentId: input.agentId,
    stateKey: input.stateKey,
    selectedAction: input.selectedAction,
    legalActions: input.legalActions ?? [...AGENT_ACTIONS],
    decisionType: input.decisionType,
    epsilon: input.epsilon,
    qValues: input.qValues.slice(),
    geneticBias: snapshotQValues(input.geneticBias ?? []),
    actionSchemaVersion: input.actionSchemaVersion ?? ACTION_SCHEMA_VERSION,
    observationSchemaVersion: input.observationSchemaVersion ?? OBSERVATION_SCHEMA_VERSION,
  })

  if (pendingDecisions.size > ACTION_EVENT_LIMIT_GLOBAL) {
    const oldest = pendingDecisions.keys().next().value
    if (oldest) pendingDecisions.delete(oldest)
  }

  return eventId
}

export function getPendingActionDecision(eventId: string): ActionDecisionEvent | undefined {
  const pending = pendingDecisions.get(eventId)
  if (!pending) return undefined
  return {
    ...pending,
    qValues: pending.qValues.slice(),
    geneticBias: pending.geneticBias.slice(),
    legalActions: pending.legalActions.slice(),
  }
}

export function completeActionOutcome(eventId: string, outcome: ActionOutcomeFields): ActionEvent | null {
  const decision = pendingDecisions.get(eventId)
  if (!decision) return null
  pendingDecisions.delete(eventId)

  const event: ActionEvent = {
    ...decision,
    qValues: decision.qValues.slice(),
    geneticBias: decision.geneticBias.slice(),
    outcome: outcome.outcome,
    targetId: outcome.targetId,
    targetKind: outcome.targetKind,
    gatheredAmount: outcome.gatheredAmount,
    durabilityDelta: outcome.durabilityDelta,
    damageDealt: outcome.damageDealt,
    damageReduced: outcome.damageReduced,
    reward: outcome.reward,
    energyDelta: outcome.energyDelta,
    healthDelta: outcome.healthDelta,
  }

  pushAgentEvent(event)
  pushRing(globalEvents, event, ACTION_EVENT_LIMIT_GLOBAL)
  return event
}

export function getAgentActionEvents(agentId: string): ActionEvent[] {
  const events = agentEvents.get(agentId)
  if (!events || events.length === 0) return []
  return events.map(cloneActionEvent).reverse()
}

export function getRecentActionEvents(): ActionEvent[] {
  return globalEvents.map(cloneActionEvent).reverse()
}

export function getCompletedActionEvent(eventId: string): ActionEvent | undefined {
  for (let index = globalEvents.length - 1; index >= 0; index -= 1) {
    const event = globalEvents[index]
    if (event?.eventId === eventId) return cloneActionEvent(event)
  }
  return undefined
}

export function removeActionEvents(agentIds: Iterable<string>): void {
  for (const agentId of agentIds) {
    agentEvents.delete(agentId)
  }
}

export function resetActionEvents(): void {
  agentEvents.clear()
  globalEvents.length = 0
  pendingDecisions.clear()
  intervalActionCounts = createEmptyActionCounts()
  intervalAnalytics = createEmptyIntervalAnalytics()
  eventSeq = 0
  recordCursor = 0
  recordStride = 1
}

function pushAgentEvent(event: ActionEvent): void {
  const existing = agentEvents.get(event.agentId)
  if (existing) {
    pushRing(existing, event, ACTION_EVENT_LIMIT_PER_AGENT)
    return
  }
  agentEvents.set(event.agentId, [event])
}

function pushRing<T>(items: T[], item: T, max: number): void {
  items.push(item)
  if (items.length > max) {
    items.splice(0, items.length - max)
  }
}

function cloneActionEvent(event: ActionEvent): ActionEvent {
  return {
    ...event,
    qValues: event.qValues.slice(),
    geneticBias: event.geneticBias.slice(),
    legalActions: event.legalActions.slice(),
  }
}
