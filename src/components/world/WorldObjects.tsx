import { useSimulationStore } from '../../store/useSimulationStore'
import { WorldObjectMesh } from './WorldObjectMesh'

export function WorldObjects() {
  const objects = useSimulationStore((state) => state.world.objects)
  const showTrees = useSimulationStore((state) => state.settings.showTrees)
  const showRocks = useSimulationStore((state) => state.settings.showRocks)
  const showFood = useSimulationStore((state) => state.settings.showFood)

  return (
    <group>
      {objects.map((object) => {
        if (object.type === 'tree' && !showTrees) return null
        if (object.type === 'rock' && !showRocks) return null
        if (object.type === 'food' && !showFood) return null

        return <WorldObjectMesh key={object.id} object={object} />
      })}
    </group>
  )
}
