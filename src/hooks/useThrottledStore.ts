import { useEffect, useRef, useState } from 'react'
import { useSimulationStore } from '../store/useSimulationStore'
import type { SimulationActions, SimulationState } from '../types/simulation'

type Store = SimulationState & SimulationActions

export function useThrottledStore<T>(
  selector: (state: Store) => T,
  intervalMs = 150,
  flushKey?: unknown,
): T {
  const selectorRef = useRef(selector)
  selectorRef.current = selector
  const [value, setValue] = useState(() => selector(useSimulationStore.getState()))

  useEffect(() => {
    setValue(selectorRef.current(useSimulationStore.getState()))
  }, [flushKey])

  useEffect(() => {
    let last = 0
    let raf = 0
    let cancelled = false

    const loop = (now: number) => {
      if (cancelled) return
      if (now - last >= intervalMs) {
        last = now
        const next = selectorRef.current(useSimulationStore.getState())
        setValue((previous) => (Object.is(previous, next) ? previous : next))
      }
      raf = window.requestAnimationFrame(loop)
    }

    raf = window.requestAnimationFrame(loop)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
    }
  }, [intervalMs])

  return value
}
