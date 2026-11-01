import { useCallback, useEffect, useState } from 'react'
import {
  deleteExperiment,
  downloadExperimentJson,
  formatMigrationNotice,
  formatValidationIssues,
  getExperiment,
  listExperiments,
  parseExperimentJson,
  prepareImportedExperiment,
  readFileAsText,
  saveExperiment,
  saveSession,
} from '../experiments'
import { captureExperimentRecord } from '../experiments/snapshot'
import type { ExperimentRecord, ExperimentSummary } from '../experiments/types'
import { useSimulationStore } from '../store/useSimulationStore'

export function useExperimentLibrary() {
  const [items, setItems] = useState<ExperimentSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const next = await listExperiments()
    setItems(next)
    setReady(true)
  }, [])

  useEffect(() => {
    void refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Could not read saved experiments')
    })
  }, [refresh])

  const capture = useCallback(() => {
    const state = useSimulationStore.getState()
    return captureExperimentRecord({
      identity: state.experiment,
      simulation: state,
    })
  }, [])

  const run = useCallback(async (task: () => Promise<string>) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const nextMessage = await task()
      setMessage(nextMessage)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Experiment action failed')
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const saveCurrent = useCallback(
    () =>
      run(async () => {
        const record = capture()
        await saveExperiment(record)
        await saveSession(record)
        useSimulationStore.getState().markSaved(record.updatedAt)
        return `Saved “${record.name}”.`
      }),
    [capture, run],
  )

  const loadById = useCallback(
    (id: string) =>
      run(async () => {
        const record = await getExperiment(id)
        if (!record) {
          throw new Error('Saved experiment is missing or invalid')
        }
        useSimulationStore.getState().loadExperimentRecord(record)
        const notice = formatMigrationNotice(record)
        return notice ? `Loaded “${record.name}”. ${notice}` : `Loaded “${record.name}”.`
      }),
    [run],
  )

  const removeById = useCallback(
    (id: string) =>
      run(async () => {
        await deleteExperiment(id)
        return 'Deleted experiment.'
      }),
    [run],
  )

  const exportById = useCallback(
    (id: string) =>
      run(async () => {
        const current = useSimulationStore.getState().experiment
        const record = current.id === id ? capture() : await getExperiment(id)
        if (!record) {
          throw new Error('Nothing to export')
        }
        downloadExperimentJson(record)
        return `Exported “${record.name}”.`
      }),
    [capture, run],
  )

  const exportCurrent = useCallback(
    () =>
      run(async () => {
        const record = capture()
        downloadExperimentJson(record)
        return `Exported “${record.name}”.`
      }),
    [capture, run],
  )

  const importFile = useCallback(
    (file: File) =>
      run(async () => {
        const text = await readFileAsText(file)
        const parsed = parseExperimentJson(text)
        if (!parsed.ok || !parsed.value) {
          throw new Error(formatValidationIssues(parsed.issues) || 'Invalid experiment JSON')
        }
        const imported = prepareImportedExperiment(parsed.value)
        await saveExperiment(imported)
        useSimulationStore.getState().loadExperimentRecord(imported)
        const notice = formatMigrationNotice(imported)
        return notice ? `Imported “${imported.name}”. ${notice}` : `Imported “${imported.name}”.`
      }),
    [run],
  )

  const loadRecords = useCallback(async (ids: string[]): Promise<ExperimentRecord[]> => {
    const records: ExperimentRecord[] = []
    for (const id of ids) {
      const record = await getExperiment(id)
      if (record) records.push(record)
    }
    return records
  }, [])

  return {
    items,
    busy,
    ready,
    message,
    error,
    refresh,
    saveCurrent,
    loadById,
    removeById,
    exportById,
    exportCurrent,
    importFile,
    loadRecords,
  }
}
