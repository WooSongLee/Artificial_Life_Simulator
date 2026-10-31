import { createBrain, getBrain } from '../learning/brain'
import type { AgentBrain, LearningConfig, StateKey } from '../learning/types'
import type { Agent } from '../types/agent'

export function cloneQTable(table: Map<StateKey, number[]>): Map<StateKey, number[]> {
  const cloned = new Map<StateKey, number[]>()
  for (const [key, values] of table) {
    cloned.set(key, values.slice())
  }
  return cloned
}

export function inheritBrain(
  parentId: string,
  config: LearningConfig,
  initialEpsilon: number,
): AgentBrain {
  const child = createBrain(config, initialEpsilon)
  const parent = getBrain(parentId)
  if (parent) {
    child.qTable = cloneQTable(parent.qTable)
  }
  return child
}

export function assignChildBrains(
  children: readonly Agent[],
  inheritQTable: boolean,
  config: LearningConfig,
  setBrain: (agentId: string, brain: AgentBrain) => void,
): void {
  for (const child of children) {
    const brain =
      inheritQTable && child.inheritParentId
        ? inheritBrain(child.inheritParentId, config, child.genome.explorationRate)
        : createBrain(config, child.genome.explorationRate)
    setBrain(child.id, brain)
  }
}
