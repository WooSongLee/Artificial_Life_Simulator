import type { Agent, AgentPosition, AgentTrail } from '../types/agent'
import { MAX_TRAIL_POINTS, TRAIL_MIN_DISTANCE } from '../simulation/constants'

export function createAgentTrails(agents: Agent[]): Record<string, AgentTrail> {
  const trails: Record<string, AgentTrail> = {}

  for (const agent of agents) {
    trails[agent.id] = [{ x: agent.position.x, z: agent.position.z }]
  }

  return trails
}

export function appendTrailPoint(
  trail: AgentTrail | undefined,
  position: AgentPosition,
  maxPoints = MAX_TRAIL_POINTS,
  minDistance = TRAIL_MIN_DISTANCE,
): AgentTrail {
  const point = { x: position.x, z: position.z }

  if (!trail || trail.length === 0) {
    return [point]
  }

  const last = trail[trail.length - 1]
  const dx = point.x - last.x
  const dz = point.z - last.z
  if (dx * dx + dz * dz < minDistance * minDistance) {
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
    next[agent.id] = appendTrailPoint(previous[agent.id], agent.position)
  }

  return next
}
