import { useSimulationStore } from '../../store/useSimulationStore'
import { AgentMesh } from './AgentMesh'

export function Agents() {
  const agents = useSimulationStore((state) => state.world.agents)
  const showAgents = useSimulationStore((state) => state.settings.showAgents)

  if (!showAgents) return null

  return (
    <group>
      {agents.map((agent) => (
        <AgentMesh key={agent.id} agent={agent} />
      ))}
    </group>
  )
}
