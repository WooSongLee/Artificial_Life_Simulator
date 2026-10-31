import { useShallow } from 'zustand/react/shallow'
import { useSimulationStore } from '../../store/useSimulationStore'
import { AgentMesh } from './AgentMesh'

export function Agents() {
  const agentIds = useSimulationStore(
    useShallow((state) => state.world.agents.map((agent) => agent.id)),
  )
  const showAgents = useSimulationStore((state) => state.settings.showAgents)

  if (!showAgents) return null

  return (
    <group>
      {agentIds.map((id) => (
        <AgentMesh key={id} agentId={id} />
      ))}
    </group>
  )
}
