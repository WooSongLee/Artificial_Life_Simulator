import { Outlines, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  AnimationMixer,
  Color,
  LoopOnce,
  type AnimationAction,
  type AnimationClip,
  type Bone,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
} from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
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

const LAB_HUMAN_URL = '/models/lab-human.glb'

/** Soft energy wash — never replaces textured skin/clothing albedo. */
function energyEmissive(alive: boolean, energy: 0 | 1 | 2): { color: string; intensity: number } {
  if (!alive) return { color: '#000000', intensity: 0 }
  if (energy === 2) return { color: '#6a9ec0', intensity: 0.045 }
  if (energy === 1) return { color: '#b08a45', intensity: 0.03 }
  return { color: '#b06055', intensity: 0.02 }
}

interface BoneRig {
  hips: Bone
  spine: Bone
  spine1: Bone
  leftUpLeg: Bone
  rightUpLeg: Bone
  leftLeg: Bone
  rightLeg: Bone
  leftArm: Bone
  rightArm: Bone
  leftForeArm: Bone
  rightForeArm: Bone
  head: Bone
}

interface RestPose {
  quats: Map<string, { x: number; y: number; z: number; w: number }>
  hipsY: number
}

/** Mixamo exports use `mixamorigHips` or `mixamorig:Hips`. */
function boneNameMatches(actual: string, wanted: string): boolean {
  if (actual === wanted) return true
  const norm = (s: string) => s.replace(/:/g, '').toLowerCase()
  return norm(actual) === norm(wanted)
}

function findBone(root: Object3D, name: string): Bone {
  let found: Bone | null = null
  root.traverse((obj) => {
    if (found || !('isBone' in obj) || !(obj as Bone).isBone) return
    if (boneNameMatches(obj.name, name)) found = obj as Bone
  })
  if (!found) throw new Error(`Lab human missing bone: ${name}`)
  return found
}

function captureRest(rig: BoneRig): RestPose {
  const bones: Bone[] = [
    rig.hips,
    rig.spine,
    rig.spine1,
    rig.leftUpLeg,
    rig.rightUpLeg,
    rig.leftLeg,
    rig.rightLeg,
    rig.leftArm,
    rig.rightArm,
    rig.leftForeArm,
    rig.rightForeArm,
    rig.head,
  ]
  const quats = new Map<string, { x: number; y: number; z: number; w: number }>()
  for (const bone of bones) {
    quats.set(bone.name, {
      x: bone.quaternion.x,
      y: bone.quaternion.y,
      z: bone.quaternion.z,
      w: bone.quaternion.w,
    })
  }
  return { quats, hipsY: rig.hips.position.y }
}

function restoreRest(rig: BoneRig, rest: RestPose) {
  const apply = (bone: Bone) => {
    const q = rest.quats.get(bone.name)
    if (!q) return
    bone.quaternion.set(q.x, q.y, q.z, q.w)
  }
  apply(rig.hips)
  apply(rig.spine)
  apply(rig.spine1)
  apply(rig.leftUpLeg)
  apply(rig.rightUpLeg)
  apply(rig.leftLeg)
  apply(rig.rightLeg)
  apply(rig.leftArm)
  apply(rig.rightArm)
  apply(rig.leftForeArm)
  apply(rig.rightForeArm)
  apply(rig.head)
  rig.hips.position.y = rest.hipsY
}

/**
 * Drop T-pose arms into a natural hang before capturing rest.
 * Mixamo arm local +Z ≈ world down once Character applies ±X 90°.
 */
function applyArmHangFromTPose(rig: BoneRig) {
  rig.leftArm.rotateZ(1.15)
  rig.rightArm.rotateZ(-1.15)
  rig.leftForeArm.rotateX(0.12)
  rig.rightForeArm.rotateX(0.12)
}

