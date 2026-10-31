export function EmptyState({ children }: { children: string }) {
  return (
    <div className="border border-dashed border-lab-border bg-lab-elevated px-3 py-4 text-center text-[12px] leading-5 text-lab-muted">
      {children}
    </div>
  )
}
