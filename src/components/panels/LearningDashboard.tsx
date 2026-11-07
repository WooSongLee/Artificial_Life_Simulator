import { useState } from 'react'
import { describePolicyMode, policyModeFor } from '../../experiments/conditions'
import { ACTION_LABELS } from '../../learning/constants'
import { getRecentActionEvents, totalActionCounts } from '../../learning/actionEvents'
import { AGENT_ACTIONS } from '../../learning/types'
import { TERRAIN_TYPES } from '../../types/terrain'
import { TERRAIN_LABELS } from '../../simulation/constants'
import { shortAgentId } from '../../utils/format'
import { useLearningHistory } from '../../hooks/useLearningHistory'
import { useLearningStats } from '../../hooks/useLearningStats'
import { useThrottledStore } from '../../hooks/useThrottledStore'
import { useWorldStats } from '../../hooks/useWorldStats'
import {
  LAB_CURRICULUM_SURVIVAL_END,
  labCurriculumPhaseFromProgress,
} from '../../learning/labCurriculum'
import {
  LEARNING_COMPARISON_WINDOW,
  LEARNING_HISTORY_MAX_POINTS,
  LEARNING_HISTORY_SAMPLE_TICKS,
  SIMULATION_STEP_DT,
} from '../../simulation/constants'
import {
  compareLabOnVsFrozen,
  createEmptyOutcomeStats,
  driveVsSurvivalEarlyLate,
  driveVsSurvivalPickRates,
  driveVsSurvivalTrajectory,
  interactSuccessRate,
  labChoiceCountsFrom,
  labChoiceDriveSurvivalRates,
  labChoiceInteractRate,
  type LabChoiceCounts,
} from '../../simulation/outcomes'
import { useSimulationStore } from '../../store/useSimulationStore'
import type { LearningHistoryPoint } from '../../types/simulation'
import { formatSigned } from '../../utils/format'
import { formatSimulationTime } from '../../utils/time'
import { ActionShareChart } from '../charts/ActionShareChart'
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
          <StatCard
            label="Visited States"
            value={learning.visitedStates}
            tone="cyan"
          />
          <StatCard
            label="Max States / Agent"
            value={learning.maxVisitedStates}
          />
          <StatCard
            label="Q Cells Stored"
            value={learning.qTableCells}
            tone="amber"
          />
        </div>
        <p className="mt-2 text-[12px] leading-5 text-lab-muted">
          Average Reward와 Exploration Rate는 최근 80개 학습 행동의 평균이다. Average Survival Time은
          사망 개체의 평균 수명이다. Visited States는 희소 Q-Table에 실제로 저장된 상태 수다. 이론
          공간 {learning.stateSpaceSize.toLocaleString()}은 참고값이며 미리 할당하지 않는다.
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
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          시계열은 {SAMPLE_SECONDS.toFixed(0)}초 구간의 실제 선택 횟수다. 비율은 그 구간 결정 수로
          나누므로 생존 수나 학습 스텝 수 변화의 영향을 줄인다. 누적 합은 아래 Lifetime에 둔다.
        </p>
        <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
          <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">Share over time</h3>
          <div className="mt-2">
            <ActionShareChart
              points={history.series.flatMap((point) =>
                point.actionCounts ? [{ time: point.time, counts: point.actionCounts }] : [],
              )}
              emptyLabel="구간별 행동 선택이 아직 없다."
            />
          </div>
          <LatestIntervalCounts series={history.series} />
        </div>
        <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3">
          <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">Lifetime</h3>
          {totalActions === 0 ? (
            <p className="mt-2 text-[12px] leading-5 text-lab-muted">학습 중 선택된 행동이 아직 없다.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {AGENT_ACTIONS.map((action) => (
                <DistributionRow
                  key={action}
                  label={`${ACTION_LABELS[action]}`}
                  count={learning.actionCounts[action]}
                  total={totalActions}
                />
              ))}
            </div>
          )}
        </div>
        <ExploreExploitSeries series={history.series} />
        <AgentActionTable agents={learning.agentActionCounts} />
        <TerrainActionTable series={history.series} />
        <ToolSuccessTable series={history.series} />
        <InteractOutcomeTable />
        <DriveVsSurvivalPickTable />
        <LabOnVsFrozenComparePanel />
        <DriveVsSurvivalTrajectoryTimeline />
        <CombatActionTable series={history.series} />
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Learning Comparison</h2>
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          첫 {COMPARISON_SECONDS.toFixed(0)}초와 최근 {COMPARISON_SECONDS.toFixed(0)}초의 기록 평균이다.
          겹치지 않는 구간이 쌓이기 전에는 비교하지 않는다. 향상을 가정하지 않는다. epsilon이
          낮아진 것만으로 학습이 좋아졌다고 보지 않으며, 행동 비율 변화와 생존·자원 획득은 별개다.
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
        <div className="mt-3">
          {comparison ? (
            <ActionComparison early={comparison.early} current={comparison.current} />
          ) : (
            <EmptyState>행동 비율 비교도 겹치지 않는 초기/최근 구간이 쌓인 뒤에 표시한다.</EmptyState>
          )}
        </div>
        {comparison ? <WindowAnalyticsComparison early={comparison.early} current={comparison.current} /> : null}
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
            좌측 설정에서 학습 파라미터와 보상을 바꿀 수 있다. Q-update의 α와 초기 epsilon은 각
            개체의 Genome 값이다. Config Learning Rate와 Initial Epsilon은 새 개체의 Genome 기본값이다.
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