function sampleClipRest(
  clone: Group,
  rig: BoneRig,
  clipName: string | undefined,
  animations: { name: string; duration: number }[],
  findClip: (name: string) => AnimationClip | undefined,
): RestPose | null {
  if (!clipName) return null
  const clip = findClip(clipName)
  if (!clip) return null
  const meta = animations.find((item) => item.name === clipName)
  const mixer = new AnimationMixer(clone)
  const action: AnimationAction = mixer.clipAction(clip)
  action.setLoop(LoopOnce, 1)
  action.clampWhenFinished = true
  action.play()
  const t =
    clipName === 'Idle'
      ? Math.min(0.45, (meta?.duration ?? clip.duration) * 0.35)
      : 0
  mixer.setTime(t)
  if (clipName === 'TPose') applyArmHangFromTPose(rig)
  const rest = captureRest(rig)
  mixer.stopAllAction()
  mixer.uncacheRoot(clone)
  return rest
}

/**
 * Map LimbPose onto Mixamo local axes, additive on rest.
 * Character root is ±X 90° at scale 0.01 (Mixamo → Y-up).
 */
function applyPoseToMixamo(rig: BoneRig, rest: RestPose, pose: LimbPose) {
  restoreRest(rig, rest)

  // World bob: Character scale is 0.01, so ΔlocalY ≈ world * 100.
  rig.hips.position.y = rest.hipsY + pose.bob * 100

  rig.spine.rotateX(pose.torsoPitch * 0.85)
  rig.spine.rotateY(pose.torsoY * 0.7)
  rig.spine.rotateZ(pose.torsoRoll * 0.75)
  rig.spine1.rotateX(pose.torsoPitch * 0.35)
  rig.spine1.rotateY(pose.torsoY * 0.25)

  rig.leftUpLeg.rotateX(pose.leftHip)
  rig.leftUpLeg.rotateZ(pose.leftHipY * 0.8)
  rig.rightUpLeg.rotateX(pose.rightHip)
  rig.rightUpLeg.rotateZ(pose.rightHipY * 0.8)
  rig.leftLeg.rotateX(pose.leftKnee)
  rig.rightLeg.rotateX(pose.rightKnee)

  // Rest arms already hang; shoulder deltas swing in the sagittal plane.
  rig.leftArm.rotateY(pose.leftShoulder * 0.9)
  rig.leftArm.rotateX(pose.leftShoulderY * 0.7)
  rig.rightArm.rotateY(pose.rightShoulder * 0.9)
  rig.rightArm.rotateX(pose.rightShoulderY * 0.7)
  rig.leftForeArm.rotateX(pose.leftElbow * 0.95)
  rig.rightForeArm.rotateX(pose.rightElbow * 0.95)

  // Head leads intention under close-cam (lookout scan / tired drop / food seek).
  rig.head.rotateY(pose.torsoY * 0.25 + pose.headYaw)
  rig.head.rotateX(pose.torsoPitch * 0.15 + pose.headPitch)
}

interface LabHumanGltfProps {
  agentId: string
  alive: boolean
  energy: 0 | 1 | 2
  selected: boolean
}

/**
 * Skinned Mixamo human (textured face/skin/clothes) for Lab close-cam.
 * Same motion hooks as the biped rig; bones get rest + pose deltas.
 * Ecology never loads this asset.
 */
