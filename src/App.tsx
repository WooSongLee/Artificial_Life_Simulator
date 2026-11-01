import { SimulatorLayout } from './components/layout/SimulatorLayout'
import { StatusOverlay } from './components/ui/StatusOverlay'
import { useExperimentPersistence } from './hooks/useExperimentPersistence'
import { useSimulationLoop } from './hooks/useSimulationLoop'
import { useSimulationStore } from './store/useSimulationStore'

export default function App() {
  const persist = useExperimentPersistence()
  const migrationNotice = useSimulationStore((state) => state.migrationNotice)
  const dismissMigrationNotice = useSimulationStore((state) => state.dismissMigrationNotice)
  useSimulationLoop()

  return (
    <div className="relative h-full w-full">
      <SimulatorLayout />
      {persist.hydrated && migrationNotice ? (
        <div className="pointer-events-none absolute inset-x-0 top-12 z-20 flex justify-center px-4">
          <div className="pointer-events-auto max-w-xl border border-lab-warn bg-lab-panel px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
            <p className="text-[11px] tracking-[0.14em] text-lab-warn uppercase">Migration</p>
            <p className="mt-1 text-[13px] leading-5 text-lab-text">{migrationNotice}</p>
            <button
              type="button"
              onClick={dismissMigrationNotice}
              className="mt-2 border border-lab-border bg-lab-elevated px-2.5 py-1 text-[12px] text-lab-text hover:border-lab-accent/50"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
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
