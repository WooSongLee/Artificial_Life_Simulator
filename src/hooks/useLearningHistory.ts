import { compareLearningWindows } from '../simulation/metrics'
import { useSimulationStore } from '../store/useSimulationStore'

export function useLearningHistory() {
  const history = useSimulationStore((state) => state.learningHistory)

  return {
    history,
    comparison: compareLearningWindows(history),
  }
}
