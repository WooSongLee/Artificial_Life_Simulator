import { ACTION_LABELS } from '../../learning/constants'
import { AGENT_ACTIONS } from '../../learning/types'
import { useLearningHistory } from '../../hooks/useLearningHistory'
import { useLearningStats } from '../../hooks/useLearningStats'
import { useWorldStats } from '../../hooks/useWorldStats'
import {
  LEARNING_COMPARISON_WINDOW,
  LEARNING_HISTORY_MAX_POINTS,
  LEARNING_HISTORY_SAMPLE_TICKS,
  SIMULATION_STEP_DT,
} from '../../simulation/constants'
import { useSimulationStore } from '../../store/useSimulationStore'
import type { LearningHistoryPoint } from '../../types/simulation'
import { formatSigned } from '../../utils/format'
import { formatSimulationTime } from '../../utils/time'
import { LineChart } from '../charts/LineChart'
import { EmptyState } from '../ui/EmptyState'
import { StatCard } from '../ui/StatCard'
import type { ComparisonWindow } from '../../simulation/metrics'

const SAMPLE_SECONDS = LEARNING_HISTORY_SAMPLE_TICKS * SIMULATION_STEP_DT
const COMPARISON_SECONDS = LEARNING_COMPARISON_WINDOW * SAMPLE_SECONDS

