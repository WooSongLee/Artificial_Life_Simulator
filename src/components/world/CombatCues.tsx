import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { useShallow } from 'zustand/react/shallow'
import { ACTION_CUE_FULL_SPEED_MAX } from '../../simulation/constants'
import { useSimulationStore } from '../../store/useSimulationStore'

function AttackCue({ fromId }: { fromId: string }) {
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    const agent = useSimulationStore.getState().world.agents.find((item) => item.id === fromId)
    const cue = agent?.alive ? agent.combatCue : null
    if (!groupRef.current || !agent || cue?.kind !== 'attack') {
      if (groupRef.current) groupRef.current.visible = false
      return
    }
    const dx = cue.x - agent.position.x
    const dz = cue.z - agent.position.z
    const length = Math.hypot(dx, dz)
    groupRef.current.visible = length > 0.05
    groupRef.current.position.set(agent.position.x, 0.22, agent.position.z)
    groupRef.current.rotation.set(0, Math.atan2(dx, dz), 0)
    groupRef.current.scale.set(1, 1, Math.min(length, 3.2))
  })

  return (
    <group ref={groupRef} visible={false} raycast={() => null}>
      <mesh position={[0, 0, 0.5]}>
        <boxGeometry args={[0.045, 0.03, 1]} />
        <meshBasicMaterial color="#c45c4a" transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

function DefendCue({ agentId }: { agentId: string }) {
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    const agent = useSimulationStore.getState().world.agents.find((item) => item.id === agentId)
    if (!groupRef.current) return
    const visible = Boolean(agent?.alive && (agent.defendTimeLeft > 0 || agent.combatCue?.kind === 'defend'))
    groupRef.current.visible = visible
    if (agent && visible) {
      groupRef.current.position.set(agent.position.x, 0.06, agent.position.z)
    }
  })

  return (
    <group ref={groupRef} visible={false} raycast={() => null}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.46, 0.6, 24]} />
        <meshBasicMaterial color="#5aa0d6" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

function FleeCue({ fromId }: { fromId: string }) {
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    const agent = useSimulationStore.getState().world.agents.find((item) => item.id === fromId)
    const cue = agent?.alive ? agent.combatCue : null
    if (!groupRef.current || !agent || cue?.kind !== 'flee') {
      if (groupRef.current) groupRef.current.visible = false
      return
    }
    const awayX = agent.position.x - cue.x
    const awayZ = agent.position.z - cue.z
    const length = Math.hypot(awayX, awayZ)
    groupRef.current.visible = length > 0.05
    groupRef.current.position.set(agent.position.x, 0.2, agent.position.z)
    groupRef.current.rotation.set(0, Math.atan2(awayX, awayZ), 0)
  })

  return (
    <group ref={groupRef} visible={false} raycast={() => null}>
      <mesh position={[0, 0, 0.55]}>
        <boxGeometry args={[0.04, 0.03, 0.9]} />
        <meshBasicMaterial color="#c9a227" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0, 1.05]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.08, 0.2, 6]} />
        <meshBasicMaterial color="#c9a227" transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

function GatherCue({ fromId }: { fromId: string }) {
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    const agent = useSimulationStore.getState().world.agents.find((item) => item.id === fromId)
    const target = agent?.alive && agent.lastAction === 'GATHER' ? agent.actionTarget : null
    if (!groupRef.current || !agent || !target) {
      if (groupRef.current) groupRef.current.visible = false
      return
    }
    const dx = target.x - agent.position.x
    const dz = target.z - agent.position.z
    const length = Math.hypot(dx, dz)
    groupRef.current.visible = length > 0.05
    groupRef.current.position.set(agent.position.x, 0.18, agent.position.z)
    groupRef.current.rotation.set(0, Math.atan2(dx, dz), 0)
    groupRef.current.scale.set(1, 1, Math.min(length, 2.8))
  })

  return (
    <group ref={groupRef} visible={false} raycast={() => null}>
      <mesh position={[0, 0, 0.5]}>
        <boxGeometry args={[0.05, 0.03, 1]} />
        <meshBasicMaterial color="#6aa84e" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0, 1]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.12, 0.03, 0.12]} />
        <meshBasicMaterial color="#6aa84e" transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

function PickupCue({ fromId }: { fromId: string }) {
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    const agent = useSimulationStore.getState().world.agents.find((item) => item.id === fromId)
    const target = agent?.alive && agent.lastAction === 'PICK_UP' ? agent.actionTarget : null
    if (!groupRef.current || !agent || !target) {
      if (groupRef.current) groupRef.current.visible = false
      return
    }
    const dx = target.x - agent.position.x
    const dz = target.z - agent.position.z
    const length = Math.hypot(dx, dz)
    groupRef.current.visible = length > 0.05
    groupRef.current.position.set(agent.position.x, 0.18, agent.position.z)
    groupRef.current.rotation.set(0, Math.atan2(dx, dz), 0)
    groupRef.current.scale.set(1, 1, Math.min(length, 2.8))
  })

  return (
    <group ref={groupRef} visible={false} raycast={() => null}>
      <mesh position={[0, 0, 0.5]}>
        <boxGeometry args={[0.05, 0.03, 1]} />
        <meshBasicMaterial color="#c47a3d" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0, 1]}>
        <boxGeometry args={[0.14, 0.03, 0.14]} />
        <meshBasicMaterial color="#c47a3d" transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

export function CombatCues() {
  const agentIds = useSimulationStore(
    useShallow((state) => {
      if (!state.settings.showActionCues) return []
      const selected = state.selectedObjectId
      const ids =
        state.speed > ACTION_CUE_FULL_SPEED_MAX && selected
          ? state.world.agents.filter((agent) => agent.alive && agent.id === selected).map((agent) => agent.id)
          : state.speed > ACTION_CUE_FULL_SPEED_MAX
            ? []
            : state.world.agents.filter((agent) => agent.alive).map((agent) => agent.id)
      return ids
    }),
  )

  return (
    <group>
      {agentIds.map((id) => (
        <group key={id}>
          <AttackCue fromId={id} />
          <DefendCue agentId={id} />
          <FleeCue fromId={id} />
          <GatherCue fromId={id} />
          <PickupCue fromId={id} />
        </group>
      ))}
    </group>
  )
}
