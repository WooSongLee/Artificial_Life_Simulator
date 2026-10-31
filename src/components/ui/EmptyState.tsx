export function EmptyState({
  children,
  title,
}: {
  children: string
  title?: string
}) {
  return (
    <div className="border border-dashed border-lab-border bg-lab-elevated px-3 py-4 text-center">
      {title ? (
        <p className="text-[11px] tracking-[0.12em] text-lab-muted uppercase">{title}</p>
      ) : null}
      <p className={`text-[12px] leading-5 text-lab-muted ${title ? 'mt-2' : ''}`}>{children}</p>
    </div>
  )
}
