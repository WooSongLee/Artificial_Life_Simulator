import { GENE_LABELS } from '../../evolution/metrics'
import { GENOME_GENES, type GenomeGene } from '../../evolution/types'
import { ACTION_EVENT_LIMIT_PER_AGENT } from '../../learning/actionEvents'
import {
  ACTION_LABELS,
  ACTION_OUTCOME_LABELS,
  DECISION_TYPE_LABELS,
} from '../../learning/constants'
import { AGENT_ACTIONS } from '../../learning/types'
import { useAgentActionEvents, useAgentLearningView } from '../../hooks/useLearningStats'
import { useThrottledStore } from '../../hooks/useThrottledStore'
import { TERRAIN_LABELS } from '../../simulation/constants'
import { getAgentTerrain, getAgentTerrainProfile, getEffectiveVision } from '../../simulation/terrain'
import { lookAheadPoint, observeTerrainAhead } from '../../learning/observation'
import type { Agent } from '../../types/agent'
import { TOOL_LABELS } from '../../types/forage'
import { shortAgentId } from '../../utils/format'
import { formatSimulationTime } from '../../utils/time'
import { LineChart } from '../charts/LineChart'
import { EmptyState } from '../ui/EmptyState'

export function AgentInspection({ agent }: { agent: Agent }) {
  const world = useThrottledStore((state) => state.world, 150, agent.id)
  const learning = useAgentLearningView(agent)
  const actionEvents = useAgentActionEvents(agent.id)
  const terrain = getAgentTerrain(agent, world)
  const terrainProfile = getAgentTerrainProfile(agent, world)
  const terrainAhead = observeTerrainAhead(agent, world)
  const effectiveVision = getEffectiveVision(agent, world)
  const look = lookAheadPoint(agent)
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
          <InfoRow
            label="Survival Time"
            value={`${agent.age.toFixed(1)}s / ${agent.maxLifespan.toFixed(0)}s`}
          />
          <InfoRow label="Generation" value={`${agent.generation}`} />
          <InfoRow
            label="Mating"
            value={agent.matingPartnerId && agent.matingTimeLeft > 0 ? 'Mating' : 'Idle'}
          />
          <InfoRow
            label="Death Cause"
            value={
              agent.deathCause === 'age'
                ? 'Old age'
                : agent.deathCause === 'combat'
                  ? 'Combat'
                  : agent.deathCause === 'health'
                    ? 'Health'
                    : '—'
            }
          />
          <InfoRow label="Speed" value={`${agent.speed.toFixed(2)} u/s`} />
          <InfoRow label="Vision" value={`${agent.vision.toFixed(1)} u`} />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Equipment</h2>
        <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
          <InfoRow
            label="Tool"
            value={agent.equipment ? TOOL_LABELS[agent.equipment.toolType] : 'None'}
          />
          {agent.equipment ? (
            <Meter
              label="Durability"
              value={(agent.equipment.durability / agent.equipment.maxDurability) * 100}
              tone={agent.equipment.durability / agent.equipment.maxDurability >= 0.5 ? 'bg-lab-info' : 'bg-lab-warn'}
            />
          ) : (
            <p className="text-[12px] leading-5 text-lab-muted">
              PICK_UP a nearby tool into the single equipment slot. A broken tool is removed.
            </p>
          )}
          {agent.equipment ? (
            <InfoRow
              label="Uses left"
              value={`${agent.equipment.durability} / ${agent.equipment.maxDurability}`}
            />
          ) : null}
          <InfoRow label="Defend" value={agent.defendTimeLeft > 0 ? `${agent.defendTimeLeft.toFixed(2)}s` : 'Off'} />
          <InfoRow
            label="Attack cooldown"
            value={agent.attackCooldownLeft > 0 ? `${agent.attackCooldownLeft.toFixed(2)}s` : 'Ready'}
          />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Terrain</h2>
        <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
          <InfoRow label="Current" value={TERRAIN_LABELS[terrain]} />
          <InfoRow label="Ahead" value={TERRAIN_LABELS[terrainAhead]} />
          <InfoRow
            label="Move"
            value={`×${terrainProfile.moveSpeedMultiplier.toFixed(2)} → ${(agent.speed * terrainProfile.moveSpeedMultiplier).toFixed(2)} u/s`}
          />
          <InfoRow
            label="Energy Drain"
            value={`×${terrainProfile.energyDrainMultiplier.toFixed(2)}`}
          />
          <InfoRow
            label="Vision"
            value={`×${terrainProfile.visionMultiplier.toFixed(2)} → ${effectiveVision.toFixed(1)} u`}
          />
          <InfoRow
            label="Concealment"
            value={`${Math.round(terrainProfile.concealment * 100)}%`}
          />
          <InfoRow label="Walkable" value={terrainProfile.walkable ? 'Yes' : 'No'} />
          <p className="pt-1 text-[12px] leading-5 text-lab-muted">
            Ahead samples ({look.x.toFixed(1)}, {look.z.toFixed(1)}). Concealment reduces food and
            mate detection. Terrain entry itself does not add a reward.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Genome</h2>
        <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
          {GENOME_GENES.map((gene) => (
            <GeneRow key={gene} agent={agent} gene={gene} />
          ))}
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
            Genome은 부모에게서 전달되는 선천적 특성이다. Strength는 피해량, Tool Affinity는 도구
            효율에 쓰인다. Aggression/Caution은 정책 점수의 작은 편향이며 Q 값을 바꾸지 않는다.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">생존 상태</h2>
        <div className="mt-3 space-y-3 border border-lab-border bg-lab-elevated px-3 py-3">
          <Meter label="Energy" value={agent.energy} tone="bg-lab-warn" />
          <Meter label="Hunger" value={agent.hunger} tone="bg-lab-danger" />
          <Meter label="Health" value={agent.health} tone="bg-lab-accent" />
          <Meter label="Desire" value={agent.desire} tone="bg-[#f071a8]" />
          <Meter
            label="Life"
            value={agent.maxLifespan <= 0 ? 0 : (1 - agent.age / agent.maxLifespan) * 100}
            tone="bg-lab-info"
          />
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
          <InfoRow label="State" value={learning.lastStateKey ? formatStateKey(learning.lastStateKey) : '—'} />
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
            <InfoRow label="Visited States" value={`${qTable.visitedStates}`} />
            <InfoRow
              label="Theoretical Space"
              value={`${qTable.stateSpaceSize.toLocaleString()}`}
            />
            <InfoRow label="Coverage" value={`${(qTable.coverage * 100).toFixed(2)}%`} />
            <InfoRow label="Avg Q" value={qTable.averageQ.toFixed(3)} />
            <InfoRow label="Min Q" value={qTable.minQ.toFixed(3)} />
            <InfoRow label="Max Q" value={qTable.maxQ.toFixed(3)} />
            <p className="pt-1 text-[12px] leading-5 text-lab-muted">
              Q-Table은 방문한 상태만 저장한다. 이론 공간 {qTable.stateSpaceSize.toLocaleString()}은
              참고값이다. Preferred action은 각 방문 상태에서 Q가 가장 높은 행동이다.
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
        <h2 className="text-[11px] text-lab-muted">Current Q-values</h2>
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          마지막 관찰 상태의 학습된 Q와 선천적 genetic bias다. Score = Q + bias이며, bias는 Q-Table을
          덮어쓰지 않는다. 탐험은 기존처럼 무작위 가중 선택이다.
        </p>
        {learning.currentQByAction && learning.lastStateKey ? (
          <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
            <InfoRow label="State" value={formatStateKey(learning.lastStateKey)} />
            {AGENT_ACTIONS.map((action) => (
              <InfoRow
                key={action}
                label={ACTION_LABELS[action]}
                value={`Q ${learning.currentQByAction?.[action].toFixed(3) ?? '—'} · bias ${
                  learning.currentGeneticBiasByAction?.[action].toFixed(3) ?? '0.000'
                } · score ${learning.currentSelectionScoreByAction?.[action].toFixed(3) ?? '—'}`}
              />
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState>이 개체의 현재 상태 Q 값이 아직 없다.</EmptyState>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Action Timeline</h2>
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          최근 완료된 선택·실행 이벤트다. 개체당 최대 {ACTION_EVENT_LIMIT_PER_AGENT}개를 유지한다.
          보상은 실행 후에만 기록한다.
        </p>
        <div className="mt-3">
          {actionEvents.length === 0 ? (
            <EmptyState>이 개체의 행동 이벤트가 아직 없다.</EmptyState>
          ) : (
            <div className="space-y-2">
              {actionEvents.slice(0, 24).map((event) => (
                <div
                  key={event.eventId}
                  className="border border-lab-border bg-lab-elevated px-3 py-2 text-[12px]"
                  title={event.stateKey}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-lab-text">{ACTION_LABELS[event.selectedAction]}</span>
                    <span className="font-mono text-lab-muted">{formatSimulationTime(event.simulationTime)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-lab-muted">
                    <span>{DECISION_TYPE_LABELS[event.decisionType]}</span>
                    <span>ε {event.epsilon.toFixed(3)}</span>
                    <span>
                      Q {event.qValues[AGENT_ACTIONS.indexOf(event.selectedAction)]?.toFixed(2) ?? '—'}
                    </span>
                    <span>
                      bias {event.geneticBias[AGENT_ACTIONS.indexOf(event.selectedAction)]?.toFixed(2) ?? '0.00'}
                    </span>
                    <span>{ACTION_OUTCOME_LABELS[event.outcome]}</span>
                    <span>r {event.reward.toFixed(2)}</span>
                    {event.targetKind ? <span>{event.targetKind.replace('_', ' ')}</span> : null}
                    {event.targetId ? <span>target {shortAgentId(event.targetId)}</span> : null}
                    {event.gatheredAmount > 0 ? <span>qty {event.gatheredAmount}</span> : null}
                    {event.damageDealt > 0 ? <span>dmg {event.damageDealt.toFixed(1)}</span> : null}
                    {event.damageReduced > 0 ? <span>blocked {event.damageReduced.toFixed(1)}</span> : null}
                    {event.durabilityDelta !== 0 ? <span>dur {event.durabilityDelta}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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

function formatStateKey(stateKey: string): string {
  return stateKey.replaceAll('|', ' · ')
}

function formatHeading(rotation: number): string {
  const degrees = ((rotation * 180) / Math.PI + 360) % 360
  return degrees.toFixed(0)
}

function formatMutatedGenes(genes: readonly string[]): string {
  return genes
    .map((gene) => GENE_LABELS[gene as GenomeGene] ?? gene)
    .join(', ')
}

function formatGeneValue(gene: GenomeGene, value: number): string {
  if (gene === 'lifespan') return `${value.toFixed(0)}s`
  if (gene === 'vision') return value.toFixed(1)
  if (gene === 'learningRate' || gene === 'explorationRate') return value.toFixed(3)
  return value.toFixed(2)
}

function GeneRow({ agent, gene }: { agent: Agent; gene: GenomeGene }) {
  const child = agent.genome[gene]
  const parents = agent.parentGenomes
  const mutated = agent.mutatedGenes.includes(gene)
  const parentText = parents
    ? `A ${formatGeneValue(gene, parents[0][gene])} · B ${formatGeneValue(gene, parents[1][gene])}`
    : agent.parentIds
      ? 'parents unavailable'
      : 'founder'

  return (
    <div className="space-y-0.5">
      <InfoRow label={GENE_LABELS[gene]} value={formatGeneValue(gene, child)} />
      <div className="flex items-center justify-between gap-3 text-[11px] text-lab-muted">
        <span>{parentText}</span>
        <span className="font-mono">
          {agent.parentIds ? (mutated ? 'mutated' : 'inherited') : 'founder'}
        </span>
      </div>
    </div>
  )
}
