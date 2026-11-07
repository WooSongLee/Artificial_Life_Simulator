import type { Genome, GenomeGene } from '../evolution/types'
import type { AgentAction } from '../learning/types'
import type { CombatCue } from './combat'
import type { EquippedTool } from './forage'

export type DeathCause = 'health' | 'age' | 'combat'

export interface AgentPosition {
  x: number
  z: number
}

export interface ActionTarget {
  kind: string
  id: string | null
  x: number
  z: number
}

export interface Agent {
  id: string
  position: AgentPosition
  rotation: number
  energy: number
  hunger: number
  health: number
  speed: number
  vision: number
  age: number
  maxLifespan: number
  desire: number
  alive: boolean
  deathCause: DeathCause | null
  generation: number
  parentIds: [string, string] | null
  parentGenomes: [Genome, Genome] | null
  inheritParentId: string | null
  genome: Genome
  mutatedGenes: GenomeGene[]
  matingPartnerId: string | null
  matingTimeLeft: number
  turnRate: number
  turnBias: number
  wanderTimer: number
  wanderInterval: number
  lastAction: AgentAction | null
  lastReward: number
  lastStateKey: string | null
  equipment: EquippedTool | null
  defendTimeLeft: number
  attackCooldownLeft: number
  lastAttackerId: string | null
  lastCombatTick: number
  combatCue: CombatCue | null
  actionTarget: ActionTarget | null
  /**
   * Lab-only human drives (STEP 19). Absent in Ecology so ecology schema stays untouched.
   * 0–100; fatigue/curiosity rise unmet; comfort decays without rest.
   */
  fatigue?: number
  curiosity?: number
  comfort?: number
  /**
   * Lab-only held LabObject instance id (Env-P2). Separate from Ecology `equipment`.
   * Enables requiresHeldType chains (pick food → stove operate / table consume).
   */
  heldLabObjectId?: string | null
}

/** Lab survival vs drive mark for watchable trails (null = ordinary motion). */
export type TrailChoiceKind = 'drive' | 'survival'

export interface AgentTrailPoint {
  x: number
  z: number
  action: AgentAction | null
  /** Set when this sample coincides with Eat or rest_bed/lookout GATHER. */
  choice?: TrailChoiceKind | null
}

export type AgentTrail = AgentTrailPoint[]

export interface AgentStats {
  totalAgents: number
  aliveCount: number
  deadCount: number
  averageEnergy: number
  averageHealth: number
  averageLifespan: number
}
