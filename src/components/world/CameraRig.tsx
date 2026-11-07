import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  CAMERA_MAX_POLAR,
  CAMERA_MIN_DISTANCE,
  CAMERA_MIN_POLAR,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  DEFAULT_WORLD_CONFIG,
  LAB_CAMERA_MIN_DISTANCE,
  LAB_CAMERA_POSITION,
  LAB_FOLLOW_HEIGHT,
} from '../../simulation/constants'
import { isHumanBehaviorLab } from '../../simulation/labMode'
import { clamp } from '../../utils/math'
import { useSimulationStore } from '../../store/useSimulationStore'

const FOLLOW_HEIGHT = 0.45
const FOLLOW_LERP = 6

function labSubjectId(): string | null {
  const state = useSimulationStore.getState()
  if (!isHumanBehaviorLab(state.world.config.mode)) return null
  const selected = state.selectedObjectId
    ? state.world.agents.find((a) => a.id === state.selectedObjectId && a.alive)
    : null
  if (selected) return selected.id
  return state.world.agents.find((a) => a.alive)?.id ?? state.world.agents[0]?.id ?? null
}

function followTargetForSelection(): [number, number, number] {
  const state = useSimulationStore.getState()
  const lab = isHumanBehaviorLab(state.world.config.mode)
  const subjectId = lab
    ? labSubjectId()
    : state.settings.followSelectedAgent
      ? state.selectedObjectId
      : null
  if (!subjectId) return [...DEFAULT_CAMERA_TARGET]
  if (!lab && !state.settings.followSelectedAgent) return [...DEFAULT_CAMERA_TARGET]

  const agent = state.world.agents.find((item) => item.id === subjectId)
  if (!agent?.alive && !lab) return [...DEFAULT_CAMERA_TARGET]
  if (!agent) return [...DEFAULT_CAMERA_TARGET]
  const height = lab ? LAB_FOLLOW_HEIGHT : FOLLOW_HEIGHT
  return [agent.position.x, height, agent.position.z]
}

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const camera = useThree((state) => state.camera)
  const cameraResetToken = useSimulationStore((state) => state.cameraResetToken)
  const worldSize = useSimulationStore((state) => state.world.config.size)
  const labMode = useSimulationStore((state) => isHumanBehaviorLab(state.world.config.mode))
  const scale = worldSize / DEFAULT_WORLD_CONFIG.size
  const maxDistance = labMode ? clamp(6.5 * scale, 4, 10) : clamp(90 * scale, 40, 160)
  const minDistance = labMode ? LAB_CAMERA_MIN_DISTANCE : CAMERA_MIN_DISTANCE
  const camPos = labMode ? LAB_CAMERA_POSITION : DEFAULT_CAMERA_POSITION
  const desiredTarget = useRef(new Vector3())
  const cameraOffset = useRef(new Vector3())

  useLayoutEffect(() => {
    const target = followTargetForSelection()
    camera.position.set(
      target[0] + camPos[0] * (labMode ? 1 : scale),
      camPos[1] * (labMode ? 1 : scale),
      target[2] + camPos[2] * (labMode ? 1 : scale),
    )
    camera.lookAt(...target)
    if (controlsRef.current) {
      controlsRef.current.target.set(...target)
      controlsRef.current.update()
    }
  }, [camera, cameraResetToken, scale, labMode, camPos])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return

    const state = useSimulationStore.getState()
    const lab = isHumanBehaviorLab(state.world.config.mode)
    const subjectId = lab
      ? labSubjectId()
      : state.settings.followSelectedAgent
        ? state.selectedObjectId
        : null
    if (!subjectId) return
    if (!lab && !state.settings.followSelectedAgent) return

    const agent = state.world.agents.find((item) => item.id === subjectId)
    if (!agent?.alive && !lab) return
    if (!agent) return

    const height = lab ? LAB_FOLLOW_HEIGHT : FOLLOW_HEIGHT
    desiredTarget.current.set(agent.position.x, height, agent.position.z)
    cameraOffset.current.copy(camera.position).sub(controls.target)

    // Keep Lab framing close: shrink oversized orbit distance toward lab default.
    if (lab) {
      const dist = cameraOffset.current.length()
      const ideal = Math.hypot(LAB_CAMERA_POSITION[0], LAB_CAMERA_POSITION[1], LAB_CAMERA_POSITION[2])
      if (dist > ideal * 1.35) {
        cameraOffset.current.multiplyScalar(ideal / dist)
      }
    }

    const alpha = 1 - Math.exp(-FOLLOW_LERP * Math.min(delta, 0.1))
    controls.target.lerp(desiredTarget.current, alpha)
    camera.position.copy(controls.target).add(cameraOffset.current)
    controls.update()
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan
      enableRotate
      enableZoom
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={labMode ? 0.48 : CAMERA_MIN_POLAR}
      maxPolarAngle={labMode ? 1.32 : CAMERA_MAX_POLAR}
      target={[...DEFAULT_CAMERA_TARGET]}
    />
  )
}
