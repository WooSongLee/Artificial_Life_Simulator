import { useWorldStats } from '../../hooks/useWorldStats'
import { formatSpeed } from '../../utils/format'
import { SIMULATION_STATUS_LABEL } from '../../utils/status'
import { formatSimulationTime } from '../../utils/time'
import { StatCard } from '../ui/StatCard'

export function EcosystemStats() {
  const stats = useWorldStats()

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-[11px] text-lab-muted">시뮬레이션</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatCard
            label="상태"
            value={SIMULATION_STATUS_LABEL[stats.status]}
            tone={stats.status === 'ended' ? 'rose' : 'cyan'}
          />
          <StatCard label="시간" value={formatSimulationTime(stats.simulationTime)} />
          <StatCard label="속도" value={formatSpeed(stats.speed)} tone="cyan" />
          <StatCard label="틱" value={stats.tick.toString().padStart(5, '0')} />
          <StatCard label="세대" value={stats.generation} tone="cyan" />
          <StatCard label="출생" value={stats.birthCount} />
          <StatCard label="교배 쌍" value={stats.matingCount} />
          <StatCard label="평균 성욕" value={`${Math.round(stats.averageDesire)}`} />
          <StatCard
            label="현 세대 경과"
            value={formatSimulationTime(stats.generationElapsed)}
          />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">생태계 통계</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          <StatCard label="전체 개체" value={stats.totalAgents} />
          <StatCard label="생존 개체" value={stats.aliveCount} tone="green" />
          <StatCard label="사망 개체" value={stats.deadCount} tone="rose" />
          <StatCard label="평균 에너지" value={Math.round(stats.averageEnergy)} tone="amber" />
          <StatCard label="평균 체력" value={Math.round(stats.averageHealth)} tone="cyan" />
          <StatCard
            label="평균 수명"
            value={stats.deadCount === 0 ? '—' : `${stats.averageLifespan.toFixed(1)}s`}
          />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">월드 오브젝트</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatCard label="나무" value={stats.treeCount} tone="green" />
          <StatCard label="바위" value={stats.rockCount} tone="stone" />
          <StatCard label="먹이" value={stats.foodCount} tone="amber" />
        </div>
      </section>
    </div>
  )
}
