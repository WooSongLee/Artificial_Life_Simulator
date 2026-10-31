import {
  EXPERIMENT_DB_NAME,
  EXPERIMENT_DB_VERSION,
  EXPERIMENT_STORE,
  SESSION_RECORD_ID,
  SESSION_STORE,
} from './constants'
import type { ExperimentRecord, ExperimentSummary } from './types'
import { validateExperimentRecord } from './validation'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EXPERIMENT_DB_NAME, EXPERIMENT_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(EXPERIMENT_STORE)) {
        const store = db.createObjectStore(EXPERIMENT_STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open experiment database'))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDatabase()
  try {
    const transaction = db.transaction(storeName, mode)
    return await run(transaction.objectStore(storeName))
  } finally {
    db.close()
  }
}

export function toExperimentSummary(record: ExperimentRecord): ExperimentSummary {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    currentGeneration: record.statistics.currentGeneration,
    tick: record.tick,
    statistics: record.statistics,
    worldConfig: record.worldConfig,
    learningConfig: record.learningConfig,
  }
}

export async function listExperiments(): Promise<ExperimentSummary[]> {
  const records = await withStore(EXPERIMENT_STORE, 'readonly', (store) =>
    requestToPromise(store.getAll() as IDBRequest<ExperimentRecord[]>),
  )

  return records
    .filter((record) => validateExperimentRecord(record).ok)
    .map(toExperimentSummary)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function getExperiment(id: string): Promise<ExperimentRecord | null> {
  const record = await withStore(EXPERIMENT_STORE, 'readonly', (store) =>
    requestToPromise(store.get(id) as IDBRequest<ExperimentRecord | undefined>),
  )
  if (!record) return null
  const validated = validateExperimentRecord(record)
  return validated.ok && validated.value ? validated.value : null
}

export async function saveExperiment(record: ExperimentRecord): Promise<void> {
  const validated = validateExperimentRecord(record)
  if (!validated.ok || !validated.value) {
    throw new Error('Refusing to save an invalid experiment record')
  }

  await withStore(EXPERIMENT_STORE, 'readwrite', (store) => requestToPromise(store.put(validated.value)))
}

export async function deleteExperiment(id: string): Promise<void> {
  await withStore(EXPERIMENT_STORE, 'readwrite', (store) => requestToPromise(store.delete(id)))
}

export async function saveSession(record: ExperimentRecord): Promise<void> {
  const validated = validateExperimentRecord(record)
  if (!validated.ok || !validated.value) return

  await withStore(SESSION_STORE, 'readwrite', (store) =>
    requestToPromise(store.put({ id: SESSION_RECORD_ID, record: validated.value })),
  )
}

export async function loadSession(): Promise<ExperimentRecord | null> {
  const row = await withStore(SESSION_STORE, 'readonly', (store) =>
    requestToPromise(store.get(SESSION_RECORD_ID) as IDBRequest<{ id: string; record: ExperimentRecord } | undefined>),
  )
  if (!row) return null
  const validated = validateExperimentRecord(row.record)
  return validated.ok && validated.value ? validated.value : null
}

export async function clearSession(): Promise<void> {
  await withStore(SESSION_STORE, 'readwrite', (store) => requestToPromise(store.delete(SESSION_RECORD_ID)))
}
