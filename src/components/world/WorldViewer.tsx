import { Canvas } from '@react-three/fiber'
import {
  DEFAULT_CAMERA_FOV,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from '../../simulation/constants'
import { useSimulationStore } from '../../store/useSimulationStore'
import { WorldScene } from './WorldScene'

export function WorldViewer() {
  const selectObject = useSimulationStore((state) => state.selectObject)

  return (
    <div className="relative h-full w-full bg-[#152018]">
      <Canvas
        shadows="percentage"
        camera={{
          position: [...DEFAULT_CAMERA_POSITION],
          fov: DEFAULT_CAMERA_FOV,
          near: 0.1,
          far: 220,
        }}
        onCreated={({ camera }) => {
          camera.lookAt(...DEFAULT_CAMERA_TARGET)
        }}
        onPointerMissed={() => selectObject(null)}
      >
        <WorldScene />
      </Canvas>

      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-lab-border bg-lab-panel px-2.5 py-1 text-[11px] tracking-wide text-lab-muted">
        드래그: 회전 · 휠: 확대/축소
      </div>
    </div>
  )
}
