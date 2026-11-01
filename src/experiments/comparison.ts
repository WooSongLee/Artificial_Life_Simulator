import type { ExperimentComparisonRow, ExperimentRecord, ExperimentSummary } from './types'

export type ComparableExperiment = Pick<ExperimentSummary, 'id' | 'name' | 'statistics'>

export function toComparable(record: ExperimentRecord): ComparableExperiment {
  return {
    id: record.id,
    name: record.name,
    statistics: record.statistics,
  }
}

export function buildComparisonRows(experiments: ComparableExperiment[]): ExperimentComparisonRow[] {
  const values = (read: (item: ComparableExperiment) => number | null): Array<number | null> =>
    experiments.map(read)

  return [
    {
      key: 'populationSurvival',
      label: 'Population Survival',
      format: 'percent',
      values: values((item) => item.statistics.populationSurvival),
    },
    {
      key: 'averageReward',
      label: 'Average Reward',
      format: 'emptyable',
      values: values((item) => item.statistics.averageReward),
    },
    {
      key: 'averageLifespan',
      label: 'Average Lifespan',
      format: 'emptyable',
      values: values((item) => item.statistics.averageLifespan),
    },
    {
      key: 'generationCount',
      label: 'Generation Count',
      format: 'integer',
      values: values((item) => item.statistics.generationCount),
    },
    {
      key: 'currentGeneration',
      label: 'Current Generation',
      format: 'integer',
      values: values((item) => item.statistics.currentGeneration),
    },
    {
      key: 'genome.speed',
      label: 'Avg Speed',
      format: 'number',
      values: values((item) => item.statistics.averageGenome.speed),
    },
    {
      key: 'genome.vision',
      label: 'Avg Vision',
      format: 'number',
      values: values((item) => item.statistics.averageGenome.vision),
    },
    {
      key: 'genome.energyEfficiency',
      label: 'Avg Energy Efficiency',
      format: 'number',
      values: values((item) => item.statistics.averageGenome.energyEfficiency),
    },
    {
      key: 'genome.learningRate',
      label: 'Avg Genome Learning Rate',
      format: 'number',
      values: values((item) => item.statistics.averageGenome.learningRate),
    },
    {
      key: 'genome.explorationRate',
      label: 'Avg Genome Exploration',
      format: 'number',
      values: values((item) => item.statistics.averageGenome.explorationRate),
    },
    {
      key: 'genome.libido',
      label: 'Avg Libido',
      format: 'number',
      values: values((item) => item.statistics.averageGenome.libido),
    },
    {
      key: 'genome.lifespan',
      label: 'Avg Lifespan Gene',
      format: 'number',
      values: values((item) => item.statistics.averageGenome.lifespan),
    },
    {
      key: 'genome.strength',
      label: 'Avg Strength',
      format: 'number',
      values: values((item) => item.statistics.averageGenome.strength),
    },
    {
      key: 'genome.aggression',
      label: 'Avg Aggression',
      format: 'number',
      values: values((item) => item.statistics.averageGenome.aggression),
    },
    {
      key: 'genome.caution',
      label: 'Avg Caution',
      format: 'number',
      values: values((item) => item.statistics.averageGenome.caution),
    },
    {
      key: 'genome.toolAffinity',
      label: 'Avg Tool Affinity',
      format: 'number',
      values: values((item) => item.statistics.averageGenome.toolAffinity),
    },
    {
      key: 'foodEaten',
      label: 'Food Eaten',
      format: 'integer',
      values: values((item) => item.statistics.foodEaten ?? 0),
    },
    {
      key: 'resourcesGathered',
      label: 'Resources Gathered',
      format: 'integer',
      values: values((item) => item.statistics.resourcesGathered ?? 0),
    },
    {
      key: 'toolUsageSuccessRate',
      label: 'Tool Usage Success',
      format: 'percent',
      values: values((item) => item.statistics.toolUsageSuccessRate ?? null),
    },
    {
      key: 'damageDealt',
      label: 'Damage Dealt',
      format: 'number',
      values: values((item) => item.statistics.damageDealt ?? 0),
    },
    {
      key: 'damageReceived',
      label: 'Damage Received',
      format: 'number',
      values: values((item) => item.statistics.damageReceived ?? 0),
    },
    {
      key: 'combatDeaths',
      label: 'Combat Deaths',
      format: 'integer',
      values: values((item) => item.statistics.combatDeaths ?? 0),
    },
    {
      key: 'combatSurvivalRate',
      label: 'Combat Survival',
      format: 'percent',
      values: values((item) => item.statistics.combatSurvivalRate ?? null),
    },
    {
      key: 'reproductionCount',
      label: 'Reproduction',
      format: 'integer',
      values: values((item) => item.statistics.reproductionCount ?? 0),
    },
    {
      key: 'visitedStates',
      label: 'Visited Q States',
      format: 'integer',
      values: values((item) => item.statistics.visitedStates ?? 0),
    },
  ]
}

export function formatComparisonValue(
  value: number | null,
  format: ExperimentComparisonRow['format'],
): string {
  if (value === null) return '—'
  if (format === 'percent') return `${(value * 100).toFixed(0)}%`
  if (format === 'integer') return value.toFixed(0)
  if (format === 'emptyable') return value.toFixed(2)
  return value.toFixed(2)
}
