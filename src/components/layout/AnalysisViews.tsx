import type { ReactNode } from 'react'
import { useThrottledStore } from '../../hooks/useThrottledStore'
import { useSimulationStore } from '../../store/useSimulationStore'
import { AgentInspection } from '../panels/AgentInspection'
import { EcosystemStats } from '../panels/EcosystemStats'
import { EvolutionDashboard } from '../panels/EvolutionDashboard'
import { ExperimentsDashboard } from '../panels/ExperimentsDashboard'
import { LearningDashboard } from '../panels/LearningDashboard'
import { ObjectInspection } from '../panels/ObjectInspection'
import { EmptyState } from '../ui/EmptyState'

export function SimulationView() {
  return (
    <WorkspacePage>
      <InspectionColumn />
      <section className="min-w-0 flex-1">
        <EcosystemStats />
      </section>
    </WorkspacePage>
  )
}

export function LearningView() {
  return (
    <WorkspacePage>
      <InspectionColumn agentsOnly />
      <section className="min-w-0 flex-1">
        <LearningDashboard />
      </section>
    </WorkspacePage>
  )
}

export function EvolutionView() {
  return (
    <WorkspacePage>
      <InspectionColumn agentsOnly />
      <section className="min-w-0 flex-1">
        <EvolutionDashboard />
      </section>
    </WorkspacePage>
  )
}

export function ExperimentsView() {
  return (
    <WorkspacePage>
      <section className="min-w-0 flex-1">
        <ExperimentsDashboard />
      </section>
    </WorkspacePage>
  )
}

function WorkspacePage({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto bg-lab-bg">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-6 py-6 lg:flex-row lg:items-start">
        {children}
      </div>
    </div>
  )
}

function InspectionColumn({ agentsOnly = false }: { agentsOnly?: boolean }) {
  const selectedObjectId = useSimulationStore((state) => state.selectedObjectId)
  const selectedAgent = useThrottledStore(
    (state) => state.world.agents.find((agent) => agent.id === state.selectedObjectId) ?? null,
    150,
    selectedObjectId,
  )
  const selectedObject = useThrottledStore(
    (state) => state.world.objects.find((object) => object.id === state.selectedObjectId) ?? null,
    150,
    selectedObjectId,
  )

  if (selectedAgent && selectedObjectId) {
    return (
      <aside className="w-full shrink-0 lg:w-80">
        <AgentInspection agent={selectedAgent} />
      </aside>
    )
  }

  if (!agentsOnly && selectedObject && selectedObjectId) {
    return (
      <aside className="w-full shrink-0 lg:w-80">
        <ObjectInspection object={selectedObject} />
      </aside>
    )
  }

  return (
    <aside className="w-full shrink-0 lg:w-80">
      <EmptyState title="No selection">
        {agentsOnly
          ? 'World 탭에서 개체를 선택하면 상세 상태를 표시한다.'
          : 'World 탭에서 개체 또는 오브젝트를 선택하면 상세 상태를 표시한다.'}
      </EmptyState>
    </aside>
  )
}
