import { Outlines } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef, type RefObject } from 'react'
import type { Group } from 'three'
import {
  HELD_ACTION_MOTIONS,
  IDLE_LIMB_POSE,
  advanceWalkPhase,
  blendPoseExp,
  computeLocalReachAim,
  locomotionPhaseRates,
  poseFromMotion,
  resolveAgentMotionState,
  stepHeldMotion,
  type HeldMotionClock,
  type LimbPose,
  type Vec2,
} from '../../render/agentMotion'
import { useSimulationStore } from '../../store/useSimulationStore'
import { LabHumanGltf } from './LabHumanGltf'

interface HumanoidRigProps {
  agentId: string
  alive: boolean
  energy: 0 | 1 | 2
  selected: boolean
  /** Lab: skinned GLTF human. Ecology keeps placeholder look. */
  lab?: boolean
}

function ecologyBodyColor(alive: boolean, energy: 0 | 1 | 2): string {
  if (!alive) return '#6d7178'
  if (energy === 2) return '#3d9b7a'
  if (energy === 1) return '#c9a227'
  return '#c45c4a'
}

/**
 * Biped rig. Joint angles are driven on the render clock from
 * observable lastAction + speed + Lab drives → motion
 * (idle/rest/slump/curious/hungry/positive/walk/run/turn/gather/eat/attack/defend/dead).
 * Sticky actions hold briefly; gather/attack aim at latched actionTarget xz.
 * Sim ticks stay separate; no emotion meters.
 * Lab `lab` → textured Mixamo human (GLTF, face/skin/clothes); Ecology stays placeholder.
 */
export function HumanoidRig({ agentId, alive, energy, selected, lab = false }: HumanoidRigProps) {
  if (lab) {
    return (
      <Suspense fallback={<LabHumanFallback selected={selected} />}>
        <LabHumanGltf agentId={agentId} alive={alive} energy={energy} selected={selected} />
      </Suspense>
    )
  }

  return (
    <EcologyHumanoidRig
      agentId={agentId}
      alive={alive}
      energy={energy}
      selected={selected}
    />
  )
}

/** Brief silhouette while the Lab GLTF streams in — never the long-term subject. */
function LabHumanFallback({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.22, 1.05, 6, 10]} />
        <meshStandardMaterial color="#4a6f8f" roughness={0.7} />
        {selected ? <Outlines thickness={2.2} color="#5aa0d6" /> : null}
      </mesh>
    </group>
  )
}

