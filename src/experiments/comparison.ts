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
