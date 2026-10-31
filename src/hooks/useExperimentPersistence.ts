import { useEffect, useState } from 'react'
import { captureExperimentRecord } from '../experiments/snapshot'
import { loadSession, saveSession, SESSION_AUTOSAVE_MS } from '../experiments'
import { useSimulationStore } from '../store/useSimulationStore'

function captureCurrentRecord() {
  const state = useSimulationStore.getState()
  return captureExperimentRecord({
    identity: state.experiment,
    simulation: state,
  })
}

export function useExperimentPersistence() {
  const hydrated = useSimulationStore((state) => state.hydrated)
  const status = useSimulationStore((state) => state.status)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadSession()
      .then((record) => {
        if (cancelled) return
        if (record) {
          useSimulationStore.getState().loadExperimentRecord(record)
        } else {
          useSimulationStore.getState().markHydrated()
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('이전 세션을 복원하지 못했다. 새 실험으로 시작한다.')
          useSimulationStore.getState().markHydrated()
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return

    const persist = () => {
      void saveSession(captureCurrentRecord())
    }

    const unsubscribe = useSimulationStore.subscribe((state, previous) => {
      const statusChanged =
        state.status !== previous.status && (state.status === 'paused' || state.status === 'ended')
      const experimentCommitted =
        state.experiment.id !== previous.experiment.id ||
        (!state.experiment.dirty && previous.experiment.dirty)
      const worldChanged = state.world.config !== previous.world.config

      if (statusChanged || experimentCommitted || worldChanged) {
        persist()
      }
    })

    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        persist()
      }
    }

    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', persist)

    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', persist)
    }
  }, [hydrated])

  useEffect(() => {
    if (!hydrated || status !== 'running') return
    const timer = window.setInterval(() => {
      void saveSession(captureCurrentRecord())
    }, SESSION_AUTOSAVE_MS)
    return () => window.clearInterval(timer)
  }, [hydrated, status])

  return { hydrated, error, dismissError: () => setError(null) }
}
