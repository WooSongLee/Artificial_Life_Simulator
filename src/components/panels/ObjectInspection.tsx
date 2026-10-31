import { OBJECT_REGISTRY } from '../../simulation/objectRegistry'
import type { WorldObject } from '../../types/world'

export function ObjectInspection({ object }: { object: WorldObject }) {
  return (
    <section>
      <h2 className="text-[11px] text-lab-muted">선택 오브젝트</h2>
      <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
        <InfoRow label="종류" value={OBJECT_REGISTRY[object.type].label} />
        <InfoRow label="ID" value={object.id.slice(0, 18)} />
        <InfoRow
          label="위치"
          value={`${object.position.x.toFixed(1)}, ${object.position.z.toFixed(1)}`}
        />
        <InfoRow label="스케일" value={object.scale.toFixed(2)} />
        <p className="pt-1 text-[12px] leading-5 text-lab-muted">
          {OBJECT_REGISTRY[object.type].description}
        </p>
      </div>
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-lab-muted">{label}</span>
      <span className="font-mono text-lab-text">{value}</span>
    </div>
  )
}
