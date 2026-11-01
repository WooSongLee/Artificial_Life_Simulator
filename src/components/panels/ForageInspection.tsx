import { TOOL_LABELS, type ForageNode, type WorldTool } from '../../types/forage'

export function ForageInspection({ node }: { node: ForageNode }) {
  return (
    <section>
      <h2 className="text-[11px] text-lab-muted">Forage node</h2>
      <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
        <InfoRow label="Kind" value={node.kind === 'berry_bush' ? 'Berry bush' : 'Root patch'} />
        <InfoRow label="ID" value={node.id.slice(0, 18)} />
        <InfoRow
          label="Position"
          value={`${node.position.x.toFixed(1)}, ${node.position.z.toFixed(1)}`}
        />
        <InfoRow label="Quantity" value={`${node.quantity} / ${node.maxQuantity}`} />
        <p className="pt-1 text-[12px] leading-5 text-lab-muted">
          {node.kind === 'berry_bush'
            ? 'GATHER works without a tool. A basket increases yield and hunger relief.'
            : 'GATHER requires a usable digging stick. Successful use wears the tool.'}
        </p>
      </div>
    </section>
  )
}

export function ToolInspection({ tool }: { tool: WorldTool }) {
  return (
    <section>
      <h2 className="text-[11px] text-lab-muted">World tool</h2>
      <div className="mt-3 space-y-2 border border-lab-border bg-lab-elevated px-3 py-3 text-[13px]">
        <InfoRow label="Kind" value={TOOL_LABELS[tool.toolType]} />
        <InfoRow label="ID" value={tool.id.slice(0, 18)} />
        <InfoRow
          label="Position"
          value={`${tool.position.x.toFixed(1)}, ${tool.position.z.toFixed(1)}`}
        />
        <InfoRow label="Durability" value={`${tool.durability} / ${tool.maxDurability}`} />
        <p className="pt-1 text-[12px] leading-5 text-lab-muted">
          PICK_UP moves this object into an empty equipment slot. The world object then disappears.
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
