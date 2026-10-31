import { useThrottledStore } from '../../hooks/useThrottledStore'
import { useSimulationStore } from '../../store/useSimulationStore'
import { AgentInspection } from '../panels/AgentInspection'
import { ObjectInspection } from '../panels/ObjectInspection'

export function WorldInspectionPanel() {
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
  const selectObject = useSimulationStore((state) => state.selectObject)

  if (!selectedAgent && !selectedObject) {
    return null
  }

  return (
    <aside className="absolute inset-y-0 right-0 z-10 flex w-[min(20rem,100%)] flex-col border-l border-lab-border bg-lab-panel">
      <div className="flex items-center justify-between border-b border-lab-border px-4 py-3">
        <h2 className="text-[11px] text-lab-muted">선택 정보</h2>
        <button
          type="button"
          onClick={() => selectObject(null)}
          className="text-[11px] text-lab-muted transition-colors hover:text-lab-text"
        >
          닫기
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {selectedAgent ? (
          <AgentInspection agent={selectedAgent} />
        ) : selectedObject ? (
          <ObjectInspection object={selectedObject} />
        ) : null}
      </div>
    </aside>
  )
}
