import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, MeshBasicMaterial, PointLight as ThreePointLight } from 'three'
import { useShallow } from 'zustand/react/shallow'
import {
  agentInInteractReach,
  DRIVE_SUCCESS_FLASH_TICKS,
  isDriveSuccessFresh,
} from '../../simulation/interactables'
import type { Interactable } from '../../types/interactable'
import { useSimulationStore } from '../../store/useSimulationStore'

/**
 * Reach ring: agent in interact radius → object invites GATHER.
 * Success burst: lastUsedTick-fresh → brief bright bloom (real sim data).
 */
function DriveInteractCues({
  itemId,
  accent,
  burstHeight,
}: {
  itemId: string
  accent: string
  burstHeight: number
}) {
  const reachRef = useRef<Group>(null)
  const burstRef = useRef<Group>(null)
  const reachMatRef = useRef<MeshBasicMaterial>(null)
  const burstMatRef = useRef<MeshBasicMaterial>(null)
  const burstLightRef = useRef<ThreePointLight>(null)

  useFrame(({ clock }) => {
    const state = useSimulationStore.getState()
    const item = (state.world.interactables ?? []).find((candidate) => candidate.id === itemId)
    if (!item || (item.kind !== 'rest_bed' && item.kind !== 'lookout')) {
      if (reachRef.current) reachRef.current.visible = false
      if (burstRef.current) burstRef.current.visible = false
      return
    }

    const inReach = agentInInteractReach(item.position.x, item.position.z, state.world.agents)
    const fresh = isDriveSuccessFresh(item.lastUsedTick, state.tick)
    const t = clock.elapsedTime

    if (reachRef.current) {
      reachRef.current.visible = inReach && !fresh
      if (inReach && reachMatRef.current) {
        reachMatRef.current.opacity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(t * 5.5))
        const pulse = 1 + 0.04 * Math.sin(t * 5.5)
        reachRef.current.scale.set(pulse, 1, pulse)
      }
    }

    if (burstRef.current) {
      burstRef.current.visible = fresh
      if (fresh) {
        const age = Math.max(0, state.tick - item.lastUsedTick)
        const fade = 1 - age / DRIVE_SUCCESS_FLASH_TICKS
        const expand = 0.85 + (1 - fade) * 0.55
        burstRef.current.scale.set(expand, 1, expand)
        if (burstMatRef.current) burstMatRef.current.opacity = 0.25 + fade * 0.7
        if (burstLightRef.current) burstLightRef.current.intensity = 0.4 + fade * 1.4
      }
    }
  })

  return (
    <group raycast={() => null}>
      <group ref={reachRef} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[1.35, 1.58, 28]} />
          <meshBasicMaterial
            ref={reachMatRef}
            color={accent}
            transparent
            opacity={0.45}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
          <ringGeometry args={[0.95, 1.05, 24]} />
          <meshBasicMaterial color={accent} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      </group>
      <group ref={burstRef} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <ringGeometry args={[0.7, 1.9, 32]} />
          <meshBasicMaterial
            ref={burstMatRef}
            color={accent}
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, burstHeight, 0]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshBasicMaterial color={accent} transparent opacity={0.55} depthWrite={false} />
        </mesh>
        <pointLight
          ref={burstLightRef}
          position={[0, burstHeight, 0]}
          intensity={0}
          distance={6}
          color={accent}
        />
      </group>
    </group>
  )
}

function DoorMesh({ item }: { item: Extract<Interactable, { kind: 'door' }> }) {
  const open = item.open
  const panel = open ? '#5a6a78' : '#3a4654'
  const frame = '#2a323c'
  return (
    <group>
      {/* Lab gate frame */}
      <mesh position={[-0.92, 1.05, 0]} castShadow>
        <boxGeometry args={[0.16, 2.1, 0.28]} />
        <meshStandardMaterial color={frame} roughness={0.88} metalness={0.15} />
      </mesh>
      <mesh position={[0.92, 1.05, 0]} castShadow>
        <boxGeometry args={[0.16, 2.1, 0.28]} />
        <meshStandardMaterial color={frame} roughness={0.88} metalness={0.15} />
      </mesh>
      <mesh position={[0, 2.16, 0]} castShadow>
        <boxGeometry args={[2.0, 0.16, 0.3]} />
        <meshStandardMaterial color={frame} roughness={0.85} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[2.0, 0.08, 0.36]} />
        <meshStandardMaterial color="#1e242c" roughness={0.95} />
      </mesh>
      <group position={[-0.78, 0, 0]} rotation={[0, open ? -1.2 : 0, 0]}>
        <mesh position={[0.78, 1.05, 0]} castShadow>
          <boxGeometry args={[1.56, 2.0, 0.08]} />
          <meshStandardMaterial color={panel} roughness={0.7} metalness={0.25} />
        </mesh>
        <mesh position={[0.78, 1.35, 0.05]}>
          <boxGeometry args={[0.9, 0.35, 0.02]} />
          <meshStandardMaterial
            color={open ? '#5ecf70' : '#c45a3a'}
            emissive={open ? '#2a8a3a' : '#6a2020'}
            emissiveIntensity={0.45}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[1.4, 1.0, 0.1]} castShadow>
          <boxGeometry args={[0.12, 0.08, 0.08]} />
          <meshStandardMaterial color="#c9a227" metalness={0.55} roughness={0.35} />
        </mesh>
      </group>
    </group>
  )
}

