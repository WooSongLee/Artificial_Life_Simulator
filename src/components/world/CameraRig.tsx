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
} from '../../simulation/constants'
import { clamp } from '../../utils/math'
import { useSimulationStore } from '../../store/useSimulationStore'

const FOLLOW_HEIGHT = 0.45
const FOLLOW_LERP = 6

function followTargetForSelection(): [number, number, number] {
  const state = useSimulationStore.getState()
  if (!state.settings.followSelectedAgent || !state.selectedObjectId) {
    return [...DEFAULT_CAMERA_TARGET]
  }
  const agent = state.world.agents.find((item) => item.id === state.selectedObjectId)
  if (!agent?.alive) return [...DEFAULT_CAMERA_TARGET]
  return [agent.position.x, FOLLOW_HEIGHT, agent.position.z]
}

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const camera = useThree((state) => state.camera)
  const cameraResetToken = useSimulationStore((state) => state.cameraResetToken)
  const worldSize = useSimulationStore((state) => state.world.config.size)
  const scale = worldSize / DEFAULT_WORLD_CONFIG.size
  const maxDistance = clamp(90 * scale, 40, 160)
  const desiredTarget = useRef(new Vector3())
  const cameraOffset = useRef(new Vector3())

  useLayoutEffect(() => {
    const target = followTargetForSelection()
    camera.position.set(
      target[0] + DEFAULT_CAMERA_POSITION[0] * scale,
      DEFAULT_CAMERA_POSITION[1] * scale,
      target[2] + DEFAULT_CAMERA_POSITION[2] * scale,
    )
    camera.lookAt(...target)
    if (controlsRef.current) {
      controlsRef.current.target.set(...target)
      controlsRef.current.update()
    }
  }, [camera, cameraResetToken, scale])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return

    const state = useSimulationStore.getState()
    if (!state.settings.followSelectedAgent || !state.selectedObjectId) return

    const agent = state.world.agents.find((item) => item.id === state.selectedObjectId)
    if (!agent?.alive) return

    desiredTarget.current.set(agent.position.x, FOLLOW_HEIGHT, agent.position.z)
    cameraOffset.current.copy(camera.position).sub(controls.target)
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
      minDistance={CAMERA_MIN_DISTANCE}
      maxDistance={maxDistance}
      minPolarAngle={CAMERA_MIN_POLAR}
      maxPolarAngle={CAMERA_MAX_POLAR}
      target={[...DEFAULT_CAMERA_TARGET]}
    />
  )
}
