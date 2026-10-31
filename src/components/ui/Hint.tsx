export function Hint({ children }: { children: string }) {
  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <span
        tabIndex={0}
        aria-label={children}
        className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-lab-border text-[9px] text-lab-muted"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden w-56 border border-lab-border bg-lab-panel px-2 py-1.5 text-[11px] leading-4 text-lab-text shadow-[0_8px_24px_rgba(0,0,0,0.35)] group-hover:block group-focus-within:block"
      >
        {children}
      </span>
    </span>
  )
}
