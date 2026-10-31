import { useState } from 'react'
import { useSimulationStore } from '../../store/useSimulationStore'
import { shortAgentId } from '../../utils/format'
import { WorldViewer } from '../world/WorldViewer'
import { EvolutionView, LearningView, SimulationView } from './AnalysisViews'
import { Header } from './Header'
import { SettingsPanel } from './SettingsPanel'
import { SimulationControls } from './SimulationControls'
import { SimulationEndedOverlay } from './SimulationEndedOverlay'
import { WorkspaceTabs, type WorkspaceTab } from './WorkspaceTabs'

export function SimulatorLayout() {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('world')
  const selectedObjectId = useSimulationStore((state) => state.selectedObjectId)
  const selectedAgent = useSimulationStore(
    (state) => state.world.agents.find((agent) => agent.id === state.selectedObjectId) ?? null,
  )
  const selectedObject = useSimulationStore(
    (state) => state.world.objects.find((object) => object.id === state.selectedObjectId) ?? null,
  )

  const selectionLabel = selectedAgent
    ? shortAgentId(selectedAgent.id)
    : selectedObject
      ? selectedObject.id.slice(0, 8)
      : selectedObjectId
        ? selectedObjectId.slice(0, 8)
        : null

  return (
    <div className="flex h-dvh min-h-[640px] w-full min-w-[960px] flex-col bg-lab-bg text-lab-text">
      <Header />

      <div className="flex min-h-0 flex-1">
        <SettingsPanel />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <WorkspaceTabs
            active={workspaceTab}
            onChange={setWorkspaceTab}
            selectionLabel={selectionLabel}
          />

          <div className="relative min-h-0 flex-1">
            <div
              className={`absolute inset-0 ${
                workspaceTab === 'world' ? '' : 'invisible pointer-events-none'
              }`}
            >
              <WorldViewer />
              <SimulationEndedOverlay />
            </div>

            {workspaceTab === 'simulation' ? (
              <div className="absolute inset-0">
                <SimulationView />
              </div>
            ) : null}

            {workspaceTab === 'learning' ? (
              <div className="absolute inset-0">
                <LearningView />
              </div>
            ) : null}

            {workspaceTab === 'evolution' ? (
              <div className="absolute inset-0">
                <EvolutionView />
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <SimulationControls />
    </div>
  )
}
