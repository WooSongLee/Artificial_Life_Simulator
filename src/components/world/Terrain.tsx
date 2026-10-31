import { useSimulationStore } from '../../store/useSimulationStore'

export function Terrain() {
  const size = useSimulationStore((state) => state.world.config.size)
  const divisions = useSimulationStore((state) => state.world.config.gridDivisions)
  const showGrid = useSimulationStore((state) => state.settings.showGrid)
  const selectObject = useSimulationStore((state) => state.selectObject)

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.04, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0d1210" roughness={1} />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={() => selectObject(null)}
      >
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          color="#4f8a4c"
          roughness={0.82}
          metalness={0}
        />
      </mesh>

      {showGrid ? (
        <gridHelper
          args={[size, divisions, '#7d9a70', '#35553a']}
          position={[0, 0.02, 0]}
        />
      ) : null}
    </group>
  )
}
