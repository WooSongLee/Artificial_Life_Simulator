export const ACTION_SCHEMA_VERSION = 3
export const OBSERVATION_SCHEMA_VERSION = 4

export const V1_STATE_SPACE_LIMIT = 360
export const V1_ACTION_COUNT = 5
export const V2_ACTION_COUNT = 7
export const V3_ACTION_COUNT = 10
export const V2_VISITED_STATE_LIMIT = 8000

export const V1_OBSERVATION_TOKENS = 5
export const V2_OBSERVATION_TOKENS = 7
export const V3_OBSERVATION_TOKENS = 10
export const V4_OBSERVATION_TOKENS = 13

export function actionCountForSchema(version: number): number {
  if (version <= 1) return V1_ACTION_COUNT
  if (version === 2) return V2_ACTION_COUNT
  return V3_ACTION_COUNT
}

export function observationTokenCountForSchema(version: number): number {
  if (version <= 1) return V1_OBSERVATION_TOKENS
  if (version === 2) return V2_OBSERVATION_TOKENS
  if (version === 3) return V3_OBSERVATION_TOKENS
  return V4_OBSERVATION_TOKENS
}

export function canPadActionSchema(fromVersion: number, toVersion: number): boolean {
  return (
    Number.isFinite(fromVersion) &&
    Number.isFinite(toVersion) &&
    fromVersion >= 1 &&
    toVersion >= fromVersion &&
    toVersion <= ACTION_SCHEMA_VERSION &&
    actionCountForSchema(fromVersion) <= actionCountForSchema(toVersion)
  )
}

export function isValidStateKeyForSchema(stateKey: unknown, version: number): stateKey is string {
  if (typeof stateKey !== 'string' || stateKey.length === 0) return false
  if (stateKey.includes('undefined') || stateKey.includes('NaN') || stateKey.includes('Infinity')) {
    return false
  }
  return stateKey.split('|').length === observationTokenCountForSchema(version)
}
