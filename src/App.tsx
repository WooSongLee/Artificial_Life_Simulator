import { SimulatorLayout } from './components/layout/SimulatorLayout'
import { useSimulationLoop } from './hooks/useSimulationLoop'

export default function App() {
  useSimulationLoop()

  return <SimulatorLayout />
}
