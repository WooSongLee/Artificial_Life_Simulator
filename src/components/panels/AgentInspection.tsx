import { ACTION_LABELS } from '../../learning/constants'
import { AGENT_ACTIONS } from '../../learning/types'
import { useAgentLearningView } from '../../hooks/useLearningStats'
import type { Agent } from '../../types/agent'
import { shortAgentId } from '../../utils/format'

export function AgentInspection({ agent }: { agent: Agent }) {
  const learning = useAgentLearningView(agent)
  const totalActions = AGENT_ACTIONS.reduce((sum, action) => sum + learning.actionCounts[action], 0)

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
          <InfoRow label="Age" value={`${agent.age.toFixed(1)}s`} />
          <InfoRow label="Speed" value={`${agent.speed.toFixed(2)} u/s`} />
          <InfoRow label="Vision" value={`${agent.vision.toFixed(1)} u`} />
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
          <InfoRow label="Epsilon" value={learning.epsilon.toFixed(3)} />
          <InfoRow label="Total Reward" value={learning.totalReward.toFixed(1)} />
          <InfoRow label="Avg Reward" value={learning.averageReward.toFixed(2)} />
          <InfoRow label="Avg Q" value={learning.averageQValue.toFixed(3)} />
          <InfoRow label="Exploration" value={`${(learning.explorationRate * 100).toFixed(1)}%`} />
          <InfoRow label="Visited States" value={learning.visitedStates.toString()} />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">행동 분포</h2>
        <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3">
          {AGENT_ACTIONS.map((action) => (
            <DistributionRow
              key={action}
              label={ACTION_LABELS[action]}
              count={learning.actionCounts[action]}
              total={totalActions}
            />
          ))}
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

function formatHeading(rotation: number): string {
  const degrees = ((rotation * 180) / Math.PI + 360) % 360
  return degrees.toFixed(0)
}
