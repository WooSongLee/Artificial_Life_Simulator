import { useMemo, useState } from 'react'
import { buildComparisonRows, formatComparisonValue } from '../../experiments/comparison'
import { RESOURCE_DISTRIBUTION_LABELS } from '../../experiments/constants'
import { useExperimentLibrary } from '../../hooks/useExperimentLibrary'
import { SIMULATION_STEP_DT } from '../../simulation/constants'
import { useSimulationStore } from '../../store/useSimulationStore'
import { formatSimulationTime } from '../../utils/time'
import { EmptyState } from '../ui/EmptyState'
import { StatCard } from '../ui/StatCard'

export function ExperimentsDashboard() {
  const experiment = useSimulationStore((state) => state.experiment)
  const setExperimentName = useSimulationStore((state) => state.setExperimentName)
  const newExperiment = useSimulationStore((state) => state.newExperiment)
  const generation = useSimulationStore((state) => state.world.generation)
  const tick = useSimulationStore((state) => state.tick)
  const worldConfig = useSimulationStore((state) => state.pendingWorldConfig ?? state.world.config)
  const library = useExperimentLibrary()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const experimentName = nameDraft ?? experiment.name

  const selectedItems = useMemo(
    () => library.items.filter((item) => selectedIds.includes(item.id)),
    [library.items, selectedIds],
  )
  const comparisonRows = selectedItems.length >= 2 ? buildComparisonRows(selectedItems) : []

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-[11px] text-lab-muted">Current Experiment</h2>
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          월드 상태, 개체, Q-Table, Genome, 통계를 함께 저장한다. 새로고침하면 마지막 세션을
          복원한다.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            value={experimentName}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={() => {
              const next = experimentName.trim()
              if (next && next !== experiment.name) {
                setExperimentName(next)
              }
              setNameDraft(null)
            }}
            className="border border-lab-border bg-lab-elevated px-3 py-2 text-[13px] text-lab-text outline-none focus:border-lab-accent/60"
          />
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => void library.saveCurrent()} disabled={library.busy}>
              Save Experiment
            </ActionButton>
            <ActionButton onClick={() => void library.exportCurrent()} disabled={library.busy}>
              Export JSON
            </ActionButton>
            <label className="border border-lab-border bg-lab-elevated px-3 py-2 text-[13px] text-lab-text hover:border-lab-accent/50">
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void library.importFile(file)
                  event.target.value = ''
                }}
              />
            </label>
            <ActionButton
              onClick={() => {
                newExperiment()
                setNameDraft(null)
              }}
            >
              New Experiment
            </ActionButton>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatCard label="Status" value={experiment.dirty ? 'Unsaved' : 'Saved'} tone={experiment.dirty ? 'amber' : 'green'} />
          <StatCard label="Generation" value={generation} tone="cyan" />
          <StatCard label="Time" value={formatSimulationTime(tick * SIMULATION_STEP_DT)} />
          <StatCard label="World" value={`${worldConfig.size} · ${worldConfig.agentCount}A`} />
        </div>
        <p className="mt-2 text-[12px] leading-5 text-lab-muted">
          Food {worldConfig.initialFoodCount} · Regen {worldConfig.foodRegenRate.toFixed(1)}/s ·
          Obstacles {Math.round(worldConfig.obstacleDensity * 100)}% ·{' '}
          {RESOURCE_DISTRIBUTION_LABELS[worldConfig.resourceDistribution]}
        </p>
        {library.message ? <p className="mt-2 text-[12px] text-lab-accent">{library.message}</p> : null}
        {library.error ? (
          <p className="mt-2 whitespace-pre-line text-[12px] text-lab-danger">{library.error}</p>
        ) : null}
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Saved Experiments</h2>
        {!library.ready ? (
          <p className="mt-3 text-[12px] leading-5 text-lab-muted">저장된 실험을 읽는 중이다.</p>
        ) : library.items.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No experiments">
              저장된 실험이 없다. Save Experiment로 현재 상태를 남긴다.
            </EmptyState>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden border border-lab-border">
            {library.items.map((item) => {
              const selected = selectedIds.includes(item.id)
              const isCurrent = item.id === experiment.id
              return (
                <div
                  key={item.id}
                  className="grid gap-2 border-b border-lab-border px-3 py-3 last:border-b-0 md:grid-cols-[auto_1fr_auto]"
                >
                  <label className="flex items-start gap-2 text-[12px] text-lab-muted">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        setSelectedIds((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : current.length >= 4
                              ? current
                              : [...current, item.id],
                        )
                      }}
                    />
                    Compare
                  </label>
                  <div>
                    <p className="text-[13px] text-lab-text">
                      {item.name}
                      {isCurrent ? <span className="ml-2 font-mono text-[11px] text-lab-info">current</span> : null}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-lab-muted">
                      Gen {item.currentGeneration} · {formatSimulationTime(item.statistics.simulationTime)} ·
                      Survival {(item.statistics.populationSurvival * 100).toFixed(0)}%
                    </p>
                    <p className="mt-1 text-[11px] text-lab-muted">
                      Updated {new Date(item.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton onClick={() => void library.loadById(item.id)} disabled={library.busy}>
                      Load
                    </ActionButton>
                    <ActionButton onClick={() => void library.exportById(item.id)} disabled={library.busy}>
                      Export
                    </ActionButton>
                    <ActionButton onClick={() => void library.removeById(item.id)} disabled={library.busy}>
                      Delete
                    </ActionButton>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[11px] text-lab-muted">Experiment Comparison</h2>
        <p className="mt-1 text-[12px] leading-5 text-lab-muted">
          저장된 실험 2–4개를 선택한다. 값은 저장 시점의 실측 통계다.
        </p>
        {comparisonRows.length === 0 ? (
          <div className="mt-3">
            <EmptyState>비교하려면 저장된 실험을 두 개 이상 선택한다.</EmptyState>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto border border-lab-border bg-lab-elevated">
            <div
              className="grid min-w-[640px] gap-1 px-3 py-2 text-[11px] text-lab-muted"
              style={{ gridTemplateColumns: `12rem repeat(${selectedItems.length}, minmax(7rem, 1fr))` }}
            >
              <span>Metric</span>
              {selectedItems.map((item) => (
                <span key={item.id} className="truncate text-right">
                  {item.name}
                </span>
              ))}
            </div>
            {comparisonRows.map((row) => (
              <div
                key={row.key}
                className="grid min-w-[640px] gap-1 border-t border-lab-border px-3 py-2 font-mono text-[12px]"
                style={{ gridTemplateColumns: `12rem repeat(${selectedItems.length}, minmax(7rem, 1fr))` }}
              >
                <span className="font-sans text-lab-muted">{row.label}</span>
                {row.values.map((value, index) => (
                  <span key={`${row.key}-${selectedItems[index]?.id ?? index}`} className="text-right text-lab-text">
                    {formatComparisonValue(value, row.format)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ActionButton({
  children,
  onClick,
  disabled = false,
}: {
  children: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border border-lab-border bg-lab-elevated px-3 py-2 text-[13px] text-lab-text transition-colors hover:border-lab-accent/50 disabled:cursor-default disabled:opacity-50"
    >
      {children}
    </button>
  )
}
