import { Canvas } from '@react-three/fiber'
import { ACTION_COLORS, ACTION_LABELS, ACTION_MARKS } from '../../learning/constants'
import { AGENT_ACTIONS } from '../../learning/types'
import {
  DEFAULT_CAMERA_FOV,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  TERRAIN_COLORS,
  TERRAIN_LABELS,
} from '../../simulation/constants'
import { TERRAIN_TYPES } from '../../types/terrain'
import { useSimulationStore } from '../../store/useSimulationStore'
import { WorldInspectionPanel } from './WorldInspectionPanel'
import { WorldScene } from './WorldScene'

export function WorldViewer() {
  const selectObject = useSimulationStore((state) => state.selectObject)
  const showActionMarkers = useSimulationStore((state) => state.settings.showActionMarkers)

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

      {showActionMarkers ? (
        <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5 rounded border border-lab-border bg-lab-panel/90 px-2 py-1.5">
          {AGENT_ACTIONS.map((action) => (
            <span
              key={action}
              className="flex items-center gap-1 font-mono text-[10px] text-lab-text"
            >
              <span
                className="inline-flex h-4 w-4 items-center justify-center text-[10px] font-semibold"
                style={{ backgroundColor: ACTION_COLORS[action], color: '#0c1118' }}
              >
                {ACTION_MARKS[action]}
              </span>
              {ACTION_LABELS[action]}
            </span>
          ))}
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-12 left-3 flex flex-wrap gap-1.5 rounded border border-lab-border bg-lab-panel/90 px-2 py-1.5">
        {TERRAIN_TYPES.map((type) => (
          <span key={type} className="flex items-center gap-1 font-mono text-[10px] text-lab-text">
            <span className="inline-block h-2.5 w-2.5 border border-lab-border" style={{ backgroundColor: TERRAIN_COLORS[type] }} />
            {TERRAIN_LABELS[type]}
          </span>
        ))}
        <span className="flex items-center gap-1 font-mono text-[10px] text-lab-text">
          <span className="inline-block h-2.5 w-2.5 border border-lab-border" style={{ backgroundColor: '#c43b4a' }} />
          Berry
        </span>
        <span className="flex items-center gap-1 font-mono text-[10px] text-lab-text">
          <span className="inline-block h-2.5 w-2.5 border border-lab-border" style={{ backgroundColor: '#8a6a48' }} />
          Root
        </span>
        <span className="flex items-center gap-1 font-mono text-[10px] text-lab-text">
          <span className="inline-block h-2.5 w-2.5 border border-lab-border" style={{ backgroundColor: '#b8864a' }} />
          Tool
        </span>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-lab-border bg-lab-panel px-2.5 py-1 text-[11px] tracking-wide text-lab-muted">
        드래그: 회전 · 휠: 확대/축소 · 선택 시 추적
      </div>

      <WorldInspectionPanel />
    </div>
  )
}
