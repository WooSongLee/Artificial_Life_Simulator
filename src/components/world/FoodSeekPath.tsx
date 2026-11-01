import { Line } from '@react-three/drei'
import { findNearestFood } from '../../learning/observation'
import { useSimulationStore } from '../../store/useSimulationStore'

export function FoodSeekPath() {
  const enabled = useSimulationStore((state) => state.settings.showFoodSeek)
  const selectedId = useSimulationStore((state) => state.selectedObjectId)
  const agent = useSimulationStore((state) =>
    selectedId ? (state.world.agents.find((item) => item.id === selectedId) ?? null) : null,
  )
  const world = useSimulationStore((state) => state.world)

  if (!enabled || !agent || !agent.alive) return null

  const food = findNearestFood(agent, world)
  if (!food) return null

  return (
    <Line
      points={[
        [agent.position.x, 0.12, agent.position.z],
        [food.position.x, 0.18, food.position.z],
      ]}
      color="#c9a227"
      lineWidth={1.4}
      dashed
      dashSize={0.28}
      gapSize={0.16}
      transparent
      opacity={0.9}
    />
  )
}
