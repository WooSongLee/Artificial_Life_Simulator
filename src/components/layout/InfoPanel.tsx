import { useSimulationStore } from '../../store/useSimulationStore'
import { AgentInspection } from '../panels/AgentInspection'
import { EcosystemStats } from '../panels/EcosystemStats'
import { ObjectInspection } from '../panels/ObjectInspection'

export function InfoPanel() {
  const selectedObjectId = useSimulationStore((state) => state.selectedObjectId)
  const selectedObject = useSimulationStore(
    (state) => state.world.objects.find((object) => object.id === state.selectedObjectId) ?? null,
  )
  const selectedAgent = useSimulationStore(
    (state) => state.world.agents.find((agent) => agent.id === state.selectedObjectId) ?? null,
  )

  const title = selectedAgent
    ? '개체 상세'
    : selectedObject
      ? '오브젝트 상세'
      : '생태계 통계'

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-lab-border bg-lab-panel">
      <div className="border-b border-lab-border px-4 py-3 text-[11px] text-lab-muted">
        {title}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {selectedAgent && selectedObjectId ? (
          <AgentInspection agent={selectedAgent} />
        ) : selectedObject && selectedObjectId ? (
          <ObjectInspection object={selectedObject} />
        ) : (
          <EcosystemStats />
        )}
      </div>
    </aside>
  )
}
