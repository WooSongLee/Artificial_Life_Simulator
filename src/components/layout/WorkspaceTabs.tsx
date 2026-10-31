export type WorkspaceTab = 'world' | 'simulation' | 'learning' | 'evolution'

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'world', label: 'World' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'learning', label: 'Learning' },
  { id: 'evolution', label: 'Evolution' },
]

export function WorkspaceTabs({
  active,
  onChange,
  selectionLabel,
}: {
  active: WorkspaceTab
  onChange: (tab: WorkspaceTab) => void
  selectionLabel?: string | null
}) {
  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-lab-border bg-lab-panel">
      {TABS.map((tab) => {
        const isActive = active === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 border-r border-lab-border px-3.5 text-[12px] ${
              isActive
                ? 'bg-lab-bg text-lab-text'
                : 'bg-lab-panel text-lab-muted hover:bg-lab-elevated hover:text-lab-text'
            }`}
          >
            {isActive ? <span className="absolute inset-x-0 top-0 h-0.5 bg-lab-accent" /> : null}
            <span>{tab.label}</span>
            {tab.id === 'simulation' && selectionLabel ? (
              <span className="max-w-28 truncate font-mono text-[10px] text-lab-info">
                {selectionLabel}
              </span>
            ) : null}
          </button>
        )
      })}
      <div className="flex-1 bg-lab-panel" />
    </div>
  )
}
