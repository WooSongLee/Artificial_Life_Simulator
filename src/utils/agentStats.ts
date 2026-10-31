import type { Agent, AgentStats } from '../types/agent'

export function summarizeAgents(agents: Agent[]): AgentStats {
  let aliveCount = 0
  let energySum = 0
  let healthSum = 0
  let deadCount = 0
  let lifespanSum = 0

  for (const agent of agents) {
    if (agent.alive) {
      aliveCount += 1
      energySum += agent.energy
      healthSum += agent.health
      continue
    }

    deadCount += 1
    lifespanSum += agent.age
  }

  return {
    totalAgents: agents.length,
    aliveCount,
    deadCount,
    averageEnergy: aliveCount === 0 ? 0 : energySum / aliveCount,
    averageHealth: aliveCount === 0 ? 0 : healthSum / aliveCount,
    averageLifespan: deadCount === 0 ? 0 : lifespanSum / deadCount,
  }
}
