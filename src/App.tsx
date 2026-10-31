import { SimulatorLayout } from './components/layout/SimulatorLayout'
import { StatusOverlay } from './components/ui/StatusOverlay'
import { useExperimentPersistence } from './hooks/useExperimentPersistence'
import { useSimulationLoop } from './hooks/useSimulationLoop'

export default function App() {
  const persist = useExperimentPersistence()
  useSimulationLoop()

  return (
    <div className="relative h-full w-full">
      <SimulatorLayout />
      {!persist.hydrated ? (
        <StatusOverlay title="Loading">세션을 복원하는 중이다.</StatusOverlay>
      ) : persist.error ? (
        <StatusOverlay
          title="Session"
          action={
            <button
              type="button"
              onClick={persist.dismissError}
              className="h-9 min-w-24 border border-lab-border bg-lab-elevated px-3 text-[13px] text-lab-text hover:border-lab-accent/50"
            >
              Continue
            </button>
          }
        >
          {persist.error}
        </StatusOverlay>
      ) : null}
    </div>
  )
}