function EcologyHumanoidRig({
  agentId,
  alive,
  energy,
  selected,
}: {
  agentId: string
  alive: boolean
  energy: 0 | 1 | 2
  selected: boolean
}) {
  const torsoRef = useRef<Group>(null)
  const leftThighRef = useRef<Group>(null)
  const rightThighRef = useRef<Group>(null)
  const leftShinRef = useRef<Group>(null)
  const rightShinRef = useRef<Group>(null)
  const leftUpperArmRef = useRef<Group>(null)
  const rightUpperArmRef = useRef<Group>(null)
  const leftForearmRef = useRef<Group>(null)
  const rightForearmRef = useRef<Group>(null)

  const phaseRef = useRef(0)
  const poseRef = useRef<LimbPose>({ ...IDLE_LIMB_POSE })
  const holdRef = useRef<HeldMotionClock>({ displayed: 'idle', holdLeft: 0 })
  const aimLatchRef = useRef<Vec2 | null>(null)

  useFrame((_, dt) => {
    const agent = useSimulationStore.getState().world.agents.find((item) => item.id === agentId)
    if (!agent) return

    const resolved = resolveAgentMotionState({
      alive: agent.alive,
      lastAction: agent.lastAction,
      speed: agent.speed,
      fatigue: agent.fatigue,
      comfort: agent.comfort,
      curiosity: agent.curiosity,
      hunger: agent.hunger,
      energy: agent.energy,
    })
    const clampedDt = Math.min(0.05, Math.max(0, dt))
    holdRef.current = stepHeldMotion(holdRef.current, resolved, clampedDt)
    const motion = holdRef.current.displayed

    if (HELD_ACTION_MOTIONS.has(resolved) && agent.actionTarget) {
      aimLatchRef.current = { x: agent.actionTarget.x, z: agent.actionTarget.z }
    } else if (!HELD_ACTION_MOTIONS.has(motion)) {
      aimLatchRef.current = null
    }

    const aim =
      aimLatchRef.current && (motion === 'gather' || motion === 'attack')
        ? computeLocalReachAim({
            agentX: agent.position.x,
            agentZ: agent.position.z,
            agentYaw: agent.rotation,
            targetX: aimLatchRef.current.x,
            targetZ: aimLatchRef.current.z,
          })
        : null

    const rates = locomotionPhaseRates(agent.speed)
    phaseRef.current = advanceWalkPhase(
      phaseRef.current,
      clampedDt,
      motion,
      rates.walk,
      undefined,
      rates.run,
    )
    const target = poseFromMotion(motion, phaseRef.current, aim)
    poseRef.current = blendPoseExp(poseRef.current, target, clampedDt)
    const pose = poseRef.current

    if (torsoRef.current) {
      torsoRef.current.position.y = 0.55 + pose.bob
      torsoRef.current.rotation.x = pose.torsoPitch
      torsoRef.current.rotation.y = pose.torsoY
      torsoRef.current.rotation.z = pose.torsoRoll
    }
    if (leftThighRef.current) {
      leftThighRef.current.rotation.x = pose.leftHip
      leftThighRef.current.rotation.y = pose.leftHipY
    }
    if (rightThighRef.current) {
      rightThighRef.current.rotation.x = pose.rightHip
      rightThighRef.current.rotation.y = pose.rightHipY
    }
    if (leftShinRef.current) leftShinRef.current.rotation.x = pose.leftKnee
    if (rightShinRef.current) rightShinRef.current.rotation.x = pose.rightKnee
    if (leftUpperArmRef.current) {
      leftUpperArmRef.current.rotation.x = pose.leftShoulder
      leftUpperArmRef.current.rotation.y = pose.leftShoulderY
    }
    if (rightUpperArmRef.current) {
      rightUpperArmRef.current.rotation.x = pose.rightShoulder
      rightUpperArmRef.current.rotation.y = pose.rightShoulderY
    }
    if (leftForearmRef.current) leftForearmRef.current.rotation.x = pose.leftElbow
    if (rightForearmRef.current) rightForearmRef.current.rotation.x = pose.rightElbow
  })

  return (
    <EcologyFigure
      alive={alive}
      energy={energy}
      selected={selected}
      torsoRef={torsoRef}
      leftThighRef={leftThighRef}
      rightThighRef={rightThighRef}
      leftShinRef={leftShinRef}
      rightShinRef={rightShinRef}
      leftUpperArmRef={leftUpperArmRef}
      rightUpperArmRef={rightUpperArmRef}
      leftForearmRef={leftForearmRef}
      rightForearmRef={rightForearmRef}
    />
  )
}

interface FigureRefs {
  alive: boolean
  energy: 0 | 1 | 2
  selected: boolean
  torsoRef: RefObject<Group | null>
  leftThighRef: RefObject<Group | null>
  rightThighRef: RefObject<Group | null>
  leftShinRef: RefObject<Group | null>
  rightShinRef: RefObject<Group | null>
  leftUpperArmRef: RefObject<Group | null>
  rightUpperArmRef: RefObject<Group | null>
  leftForearmRef: RefObject<Group | null>
  rightForearmRef: RefObject<Group | null>
}

