import { ACTION_LABELS } from '../../learning/constants'
import { AGENT_ACTIONS } from '../../learning/types'
import { useAgentLearningView } from '../../hooks/useLearningStats'
import type { Agent } from '../../types/agent'
import { shortAgentId } from '../../utils/format'
import { LineChart } from '../charts/LineChart'
import { EmptyState } from '../ui/EmptyState'

export function AgentInspection({ agent }: { agent: Agent }) {
  const learning = useAgentLearningView(agent)
  const totalActions = AGENT_ACTIONS.reduce((sum, action) => sum + learning.actionCounts[action], 0)
  const qTable = learning.qTable
  const preferredTotal = AGENT_ACTIONS.reduce(
    (sum, action) => sum + qTable.preferredActionCounts[action],
    0,
  )

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-[11px] text-lab-muted">선택 개체</h2>
        <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
          <InfoRow label="ID" value={shortAgentId(agent.id)} />
          <InfoRow label="Alive Status" value={agent.alive ? 'Alive' : 'Dead'} />
          <InfoRow
            label="Position"
            value={`${agent.position.x.toFixed(2)}, ${agent.position.z.toFixed(2)}`}
          />
          <InfoRow label="Heading" value={`${formatHeading(agent.rotation)}°`} />
          <InfoRow label="Survival Time" value={`${agent.age.toFixed(1)}s`} />
          <InfoRow label="Generation" value={`${agent.generation}`} />
          <InfoRow label="Speed" value={`${agent.speed.toFixed(2)} u/s`} />
          <InfoRow label="Vision" value={`${agent.vision.toFixed(1)} u`} />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Genome</h2>
        <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
          <InfoRow label="Speed" value={agent.genome.speed.toFixed(2)} />
          <InfoRow label="Vision" value={agent.genome.vision.toFixed(1)} />
          <InfoRow label="Energy Efficiency" value={agent.genome.energyEfficiency.toFixed(2)} />
          <InfoRow label="Learning Rate" value={agent.genome.learningRate.toFixed(3)} />
          <InfoRow label="Exploration Rate" value={agent.genome.explorationRate.toFixed(3)} />
          <InfoRow
            label="Parents"
            value={
              agent.parentIds
                ? `${shortAgentId(agent.parentIds[0])} · ${shortAgentId(agent.parentIds[1])}`
                : 'Founder'
            }
          />
          <InfoRow
            label="Mutated Genes"
            value={agent.mutatedGenes.length === 0 ? 'None' : formatMutatedGenes(agent.mutatedGenes)}
          />
          <p className="pt-1 text-[12px] leading-5 text-lab-muted">
            Genome은 유전 특성이다. 아래 Q-Table은 이 개체의 학습된 지식이며 기본적으로 상속되지
            않는다.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">생존 상태</h2>
        <div className="mt-3 space-y-3 border border-lab-border bg-lab-elevated px-3 py-3">
          <Meter label="Energy" value={agent.energy} tone="bg-lab-warn" />
          <Meter label="Hunger" value={agent.hunger} tone="bg-lab-danger" />
          <Meter label="Health" value={agent.health} tone="bg-lab-accent" />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">학습 상태</h2>
        <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
          <InfoRow
            label="Last Action"
            value={learning.lastAction ? ACTION_LABELS[learning.lastAction] : '—'}
          />
          <InfoRow label="Last Reward" value={learning.lastReward.toFixed(2)} />
          <InfoRow label="State" value={learning.lastStateKey ?? '—'} />
          <InfoRow label="Learning Steps" value={learning.totalSteps.toString()} />
          <InfoRow label="Total Actions" value={totalActions.toString()} />
          <InfoRow label="Epsilon" value={learning.epsilon.toFixed(3)} />
          <InfoRow
            label="Exploration Rate"
            value={learning.totalSteps === 0 ? '—' : `${(learning.explorationRate * 100).toFixed(1)}%`}
          />
          <InfoRow label="Total Reward" value={learning.totalReward.toFixed(1)} />
          <InfoRow
            label="Avg Reward"
            value={learning.totalSteps === 0 ? '—' : learning.averageReward.toFixed(2)}
          />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Q-Table 요약</h2>
        {qTable.visitedStates === 0 ? (
          <div className="mt-3">
            <EmptyState>이 개체의 Q-Table이 아직 비어 있다.</EmptyState>
          </div>
        ) : (
          <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
            <InfoRow
              label="Visited States"
              value={`${qTable.visitedStates} / ${qTable.stateSpaceSize}`}
            />
            <InfoRow label="Coverage" value={`${(qTable.coverage * 100).toFixed(1)}%`} />
            <InfoRow label="Avg Q" value={qTable.averageQ.toFixed(3)} />
            <InfoRow label="Min Q" value={qTable.minQ.toFixed(3)} />
            <InfoRow label="Max Q" value={qTable.maxQ.toFixed(3)} />
            <p className="pt-1 text-[12px] leading-5 text-lab-muted">
              Preferred action은 각 방문 상태에서 Q가 가장 높은 행동이다. 동점이면 행동 목록의 앞쪽을
              고른다.
            </p>
            <div className="pt-1 space-y-2">
              {AGENT_ACTIONS.map((action) => (
                <DistributionRow
                  key={action}
                  label={`${ACTION_LABELS[action]} Q`}
                  detail={`${qTable.averageQByAction[action].toFixed(3)} · pref ${qTable.preferredActionCounts[action]}`}
                  ratio={preferredTotal === 0 ? 0 : qTable.preferredActionCounts[action] / preferredTotal}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">행동 분포</h2>
        <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3">
          {totalActions === 0 ? (
            <p className="text-[12px] leading-5 text-lab-muted">학습 중 선택된 행동이 아직 없다.</p>
          ) : (
            AGENT_ACTIONS.map((action) => (
              <DistributionRow
                key={action}
                label={ACTION_LABELS[action]}
                detail={`${learning.actionCounts[action]} · ${((learning.actionCounts[action] / totalActions) * 100).toFixed(0)}%`}
                ratio={learning.actionCounts[action] / totalActions}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Reward History</h2>
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          최근 {learning.recentRewards.length}개 학습 보상. 최대 80개를 유지한다.
        </p>
        <div className="mt-3 border border-lab-border bg-lab-elevated px-3 py-3">
          <LineChart
            points={learning.recentRewards.map((reward, index) => ({ x: index + 1, y: reward }))}
            color="#c9a227"
            emptyLabel="이 개체의 학습 보상이 아직 없다."
            xFormat={(value) => `${value.toFixed(0)}`}
            yFormat={(value) => value.toFixed(1)}
          />
        </div>
      </section>
    </div>
  )
}

function Meter({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: string
}) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-lab-muted">{label}</span>
        <span className="font-mono text-lab-text">{Math.round(clamped)}</span>
      </div>
      <div className="mt-1 h-1.5 bg-lab-bg">
        <div className={`h-full ${tone}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-lab-muted">{label}</span>
      <span className="max-w-[58%] truncate text-right font-mono text-lab-text" title={value}>
        {value}
      </span>
    </div>
  )
}

function DistributionRow({
  label,
  detail,
  ratio,
}: {
  label: string
  detail: string
  ratio: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-lab-muted">{label}</span>
        <span className="font-mono text-lab-text">{detail}</span>
      </div>
      <div className="mt-1 h-1.5 bg-lab-bg">
        <div className="h-full bg-lab-info" style={{ width: `${Math.round(Math.max(0, ratio) * 100)}%` }} />
      </div>
    </div>
  )
}

function formatHeading(rotation: number): string {
  const degrees = ((rotation * 180) / Math.PI + 360) % 360
  return degrees.toFixed(0)
}

function formatMutatedGenes(genes: readonly string[]): string {
  return genes
    .map((gene) => GENE_LABELS[gene] ?? gene)
    .join(', ')
}

const GENE_LABELS: Record<string, string> = {
  speed: 'Speed',
  vision: 'Vision',
  energyEfficiency: 'Eff.',
  learningRate: 'α',
  explorationRate: 'Explore',
}
