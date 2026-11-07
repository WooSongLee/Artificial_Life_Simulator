import type { Agent, AgentPosition, AgentTrail, TrailChoiceKind } from '../types/agent'
import type { AgentAction } from '../learning/types'
import { isDriveTargetKind } from '../simulation/outcomes'
import { MAX_TRAIL_POINTS, TRAIL_MIN_DISTANCE } from '../simulation/constants'

/** Classify a trail sample as survival (EAT) or drive (rest/lookout gather). */
export function trailChoiceFromAgent(agent: Agent): TrailChoiceKind | null {
  if (agent.lastAction === 'EAT') return 'survival'
  if (agent.lastAction === 'GATHER' && isDriveTargetKind(agent.actionTarget?.kind)) {
    return 'drive'
  }
  return null
}

export function createAgentTrails(agents: Agent[]): Record<string, AgentTrail> {
  const trails: Record<string, AgentTrail> = {}

  for (const agent of agents) {
    trails[agent.id] = [
      {
        x: agent.position.x,
        z: agent.position.z,
        action: agent.lastAction,
        choice: trailChoiceFromAgent(agent),
      },
    ]
  }

  return trails
}

export function appendTrailPoint(
  trail: AgentTrail | undefined,
  position: AgentPosition,
  action: AgentAction | null,
  choice: TrailChoiceKind | null = null,
  maxPoints = MAX_TRAIL_POINTS,
  minDistance = TRAIL_MIN_DISTANCE,
): AgentTrail {
  const point = { x: position.x, z: position.z, action, choice }

  if (!trail || trail.length === 0) {
    return [point]
  }

  const last = trail[trail.length - 1]
  if (!last) {
    return [point]
  }

  const dx = point.x - last.x
  const dz = point.z - last.z
  if (dx * dx + dz * dz < minDistance * minDistance) {
    // Sticky choice: keep Eat/drive mark even if the agent barely moved.
    if (choice && last.choice !== choice) {
      const updated = [...trail]
      updated[updated.length - 1] = { ...last, action, choice }
      return updated
    }
    return trail
  }

  if (trail.length < maxPoints) {
    return [...trail, point]
  }

  return [...trail.slice(trail.length - maxPoints + 1), point]
}

export function recordAgentTrails(
  previous: Record<string, AgentTrail>,
  agents: Agent[],
): Record<string, AgentTrail> {
  const next: Record<string, AgentTrail> = {}

  for (const agent of agents) {
    next[agent.id] = appendTrailPoint(
      previous[agent.id],
      agent.position,
      agent.lastAction,
      trailChoiceFromAgent(agent),
    )
  }

  return next
}
