import { WorldViewer } from '../world/WorldViewer'
import { Header } from './Header'
import { InfoPanel } from './InfoPanel'
import { SettingsPanel } from './SettingsPanel'
import { SimulationControls } from './SimulationControls'

export function SimulatorLayout() {
  return (
    <div className="flex h-dvh min-h-[640px] w-full min-w-[1100px] flex-col bg-lab-bg text-lab-text">
      <Header />

      <div className="flex min-h-0 flex-1">
        <SettingsPanel />

        <main className="relative min-h-0 min-w-0 flex-1">
          <div className="absolute inset-0">
            <WorldViewer />
          </div>
        </main>

        <InfoPanel />
      </div>

      <SimulationControls />
    </div>
  )
}
