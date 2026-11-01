export type {
  EvolutionConfig,
  GenerationEndReason,
  GenerationRecord,
  Genome,
  GenomeGene,
  MutationSummary,
} from '../evolution/types'
export type { AgentAction, LearningConfig, LearningStats, Observation, RewardConfig } from '../learning/types'
export type { ActionTarget, Agent, AgentPosition, AgentStats, AgentTrail, AgentTrailPoint, DeathCause } from './agent'
export type { AttackIntent, CombatCue, CombatCueKind, CombatHit } from './combat'

export type {
  EquippedTool,
  ForageKind,
  ForageNode,
  ToolType,
  WorldTool,
} from './forage'

export type {
  TerrainGrid,
  TerrainPreset,
  TerrainProfile,
  TerrainType,
} from './terrain'

export type {
  ObjectDefinition,
  ResourceDistribution,
  Vec3,
  WorldConfig,
  WorldObject,
  WorldObjectType,
  WorldOutcomeStats,
  WorldState,
} from './world'

export type {
  LearningHistoryPoint,
  LearningHistoryState,
  SimulationActions,
  SimulationSnapshot,
  SimulationState,
  SimulationStatus,
  ViewerSettings,
  WorldStats,
} from './simulation'
