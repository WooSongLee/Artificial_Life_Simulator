export type {
  EvolutionConfig,
  GenerationEndReason,
  GenerationRecord,
  Genome,
  GenomeGene,
  MutationSummary,
} from '../evolution/types'
export type { AgentAction, LearningConfig, LearningStats, Observation, RewardConfig } from '../learning/types'
export type {
  ActionTarget,
  Agent,
  AgentPosition,
  AgentStats,
  AgentTrail,
  AgentTrailPoint,
  DeathCause,
  TrailChoiceKind,
} from './agent'
export type { AttackIntent, CombatCue, CombatCueKind, CombatHit } from './combat'

export type {
  EquippedTool,
  ForageKind,
  ForageNode,
  ToolType,
  WorldTool,
} from './forage'

export type {
  DoorInteractable,
  Interactable,
  InteractableKind,
  LookoutInteractable,
  MovableBoxInteractable,
  RestBedInteractable,
  SwitchInteractable,
} from './interactable'
export {
  INTERACTABLE_KINDS,
  isDoor,
  isLookout,
  isMovableBox,
  isRestBed,
  isSwitch,
} from './interactable'

export type {
  TerrainGrid,
  TerrainPreset,
  TerrainProfile,
  TerrainType,
} from './terrain'

export type {
  LabEnvironmentState,
  LabTimePeriod,
  ObjectDefinition,
  ResourceDistribution,
  SimulationMode,
  Vec3,
  WorldConfig,
  WorldObject,
  WorldObjectType,
  WorldOutcomeStats,
  WorldState,
} from './world'
export { LAB_TIME_PERIODS, SIMULATION_MODES } from './world'

export type {
  LabAffordanceDefinition,
  LabAffordanceKind,
  LabDiscoveryStatus,
  LabObjectCategory,
  LabObjectInstance,
  LabObjectRelation,
  LabObjectState,
  LabObjectTypeDefinition,
  LabWorldLayout,
  LabZoneDefinition,
  LabZoneId,
  LabZonePresence,
} from './labObject'
export { LAB_AFFORDANCE_KINDS, LAB_ZONE_IDS } from './labObject'

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
