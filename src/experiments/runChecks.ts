import { DEFAULT_EVOLUTION_CONFIG } from '../evolution/constants'
import { importBrains, resetBrains } from '../learning/brain'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import { DEFAULT_WORLD_CONFIG } from '../simulation/constants'
import { createLearningHistory } from '../simulation/metrics'
import { createInitialWorld } from '../simulation/worldFactory'
import { experimentToJson, prepareImportedExperiment } from './serialization'
import { applyExperimentBrains, captureExperimentRecord, createExperimentIdentity } from './snapshot'
import { parseExperimentJson, validateExperimentRecord, validateLearningConfig } from './validation'
import { buildComparisonRows } from './comparison'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function validSnapshotRoundtrip(): void {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 3,
    initialFoodCount: 8,
  })
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)
  const identity = createExperimentIdentity('Roundtrip Check')
  const record = captureExperimentRecord({
    identity,
    simulation: {
      status: 'paused',
      tick: 12,
      speed: 2,
      world,
      learningHistory: createLearningHistory(12, world.agents, true),
      generationHistory: [],
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      evolutionConfig: DEFAULT_EVOLUTION_CONFIG,
      pendingWorldConfig: null,
    },
  })

  const json = experimentToJson(record)
  const parsed = parseExperimentJson(json)
  assert(parsed.ok && parsed.value !== undefined, 'exported JSON must validate')
  assert(parsed.value?.world.agents.length === 3, 'agent count must survive export')
  assert(parsed.value?.brains.length === 3, 'brains must be stored with the experiment')
  assert(parsed.value?.schemaVersion === 1, 'schema version must be stored')

  applyExperimentBrains(parsed.value!)
  const imported = prepareImportedExperiment(parsed.value!)
  assert(imported.id !== record.id, 'import must assign a new id')
  assert(imported.name.includes('imported'), 'import must mark the name')
}

function rejectsInvalidLearningRate(): void {
  const issues = validateLearningConfig({
    ...DEFAULT_LEARNING_CONFIG,
    learningRate: 4,
  })
  assert(issues.length > 0, 'learning rate 4 must be rejected')
}

function rejectsBadJson(): void {
  const parsed = parseExperimentJson('{"schemaVersion":999}')
  assert(!parsed.ok, 'unknown schema version must be rejected')
  assert(parsed.issues.some((issue) => issue.path === 'schemaVersion'), 'schemaVersion issue required')
}

function rejectsMinEpsilonAboveInitial(): void {
  const issues = validateLearningConfig({
    ...DEFAULT_LEARNING_CONFIG,
    initialEpsilon: 0.1,
    minEpsilon: 0.4,
  })
  assert(issues.some((issue) => issue.path === 'learningConfig.minEpsilon'), 'minEpsilon > initialEpsilon must fail')
}

function comparisonUsesSavedStats(): void {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 2,
  })
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)
  const left = captureExperimentRecord({
    identity: createExperimentIdentity('A'),
    simulation: {
      status: 'paused',
      tick: 0,
      speed: 1,
      world,
      learningHistory: createLearningHistory(0, world.agents, true),
      generationHistory: [],
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      evolutionConfig: DEFAULT_EVOLUTION_CONFIG,
      pendingWorldConfig: null,
    },
  })
  const right = {
    ...left,
    id: 'other',
    name: 'B',
    statistics: {
      ...left.statistics,
      populationSurvival: 0.4,
      averageReward: 1.25,
      generationCount: 3,
    },
  }
  const rows = buildComparisonRows([left, right])
  const survival = rows.find((row) => row.key === 'populationSurvival')
  const reward = rows.find((row) => row.key === 'averageReward')
  assert(survival?.values[1] === 0.4, 'comparison must read saved survival')
  assert(reward?.values[1] === 1.25, 'comparison must read saved reward')
}

function completeRecordRejectsMissingWorld(): void {
  const result = validateExperimentRecord({
    schemaVersion: 1,
    id: 'x',
    name: 'Broken',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  assert(!result.ok, 'incomplete record must fail')
}

export function runExperimentChecks(): void {
  validSnapshotRoundtrip()
  rejectsInvalidLearningRate()
  rejectsBadJson()
  rejectsMinEpsilonAboveInitial()
  comparisonUsesSavedStats()
  completeRecordRejectsMissingWorld()
  importBrains([])
}

runExperimentChecks()
console.log('experiment checks passed')
