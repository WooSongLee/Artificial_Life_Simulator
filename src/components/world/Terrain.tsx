import { useEffect, useMemo } from 'react'
import { createTerrainVisuals } from './terrainVisuals'
import { useSimulationStore } from '../../store/useSimulationStore'

export function Terrain() {
  const size = useSimulationStore((state) => state.world.config.size)
  const divisions = useSimulationStore((state) => state.world.config.gridDivisions)
  const terrain = useSimulationStore((state) => state.world.terrain)
  const showGrid = useSimulationStore((state) => state.settings.showGrid)
  const selectObject = useSimulationStore((state) => state.selectObject)
  const visuals = useMemo(() => createTerrainVisuals(terrain, size), [terrain, size])

  useEffect(
    () => () => {
      visuals.dispose()
    },
    [visuals],
  )

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0d1210" roughness={1} />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={visuals.geometry}
        receiveShadow
        onClick={() => selectObject(null)}
      >
        <meshStandardMaterial
          map={visuals.albedo}
          roughnessMap={visuals.surface}
          metalnessMap={visuals.surface}
          roughness={1}
          metalness={1}
        />
      </mesh>

      {showGrid ? (
        <gridHelper
          args={[size, divisions, '#7d9a70', '#35553a']}
          position={[0, 0.16, 0]}
        />
      ) : null}
    </group>
  )
}
