import { useEffect } from 'react'
import { SIMULATION_STEP_DT } from '../simulation/constants'
import { useSimulationStore } from '../store/useSimulationStore'

const MAX_STEPS_PER_FRAME = 8

export function useSimulationLoop() {
  const status = useSimulationStore((state) => state.status)
  const speed = useSimulationStore((state) => state.speed)

  useEffect(() => {
    if (status !== 'running') {
      return
    }

    let frameId = 0
    let previous = performance.now()
    let accumulator = 0

    const loop = (now: number) => {
      const elapsed = Math.min((now - previous) / 1000, 0.25)
      previous = now
      accumulator += elapsed * speed

      let steps = 0
      while (accumulator >= SIMULATION_STEP_DT && steps < MAX_STEPS_PER_FRAME) {
        useSimulationStore.getState().step(SIMULATION_STEP_DT)
        accumulator -= SIMULATION_STEP_DT
        steps += 1
      }

      if (steps === MAX_STEPS_PER_FRAME) {
        accumulator = 0
      }

      frameId = window.requestAnimationFrame(loop)
    }

    frameId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frameId)
  }, [status, speed])
}