export function LabHumanGltf({ agentId, alive, energy, selected }: LabHumanGltfProps) {
  const { scene, animations } = useGLTF(LAB_HUMAN_URL)
  const rootRef = useRef<Group>(null)
  const phaseRef = useRef(0)
  const poseRef = useRef<LimbPose>({ ...IDLE_LIMB_POSE })
  const holdRef = useRef<HeldMotionClock>({ displayed: 'idle', holdLeft: 0 })
  const aimLatchRef = useRef<Vec2 | null>(null)
  const baseColorRef = useRef<Map<MeshStandardMaterial, Color>>(new Map())

  const clone = useMemo(() => cloneSkinned(scene) as Group, [scene])

  const rig = useMemo((): BoneRig => {
    return {
      hips: findBone(clone, 'mixamorigHips'),
      spine: findBone(clone, 'mixamorigSpine'),
      spine1: findBone(clone, 'mixamorigSpine1'),
      leftUpLeg: findBone(clone, 'mixamorigLeftUpLeg'),
      rightUpLeg: findBone(clone, 'mixamorigRightUpLeg'),
      leftLeg: findBone(clone, 'mixamorigLeftLeg'),
      rightLeg: findBone(clone, 'mixamorigRightLeg'),
      leftArm: findBone(clone, 'mixamorigLeftArm'),
      rightArm: findBone(clone, 'mixamorigRightArm'),
      leftForeArm: findBone(clone, 'mixamorigLeftForeArm'),
      rightForeArm: findBone(clone, 'mixamorigRightForeArm'),
      head: findBone(clone, 'mixamorigHead'),
    }
  }, [clone])

  const restRef = useRef<RestPose | null>(null)

  useLayoutEffect(() => {
    const baseColors = new Map<MeshStandardMaterial, Color>()
    clone.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const skinned = obj as SkinnedMesh
      if (skinned.isSkinnedMesh) skinned.frustumCulled = false
      // Clone materials so energy washes never mutate the useGLTF cache.
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => mat.clone())
        } else {
          mesh.material = mesh.material.clone()
        }
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const raw of materials) {
        const mat = raw as MeshStandardMaterial
        if (mat?.color) baseColors.set(mat, mat.color.clone())
      }
    })
    baseColorRef.current = baseColors

    // Prefer Idle; else TPose + arm hang so close-cam never freezes in T-pose.
    const byName = (name: string) => animations.find((clip) => clip.name === name)
    restRef.current =
      sampleClipRest(clone, rig, 'Idle', animations, byName) ??
      sampleClipRest(clone, rig, 'TPose', animations, byName) ??
      (() => {
        applyArmHangFromTPose(rig)
        return captureRest(rig)
      })()
    restoreRest(rig, restRef.current)
  }, [animations, clone, rig])

  useLayoutEffect(() => {
    const wash = energyEmissive(alive, energy)
    const washColor = new Color(wash.color)
    clone.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh || !mesh.material) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const raw of materials) {
        const mat = raw as MeshStandardMaterial
        if (!mat.color) continue
        const base = baseColorRef.current.get(mat)
        // Keep textured albedo (face/skin/clothes). Energy is emissive only.
        if (base) mat.color.copy(base)
        if (!alive) {
          mat.color.multiplyScalar(0.55)
          mat.metalness = Math.min(mat.metalness ?? 0.05, 0.08)
          mat.roughness = Math.max(mat.roughness ?? 0.7, 0.88)
          if (mat.emissive) mat.emissiveIntensity = 0
        } else if (mat.emissive) {
          mat.emissive.copy(washColor)
          mat.emissiveIntensity = wash.intensity
        }
        mat.needsUpdate = true
      }
    })
  }, [alive, clone, energy])

  useFrame((_, dt) => {
    const rest = restRef.current
    if (!rest) return
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
    applyPoseToMixamo(rig, rest, poseRef.current)
  })

  return (
    <group ref={rootRef} scale={0.9} position={[0, 0, 0]}>
      <primitive object={clone} />
      {selected ? (
        <mesh position={[0, 0.95, 0]} visible={false}>
          <capsuleGeometry args={[0.28, 1.1, 4, 8]} />
          <meshBasicMaterial transparent opacity={0} />
          <Outlines thickness={2.4} color="#5aa0d6" />
        </mesh>
      ) : null}
      {alive ? null : (
        <mesh position={[0, 1.85, 0]} rotation={[0, 0, Math.PI / 4]} raycast={() => null}>
          <boxGeometry args={[0.22, 0.035, 0.035]} />
          <meshBasicMaterial color="#c45c4a" />
        </mesh>
      )}
    </group>
  )
}

useGLTF.preload(LAB_HUMAN_URL)
