import { SPEED_OPTIONS } from '../../simulation/constants'
import { useSimulationStore } from '../../store/useSimulationStore'
import { formatSimulationTime, getSimulationTime } from '../../utils/time'

export function SimulationControls() {
  const status = useSimulationStore((state) => state.status)
  const tick = useSimulationStore((state) => state.tick)
  const speed = useSimulationStore((state) => state.speed)
  const play = useSimulationStore((state) => state.play)
  const pause = useSimulationStore((state) => state.pause)
  const reset = useSimulationStore((state) => state.reset)
  const setSpeed = useSimulationStore((state) => state.setSpeed)
  const learningEnabled = useSimulationStore((state) => state.learningEnabled)

  const isRunning = status === 'running'
  const simulationTime = formatSimulationTime(getSimulationTime(tick))

  return (
    <footer className="flex h-14 shrink-0 items-center justify-between gap-4 border-t border-lab-border bg-lab-panel px-4">
      <div className="flex items-center gap-2">
        <ControlButton onClick={play} active={isRunning} disabled={isRunning}>
          Play
        </ControlButton>
        <ControlButton onClick={pause} active={status === 'paused'} disabled={!isRunning}>
          Pause
        </ControlButton>
        <ControlButton onClick={reset}>Reset</ControlButton>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] tracking-[0.14em] text-lab-muted uppercase">
          Speed
        </span>
        {SPEED_OPTIONS.map((option) => (
          <ControlButton
            key={option}
            onClick={() => setSpeed(option)}
            active={speed === option}
          >
            {`${option}x`}
          </ControlButton>
        ))}
      </div>

      <div className="flex items-center gap-4 font-mono text-sm tabular-nums text-lab-text">
        <div>
          <span className="mr-2 text-[11px] tracking-[0.14em] text-lab-muted">
            TIME
          </span>
          {simulationTime}
        </div>
        <div className="hidden sm:block">
          <span className="mr-2 text-[11px] tracking-[0.14em] text-lab-muted">
            TICK
          </span>
          {tick.toString().padStart(6, '0')}
        </div>
        <div>
          <span className="mr-2 text-[11px] tracking-[0.14em] text-lab-muted">
            LEARN
          </span>
          <span className={learningEnabled ? 'text-lab-accent' : 'text-lab-danger'}>
            {learningEnabled ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>
    </footer>
  )
}

function ControlButton({
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  children: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-8 min-w-16 border px-3 text-[13px] transition-colors ${
        active
          ? 'border-lab-accent bg-lab-accent/15 text-lab-accent'
          : 'border-lab-border bg-lab-elevated text-lab-text hover:border-lab-accent/40'
      } disabled:cursor-default disabled:opacity-50`}
    >
      {children}
    </button>
  )
}
