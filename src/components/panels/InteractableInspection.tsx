import type { Interactable } from '../../types/interactable'

const KIND_LABELS = {
  door: 'Rest-chamber gate',
  switch: 'Gate control panel',
  movable_box: 'Equipment crate',
  rest_bed: 'Rest cot',
  lookout: 'Observation booth',
} as const

export function InteractableInspection({
  item,
  interactables,
}: {
  item: Interactable
  interactables: readonly Interactable[]
}) {
  const linkedDoor =
    item.kind === 'switch'
      ? interactables.find(
          (candidate): candidate is Extract<Interactable, { kind: 'door' }> =>
            candidate.id === item.controlsId && candidate.kind === 'door',
        )
      : null

  return (
    <section>
      <h2 className="text-[11px] text-lab-muted">Lab apparatus</h2>
      <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
        <InfoRow label="Kind" value={KIND_LABELS[item.kind]} />
        <InfoRow label="ID" value={item.id.slice(0, 18)} />
        <InfoRow
          label="Position"
          value={`${item.position.x.toFixed(1)}, ${item.position.z.toFixed(1)}`}
        />
        {item.kind === 'door' ? (
          <>
            <InfoRow label="State" value={item.open ? 'Open (passable)' : 'Closed (blocks)'} />
            <InfoRow label="Chamber" value="Rest gate (−X from vestibule)" />
          </>
        ) : null}
        {item.kind === 'switch' ? (
          <>
            <InfoRow label="Lever" value={item.on ? 'On' : 'Off'} />
            <InfoRow
              label="Controls"
              value={
                linkedDoor
                  ? `${linkedDoor.id.slice(0, 12)} · ${linkedDoor.open ? 'open' : 'closed'}`
                  : item.controlsId.slice(0, 18)
              }
            />
            <InfoRow label="Chamber" value="Vestibule control panel" />
          </>
        ) : null}
        {item.kind === 'movable_box' ? (
          <InfoRow label="Role" value="Blocks lookout approach until pushed" />
        ) : null}
        {item.kind === 'rest_bed' ? (
          <>
            <InfoRow label="State" value={item.used ? 'Used' : 'Ready'} />
            <InfoRow
              label="Last use"
              value={item.lastUsedTick > 0 ? `tick ${item.lastUsedTick}` : 'never'}
            />
            <InfoRow label="Chamber" value="Rest (−X cot)" />
          </>
        ) : null}
        {item.kind === 'lookout' ? (
          <>
            <InfoRow label="State" value={item.used ? 'Used' : 'Ready'} />
            <InfoRow
              label="Last use"
              value={item.lastUsedTick > 0 ? `tick ${item.lastUsedTick}` : 'never'}
            />
            <InfoRow label="Chamber" value="Lookout (+X observation booth)" />
          </>
        ) : null}
        <p className="pt-1 text-[12px] leading-5 text-lab-muted">{descriptionFor(item)}</p>
      </div>
    </section>
  )
}

function descriptionFor(item: Interactable): string {
  if (item.kind === 'door') {
    return 'Rest-chamber gate. When closed it blocks entry; the vestibule control panel opens it (GATHER).'
  }
  if (item.kind === 'switch') {
    return 'GATHER toggles this panel and mirrors the rest-chamber gate. Reward uses Interact Success.'
  }
  if (item.kind === 'rest_bed') {
    return 'Rest chamber cot. In-range ring invites GATHER; success flash from lastUsedTick. Relieves fatigue/comfort at a survival cost.'
  }
  if (item.kind === 'lookout') {
    return 'Observation booth window. In-range ring invites GATHER; relieves curiosity at a survival cost.'
  }
  return 'GATHER while facing the crate pushes it. Blocked destinations fail with no reward.'
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-lab-muted">{label}</span>
      <span className="font-mono text-lab-text">{value}</span>
    </div>
  )
}
