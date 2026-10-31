import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  CAMERA_MAX_DISTANCE,
  CAMERA_MAX_POLAR,
  CAMERA_MIN_DISTANCE,
  CAMERA_MIN_POLAR,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from '../../simulation/constants'
import { useSimulationStore } from '../../store/useSimulationStore'

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const camera = useThree((state) => state.camera)
  const cameraResetToken = useSimulationStore((state) => state.cameraResetToken)

  useLayoutEffect(() => {
    camera.position.set(...DEFAULT_CAMERA_POSITION)
    camera.lookAt(...DEFAULT_CAMERA_TARGET)
    if (controlsRef.current) {
      controlsRef.current.target.set(...DEFAULT_CAMERA_TARGET)
      controlsRef.current.update()
    }
  }, [camera, cameraResetToken])

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
      maxDistance={CAMERA_MAX_DISTANCE}
      minPolarAngle={CAMERA_MIN_POLAR}
      maxPolarAngle={CAMERA_MAX_POLAR}
      target={[...DEFAULT_CAMERA_TARGET]}
    />
  )
}
