import type { ThreeEvent } from '@react-three/fiber'
import type { WorldObject } from '../../types/world'
import { useSimulationStore } from '../../store/useSimulationStore'

interface WorldObjectMeshProps {
  object: WorldObject
}

function TreeMesh({ scale }: { scale: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.16, 1.1, 6]} />
        <meshStandardMaterial color="#6b4a2b" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow>
        <coneGeometry args={[0.72, 1.25, 7]} />
        <meshStandardMaterial color="#2d6a38" roughness={0.75} />
      </mesh>
      <mesh position={[0, 2.05, 0]} castShadow>
        <coneGeometry args={[0.5, 0.95, 7]} />
        <meshStandardMaterial color="#3d8a4a" roughness={0.7} />
      </mesh>
    </group>
  )
}

function RockMesh({ scale }: { scale: number }) {
  return (
    <mesh
      position={[0, 0.28 * scale, 0]}
      rotation={[0.2, 0.4, 0.12]}
      scale={scale}
      castShadow
    >
      <dodecahedronGeometry args={[0.48, 0]} />
      <meshStandardMaterial color="#6f6c67" roughness={0.95} />
    </mesh>
  )
}

function FoodMesh({ scale }: { scale: number }) {
  return (
    <mesh position={[0, 0.16 * scale, 0]} scale={scale} castShadow>
      <sphereGeometry args={[0.2, 12, 12]} />
      <meshStandardMaterial
        color="#d4a017"
        emissive="#7a5a00"
        emissiveIntensity={0.18}
        roughness={0.45}
      />
    </mesh>
  )
}

function SelectionRing() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
      <ringGeometry args={[0.62, 0.78, 28]} />
      <meshBasicMaterial color="#c9a227" />
    </mesh>
  )
}

export function WorldObjectMesh({ object }: WorldObjectMeshProps) {
  const selected = useSimulationStore((state) => state.selectedObjectId === object.id)
  const selectObject = useSimulationStore((state) => state.selectObject)

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    selectObject(object.id)
  }

  return (
    <group
      position={[object.position.x, object.position.y, object.position.z]}
      rotation={[0, object.rotation, 0]}
      onClick={handleClick}
    >
      {object.type === 'tree' ? <TreeMesh scale={object.scale} /> : null}
      {object.type === 'rock' ? <RockMesh scale={object.scale} /> : null}
      {object.type === 'food' ? <FoodMesh scale={object.scale} /> : null}
      {selected ? <SelectionRing /> : null}
    </group>
  )
}
