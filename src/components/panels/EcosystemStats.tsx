import { useLearningStats } from '../../hooks/useLearningStats'
import { useWorldStats } from '../../hooks/useWorldStats'
import { formatSimulationTime } from '../../utils/time'
import { StatCard } from '../ui/StatCard'

const STATUS_LABEL = {
  idle: '대기',
  running: '실행 중',
  paused: '일시정지',
} as const

export function EcosystemStats() {
  const stats = useWorldStats()
  const learning = useLearningStats()

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-[11px] text-lab-muted">시뮬레이션</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatCard label="상태" value={STATUS_LABEL[stats.status]} tone="cyan" />
          <StatCard label="시간" value={formatSimulationTime(stats.simulationTime)} />
          <StatCard label="속도" value={`${stats.speed}x`} tone="cyan" />
          <StatCard label="틱" value={stats.tick.toString().padStart(5, '0')} />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">생태계 통계</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
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
        <h2 className="text-[11px] text-lab-muted">학습 통계</h2>
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          {learning.learningEnabled
            ? `최근 ${learning.totalLearningSteps === 0 ? 0 : Math.min(80, learning.totalLearningSteps)} step window. Average Q는 방문한 상태-행동 값의 평균이다.`
            : '학습이 꺼져 있어 Q-Table과 학습 지표가 고정되어 있다.'}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatCard label="Learning Steps" value={learning.totalLearningSteps} tone="cyan" />
          <StatCard label="Current Epsilon" value={learning.currentEpsilon.toFixed(3)} />
          <StatCard label="Average Reward" value={learning.averageReward.toFixed(2)} tone="amber" />
          <StatCard label="Average Q" value={learning.averageQValue.toFixed(3)} />
          <StatCard
            label="Exploration Rate"
            value={`${(learning.explorationRate * 100).toFixed(1)}%`}
            tone="cyan"
          />
          <StatCard
            label="Learning"
            value={learning.learningEnabled ? 'On' : 'Off'}
            tone={learning.learningEnabled ? 'green' : 'rose'}
          />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">월드 오브젝트</h2>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <StatCard label="나무" value={stats.treeCount} tone="green" />
          <StatCard label="바위" value={stats.rockCount} tone="stone" />
          <StatCard label="먹이" value={stats.foodCount} tone="amber" />
        </div>
      </section>
    </div>
  )
}
