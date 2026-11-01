import { useSimulationStore } from '../../store/useSimulationStore'
import { SIMULATION_STATUS_LABEL } from '../../utils/status'

export function Header() {
  const status = useSimulationStore((state) => state.status)
  const learningEnabled = useSimulationStore((state) => state.learningEnabled)
  const geneticsEnabled = useSimulationStore((state) => state.evolutionConfig.geneticsEnabled)
  const experiment = useSimulationStore((state) => state.experiment)

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-lab-border bg-lab-panel px-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="text-sm font-semibold tracking-[0.08em] text-lab-text uppercase">
          Artificial Life Simulator
        </h1>
        <span className="hidden truncate text-[11px] text-lab-muted sm:inline">
          {experiment.name}
          {experiment.dirty ? ' · unsaved' : ''}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[12px]">
        <span
          className={`h-2 w-2 rounded-full ${
            status === 'running'
              ? 'bg-lab-accent'
              : status === 'ended'
                ? 'bg-lab-danger'
                : 'bg-lab-muted'
          }`}
        />
        <span
          className={`font-mono tracking-wide uppercase ${
            status === 'ended' ? 'text-lab-danger' : 'text-lab-muted'
          }`}
        >
          {SIMULATION_STATUS_LABEL[status]}
        </span>
        <span className="font-mono tracking-wide text-lab-muted uppercase">
          · {learningEnabled ? 'Learning On' : 'Learning Off'}
        </span>
        <span className="font-mono tracking-wide text-lab-muted uppercase">
          · {geneticsEnabled ? 'Genetics On' : 'Genetics Off'}
        </span>
      </div>
    </header>
  )
}