function SwitchMesh({ item }: { item: Extract<Interactable, { kind: 'switch' }> }) {
  const on = item.on
  return (
    <group>
      {/* Wall control panel */}
      <mesh position={[0, 0.95, -0.08]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 1.1, 0.12]} />
        <meshStandardMaterial color="#3a424c" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[0.45, 0.22, 0.08]} />
        <meshStandardMaterial color="#2a3038" roughness={0.55} />
      </mesh>
      <group position={[0, 1.0, 0.06]} rotation={[on ? 0.65 : -0.65, 0, 0]}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <boxGeometry args={[0.1, 0.36, 0.07]} />
          <meshStandardMaterial color="#1e2228" roughness={0.45} metalness={0.25} />
        </mesh>
        <mesh position={[0, 0.38, 0]} castShadow>
          <boxGeometry args={[0.16, 0.1, 0.1]} />
          <meshStandardMaterial color={on ? '#3d9a55' : '#9a3d3d'} roughness={0.4} />
        </mesh>
      </group>
      <mesh position={[0.18, 1.55, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial
          color={on ? '#5ecf70' : '#6a3030'}
          emissive={on ? '#2a8a3a' : '#000000'}
          emissiveIntensity={on ? 0.7 : 0}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 0.45, 0]} receiveShadow>
        <boxGeometry args={[0.55, 0.08, 0.35]} />
        <meshStandardMaterial color="#2e343c" roughness={0.85} />
      </mesh>
    </group>
  )
}

function MovableBoxMesh() {
  return (
    <group>
      {/* Lab equipment crate */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.05, 1.05, 1.05]} />
        <meshStandardMaterial color="#6a7380" roughness={0.75} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.55, 0.54]}>
        <boxGeometry args={[0.7, 0.35, 0.02]} />
        <meshStandardMaterial color="#c9a05a" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[1.08, 0.06, 1.08]} />
        <meshStandardMaterial color="#4a5560" roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.72, 12]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  )
}

function RestBedMesh({ item }: { item: Extract<Interactable, { kind: 'rest_bed' }> }) {
  const used = item.used
  const frame = '#3a3430'
  const mattress = used ? '#6a7a8a' : '#4a5560'
  const linen = used ? '#c4b8a0' : '#a89878'
  const pillow = used ? '#d0c8b8' : '#b8aa90'
  return (
    <group>
      <DriveInteractCues itemId={item.id} accent="#9ed4e8" burstHeight={1.05} />
      {/* Cot side rail / partition cue */}
      <mesh position={[0, 0.85, -0.62]} castShadow>
        <boxGeometry args={[1.8, 1.5, 0.08]} />
        <meshStandardMaterial color="#2e3844" roughness={0.88} transparent opacity={0.85} />
      </mesh>
      <mesh position={[-0.95, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 1.3, 8]} />
        <meshStandardMaterial color="#4a4038" roughness={0.85} />
      </mesh>
      <mesh position={[-0.95, 1.4, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial
          color="#f0e0c0"
          emissive={used ? '#ffd8a0' : '#e8c888'}
          emissiveIntensity={used ? 0.9 : 0.5}
          roughness={0.55}
        />
      </mesh>
      <pointLight
        position={[-0.95, 1.45, 0]}
        intensity={used ? 0.75 : 0.4}
        distance={5.5}
        color="#ffd8a8"
      />
      {(
        [
          [-0.68, 0.42],
          [0.68, 0.42],
          [-0.68, -0.42],
          [0.68, -0.42],
        ] as const
      ).map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, 0.14, z]} castShadow>
          <boxGeometry args={[0.08, 0.28, 0.08]} />
          <meshStandardMaterial color={frame} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.62, 0.1, 0.98]} />
        <meshStandardMaterial color={frame} roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.62, 0.46]} castShadow>
        <boxGeometry args={[1.62, 0.55, 0.08]} />
        <meshStandardMaterial color={frame} roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.42, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[1.52, 0.16, 0.88]} />
        <meshStandardMaterial color={mattress} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.52, -0.18]} castShadow>
        <boxGeometry args={[1.48, 0.06, 0.52]} />
        <meshStandardMaterial color={linen} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.56, 0.28]} castShadow>
        <boxGeometry args={[0.58, 0.14, 0.28]} />
        <meshStandardMaterial color={pillow} roughness={0.92} />
      </mesh>
    </group>
  )
}

