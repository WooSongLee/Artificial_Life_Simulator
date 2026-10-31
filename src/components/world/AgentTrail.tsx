import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { ACTION_COLORS } from '../../learning/constants'
import { useSimulationStore } from '../../store/useSimulationStore'
import type { AgentAction } from '../../learning/types'
import type { AgentTrailPoint } from '../../types/agent'

interface TrailSegment {
  color: string
  points: [number, number, number][]
}

const DEFAULT_TRAIL_COLOR = '#5aa0d6'

function actionColor(action: AgentAction | null): string {
  return action ? ACTION_COLORS[action] : DEFAULT_TRAIL_COLOR
}

function buildSegments(trail: AgentTrailPoint[]): TrailSegment[] {
  if (trail.length < 2) return []

  const segments: TrailSegment[] = []
  let currentColor = actionColor(trail[1]?.action ?? trail[0]?.action ?? null)
  let currentPoints: [number, number, number][] = [
    [trail[0].x, 0.09, trail[0].z],
  ]

  for (let i = 1; i < trail.length; i += 1) {
    const point = trail[i]
    if (!point) continue
    const color = actionColor(point.action)
    const mapped: [number, number, number] = [point.x, 0.09, point.z]

    if (color !== currentColor && currentPoints.length >= 1) {
      currentPoints.push(mapped)
      if (currentPoints.length >= 2) {
        segments.push({ color: currentColor, points: currentPoints })
      }
      currentColor = color
      currentPoints = [mapped]
      continue
    }

    currentPoints.push(mapped)
  }

  if (currentPoints.length >= 2) {
    segments.push({ color: currentColor, points: currentPoints })
  }

  return segments
}

export function AgentTrail() {
  const selectedId = useSimulationStore((state) => state.selectedObjectId)
  const enabled = useSimulationStore((state) => state.settings.showAgentTrails)
  const isAgent = useSimulationStore((state) =>
    selectedId ? state.world.agents.some((agent) => agent.id === selectedId) : false,
  )
  const trail = useSimulationStore((state) =>
    selectedId ? state.agentTrails[selectedId] : undefined,
  )

  const segments = useMemo(() => {
    if (!trail || trail.length < 2) return []
    return buildSegments(trail)
  }, [trail])

  if (!enabled || !isAgent || segments.length === 0) return null

  return (
    <group>
      {segments.map((segment, index) => (
        <Line
          key={`${segment.color}-${index}`}
          points={segment.points}
          color={segment.color}
          lineWidth={1.8}
          transparent
          opacity={0.88}
        />
      ))}
    </group>
  )
}
