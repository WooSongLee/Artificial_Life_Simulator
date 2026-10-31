import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
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

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const camera = useThree((state) => state.camera)
  const cameraResetToken = useSimulationStore((state) => state.cameraResetToken)
  const worldSize = useSimulationStore((state) => state.world.config.size)
  const scale = worldSize / DEFAULT_WORLD_CONFIG.size
  const maxDistance = clamp(90 * scale, 40, 160)

  useLayoutEffect(() => {
    camera.position.set(
      DEFAULT_CAMERA_POSITION[0] * scale,
      DEFAULT_CAMERA_POSITION[1] * scale,
      DEFAULT_CAMERA_POSITION[2] * scale,
    )
    camera.lookAt(...DEFAULT_CAMERA_TARGET)
    if (controlsRef.current) {
      controlsRef.current.target.set(...DEFAULT_CAMERA_TARGET)
      controlsRef.current.update()
    }
  }, [camera, cameraResetToken, scale])

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