/** Observation booth window — curiosity chamber apparatus. */
function LookoutMesh({ item }: { item: Extract<Interactable, { kind: 'lookout' }> }) {
  const used = item.used
  const frame = '#2e3540'
  const glass = used ? '#b8d4f0' : '#7aa0c8'
  return (
    <group>
      <DriveInteractCues itemId={item.id} accent="#b8d4ff" burstHeight={1.55} />
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[1.85, 0.12, 0.55]} />
        <meshStandardMaterial color="#3a424c" roughness={0.9} />
      </mesh>
      <mesh position={[-0.85, 1.2, 0]} castShadow>
        <boxGeometry args={[0.14, 2.2, 0.22]} />
        <meshStandardMaterial color={frame} roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh position={[0.85, 1.2, 0]} castShadow>
        <boxGeometry args={[0.14, 2.2, 0.22]} />
        <meshStandardMaterial color={frame} roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh position={[0, 2.35, 0]} castShadow>
        <boxGeometry args={[1.85, 0.14, 0.24]} />
        <meshStandardMaterial color={frame} roughness={0.84} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.08, 2.1, 0.1]} />
        <meshStandardMaterial color={frame} roughness={0.84} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[1.6, 0.08, 0.1]} />
        <meshStandardMaterial color={frame} roughness={0.84} />
      </mesh>
      <mesh position={[0, 1.2, 0.03]}>
        <boxGeometry args={[1.5, 1.95, 0.04]} />
        <meshStandardMaterial
          color={glass}
          emissive={used ? '#a8c8f0' : '#4a78b0'}
          emissiveIntensity={used ? 0.95 : 0.5}
          transparent
          opacity={0.74}
          roughness={0.22}
          metalness={0.05}
        />
      </mesh>
      <pointLight
        position={[0.4, 1.5, -0.55]}
        intensity={used ? 0.9 : 0.52}
        distance={7}
        color="#a8c4f0"
      />
      <mesh position={[0, 1.0, -0.4]} castShadow>
        <boxGeometry args={[1.6, 0.1, 0.14]} />
        <meshStandardMaterial color="#4a5560" roughness={0.75} />
      </mesh>
      {/* Booth desk */}
      <mesh position={[0, 0.72, -0.55]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.08, 0.45]} />
        <meshStandardMaterial color="#4a5560" roughness={0.8} />
      </mesh>
    </group>
  )
}

function SelectionRing() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
      <ringGeometry args={[0.58, 0.74, 24]} />
      <meshBasicMaterial color="#5a8fc7" />
    </mesh>
  )
}

function InteractableMesh({ itemId }: { itemId: string }) {
  const item = useSimulationStore((state) =>
    (state.world.interactables ?? []).find((candidate) => candidate.id === itemId),
  )
  const selected = useSimulationStore((state) => state.selectedObjectId === itemId)
  const selectObject = useSimulationStore((state) => state.selectObject)

  if (!item) return null

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    selectObject(item.id)
  }

  return (
    <group
      position={[item.position.x, 0, item.position.z]}
      rotation={[0, item.rotation, 0]}
      scale={item.scale}
      onClick={handleClick}
    >
      {item.kind === 'door' ? <DoorMesh item={item} /> : null}
      {item.kind === 'switch' ? <SwitchMesh item={item} /> : null}
      {item.kind === 'movable_box' ? <MovableBoxMesh /> : null}
      {item.kind === 'rest_bed' ? <RestBedMesh item={item} /> : null}
      {item.kind === 'lookout' ? <LookoutMesh item={item} /> : null}
      {selected ? <SelectionRing /> : null}
    </group>
  )
}

export function Interactables() {
  const interactableIds = useSimulationStore(
    useShallow((state) => (state.world.interactables ?? []).map((item) => item.id)),
  )

  if (interactableIds.length === 0) return null

  return (
    <group>
      {interactableIds.map((id) => (
        <InteractableMesh key={id} itemId={id} />
      ))}
    </group>
  )
}
