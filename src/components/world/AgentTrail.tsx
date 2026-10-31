import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { useSimulationStore } from '../../store/useSimulationStore'

export function AgentTrail() {
  const selectedId = useSimulationStore((state) => state.selectedObjectId)
  const isAgent = useSimulationStore((state) =>
    selectedId ? state.world.agents.some((agent) => agent.id === selectedId) : false,
  )
  const trail = useSimulationStore((state) =>
    selectedId ? state.agentTrails[selectedId] : undefined,
  )

  const points = useMemo(() => {
    if (!trail || trail.length < 2) return null
    return trail.map((point) => [point.x, 0.09, point.z] as [number, number, number])
  }, [trail])

  if (!isAgent || !points) return null

  return <Line points={points} color="#5aa0d6" lineWidth={1.8} transparent opacity={0.88} />
}
