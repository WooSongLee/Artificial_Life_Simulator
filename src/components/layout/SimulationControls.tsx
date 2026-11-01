import { MAX_SPEED, MIN_SPEED, SPEED_PRESETS } from '../../simulation/constants'
import { useSimulationStore } from '../../store/useSimulationStore'
import { formatSpeed, sliderToSpeed, speedToSlider } from '../../utils/format'
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
  const geneticsEnabled = useSimulationStore((state) => state.evolutionConfig.geneticsEnabled)
  const generation = useSimulationStore((state) => state.world.generation)
  const hydrated = useSimulationStore((state) => state.hydrated)

  const isRunning = status === 'running'
  const isEnded = status === 'ended'
  const controlsLocked = !hydrated
  const simulationTime = formatSimulationTime(getSimulationTime(tick))

  return (
    <footer className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-t border-lab-border bg-lab-panel px-4 py-2">
      <div className="flex items-center gap-2">
        <ControlButton onClick={play} active={isRunning} disabled={controlsLocked || isRunning || isEnded}>
          Play
        </ControlButton>
        <ControlButton onClick={pause} active={status === 'paused'} disabled={controlsLocked || !isRunning}>
          Pause
        </ControlButton>
        <ControlButton onClick={reset} disabled={controlsLocked}>
          Reset
        </ControlButton>
      </div>

      <div className="flex min-w-[16rem] flex-1 items-center gap-3 sm:max-w-xl">
        <span className="text-[11px] tracking-[0.14em] text-lab-muted uppercase">
          Speed
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={speedToSlider(speed, MIN_SPEED, MAX_SPEED)}
          onChange={(event) => setSpeed(sliderToSpeed(Number(event.target.value), MIN_SPEED, MAX_SPEED))}
          disabled={controlsLocked}
          title="1x부터 1억 배까지 로그 스케일. 고속은 프레임 시간 예산 안에서만 진행한다."
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-lab-border accent-lab-accent disabled:opacity-50"
          aria-label="Simulation speed"
        />
        <span className="w-16 text-right font-mono text-sm tabular-nums text-lab-accent">
          {formatSpeed(speed)}
        </span>
        <div className="hidden gap-1 lg:flex">
          {SPEED_PRESETS.filter((preset) => preset === 1 || preset === 1000 || preset === MAX_SPEED).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setSpeed(preset)}
              className={`h-7 border px-1.5 font-mono text-[10px] ${
                speed === preset
                  ? 'border-lab-accent bg-lab-accent/15 text-lab-accent'
                  : 'border-lab-border bg-lab-elevated text-lab-muted hover:border-lab-accent/40'
              }`}
            >
              {formatSpeed(preset)}
            </button>
          ))}
        </div>
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
            GEN
          </span>
          {generation}
        </div>
        <div>
          <span className="mr-2 text-[11px] tracking-[0.14em] text-lab-muted">
            LEARN
          </span>
          <span className={learningEnabled ? 'text-lab-accent' : 'text-lab-danger'}>
            {learningEnabled ? 'ON' : 'OFF'}
          </span>
        </div>
        <div>
          <span className="mr-2 text-[11px] tracking-[0.14em] text-lab-muted">
            GENE
          </span>
          <span className={geneticsEnabled ? 'text-lab-accent' : 'text-lab-muted'}>
            {geneticsEnabled ? 'ON' : 'OFF'}
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
      className={`h-8 min-w-12 border px-2.5 text-[13px] transition-colors ${
        active
          ? 'border-lab-accent bg-lab-accent/15 text-lab-accent'
          : 'border-lab-border bg-lab-elevated text-lab-text hover:border-lab-accent/40'
      } disabled:cursor-default disabled:opacity-50`}
    >
      {children}
    </button>
  )
}