export function LearningDashboard() {
  const stats = useWorldStats()
  const learning = useLearningStats()
  const learningConfig = useSimulationStore((state) => state.learningConfig)
  const { history, comparison } = useLearningHistory()
  const totalActions = AGENT_ACTIONS.reduce((sum, action) => sum + learning.actionCounts[action], 0)

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-[11px] text-lab-muted">Learning Dashboard</h2>
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          카드는 현재 집계값이다. 차트는 {SAMPLE_SECONDS.toFixed(0)}초마다 기록하고 최근{' '}
          {LEARNING_HISTORY_MAX_POINTS}개만 유지한다.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          <StatCard label="Total Learning Steps" value={learning.totalLearningSteps} tone="cyan" />
          <StatCard
            label="Average Reward"
            value={learning.hasLearningSamples ? learning.averageReward.toFixed(2) : '—'}
            tone="amber"
          />
          <StatCard
            label="Average Survival Time"
            value={stats.deadCount === 0 ? '—' : `${stats.averageLifespan.toFixed(1)}s`}
          />
          <StatCard
            label="Average Energy"
            value={stats.aliveCount === 0 ? '—' : Math.round(stats.averageEnergy)}
            tone="amber"
          />
          <StatCard
            label="Exploration Rate"
            value={
              learning.hasLearningSamples ? `${(learning.explorationRate * 100).toFixed(1)}%` : '—'
            }
            tone="cyan"
          />
          <StatCard
            label="Population Size"
            value={`${stats.aliveCount}/${stats.totalAgents}`}
            tone="green"
          />
        </div>
        <p className="mt-2 text-[12px] leading-5 text-lab-muted">
          Average Reward와 Exploration Rate는 최근 80개 학습 행동의 평균이다. Average Survival Time은
          사망 개체의 평균 수명이다.
        </p>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Learning Charts</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ChartBlock
            title="Average Reward"
            points={history.series
              .filter((point) => point.hasLearningSamples)
              .map((point) => ({ x: point.time, y: point.averageReward }))}
            color="#c9a227"
            emptyLabel="학습 보상이 아직 기록되지 않았다."
            yFormat={(value) => value.toFixed(2)}
          />
          <ChartBlock
            title="Survival Time"
            points={history.series
              .filter((point) => point.hasSurvivalSamples)
              .map((point) => ({ x: point.time, y: point.averageSurvivalTime }))}
            color="#c45c4a"
            emptyLabel="사망 개체가 없어 수명 데이터가 없다."
            yFormat={(value) => `${value.toFixed(0)}s`}
          />
          <ChartBlock
            title="Average Energy"
            points={toEnergyPoints(history.series)}
            color="#3d9b7a"
            emptyLabel="생존 개체가 없어 에너지 데이터가 없다."
            yFormat={(value) => value.toFixed(0)}
          />
          <ChartBlock
            title="Learning Steps"
            points={history.series.map((point) => ({ x: point.time, y: point.learningSteps }))}
            color="#5aa0d6"
            emptyLabel="학습 이력이 아직 없다."
            yFormat={(value) => value.toFixed(0)}
          />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Action Distribution</h2>
        <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3">
          {totalActions === 0 ? (
            <p className="text-[12px] leading-5 text-lab-muted">학습 중 선택된 행동이 아직 없다.</p>
          ) : (
            AGENT_ACTIONS.map((action) => (
              <DistributionRow
                key={action}
                label={`${ACTION_LABELS[action]}`}
                count={learning.actionCounts[action]}
                total={totalActions}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Learning Comparison</h2>
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          첫 {COMPARISON_SECONDS.toFixed(0)}초와 최근 {COMPARISON_SECONDS.toFixed(0)}초의 기록 평균이다.
          겹치지 않는 구간이 쌓이기 전에는 비교하지 않는다. 향상을 가정하지 않는다.
        </p>
        <div className="mt-3">
          {comparison ? (
            <ComparisonTable early={comparison.early} current={comparison.current} />
          ) : (
            <EmptyState>
              {`초기와 현재를 나누려면 최소 ${(COMPARISON_SECONDS * 2).toFixed(0)}초의 기록이 필요하다.`}
            </EmptyState>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Learning Parameters</h2>
        <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
          <InfoRow label="Config Learning Rate" value={learningConfig.learningRate.toFixed(2)} />
          <InfoRow label="Discount" value={learningConfig.discountFactor.toFixed(2)} />
          <InfoRow label="Initial Epsilon" value={learningConfig.initialEpsilon.toFixed(2)} />
          <InfoRow label="Min Epsilon" value={learningConfig.minEpsilon.toFixed(2)} />
          <InfoRow label="Epsilon Decay" value={learningConfig.epsilonDecay.toFixed(4)} />
          <InfoRow label="Current Epsilon" value={learning.currentEpsilon.toFixed(3)} />
          <InfoRow
            label="Learning"
            value={learning.learningEnabled ? 'On' : 'Off'}
          />
          <p className="pt-1 text-[12px] leading-5 text-lab-muted">
            Q-update의 α와 초기 epsilon은 각 개체의 Genome 값이다. 위 Config Learning Rate는 실험
            기본값이며 유전 특성과 같은 값이 아니다.
          </p>
        </div>
      </section>
    </div>
  )
}

function ChartBlock({
  title,
  points,
  color,
  emptyLabel,
  yFormat,
}: {
  title: string
  points: { x: number; y: number }[]
  color: string
  emptyLabel: string
  yFormat: (value: number) => string
}) {
  return (
    <div className="border border-lab-border bg-lab-elevated px-3 py-3">
      <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">{title}</h3>
      <div className="mt-2">
        <LineChart
          points={points}
          color={color}
          emptyLabel={emptyLabel}
          xFormat={formatSimulationTime}
          yFormat={yFormat}
        />
      </div>
    </div>
  )
}

function ComparisonTable({
  early,
  current,
}: {
  early: ComparisonWindow
  current: ComparisonWindow
}) {
  return (
    <div className="overflow-hidden border border-lab-border bg-lab-elevated text-[12px]">
      <div className="grid grid-cols-[1.3fr_0.9fr_0.9fr_0.8fr] gap-1 border-b border-lab-border px-3 py-2 text-[11px] text-lab-muted">
        <span>Metric</span>
        <span className="text-right">Early</span>
        <span className="text-right">Current</span>
        <span className="text-right">Δ</span>
      </div>
      <div className="px-3 py-2 text-[11px] leading-5 text-lab-muted">
        {formatSimulationTime(early.fromTime)}–{formatSimulationTime(early.toTime)} vs{' '}
        {formatSimulationTime(current.fromTime)}–{formatSimulationTime(current.toTime)}
      </div>
      <ComparisonRow label="Average Reward" early={early.averageReward} current={current.averageReward} />
      <ComparisonRow
        label="Survival Time"
        early={early.averageSurvivalTime}
        current={current.averageSurvivalTime}
        format={(value) => `${value.toFixed(1)}s`}
      />
      <ComparisonRow
        label="Average Energy"
        early={early.averageEnergy}
        current={current.averageEnergy}
        format={(value) => value.toFixed(1)}
      />
      <ComparisonRow
        label="Exploration"
        early={early.explorationRate === null ? null : early.explorationRate * 100}
        current={current.explorationRate === null ? null : current.explorationRate * 100}
        format={(value) => `${value.toFixed(1)}%`}
      />
      <ComparisonRow
        label="Steps in window"
        early={early.learningSteps}
        current={current.learningSteps}
        format={(value) => value.toFixed(0)}
      />
      <ComparisonRow
        label="Population"
        early={early.populationSize}
        current={current.populationSize}
        format={(value) => value.toFixed(1)}
      />
    </div>
  )
}

function ComparisonRow({
  label,
  early,
  current,
  format = (value) => value.toFixed(2),
}: {
  label: string
  early: number | null
  current: number | null
  format?: (value: number) => string
}) {
  const delta = early === null || current === null ? null : current - early
  const tone =
    delta === null || delta === 0 ? 'text-lab-muted' : delta > 0 ? 'text-lab-accent' : 'text-lab-danger'

  return (
    <div className="grid grid-cols-[1.3fr_0.9fr_0.9fr_0.8fr] gap-1 border-t border-lab-border px-3 py-2 font-mono">
      <span className="font-sans text-lab-muted">{label}</span>
      <span className="text-right text-lab-text">{early === null ? '—' : format(early)}</span>
      <span className="text-right text-lab-text">{current === null ? '—' : format(current)}</span>
      <span className={`text-right ${tone}`}>
        {delta === null ? '—' : formatSigned(delta, delta === Math.trunc(delta) ? 0 : 2)}
      </span>
    </div>
  )
}

function DistributionRow({
  label,
  count,
  total,
}: {
  label: string
  count: number
  total: number
}) {
  const ratio = total === 0 ? 0 : count / total

  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-lab-muted">{label}</span>
        <span className="font-mono text-lab-text">
          {count} · {(ratio * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-1 h-1.5 bg-lab-bg">
        <div className="h-full bg-lab-info" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-lab-muted">{label}</span>
      <span className="font-mono text-lab-text">{value}</span>
    </div>
  )
}

function toEnergyPoints(series: LearningHistoryPoint[]) {
  return series
    .filter((point) => point.populationSize > 0)
    .map((point) => ({ x: point.time, y: point.averageEnergy }))
}
