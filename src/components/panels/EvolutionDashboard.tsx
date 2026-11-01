import { useGenerationHistory } from '../../hooks/useGenerationHistory'
import { useWorldStats } from '../../hooks/useWorldStats'
import type { GenerationRecord } from '../../evolution/types'
import { formatSigned } from '../../utils/format'
import { formatSimulationTime } from '../../utils/time'
import { LineChart } from '../charts/LineChart'
import { EmptyState } from '../ui/EmptyState'
import { StatCard } from '../ui/StatCard'

export function EvolutionDashboard() {
  const stats = useWorldStats()
  const {
    history,
    currentAverages,
    currentReward,
    inheritQTable,
    geneticsEnabled,
    mutationRate,
    populationLimit,
  } = useGenerationHistory()
  const previous = history[history.length - 1] ?? null
  const survivalRate = stats.totalAgents === 0 ? 0 : stats.aliveCount / stats.totalAgents

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-[11px] text-lab-muted">Evolution Dashboard</h2>
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          다음 세대가 실제로 태어나거나 전멸할 때만 그 세대의 실측값을 기록한다. 진화가 반드시
          생존이나 보상을 개선한다고 가정하지 않는다. 유전 정보와 Q-Table은 별도다.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          <StatCard label="Generation" value={stats.generation} tone="cyan" />
          <StatCard label="Births" value={stats.birthCount} />
          <StatCard label="Mating Pairs" value={stats.matingCount} />
          <StatCard
            label="Survival Rate"
            value={`${(survivalRate * 100).toFixed(0)}%`}
            tone="green"
          />
          <StatCard label="Population" value={`${stats.aliveCount}/${stats.totalAgents}`} />
          <StatCard
            label="Avg Reward / Step"
            value={currentReward.hasLearningSamples ? currentReward.averageReward.toFixed(2) : '—'}
            tone="amber"
          />
          <StatCard label="Completed Gens" value={history.length} />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Current Genome Averages</h2>
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          현재 월드에 있는 개체의 평균이다. 다음 세대가 태어나기 전에는 이력에 넣지 않는다.
          Strength나 Aggression이 높다고 생존에 유리하다고 해석하지 않는다.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          <StatCard label="Speed" value={currentAverages.speed.toFixed(2)} />
          <StatCard label="Vision" value={currentAverages.vision.toFixed(1)} />
          <StatCard label="Energy Efficiency" value={currentAverages.energyEfficiency.toFixed(2)} />
          <StatCard label="Learning Rate" value={currentAverages.learningRate.toFixed(3)} tone="cyan" />
          <StatCard
            label="Exploration Rate"
            value={currentAverages.explorationRate.toFixed(2)}
            tone="cyan"
          />
          <StatCard label="Libido" value={currentAverages.libido.toFixed(2)} />
          <StatCard label="Lifespan" value={`${currentAverages.lifespan.toFixed(0)}s`} />
          <StatCard label="Strength" value={currentAverages.strength.toFixed(2)} />
          <StatCard label="Aggression" value={currentAverages.aggression.toFixed(2)} />
          <StatCard label="Caution" value={currentAverages.caution.toFixed(2)} />
          <StatCard label="Tool Affinity" value={currentAverages.toolAffinity.toFixed(2)} />
          <StatCard label="Mutation Rate" value={`${(mutationRate * 100).toFixed(0)}%`} />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Generation Charts</h2>
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          X축은 완료된 세대 번호다. 값이 내려가도 그대로 표시한다.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ChartBlock
            title="Average Survival Time"
            points={history.map((record) => ({ x: record.generation, y: record.averageLifespan }))}
            color="#c45c4a"
            emptyLabel="완료된 세대가 없어 수명 데이터가 없다."
            yFormat={(value) => `${value.toFixed(0)}s`}
          />
          <ChartBlock
            title="Average Speed"
            points={history.map((record) => ({ x: record.generation, y: record.averageSpeed }))}
            color="#5aa0d6"
            emptyLabel="완료된 세대가 없어 Speed 데이터가 없다."
            yFormat={(value) => value.toFixed(2)}
          />
          <ChartBlock
            title="Average Vision"
            points={history.map((record) => ({ x: record.generation, y: record.averageVision }))}
            color="#7b8cff"
            emptyLabel="완료된 세대가 없어 Vision 데이터가 없다."
            yFormat={(value) => value.toFixed(1)}
          />
          <ChartBlock
            title="Average Energy Efficiency"
            points={history.map((record) => ({
              x: record.generation,
              y: record.averageEnergyEfficiency,
            }))}
            color="#3d9b7a"
            emptyLabel="완료된 세대가 없어 Energy Efficiency 데이터가 없다."
            yFormat={(value) => value.toFixed(2)}
          />
          <ChartBlock
            title="Average Reward"
            points={history
              .filter((record) => record.hasLearningSamples)
              .map((record) => ({ x: record.generation, y: record.averageReward }))}
            color="#c9a227"
            emptyLabel="학습 보상이 있는 완료 세대가 없다."
            yFormat={(value) => value.toFixed(2)}
          />
          <ChartBlock
            title="Population Size"
            points={history.map((record) => ({ x: record.generation, y: record.populationSize }))}
            color="#8b97a8"
            emptyLabel="완료된 세대가 없어 개체 수 데이터가 없다."
            yFormat={(value) => value.toFixed(0)}
          />
          <ChartBlock
            title="Average Strength"
            points={recordedPoints(history, 'averageStrength')}
            color="#c45c4a"
            emptyLabel="Strength 평균이 기록된 완료 세대가 없다."
            yFormat={(value) => value.toFixed(2)}
          />
          <ChartBlock
            title="Average Aggression"
            points={recordedPoints(history, 'averageAggression')}
            color="#c47a3d"
            emptyLabel="Aggression 평균이 기록된 완료 세대가 없다."
            yFormat={(value) => value.toFixed(2)}
          />
          <ChartBlock
            title="Average Caution"
            points={recordedPoints(history, 'averageCaution')}
            color="#5aa0d6"
            emptyLabel="Caution 평균이 기록된 완료 세대가 없다."
            yFormat={(value) => value.toFixed(2)}
          />
          <ChartBlock
            title="Average Tool Affinity"
            points={recordedPoints(history, 'averageToolAffinity')}
            color="#6aa84e"
            emptyLabel="Tool Affinity 평균이 기록된 완료 세대가 없다."
            yFormat={(value) => value.toFixed(2)}
          />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Latest Completed Generation</h2>
        {previous ? <GenerationDelta record={previous} /> : (
          <div className="mt-3">
            <EmptyState>
              첫 세대 기록은 2세대가 태어나거나 전멸해야 남는다.
            </EmptyState>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Generation History</h2>
        <div className="mt-3">
          {history.length === 0 ? (
            <EmptyState>아직 기록된 세대가 없다.</EmptyState>
          ) : (
            <HistoryTable history={history} />
          )}
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Evolution Settings</h2>
        <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
          <InfoRow label="Genetics" value={geneticsEnabled ? 'On' : 'Off'} />
          <InfoRow label="Population Limit" value={populationLimit.toString()} />
          <InfoRow label="Mutation Rate" value={`${(mutationRate * 100).toFixed(0)}% / gene`} />
          <InfoRow label="Q-Table Inheritance" value={inheritQTable ? 'On' : 'Off'} />
          <p className="pt-1 text-[12px] leading-5 text-lab-muted">
            유전이 꺼져 있으면 교배와 노화 사망이 없고 학습만 남는다. 자식은 기본적으로 빈 Q-Table로
            학습을 시작한다. 유전 값과 학습된 지식은 같은 개념이 아니다.
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
          xFormat={(value) => `G${value.toFixed(0)}`}
          yFormat={yFormat}
        />
      </div>
    </div>
  )
}

function GenerationDelta({ record }: { record: GenerationRecord }) {
  return (
    <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
      <InfoRow label="Generation" value={`${record.generation}`} />
      <InfoRow
        label="End Reason"
        value={record.endReason === 'birth' ? 'Next generation born' : 'Extinction'}
      />
      <InfoRow label="Duration" value={formatSimulationTime(record.duration)} />
      <InfoRow label="Survival Rate" value={`${(record.survivalRate * 100).toFixed(0)}%`} />
      <InfoRow label="Avg Lifespan" value={`${record.averageLifespan.toFixed(1)}s`} />
      <InfoRow
        label="Avg Reward / Step"
        value={record.hasLearningSamples ? record.averageReward.toFixed(2) : '—'}
      />
      <InfoRow
        label="Mutations"
        value={`${record.mutation.mutatedAgentCount} agents / ${record.mutation.mutatedGeneCount} genes`}
      />
      <InfoRow label="Avg Strength" value={formatOptionalAverage(record.averageStrength)} />
      <InfoRow label="Avg Aggression" value={formatOptionalAverage(record.averageAggression)} />
      <InfoRow label="Avg Caution" value={formatOptionalAverage(record.averageCaution)} />
      <InfoRow label="Avg Tool Affinity" value={formatOptionalAverage(record.averageToolAffinity)} />
    </div>
  )
}

function HistoryTable({ history }: { history: GenerationRecord[] }) {
  const previous = history.length >= 2 ? history[history.length - 2] : null
  const latest = history[history.length - 1] ?? null

  return (
    <div className="overflow-x-auto border border-lab-border bg-lab-elevated text-[12px]">
      <div className="grid min-w-[960px] grid-cols-[0.5fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr] gap-1 border-b border-lab-border px-3 py-2 text-[11px] text-lab-muted">
        <span>Gen</span>
        <span className="text-right">Survive</span>
        <span className="text-right">Lifespan</span>
        <span className="text-right">Speed</span>
        <span className="text-right">Str</span>
        <span className="text-right">Agg</span>
        <span className="text-right">Cau</span>
        <span className="text-right">Tool</span>
        <span className="text-right">Eff.</span>
        <span className="text-right">Reward</span>
        <span className="text-right">Vision</span>
      </div>
      {history.map((record) => (
        <div
          key={record.generation}
          className="grid min-w-[960px] grid-cols-[0.5fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr] gap-1 border-t border-lab-border px-3 py-2 font-mono"
        >
          <span className="text-lab-text">{record.generation}</span>
          <span className="text-right text-lab-text">{(record.survivalRate * 100).toFixed(0)}%</span>
          <span className="text-right text-lab-text">{record.averageLifespan.toFixed(1)}s</span>
          <span className="text-right text-lab-text">{record.averageSpeed.toFixed(2)}</span>
          <span className="text-right text-lab-text">{formatOptionalAverage(record.averageStrength)}</span>
          <span className="text-right text-lab-text">{formatOptionalAverage(record.averageAggression)}</span>
          <span className="text-right text-lab-text">{formatOptionalAverage(record.averageCaution)}</span>
          <span className="text-right text-lab-text">{formatOptionalAverage(record.averageToolAffinity)}</span>
          <span className="text-right text-lab-text">{record.averageEnergyEfficiency.toFixed(2)}</span>
          <span className="text-right text-lab-text">
            {record.hasLearningSamples ? record.averageReward.toFixed(2) : '—'}
          </span>
          <span className="text-right text-lab-text">{record.averageVision.toFixed(1)}</span>
        </div>
      ))}
      {previous && latest ? (
        <div className="border-t border-lab-border px-3 py-2 text-[11px] leading-5 text-lab-muted">
          Last Δ lifespan {formatSigned(latest.averageLifespan - previous.averageLifespan, 1)}s ·
          speed {formatSigned(latest.averageSpeed - previous.averageSpeed)} · reward{' '}
          {latest.hasLearningSamples && previous.hasLearningSamples
            ? formatSigned(latest.averageReward - previous.averageReward)
            : '—'}
        </div>
      ) : null}
    </div>
  )
}

function recordedPoints(
  history: GenerationRecord[],
  key: 'averageStrength' | 'averageAggression' | 'averageCaution' | 'averageToolAffinity',
): { x: number; y: number }[] {
  return history.flatMap((record) => {
    const value = record[key]
    return typeof value === 'number' && Number.isFinite(value)
      ? [{ x: record.generation, y: value }]
      : []
  })
}

function formatOptionalAverage(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—'
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-lab-muted">{label}</span>
      <span className="font-mono text-lab-text">{value}</span>
    </div>
  )
}
