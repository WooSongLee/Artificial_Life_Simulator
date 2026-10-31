import { Html, Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useSimulationStore } from '../../store/useSimulationStore'
import { ACTION_LABELS } from '../../learning/constants'
import { shortAgentId } from '../../utils/format'
import type { Agent } from '../../types/agent'

interface AgentMeshProps {
  agent: Agent
}

function bodyColor(agent: Agent): string {
  if (!agent.alive) return '#6d7178'
  if (agent.energy > 62) return '#3d9b7a'
  if (agent.energy > 32) return '#c9a227'
  return '#c45c4a'
}

function AgentFigure({ agent, selected }: { agent: Agent; selected: boolean }) {
  const color = bodyColor(agent)
  const limbColor = agent.alive ? '#2f7a60' : '#5c6168'
  const headColor = agent.alive ? '#e2c7a0' : '#8a8d93'

  return (
    <group>
      <mesh position={[0, 0.52, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.52, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.62} />
        {selected ? <Outlines thickness={3} color="#5aa0d6" /> : null}
      </mesh>
      <mesh position={[0.22, 0.58, 0]} rotation={[0, 0, 0.45]} castShadow>
        <capsuleGeometry args={[0.055, 0.26, 3, 6]} />
        <meshStandardMaterial color={limbColor} roughness={0.7} />
      </mesh>
      <mesh position={[-0.22, 0.58, 0]} rotation={[0, 0, -0.45]} castShadow>
        <capsuleGeometry args={[0.055, 0.26, 3, 6]} />
        <meshStandardMaterial color={limbColor} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color={headColor} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.04, 0.13]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color={agent.alive ? '#1b1d22' : '#4a4d52'} />
      </mesh>
      {agent.alive ? <HeadingMarker /> : <DeadMarker />}
    </group>
  )
}

function HeadingMarker() {
  return (
    <group raycast={() => null}>
      <mesh position={[0, 0.08, 0.62]}>
        <boxGeometry args={[0.07, 0.04, 0.72]} />
        <meshBasicMaterial color="#e8eef6" />
      </mesh>
      <mesh position={[0, 0.1, 1.08]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.11, 0.28, 6]} />
        <meshBasicMaterial color="#e8eef6" />
      </mesh>
    </group>
  )
}

function DeadMarker() {
  return (
    <mesh position={[0, 1.28, 0]} rotation={[0, 0, Math.PI / 4]} raycast={() => null}>
      <boxGeometry args={[0.22, 0.035, 0.035]} />
      <meshBasicMaterial color="#c45c4a" />
    </mesh>
  )
}

function SelectionRing() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} raycast={() => null}>
      <ringGeometry args={[0.48, 0.64, 32]} />
      <meshBasicMaterial color="#5aa0d6" />
    </mesh>
  )
}

function VisionRange({ radius }: { radius: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} raycast={() => null}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial color="#5aa0d6" transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]} raycast={() => null}>
        <ringGeometry args={[Math.max(0.08, radius - 0.1), radius, 48]} />
        <meshBasicMaterial color="#5aa0d6" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function AgentMesh({ agent }: AgentMeshProps) {
  const selected = useSimulationStore((state) => state.selectedObjectId === agent.id)
  const selectObject = useSimulationStore((state) => state.selectObject)

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    selectObject(agent.id)
  }

  return (
    <group position={[agent.position.x, 0, agent.position.z]} onClick={handleClick}>
      <mesh position={[0, 0.55, 0]} visible={false}>
        <cylinderGeometry args={[0.7, 0.7, 1.4, 10]} />
        <meshBasicMaterial />
      </mesh>
      {selected ? <VisionRange radius={agent.vision} /> : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.3, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={agent.alive ? 0.22 : 0.12} />
      </mesh>
      <group
        position={[0, agent.alive ? 0 : 0.16, 0]}
        rotation={agent.alive ? [0, agent.rotation, 0] : [Math.PI / 2, agent.rotation, 0]}
      >
        <AgentFigure agent={agent} selected={selected} />
      </group>
      {selected ? <SelectionRing /> : null}
      {selected ? (
        <Html
          position={[0, agent.alive ? 1.58 : 0.72, 0]}
          center
          distanceFactor={18}
          pointerEvents="none"
        >
          <div className="whitespace-nowrap rounded border border-lab-border bg-lab-panel/90 px-1.5 py-0.5 font-mono text-[10px] text-lab-text">
            {shortAgentId(agent.id)} · {agent.alive ? 'ALIVE' : 'DEAD'}
            {agent.lastAction ? ` · ${ACTION_LABELS[agent.lastAction]}` : ''}
          </div>
        </Html>
      ) : null}
    </group>
  )
}