function LatestIntervalCounts({ series }: { series: LearningHistoryPoint[] }) {
  const latest = [...series].reverse().find((point) => totalActionCounts(point.actionCounts) > 0)
  if (!latest?.actionCounts) {
    return null
  }

  const total = totalActionCounts(latest.actionCounts)
  return (
    <div className="mt-3 space-y-2 border-t border-lab-border pt-3">
      <p className="text-[11px] tracking-wide text-lab-muted uppercase">
        Latest interval · {formatSimulationTime(latest.time)} · {total} decisions
      </p>
      {AGENT_ACTIONS.map((action) => (
        <DistributionRow
          key={action}
          label={ACTION_LABELS[action]}
          count={latest.actionCounts?.[action] ?? 0}
          total={total}
        />
      ))}
    </div>
  )
}

function ActionComparison({
  early,
  current,
}: {
  early: ComparisonWindow
  current: ComparisonWindow
}) {
  const earlyTotal = totalActionCounts(early.actionCounts ?? undefined)
  const currentTotal = totalActionCounts(current.actionCounts ?? undefined)
  if (!early.actionCounts || !current.actionCounts || earlyTotal === 0 || currentTotal === 0) {
    return <EmptyState>초기 또는 최근 구간에 기록된 행동 선택이 없어 비율을 비교하지 않는다.</EmptyState>
  }

  return (
    <div className="overflow-hidden border border-lab-border bg-lab-elevated text-[12px]">
      <div className="px-3 py-2 text-[11px] tracking-wide text-lab-muted uppercase">
        Action share · early vs recent
      </div>
      <p className="px-3 pb-2 text-[12px] leading-5 text-lab-muted">
        각 값은 해당 구간 결정 수 대비 비율이다. 비율이 달라진 것은 생존이나 먹이 획득이 좋아졌다는
        뜻이 아니다.
      </p>
      <div className="grid grid-cols-[1.3fr_0.7fr_0.9fr_0.7fr_0.9fr] gap-1 border-t border-lab-border px-3 py-2 text-[11px] text-lab-muted">
        <span>Action</span>
        <span className="text-right">Early n</span>
        <span className="text-right">Early %</span>
        <span className="text-right">Now n</span>
        <span className="text-right">Now %</span>
      </div>
      {AGENT_ACTIONS.map((action) => (
        <div
          key={action}
          className="grid grid-cols-[1.3fr_0.7fr_0.9fr_0.7fr_0.9fr] gap-1 border-t border-lab-border px-3 py-2 font-mono"
        >
          <span className="font-sans text-lab-muted">{ACTION_LABELS[action]}</span>
          <span className="text-right text-lab-text">{early.actionCounts?.[action] ?? 0}</span>
          <span className="text-right text-lab-text">
            {((early.actionRatios?.[action] ?? 0) * 100).toFixed(1)}%
          </span>
          <span className="text-right text-lab-text">{current.actionCounts?.[action] ?? 0}</span>
          <span className="text-right text-lab-text">
            {((current.actionRatios?.[action] ?? 0) * 100).toFixed(1)}%
          </span>
        </div>
      ))}
      <div className="grid grid-cols-[1.3fr_0.7fr_0.9fr_0.7fr_0.9fr] gap-1 border-t border-lab-border px-3 py-2 font-mono text-lab-muted">
        <span className="font-sans">Decisions</span>
        <span className="text-right">{earlyTotal}</span>
        <span />
        <span className="text-right">{currentTotal}</span>
        <span />
      </div>
    </div>
  )
}

