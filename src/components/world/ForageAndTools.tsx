import type { ThreeEvent } from '@react-three/fiber'
import { useShallow } from 'zustand/react/shallow'
import { useSimulationStore } from '../../store/useSimulationStore'

function BerryBushMesh({ scale, depleted }: { scale: number; depleted: boolean }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.42, 10, 10]} />
        <meshStandardMaterial color={depleted ? '#4a5a32' : '#2f6a38'} roughness={0.85} />
      </mesh>
      <mesh position={[0.22, 0.42, 0.08]} castShadow>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color={depleted ? '#3d4d2c' : '#3d8a4a'} roughness={0.8} />
      </mesh>
      <mesh position={[-0.18, 0.4, -0.1]} castShadow>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color={depleted ? '#3a4a2a' : '#276433'} roughness={0.8} />
      </mesh>
      {!depleted ? (
        <>
          <mesh position={[0.16, 0.52, 0.18]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color="#c43b4a" roughness={0.4} />
          </mesh>
          <mesh position={[-0.12, 0.5, 0.16]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#d24a3a" roughness={0.4} />
          </mesh>
          <mesh position={[0.02, 0.58, -0.12]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color="#b83240" roughness={0.4} />
          </mesh>
        </>
      ) : null}
    </group>
  )
}

function RootPatchMesh({ scale, depleted }: { scale: number; depleted: boolean }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0.2]} receiveShadow>
        <circleGeometry args={[0.55, 12]} />
        <meshStandardMaterial color={depleted ? '#5a4634' : '#6b4a2b'} roughness={0.95} />
      </mesh>
      <mesh position={[0.08, 0.12, 0.04]} rotation={[0.3, 0.4, 0.15]} castShadow>
        <dodecahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.9} />
      </mesh>
      {!depleted ? (
        <>
          <mesh position={[-0.16, 0.18, 0.1]} rotation={[0.6, 0.2, -0.4]} castShadow>
            <cylinderGeometry args={[0.035, 0.055, 0.38, 6]} />
            <meshStandardMaterial color="#c4a06a" roughness={0.7} />
          </mesh>
          <mesh position={[0.18, 0.16, -0.08]} rotation={[-0.5, 0.3, 0.35]} castShadow>
            <cylinderGeometry args={[0.03, 0.05, 0.32, 6]} />
            <meshStandardMaterial color="#d2b48c" roughness={0.7} />
          </mesh>
        </>
      ) : null}
    </group>
  )
}

export function BasketMesh({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.13, 0.18, 10, 1, true]} />
        <meshStandardMaterial color="#b8864a" roughness={0.7} side={2} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.13, 10]} />
        <meshStandardMaterial color="#9a6c38" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.12, 0.018, 8, 12, Math.PI]} />
        <meshStandardMaterial color="#8a5a2b" roughness={0.65} />
      </mesh>
    </group>
  )
}

export function SpearMesh({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale} rotation={[0.2, 0, 0.15]}>
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.026, 0.86, 6]} />
        <meshStandardMaterial color="#6a4424" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.84, 0]} rotation={[0.1, 0, 0]} castShadow>
        <coneGeometry args={[0.045, 0.18, 6]} />
        <meshStandardMaterial color="#c5c8ce" roughness={0.35} metalness={0.35} />
      </mesh>
    </group>
  )
}

export function ShieldMesh({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale} rotation={[0.15, 0.6, 0.1]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.06, 10]} />
        <meshStandardMaterial color="#8a5a32" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.28, 0.035]}>
        <circleGeometry args={[0.15, 10]} />
        <meshStandardMaterial color="#c4a06a" roughness={0.55} />
      </mesh>
    </group>
  )
}

export function DiggingStickMesh({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale} rotation={[0.15, 0, 0.35]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.034, 0.62, 6]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.75} />
      </mesh>
      <mesh position={[0, -0.08, 0]} rotation={[0.2, 0, 0]} castShadow>
        <coneGeometry args={[0.045, 0.16, 6]} />
        <meshStandardMaterial color="#c9a36a" roughness={0.45} />
      </mesh>
    </group>
  )
}

function ForageMesh({ nodeId }: { nodeId: string }) {
  const node = useSimulationStore((state) => state.world.forageNodes.find((item) => item.id === nodeId))
  const selected = useSimulationStore((state) => state.selectedObjectId === nodeId)
  const selectObject = useSimulationStore((state) => state.selectObject)

  if (!node) return null

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    selectObject(node.id)
  }

  return (
    <group
      position={[node.position.x, node.position.y, node.position.z]}
      rotation={[0, node.rotation, 0]}
      onClick={handleClick}
    >
      {node.kind === 'berry_bush' ? (
        <BerryBushMesh scale={node.scale} depleted={node.quantity <= 0} />
      ) : (
        <RootPatchMesh scale={node.scale} depleted={node.quantity <= 0} />
      )}
      {selected ? <SelectionRing color="#6aa84e" /> : null}
    </group>
  )
}

function ToolMesh({ toolId }: { toolId: string }) {
  const tool = useSimulationStore((state) => state.world.worldTools.find((item) => item.id === toolId))
  const selected = useSimulationStore((state) => state.selectedObjectId === toolId)
  const selectObject = useSimulationStore((state) => state.selectObject)

  if (!tool) return null

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    selectObject(tool.id)
  }

  return (
    <group
      position={[tool.position.x, tool.position.y, tool.position.z]}
      rotation={[0, tool.rotation, 0]}
      onClick={handleClick}
    >
      {tool.toolType === 'basket' ? (
        <BasketMesh scale={tool.scale} />
      ) : tool.toolType === 'spear' ? (
        <SpearMesh scale={tool.scale} />
      ) : tool.toolType === 'shield' ? (
        <ShieldMesh scale={tool.scale} />
      ) : (
        <DiggingStickMesh scale={tool.scale} />
      )}
      {selected ? <SelectionRing color="#c47a3d" /> : null}
    </group>
  )
}

function SelectionRing({ color }: { color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
      <ringGeometry args={[0.58, 0.74, 24]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

export function ForageAndTools() {
  const forageIds = useSimulationStore(
    useShallow((state) =>
      state.settings.showForage ? state.world.forageNodes.map((node) => node.id) : [],
    ),
  )
  const toolIds = useSimulationStore(
    useShallow((state) =>
      state.settings.showTools ? state.world.worldTools.map((tool) => tool.id) : [],
    ),
  )

  return (
    <group>
      {forageIds.map((id) => (
        <ForageMesh key={id} nodeId={id} />
      ))}
      {toolIds.map((id) => (
        <ToolMesh key={id} toolId={id} />
      ))}
    </group>
  )
}
