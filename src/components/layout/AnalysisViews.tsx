import type { ReactNode } from 'react'
import { useSimulationStore } from '../../store/useSimulationStore'
import { AgentInspection } from '../panels/AgentInspection'
import { EcosystemStats } from '../panels/EcosystemStats'
import { EvolutionDashboard } from '../panels/EvolutionDashboard'
import { LearningDashboard } from '../panels/LearningDashboard'
import { ObjectInspection } from '../panels/ObjectInspection'

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
  const selectedObject = useSimulationStore(
    (state) => state.world.objects.find((object) => object.id === state.selectedObjectId) ?? null,
  )
  const selectedAgent = useSimulationStore(
    (state) => state.world.agents.find((agent) => agent.id === state.selectedObjectId) ?? null,
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

  return null
}
