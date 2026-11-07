import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ACTION_COLORS } from '../../learning/constants'
import { isHumanBehaviorLab } from '../../simulation/labMode'
import { useSimulationStore } from '../../store/useSimulationStore'
import type { AgentAction } from '../../learning/types'
import type { AgentTrailPoint, TrailChoiceKind } from '../../types/agent'

interface TrailSegment {
  color: string
  points: [number, number, number][]
}

const DEFAULT_TRAIL_COLOR = '#5aa0d6'
/** Warm = survival (Eat); cool = human-like drive (rest/lookout). */
const SURVIVAL_TRAIL_COLOR = '#d4a017'
const DRIVE_TRAIL_COLOR = '#5eb0d4'

function actionColor(action: AgentAction | null): string {
  return action ? ACTION_COLORS[action] : DEFAULT_TRAIL_COLOR
}

function pointColor(point: AgentTrailPoint, labChoiceMode: boolean): string {
  if (labChoiceMode && point.choice === 'survival') return SURVIVAL_TRAIL_COLOR
  if (labChoiceMode && point.choice === 'drive') return DRIVE_TRAIL_COLOR
  return actionColor(point.action)
}

function buildSegments(trail: AgentTrailPoint[], labChoiceMode: boolean): TrailSegment[] {
  if (trail.length < 2) return []

  const segments: TrailSegment[] = []
  let currentColor = pointColor(trail[1] ?? trail[0]!, labChoiceMode)
  let currentPoints: [number, number, number][] = [[trail[0]!.x, 0.09, trail[0]!.z]]

  for (let i = 1; i < trail.length; i += 1) {
    const point = trail[i]
    if (!point) continue
    const color = pointColor(point, labChoiceMode)
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

function choiceBeacons(trail: AgentTrailPoint[]): { x: number; z: number; kind: TrailChoiceKind }[] {
  const beacons: { x: number; z: number; kind: TrailChoiceKind }[] = []
  for (const point of trail) {
    if (!point.choice) continue
    const last = beacons[beacons.length - 1]
    if (last && last.kind === point.choice) {
      const dx = point.x - last.x
      const dz = point.z - last.z
      if (dx * dx + dz * dz < 0.35 * 0.35) continue
    }
    beacons.push({ x: point.x, z: point.z, kind: point.choice })
  }
  return beacons.slice(-24)
}

function SingleAgentTrail({
  trail,
  labChoiceMode,
}: {
  trail: AgentTrailPoint[]
  labChoiceMode: boolean
}) {
  const segments = useMemo(
    () => buildSegments(trail, labChoiceMode),
    [trail, labChoiceMode],
  )
  const beacons = useMemo(
    () => (labChoiceMode ? choiceBeacons(trail) : []),
    [trail, labChoiceMode],
  )

  if (segments.length === 0 && beacons.length === 0) return null

  return (
    <group>
      {segments.map((segment, index) => (
        <Line
          key={`${segment.color}-${index}`}
          points={segment.points}
          color={segment.color}
          lineWidth={labChoiceMode ? 2.4 : 1.8}
          transparent
          opacity={0.9}
        />
      ))}
      {beacons.map((beacon, index) => (
        <group key={`beacon-${beacon.kind}-${index}`} position={[beacon.x, 0.12, beacon.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.38, 20]} />
            <meshBasicMaterial
              color={beacon.kind === 'survival' ? SURVIVAL_TRAIL_COLOR : DRIVE_TRAIL_COLOR}
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.11, 10, 10]} />
            <meshBasicMaterial
              color={beacon.kind === 'survival' ? SURVIVAL_TRAIL_COLOR : DRIVE_TRAIL_COLOR}
              transparent
              opacity={0.7}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

const EMPTY_TRAIL_IDS: string[] = []

export function AgentTrail() {
  const enabled = useSimulationStore((state) => state.settings.showAgentTrails)
  const lab = useSimulationStore((state) => isHumanBehaviorLab(state.world.config.mode))
  const trails = useSimulationStore((state) => state.agentTrails)
  // Stable snapshot: never return a fresh [] / .map() without useShallow (React 19 loop).
  const agentIds = useSimulationStore(
    useShallow((state) => {
      if (!state.settings.showAgentTrails) return EMPTY_TRAIL_IDS
      if (isHumanBehaviorLab(state.world.config.mode)) {
        // Lab: always paint living agents so survival↔drive is watchable without a click.
        return state.world.agents.filter((agent) => agent.alive).map((agent) => agent.id)
      }
      const selectedId = state.selectedObjectId
      if (selectedId && state.world.agents.some((agent) => agent.id === selectedId)) {
        return [selectedId]
      }
      return EMPTY_TRAIL_IDS
    }),
  )

  if (!enabled || agentIds.length === 0) return null

  return (
    <group>
      {agentIds.map((id) => {
        const trail = trails[id]
        if (!trail || trail.length < 1) return null
        return (
          <SingleAgentTrail key={id} trail={trail} labChoiceMode={lab} />
        )
      })}
    </group>
  )
}
