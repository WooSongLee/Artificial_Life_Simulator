import { useSimulationStore } from '../../store/useSimulationStore'
import { formatSimulationTime, getSimulationTime } from '../../utils/time'

export function SimulationEndedOverlay() {
  const status = useSimulationStore((state) => state.status)
  const tick = useSimulationStore((state) => state.tick)
  const deadCount = useSimulationStore(
    (state) => state.world.agents.filter((agent) => !agent.alive).length,
  )
  const generation = useSimulationStore((state) => state.world.generation)
  const completedGenerations = useSimulationStore((state) => state.generationHistory.length)
  const reset = useSimulationStore((state) => state.reset)

  if (status !== 'ended') {
    return null
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-lab-bg/72 px-6">
      <div className="w-full max-w-sm border border-lab-border bg-lab-panel px-6 py-5 text-center shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <p className="text-[11px] tracking-[0.16em] text-lab-danger uppercase">Simulation Ended</p>
        <h2 className="mt-2 text-lg text-lab-text">모든 개체가 사망했습니다</h2>
        <p className="mt-2 text-[13px] leading-6 text-lab-muted">
          생존 개체가 없어 다음 세대를 만들 수 없습니다.
          <br />
          세대 {generation} · 기록 {completedGenerations} · {deadCount}개체
          <br />
          {formatSimulationTime(getSimulationTime(tick))} · 틱 {tick}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 h-9 min-w-28 border border-lab-accent bg-lab-accent/15 px-4 text-[13px] text-lab-accent transition-colors hover:bg-lab-accent/25"
        >
          다시 시작
        </button>
      </div>
    </div>
  )
}
