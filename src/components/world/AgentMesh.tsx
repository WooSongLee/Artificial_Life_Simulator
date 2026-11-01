import { Billboard, Html, Outlines, Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, MeshBasicMaterial } from 'three'
import { useShallow } from 'zustand/react/shallow'
import { isMating } from '../../evolution/reproduction'
import { ACTION_COLORS, ACTION_LABELS, ACTION_MARKS } from '../../learning/constants'
import type { AgentAction } from '../../learning/types'
import { BasketMesh, DiggingStickMesh, ShieldMesh, SpearMesh } from './ForageAndTools'
import { getEffectiveVision } from '../../simulation/terrain'
import { useSimulationStore } from '../../store/useSimulationStore'
import { shortAgentId } from '../../utils/format'

interface AgentMeshProps {
  agentId: string
}

function bodyColor(alive: boolean, energy: 0 | 1 | 2): string {
  if (!alive) return '#6d7178'
  if (energy === 2) return '#3d9b7a'
  if (energy === 1) return '#c9a227'
  return '#c45c4a'
}

function AgentFigure({
  alive,
  energy,
  selected,
}: {
  alive: boolean
  energy: 0 | 1 | 2
  selected: boolean
}) {
  const color = bodyColor(alive, energy)
  const limbColor = alive ? '#2f7a60' : '#5c6168'
  const headColor = alive ? '#e2c7a0' : '#8a8d93'

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
        <meshStandardMaterial color={alive ? '#1b1d22' : '#4a4d52'} />
      </mesh>
      {alive ? <HeadingMarker /> : <DeadMarker />}
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

function MatingHearts() {
  return (
    <Billboard position={[0, 1.58, 0]} follow raycast={() => null}>
      <Text fontSize={0.38} color="#f071a8" anchorX="center" anchorY="middle">
        ♥
      </Text>
      <Text position={[-0.28, 0.22, 0]} fontSize={0.2} color="#ff9ac8" anchorX="center" anchorY="middle">
        ♥
      </Text>
      <Text position={[0.3, 0.18, 0]} fontSize={0.16} color="#ffd0e4" anchorX="center" anchorY="middle">
        ♥
      </Text>
    </Billboard>
  )
}

function SelectedAgentLabel({
  agentId,
  statusLabel,
  alive,
  raised,
}: {
  agentId: string
  statusLabel: string
  alive: boolean
  raised: boolean
}) {
  const actionRef = useRef<HTMLSpanElement>(null)
  const lastText = useRef('')

  useFrame(() => {
    const agent = useSimulationStore.getState().world.agents.find((item) => item.id === agentId)
    const action = agent?.alive ? agent.lastAction : null
    const target = agent?.alive ? agent.actionTarget : null
    const text = action
      ? `${ACTION_LABELS[action]}${target?.kind ? ` → ${target.kind.replace('_', ' ')}` : ''}`
      : ''
    if (text === lastText.current) return
    lastText.current = text
    if (actionRef.current) {
      actionRef.current.textContent = text
      actionRef.current.style.display = text ? 'inline' : 'none'
    }
  })

  return (
    <Html
      position={[0, alive ? (raised ? 1.92 : 1.58) : 0.72, 0]}
      center
      distanceFactor={18}
      pointerEvents="none"
    >
      <div className="whitespace-nowrap rounded border border-lab-border bg-lab-panel/90 px-1.5 py-0.5 font-mono text-[10px] text-lab-text">
        {statusLabel}
        <span ref={actionRef} className="ml-1 font-semibold text-lab-info" />
      </div>
    </Html>
  )
}

function ActionMarker({ agentId }: { agentId: string }) {
  const groupRef = useRef<Group>(null)
  const materialRef = useRef<MeshBasicMaterial>(null)
  const textRef = useRef<{ text: string }>(null)
  const circleRef = useRef<Group>(null)
  const diamondRef = useRef<Group>(null)
  const boxRef = useRef<Group>(null)
  const triangleRef = useRef<Group>(null)
  const ringRef = useRef<Group>(null)
  const lastAction = useRef<AgentAction | null>(null)

  useFrame(() => {
    const agent = useSimulationStore.getState().world.agents.find((item) => item.id === agentId)
    const action = agent?.alive ? agent.lastAction : null
    if (groupRef.current) {
      groupRef.current.visible = action !== null
    }
    if (!action || action === lastAction.current) return
    lastAction.current = action
    materialRef.current?.color.set(ACTION_COLORS[action])
    if (textRef.current) {
      textRef.current.text = ACTION_MARKS[action]
    }
    const shape =
      action === 'GATHER' ? 'diamond'
      : action === 'PICK_UP' ? 'box'
      : action === 'ATTACK' ? 'triangle'
      : action === 'DEFEND' ? 'ring'
      : action === 'FLEE' ? 'triangle'
      : 'circle'
    if (circleRef.current) circleRef.current.visible = shape === 'circle'
    if (diamondRef.current) diamondRef.current.visible = shape === 'diamond'
    if (boxRef.current) boxRef.current.visible = shape === 'box'
    if (triangleRef.current) triangleRef.current.visible = shape === 'triangle'
    if (ringRef.current) ringRef.current.visible = shape === 'ring'
  })

  return (
    <Billboard ref={groupRef} position={[0, 1.42, 0]} follow raycast={() => null}>
      <group ref={circleRef}>
        <mesh>
          <circleGeometry args={[0.16, 16]} />
          <meshBasicMaterial ref={materialRef} color="#8b97a8" />
        </mesh>
      </group>
      <group ref={diamondRef} visible={false}>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[0.26, 0.26]} />
          <meshBasicMaterial color="#6aa84e" />
        </mesh>
      </group>
      <group ref={boxRef} visible={false}>
        <mesh>
          <planeGeometry args={[0.24, 0.24]} />
          <meshBasicMaterial color="#c47a3d" />
        </mesh>
      </group>
      <group ref={triangleRef} visible={false}>
        <mesh>
          <circleGeometry args={[0.17, 3]} />
          <meshBasicMaterial color="#c45c4a" />
        </mesh>
      </group>
      <group ref={ringRef} visible={false}>
        <mesh>
          <ringGeometry args={[0.1, 0.17, 16]} />
          <meshBasicMaterial color="#5aa0d6" />
        </mesh>
      </group>
      <Text
        ref={textRef}
        position={[0, 0, 0.01]}
        fontSize={0.2}
        color="#0c1118"
        anchorX="center"
        anchorY="middle"
      >
        {ACTION_MARKS.REST}
      </Text>
    </Billboard>
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

function energyBand(energy: number): 0 | 1 | 2 {
  if (energy > 62) return 2
  if (energy > 32) return 1
  return 0
}

export function AgentMesh({ agentId }: AgentMeshProps) {
  const rootRef = useRef<Group>(null)
  const bodyRef = useRef<Group>(null)
  const selectObject = useSimulationStore((state) => state.selectObject)
  const showVisionRange = useSimulationStore((state) => state.settings.showVisionRange)
  const showActionMarkers = useSimulationStore((state) => state.settings.showActionMarkers)
  const visual = useSimulationStore(
    useShallow((state) => {
      const agent = state.world.agents.find((item) => item.id === agentId)
      if (!agent) return null
      const selected = state.selectedObjectId === agentId
      return {
        alive: agent.alive,
        energy: energyBand(agent.energy),
        mating: isMating(agent),
        vision: getEffectiveVision(agent, state.world),
        selected,
        equipmentType: agent.equipment?.toolType ?? null,
        label: selected ? `${shortAgentId(agent.id)} · ${agent.alive ? 'ALIVE' : 'DEAD'}` : '',
      }
    }),
  )

  useFrame(() => {
    const agent = useSimulationStore.getState().world.agents.find((item) => item.id === agentId)
    if (!agent || !rootRef.current) return
    rootRef.current.position.set(agent.position.x, 0, agent.position.z)
    if (!bodyRef.current) return
    if (agent.alive) {
      bodyRef.current.position.set(0, 0, 0)
      bodyRef.current.rotation.set(0, agent.rotation, 0)
    } else {
      bodyRef.current.position.set(0, 0.16, 0)
      bodyRef.current.rotation.set(Math.PI / 2, agent.rotation, 0)
    }
  })

  if (!visual) return null

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    selectObject(agentId)
  }

  return (
    <group ref={rootRef} onClick={handleClick}>
      <mesh position={[0, 0.55, 0]} visible={false}>
        <cylinderGeometry args={[0.7, 0.7, 1.4, 10]} />
        <meshBasicMaterial />
      </mesh>
      {visual.selected && showVisionRange ? <VisionRange radius={visual.vision} /> : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.3, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={visual.alive ? 0.22 : 0.12} />
      </mesh>
      <group ref={bodyRef}>
        <AgentFigure alive={visual.alive} energy={visual.energy} selected={visual.selected} />
        {visual.alive && visual.equipmentType === 'basket' ? (
          <group position={[-0.22, 0.42, -0.08]} rotation={[0.15, 0.4, 0.2]}>
            <BasketMesh scale={0.72} />
          </group>
        ) : null}
        {visual.alive && visual.equipmentType === 'digging_stick' ? (
          <group position={[0.26, 0.52, 0.08]} rotation={[0.9, 0.1, -0.35]}>
            <DiggingStickMesh scale={0.7} />
          </group>
        ) : null}
        {visual.alive && visual.equipmentType === 'spear' ? (
          <group position={[0.28, 0.48, 0.1]} rotation={[0.85, 0.05, -0.25]}>
            <SpearMesh scale={0.62} />
          </group>
        ) : null}
        {visual.alive && visual.equipmentType === 'shield' ? (
          <group position={[-0.24, 0.46, 0.06]} rotation={[0.2, 0.5, 0.15]}>
            <ShieldMesh scale={0.7} />
          </group>
        ) : null}
      </group>
      {visual.selected ? <SelectionRing /> : null}
      {visual.alive && visual.mating ? (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} raycast={() => null}>
            <ringGeometry args={[0.42, 0.58, 24]} />
            <meshBasicMaterial color="#f071a8" transparent opacity={0.7} />
          </mesh>
          <MatingHearts />
        </>
      ) : null}
      {visual.alive && showActionMarkers && !visual.mating ? <ActionMarker agentId={agentId} /> : null}
      {visual.selected ? (
        <SelectedAgentLabel
          agentId={agentId}
          statusLabel={visual.label}
          alive={visual.alive}
          raised={showActionMarkers}
        />
      ) : null}
    </group>
  )
}