function ExploreExploitSeries({ series }: { series: LearningHistoryPoint[] }) {
  const points = series.flatMap((point) => {
    const explore = point.analytics?.exploreCount ?? 0
    const exploit = point.analytics?.exploitCount ?? 0
    const total = explore + exploit
    return total > 0 ? [{ time: point.time, explore, exploit, total }] : []
  })

  return (
    <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
      <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">Explore / Exploit</h3>
      <p className="mt-1 text-[12px] leading-5 text-lab-muted">
        각 1초 구간의 결정 수 대비 비율이다. epsilon이 낮아진 것만으로 성능이 좋아졌다고 보지 않는다.
      </p>
      {points.length === 0 ? (
        <p className="mt-2 text-[12px] text-lab-muted">탐험/활용 기록이 아직 없다.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {points.slice(-8).map((point) => (
            <div key={point.time} className="text-[12px]">
              <div className="flex justify-between font-mono text-lab-muted">
                <span>{formatSimulationTime(point.time)}</span>
                <span>
                  explore {((point.explore / point.total) * 100).toFixed(0)}% · exploit{' '}
                  {((point.exploit / point.total) * 100).toFixed(0)}% · n {point.total}
                </span>
              </div>
              <div className="mt-1 flex h-1.5 bg-lab-bg">
                <div className="h-full bg-lab-info" style={{ width: `${(point.explore / point.total) * 100}%` }} />
                <div className="h-full bg-lab-accent" style={{ width: `${(point.exploit / point.total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AgentActionTable({
  agents,
}: {
  agents: Array<{
    agentId: string
    alive: boolean
    total: number
    visitedStates: number
    actionCounts: Record<(typeof AGENT_ACTIONS)[number], number>
  }>
}) {
  const rows = agents.filter((agent) => agent.total > 0).slice(0, 8)
  return (
    <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
      <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">Per-agent actions</h3>
      <p className="mt-1 text-[12px] leading-5 text-lab-muted">
        결정 횟수로 나눈 비율이다. 생존 수가 달라도 횟수 합을 학습 변화로 보지 않는다.
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-[12px] text-lab-muted">개체별 행동 기록이 아직 없다.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {rows.map((agent) => (
            <div key={agent.agentId} className="text-[12px]">
              <div className="flex justify-between">
                <span className="text-lab-text">
                  {shortAgentId(agent.agentId)} · {agent.alive ? 'alive' : 'dead'}
                </span>
                <span className="font-mono text-lab-muted">
                  n {agent.total} · states {agent.visitedStates}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-lab-muted">
                {AGENT_ACTIONS.filter((action) => agent.actionCounts[action] > 0)
                  .map((action) => `${ACTION_LABELS[action]} ${((agent.actionCounts[action] / agent.total) * 100).toFixed(0)}%`)
                  .join(' · ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TerrainActionTable({ series }: { series: LearningHistoryPoint[] }) {
  const latest = [...series].reverse().find((point) => point.analytics && point.analytics.total > 0)?.analytics
  if (!latest) {
    return (
      <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
        <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">Actions by terrain</h3>
        <p className="mt-2 text-[12px] text-lab-muted">지형별 행동 기록이 아직 없다.</p>
      </div>
    )
  }

  return (
    <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
      <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">Actions by terrain</h3>
      <p className="mt-1 text-[12px] leading-5 text-lab-muted">
        최근 1초 구간의 지형별 결정 비율이다. 지형에 들어갔다는 이유로 보상하지 않는다.
      </p>
      <div className="mt-2 space-y-2">
        {TERRAIN_TYPES.map((terrain) => {
          const total = totalActionCounts(latest.terrainCounts[terrain])
          if (total === 0) return null
          return (
            <p key={terrain} className="font-mono text-[11px] text-lab-muted">
              {TERRAIN_LABELS[terrain]} · n {total} ·{' '}
              {AGENT_ACTIONS.filter((action) => latest.terrainCounts[terrain][action] > 0)
                .map((action) => `${ACTION_LABELS[action]} ${((latest.terrainCounts[terrain][action] / total) * 100).toFixed(0)}%`)
                .join(' · ')}
            </p>
          )
        })}
      </div>
    </div>
  )
}

function ToolSuccessTable({ series }: { series: LearningHistoryPoint[] }) {
  const held = series.reduce(
    (sum, point) => ({
      attempts: sum.attempts + (point.analytics?.toolHeld.attempts ?? 0),
      success: sum.success + (point.analytics?.toolHeld.success ?? 0),
    }),
    { attempts: 0, success: 0 },
  )
  const empty = series.reduce(
    (sum, point) => ({
      attempts: sum.attempts + (point.analytics?.toolEmpty.attempts ?? 0),
      success: sum.success + (point.analytics?.toolEmpty.success ?? 0),
    }),
    { attempts: 0, success: 0 },
  )

  return (
    <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
      <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">Tool vs no tool</h3>
      <p className="mt-1 text-[12px] leading-5 text-lab-muted">
        PICK_UP/GATHER 성공률이다. 시도 수로 나눈다. 도구가 없어도 베리 채집은 가능하다.
      </p>
      {held.attempts + empty.attempts === 0 ? (
        <p className="mt-2 text-[12px] text-lab-muted">도구/채집 시도가 아직 없다.</p>
      ) : (
        <div className="mt-2 space-y-1 font-mono text-[12px]">
          <p>
            Held tool · {held.success}/{held.attempts} · {held.attempts === 0 ? '—' : `${((held.success / held.attempts) * 100).toFixed(0)}%`}
          </p>
          <p>
            No tool · {empty.success}/{empty.attempts} · {empty.attempts === 0 ? '—' : `${((empty.success / empty.attempts) * 100).toFixed(0)}%`}
          </p>
        </div>
      )}
    </div>
  )
}

function InteractOutcomeTable() {
  const outcomeStats = useSimulationStore((state) => state.world.outcomeStats)
  const learningEnabled = useSimulationStore((state) => state.learningEnabled)
  const mode = useSimulationStore((state) => state.world.config.mode)
  const attempts = outcomeStats?.interactAttempts ?? 0
  const successes = outcomeStats?.interactSuccesses ?? 0
  const rate = outcomeStats ? interactSuccessRate(outcomeStats) : null

  return (
    <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
      <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">Interact outcomes</h3>
      <p className="mt-1 text-[12px] leading-5 text-lab-muted">
        Switch toggle / box push counts from this world run. Compare Learning On vs Off (Frozen Q) or
        Random-heavy early epsilon via Experiments with the same seed.
      </p>
      {attempts === 0 ? (
        <p className="mt-2 text-[12px] text-lab-muted">
          {mode === 'human_behavior_lab'
            ? 'No interact attempts yet. Approach a switch or face a box and GATHER.'
            : 'No interact attempts in this mode.'}
        </p>
      ) : (
        <div className="mt-2 space-y-1 font-mono text-[12px]">
          <p>
            Interact · {successes}/{attempts} ·{' '}
            {rate === null ? '—' : `${(rate * 100).toFixed(0)}%`}
          </p>
          <p className="text-lab-muted">
            Learning {learningEnabled ? 'On' : 'Off (Frozen Q)'} · reward uses Interact Success
          </p>
        </div>
      )}
    </div>
  )
}

function DriveVsSurvivalPickTable() {
  const outcomeStats = useSimulationStore((state) => state.world.outcomeStats)
  const mode = useSimulationStore((state) => state.world.config.mode)
  const rates = outcomeStats ? driveVsSurvivalPickRates(outcomeStats) : null

  return (
    <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
      <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">Drive vs survival picks</h3>
      <p className="mt-1 text-[12px] leading-5 text-lab-muted">
        Lab rest-cot / observation-booth successes vs EAT (survival chamber). Rates are among those two buckets only — not
        emotion meters.
      </p>
      {!rates ? (
        <p className="mt-2 text-[12px] text-lab-muted">
          {mode === 'human_behavior_lab'
            ? 'No drive or EAT picks yet. Use rest cot / observation booth or eat in the survival chamber.'
            : 'No drive/survival pick samples in this mode.'}
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          <DistributionRow label="Drive (cot/booth)" count={rates.drivePicks} total={rates.drivePicks + rates.survivalPicks} />
          <DistributionRow label="Survival (EAT)" count={rates.survivalPicks} total={rates.drivePicks + rates.survivalPicks} />
          <p className="font-mono text-[11px] text-lab-muted">
            drive {(rates.driveRate * 100).toFixed(0)}% · survival {(rates.survivalRate * 100).toFixed(0)}% · n{' '}
            {rates.drivePicks + rates.survivalPicks}
          </p>
        </div>
      )}
    </div>
  )
}

function LabOnVsFrozenComparePanel() {
  const mode = useSimulationStore((state) => state.world.config.mode)
  const learningEnabled = useSimulationStore((state) => state.learningEnabled)
  const outcomeStats = useSimulationStore((state) => state.world.outcomeStats)
  const learning = useLearningStats()
  const [learningCapture, setLearningCapture] = useState<LabChoiceCounts | null>(null)
  const [frozenCapture, setFrozenCapture] = useState<LabChoiceCounts | null>(null)

  const policy = policyModeFor({
    learningEnabled,
    visitedStates: learning.visitedStates,
  })
  const current = labChoiceCountsFrom(outcomeStats ?? createEmptyOutcomeStats())
  const compare = compareLabOnVsFrozen(learningCapture, frozenCapture)
  const currentRates = labChoiceDriveSurvivalRates(current)
  const currentInteract = labChoiceInteractRate(current)

  if (mode !== 'human_behavior_lab') {
    return (
      <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
        <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">
          Learning On vs Frozen Q · Lab choices
        </h3>
        <p className="mt-2 text-[12px] text-lab-muted">
          Lab-only compare. Switch to Human Behavior Lab to pin drive/interact choices.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
      <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">
        Learning On vs Frozen Q · Lab choices
      </h3>
      <p className="mt-1 text-[12px] leading-5 text-lab-muted">
        Capture drive/survival + interact rates under Learning On, then again under Learning Off ·
        Frozen Q (visited Q states &gt; 0). Same seed via Experiments — not emotion meters.
      </p>
      <p className="mt-2 font-mono text-[11px] text-lab-muted">
        Now · {describePolicyMode(policy)}
        {currentRates
          ? ` · drive ${(currentRates.driveRate * 100).toFixed(0)}% / survival ${(currentRates.survivalRate * 100).toFixed(0)}% · n ${currentRates.drivePicks + currentRates.survivalPicks}`
          : ' · no drive/Eat picks yet'}
        {currentInteract !== null
          ? ` · interact ${(currentInteract * 100).toFixed(0)}%`
          : ''}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={policy !== 'learning'}
          onClick={() => setLearningCapture(current)}
          className="border border-lab-border bg-lab-bg px-2 py-1 text-[12px] text-lab-text disabled:opacity-40"
        >
          Capture Learning On
        </button>
        <button
          type="button"
          disabled={policy !== 'frozen-q'}
          onClick={() => setFrozenCapture(current)}
          className="border border-lab-border bg-lab-bg px-2 py-1 text-[12px] text-lab-text disabled:opacity-40"
        >
          Capture Frozen Q
        </button>
        <button
          type="button"
          disabled={!learningCapture && !frozenCapture}
          onClick={() => {
            setLearningCapture(null)
            setFrozenCapture(null)
          }}
          className="border border-lab-border bg-lab-bg px-2 py-1 text-[12px] text-lab-muted disabled:opacity-40"
        >
          Clear
        </button>
      </div>
      {!compare ? (
        <p className="mt-2 text-[12px] text-lab-muted">
          Run Lab choices, capture Learning On, toggle Learning Off with a trained Q-table, capture
          Frozen Q.
        </p>
      ) : (
        <div className="mt-2 overflow-hidden border border-lab-border text-[12px]">
          <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.7fr] gap-1 border-b border-lab-border px-2 py-1.5 text-[11px] text-lab-muted">
            <span>Metric</span>
            <span className="text-right">Learning On</span>
            <span className="text-right">Frozen Q</span>
            <span className="text-right">Δ</span>
          </div>
          <CompareMetricRow
            label="Drive rate"
            left={compare.learningRates ? compare.learningRates.driveRate : null}
            right={compare.frozenRates ? compare.frozenRates.driveRate : null}
            delta={compare.driveRateDelta}
            asPercent
          />
          <CompareMetricRow
            label="Survival rate"
            left={compare.learningRates ? compare.learningRates.survivalRate : null}
            right={compare.frozenRates ? compare.frozenRates.survivalRate : null}
            delta={compare.survivalRateDelta}
            asPercent
          />
          <CompareMetricRow
            label="Interact success"
            left={compare.learningInteractRate}
            right={compare.frozenInteractRate}
            delta={compare.interactRateDelta}
            asPercent
          />
          <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.7fr] gap-1 px-2 py-1.5 font-mono text-[11px] text-lab-muted">
            <span>n drive+Eat</span>
            <span className="text-right">
              {learningCapture
                ? learningCapture.drivePicks + learningCapture.survivalPicks
                : '—'}
            </span>
            <span className="text-right">
              {frozenCapture ? frozenCapture.drivePicks + frozenCapture.survivalPicks : '—'}
            </span>
            <span className="text-right">—</span>
          </div>
        </div>
      )}
    </div>
  )
}

function CompareMetricRow({
  label,
  left,
  right,
  delta,
  asPercent,
}: {
  label: string
  left: number | null
  right: number | null
  delta: number | null
  asPercent?: boolean
}) {
  const fmt = (value: number | null) => {
    if (value === null) return '—'
    return asPercent ? `${(value * 100).toFixed(0)}%` : value.toFixed(2)
  }
  return (
    <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.7fr] gap-1 border-b border-lab-border px-2 py-1.5 font-mono">
      <span className="text-lab-text">{label}</span>
      <span className="text-right">{fmt(left)}</span>
      <span className="text-right">{fmt(right)}</span>
      <span className="text-right text-lab-muted">
        {delta === null ? '—' : asPercent ? formatSigned(delta * 100, 0) + 'pp' : formatSigned(delta)}
      </span>
    </div>
  )
}

function DriveVsSurvivalTrajectoryTimeline() {
  const mode = useSimulationStore((state) => state.world.config.mode)
  const tick = useSimulationStore((state) => state.tick)
  const events = useThrottledStore(() => getRecentActionEvents(), 200)
  const points = driveVsSurvivalTrajectory(events).slice(0, 40)
  const chronological = [...points].reverse()
  const splitTime = LAB_CURRICULUM_SURVIVAL_END * SIMULATION_STEP_DT
  const earlyLate = driveVsSurvivalEarlyLate(points, splitTime)
  const phase =
    mode === 'human_behavior_lab' ? labCurriculumPhaseFromProgress(tick) : null

  return (
    <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
      <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">
        Survival vs non-survival trajectory
      </h3>
      <p className="mt-1 text-[12px] leading-5 text-lab-muted">
        Real action events: Eat (survival chamber) vs cot/booth (drive chambers). Lab world trail paints the
        same warm/cool marks — not emotion meters.
      </p>
      {phase ? (
        <p className="mt-2 font-mono text-[11px] text-lab-muted">
          Curriculum · {phase.replace(/_/g, ' ')} · tick {tick} · split @{' '}
          {formatSimulationTime(splitTime)}
        </p>
      ) : null}
      {points.length === 0 ? (
        <p className="mt-2 text-[12px] text-lab-muted">
          {mode === 'human_behavior_lab'
            ? 'No Eat/cot/booth events yet. Run Lab with Learning On and watch chamber trails.'
            : 'No drive/survival trajectory samples in this mode.'}
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {earlyLate ? (
            <div className="grid gap-2 border border-lab-border bg-lab-bg px-2 py-2 font-mono text-[11px] sm:grid-cols-2">
              <p>
                Early ≤{formatSimulationTime(splitTime)} · drive{' '}
                {earlyLate.early.driveRate === null
                  ? '—'
                  : `${(earlyLate.early.driveRate * 100).toFixed(0)}%`}{' '}
                / surv{' '}
                {earlyLate.early.survivalRate === null
                  ? '—'
                  : `${(earlyLate.early.survivalRate * 100).toFixed(0)}%`}{' '}
                · n {earlyLate.early.drivePicks + earlyLate.early.survivalPicks}
              </p>
              <p>
                Late &gt;{formatSimulationTime(splitTime)} · drive{' '}
                {earlyLate.late.driveRate === null
                  ? '—'
                  : `${(earlyLate.late.driveRate * 100).toFixed(0)}%`}{' '}
                / surv{' '}
                {earlyLate.late.survivalRate === null
                  ? '—'
                  : `${(earlyLate.late.survivalRate * 100).toFixed(0)}%`}{' '}
                · n {earlyLate.late.drivePicks + earlyLate.late.survivalPicks}
                {earlyLate.driveShareShift ? ' · shift↑drive' : ''}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1" aria-label="Chronological survival vs drive marks">
            {chronological.map((point) => (
              <span
                key={point.eventId}
                title={`${point.label} @ ${formatSimulationTime(point.simulationTime)}`}
                className={`inline-block h-3 w-3 ${
                  point.kind === 'survival' ? 'bg-lab-warn' : 'bg-lab-info'
                }`}
              />
            ))}
          </div>
          <p className="font-mono text-[11px] text-lab-muted">
            <span className="mr-2 inline-block h-2 w-2 bg-lab-warn align-middle" />
            survival (Eat)
            <span className="ml-3 mr-2 inline-block h-2 w-2 bg-lab-info align-middle" />
            drive (bed/lookout) · n {points.length}
          </p>
          <div className="max-h-40 space-y-1 overflow-y-auto font-mono text-[12px]">
            {points.slice(0, 16).map((point) => (
              <p key={point.eventId} className="flex items-center justify-between gap-2">
                <span className={point.kind === 'survival' ? 'text-lab-warn' : 'text-lab-info'}>
                  {point.kind === 'survival' ? 'S' : 'D'} · {point.label}
                  {point.outcome ? ` · ${point.outcome}` : ''}
                </span>
                <span className="text-lab-muted">{formatSimulationTime(point.simulationTime)}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CombatActionTable({ series }: { series: LearningHistoryPoint[] }) {
  const combat = { ATTACK: emptyCombat(), DEFEND: emptyCombat(), FLEE: emptyCombat() }
  for (const point of series) {
    if (!point.analytics) continue
    for (const action of ['ATTACK', 'DEFEND', 'FLEE'] as const) {
      combat[action].selected += point.analytics.combat[action].selected
      combat[action].success += point.analytics.combat[action].success
      combat[action].failed += point.analytics.combat[action].failed
      combat[action].noTarget += point.analytics.combat[action].noTarget
    }
  }
  const any = combat.ATTACK.selected + combat.DEFEND.selected + combat.FLEE.selected

  return (
    <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
      <h3 className="text-[11px] tracking-wide text-lab-muted uppercase">Combat actions</h3>
      <p className="mt-1 text-[12px] leading-5 text-lab-muted">
        선택 횟수와 실제 결과다. 선택 비율은 전투 행동 결정 수로 나눈다.
      </p>
      {any === 0 ? (
        <p className="mt-2 text-[12px] text-lab-muted">전투 행동 기록이 아직 없다.</p>
      ) : (
        <div className="mt-2 space-y-1 font-mono text-[12px]">
          {(['ATTACK', 'DEFEND', 'FLEE'] as const).map((action) => (
            <p key={action}>
              {ACTION_LABELS[action]} · pick {((combat[action].selected / any) * 100).toFixed(0)}% ·
              hit {combat[action].success} · fail {combat[action].failed} · no target {combat[action].noTarget}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function emptyCombat() {
  return { selected: 0, success: 0, failed: 0, noTarget: 0 }
}

function WindowAnalyticsComparison({
  early,
  current,
}: {
  early: ComparisonWindow
  current: ComparisonWindow
}) {
  const earlyAnalytics = early.analytics
  const currentAnalytics = current.analytics
  if (!earlyAnalytics && !currentAnalytics) return null

  return (
    <div className="mt-3 overflow-hidden border border-lab-border bg-lab-elevated text-[12px]">
      <div className="px-3 py-2 text-[11px] tracking-wide text-lab-muted uppercase">
        Explore, tools, combat · early vs recent
      </div>
      <p className="px-3 pb-2 text-[12px] leading-5 text-lab-muted">
        값은 해당 구간 결정 수 또는 시도 수로 나눈다. 향상이 없으면 그대로 보여 준다.
      </p>
      <ComparisonRow
        label="Explore share"
        early={earlyAnalytics?.exploreRatio === null || earlyAnalytics?.exploreRatio === undefined ? null : earlyAnalytics.exploreRatio * 100}
        current={currentAnalytics?.exploreRatio === null || currentAnalytics?.exploreRatio === undefined ? null : currentAnalytics.exploreRatio * 100}
        format={(value) => `${value.toFixed(1)}%`}
      />
      <ComparisonRow
        label="Tool held success"
        early={rateOrNull(earlyAnalytics?.toolHeldSuccessRate)}
        current={rateOrNull(currentAnalytics?.toolHeldSuccessRate)}
        format={(value) => `${value.toFixed(1)}%`}
      />
      <ComparisonRow
        label="No tool success"
        early={rateOrNull(earlyAnalytics?.toolEmptySuccessRate)}
        current={rateOrNull(currentAnalytics?.toolEmptySuccessRate)}
        format={(value) => `${value.toFixed(1)}%`}
      />
      <ComparisonRow
        label="Attack pick share"
        early={combatShare(earlyAnalytics, 'ATTACK')}
        current={combatShare(currentAnalytics, 'ATTACK')}
        format={(value) => `${value.toFixed(1)}%`}
      />
    </div>
  )
}

function rateOrNull(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value * 100
}

function combatShare(
  analytics: ComparisonWindow['analytics'],
  action: 'ATTACK' | 'DEFEND' | 'FLEE',
): number | null {
  if (!analytics) return null
  const total =
    analytics.combat.ATTACK.selected + analytics.combat.DEFEND.selected + analytics.combat.FLEE.selected
  return total > 0 ? (analytics.combat[action].selected / total) * 100 : null
}