/** Ecology: energy-tinted placeholder biped (unchanged look). */
function EcologyFigure({
  alive,
  energy,
  selected,
  torsoRef,
  leftThighRef,
  rightThighRef,
  leftShinRef,
  rightShinRef,
  leftUpperArmRef,
  rightUpperArmRef,
  leftForearmRef,
  rightForearmRef,
}: FigureRefs) {
  const color = ecologyBodyColor(alive, energy)
  const limbColor = alive ? '#2f7a60' : '#5c6168'
  const headColor = alive ? '#e2c7a0' : '#8a8d93'
  const eyeColor = alive ? '#1b1d22' : '#4a4d52'

  return (
    <group>
      <group ref={leftThighRef} position={[-0.09, 0.52, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.2, 3, 6]} />
          <meshStandardMaterial color={limbColor} roughness={0.7} />
        </mesh>
        <group ref={leftShinRef} position={[0, -0.3, 0]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <capsuleGeometry args={[0.045, 0.18, 3, 6]} />
            <meshStandardMaterial color={limbColor} roughness={0.72} />
          </mesh>
          <mesh position={[0, -0.28, 0.02]} castShadow>
            <boxGeometry args={[0.09, 0.05, 0.14]} />
            <meshStandardMaterial color={alive ? '#3a3f46' : '#555960'} roughness={0.85} />
          </mesh>
        </group>
      </group>

      <group ref={rightThighRef} position={[0.09, 0.52, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.2, 3, 6]} />
          <meshStandardMaterial color={limbColor} roughness={0.7} />
        </mesh>
        <group ref={rightShinRef} position={[0, -0.3, 0]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <capsuleGeometry args={[0.045, 0.18, 3, 6]} />
            <meshStandardMaterial color={limbColor} roughness={0.72} />
          </mesh>
          <mesh position={[0, -0.28, 0.02]} castShadow>
            <boxGeometry args={[0.09, 0.05, 0.14]} />
            <meshStandardMaterial color={alive ? '#3a3f46' : '#555960'} roughness={0.85} />
          </mesh>
        </group>
      </group>

      <group ref={torsoRef} position={[0, 0.55, 0]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <capsuleGeometry args={[0.17, 0.34, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.62} />
          {selected ? <Outlines thickness={3} color="#5aa0d6" /> : null}
        </mesh>

        <mesh position={[0, 0.58, 0]} castShadow>
          <sphereGeometry args={[0.145, 10, 10]} />
          <meshStandardMaterial color={headColor} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.6, 0.12]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color={eyeColor} />
        </mesh>

        <group ref={leftUpperArmRef} position={[-0.22, 0.32, 0]}>
          <mesh position={[0, -0.12, 0]} castShadow>
            <capsuleGeometry args={[0.045, 0.16, 3, 6]} />
            <meshStandardMaterial color={limbColor} roughness={0.7} />
          </mesh>
          <group ref={leftForearmRef} position={[0, -0.24, 0]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <capsuleGeometry args={[0.038, 0.14, 3, 6]} />
              <meshStandardMaterial color={limbColor} roughness={0.72} />
            </mesh>
          </group>
        </group>

        <group ref={rightUpperArmRef} position={[0.22, 0.32, 0]}>
          <mesh position={[0, -0.12, 0]} castShadow>
            <capsuleGeometry args={[0.045, 0.16, 3, 6]} />
            <meshStandardMaterial color={limbColor} roughness={0.7} />
          </mesh>
          <group ref={rightForearmRef} position={[0, -0.24, 0]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <capsuleGeometry args={[0.038, 0.14, 3, 6]} />
              <meshStandardMaterial color={limbColor} roughness={0.72} />
            </mesh>
          </group>
        </group>
      </group>

      {alive ? <HeadingMarker /> : <DeadMarker />}
    </group>
  )
}

function HeadingMarker() {
  return (
    <group raycast={() => null}>
      <mesh position={[0, 0.08, 0.62]}>
        <boxGeometry args={[0.07, 0.03, 0.72]} />
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
