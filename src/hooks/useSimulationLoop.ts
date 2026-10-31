import { useEffect } from 'react'
import { FRAME_STEP_BUDGET_MS, getMaxStepsPerFrame, SIMULATION_STEP_DT } from '../simulation/constants'
import { useSimulationStore } from '../store/useSimulationStore'

export function useSimulationLoop() {
  const status = useSimulationStore((state) => state.status)
  const speed = useSimulationStore((state) => state.speed)
  const hydrated = useSimulationStore((state) => state.hydrated)

  useEffect(() => {
    if (!hydrated || status !== 'running') {
      return
    }

    let frameId = 0
    let previous = performance.now()
    let accumulator = 0
    const maxStepsPerFrame = getMaxStepsPerFrame(speed)

    const loop = (now: number) => {
      const elapsed = Math.min((now - previous) / 1000, 0.25)
      previous = now
      accumulator += elapsed * speed

      const requested = Math.min(Math.floor(accumulator / SIMULATION_STEP_DT), maxStepsPerFrame)
      if (requested > 0) {
        const started = performance.now()
        useSimulationStore.getState().advance(requested, FRAME_STEP_BUDGET_MS)
        accumulator -= requested * SIMULATION_STEP_DT
        if (requested === maxStepsPerFrame || performance.now() - started >= FRAME_STEP_BUDGET_MS) {
          accumulator = 0
        }
      }

      frameId = window.requestAnimationFrame(loop)
    }

    frameId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frameId)
  }, [hydrated, status, speed])
}
