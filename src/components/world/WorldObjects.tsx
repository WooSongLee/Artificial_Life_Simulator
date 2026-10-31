import { useShallow } from 'zustand/react/shallow'
import { useSimulationStore } from '../../store/useSimulationStore'
import { WorldObjectMesh } from './WorldObjectMesh'

export function WorldObjects() {
  const objectIds = useSimulationStore(
    useShallow((state) =>
      state.world.objects
        .filter((object) => {
          if (object.type === 'tree') return state.settings.showTrees
          if (object.type === 'rock') return state.settings.showRocks
          if (object.type === 'food') return state.settings.showFood
          return false
        })
        .map((object) => object.id),
    ),
  )

  return (
    <group>
      {objectIds.map((id) => (
        <WorldObjectMesh key={id} objectId={id} />
      ))}
    </group>
  )
}
