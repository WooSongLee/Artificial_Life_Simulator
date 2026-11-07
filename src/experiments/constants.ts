export const EXPERIMENT_SCHEMA_VERSION = 6
export const EXPERIMENT_DB_NAME = 'artificial-life-simulator'
export const EXPERIMENT_DB_VERSION = 1
export const EXPERIMENT_STORE = 'experiments'
export const SESSION_STORE = 'session'
export const SESSION_RECORD_ID = 'current'
export const MAX_EXPERIMENT_JSON_BYTES = 20 * 1024 * 1024
export const MAX_EXPERIMENT_NAME_LENGTH = 80
export const SESSION_AUTOSAVE_MS = 15_000

export const RESOURCE_DISTRIBUTION_LABELS = {
  uniform: 'Uniform',
  clustered: 'Clustered',
  edge: 'Edge',
} as const
