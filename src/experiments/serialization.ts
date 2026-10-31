import { createId } from '../utils/id'
import type { ExperimentRecord } from './types'
import { parseExperimentJson, validateExperimentRecord } from './validation'

export function experimentToJson(record: ExperimentRecord): string {
  const validated = validateExperimentRecord(record)
  if (!validated.ok || !validated.value) {
    throw new Error('Cannot export an invalid experiment')
  }
  return `${JSON.stringify(validated.value, null, 2)}\n`
}

export function downloadExperimentJson(record: ExperimentRecord): void {
  const blob = new Blob([experimentToJson(record)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const safeName = record.name.replace(/[^\w\- ]+/g, '').trim() || 'experiment'
  anchor.href = url
  anchor.download = `${safeName}.json`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function readFileAsText(file: File): Promise<string> {
  return file.text()
}

export function prepareImportedExperiment(record: ExperimentRecord): ExperimentRecord {
  const now = new Date().toISOString()
  return {
    ...record,
    id: createId('experiment'),
    createdAt: now,
    updatedAt: now,
    name: record.name.endsWith('(imported)') ? record.name : `${record.name} (imported)`,
  }
}

export { parseExperimentJson }
