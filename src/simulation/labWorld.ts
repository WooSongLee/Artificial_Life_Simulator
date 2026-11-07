/**
 * Human Life Sandbox world module facade (P0–P3).
 * Zones + object catalog + legacy bridge + kitchen/bedroom runtime + ambient env.
 */

export {
  applyLabEnvironmentDriveEffects,
  createDefaultLabEnvironment,
  ensureWorldLabEnvironment,
  LAB_ENV_DAY_LENGTH_SEC,
  LAB_ENV_HOURS_PER_SEC,
  periodFromHours,
  sanitizeLabEnvironment,
  sunLightingFromHours,
  temperatureTargetForHours,
  tickLabEnvironment,
} from './labEnvironment'

export {
  AFFORDANCE_EXECUTOR,
  affordanceKindsOn,
  defineAffordance,
  executorActionFor,
  executorActionsForType,
  findAffordance,
  isLabAffordanceKind,
  stateMatchesEquals,
} from './labAffordance'

export {
  assertLabObjectCatalogIntegrity,
  bridgedLegacyObjectTypes,
  createDefaultLabWorldLayout,
  getLabObjectType,
  LAB_OBJECT_TYPE_DEFINITIONS,
  LAB_OBJECT_TYPE_IDS,
  labObjectTypesInZone,
  requireLabObjectType,
} from './labObjectCatalog'

export {
  assertLegacyBridgeCoverage,
  catalogTypeForInteractable,
  labInstanceFromInteractable,
  labInstancesFromInteractables,
  objectStateFromInteractable,
  objectTypeForInteractableKind,
  zoneForInteractable,
} from './labObjectBridge'

export {
  activeLabZones,
  assertLabZoneCatalogIntegrity,
  createLabWorldLayout,
  LAB_LAYOUT_VERSION,
  LAB_ZONE_DEFINITIONS,
  labZoneById,
  plannedLabZones,
  pointInBounds,
  resolveLabZone,
  zoneForLegacyAnchor,
} from './labZones'

export {
  applyLabAffordance,
  applyNeedDeltas,
  canConsumeLabFood,
  canUseLabGatherTarget,
  createKitchenBedroomLabObjects,
  createLabObjectInstance,
  findLabObjectInRange,
  LAB_KITCHEN_ANCHORS,
  selectAffordanceForAction,
  tryExecuteLabEat,
  tryExecuteLabGather,
} from './labObjectRuntime'
