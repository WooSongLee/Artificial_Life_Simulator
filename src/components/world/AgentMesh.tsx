import { Billboard, Html, Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, MeshBasicMaterial } from 'three'
import { useShallow } from 'zustand/react/shallow'
import { isMating } from '../../evolution/reproduction'
import { ACTION_COLORS, ACTION_LABELS, ACTION_MARKS } from '../../learning/constants'
import type { AgentAction } from '../../learning/types'
import {
  blendAngle,
  blendPosition,
  resolveAgentMotionState,
  stepHeldMotion,
  type HeldMotionClock,
  type Vec2,
} from '../../render/agentMotion'
import { BasketMesh, DiggingStickMesh, ShieldMesh, SpearMesh } from './ForageAndTools'
import { HumanoidRig } from './HumanoidRig'
import { isHumanBehaviorLab } from '../../simulation/labMode'
import { getEffectiveVision } from '../../simulation/terrain'
import { useSimulationStore } from '../../store/useSimulationStore'
import { shortAgentId } from '../../utils/format'

interface AgentMeshProps {
  agentId: string
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
  const yawRef = useRef<number | null>(null)
  const positionRef = useRef<Vec2 | null>(null)
  const holdRef = useRef<HeldMotionClock>({ displayed: 'idle', holdLeft: 0 })
  const selectObject = useSimulationStore((state) => state.selectObject)
  const showVisionRange = useSimulationStore((state) => state.settings.showVisionRange)
  const showActionMarkers = useSimulationStore((state) => state.settings.showActionMarkers)
  const lab = useSimulationStore((state) => isHumanBehaviorLab(state.world.config.mode))
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

  useFrame((_, dt) => {
    const agent = useSimulationStore.getState().world.agents.find((item) => item.id === agentId)
    if (!agent || !rootRef.current) return
    const clampedDt = Math.min(0.05, Math.max(0, dt))
    // Same resolve + hold clock as HumanoidRig so xz follow mode matches limbs.
    const resolved = resolveAgentMotionState({
      alive: agent.alive,
      lastAction: agent.lastAction,
      speed: agent.speed,
      fatigue: agent.fatigue,
      comfort: agent.comfort,
    })
    holdRef.current = stepHeldMotion(holdRef.current, resolved, clampedDt)
    const motion = holdRef.current.displayed
    // Walk/run: soft xz follow (sim authoritative). Planted: snap (no stop foot-slide).
    if (positionRef.current === null) {
      positionRef.current = { x: agent.position.x, z: agent.position.z }
    } else {
      positionRef.current = blendPosition(
        positionRef.current,
        { x: agent.position.x, z: agent.position.z },
        clampedDt,
        motion,
      )
    }
    rootRef.current.position.set(positionRef.current.x, 0, positionRef.current.z)
    if (!bodyRef.current) return
    if (yawRef.current === null) yawRef.current = agent.rotation
    yawRef.current = blendAngle(yawRef.current, agent.rotation, clampedDt)
    if (agent.alive) {
      bodyRef.current.position.set(0, 0, 0)
      bodyRef.current.rotation.set(0, yawRef.current, 0)
    } else {
      bodyRef.current.position.set(0, 0.16, 0)
      bodyRef.current.rotation.set(Math.PI / 2, yawRef.current, 0)
    }
  })

  if (!visual) return null

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    selectObject(agentId)
  }

  return (
    <group
      ref={rootRef}
      name={`agent-${agentId}`}
      userData={{ agentId, kind: 'agent' }}
      onClick={handleClick}
    >
      <mesh position={[0, 0.55, 0]} visible={false}>
        <cylinderGeometry args={[0.7, 0.7, 1.4, 10]} />
        <meshBasicMaterial />
      </mesh>
      {visual.selected && showVisionRange ? <VisionRange radius={visual.vision} /> : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.3, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={visual.alive ? 0.22 : 0.12} />
      </mesh>
      <group ref={bodyRef} name="agent-body">
        <HumanoidRig
          agentId={agentId}
          alive={visual.alive}
          energy={visual.energy}
          selected={visual.selected}
          lab={lab}
        />
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
