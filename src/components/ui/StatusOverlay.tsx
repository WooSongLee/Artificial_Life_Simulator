import type { ReactNode } from 'react'

export function StatusOverlay({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-lab-bg/72 px-6">
      <div className="w-full max-w-sm border border-lab-border bg-lab-panel px-6 py-5 text-center shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <p className="text-[11px] tracking-[0.16em] text-lab-muted uppercase">{title}</p>
        <div className="mt-2 text-[13px] leading-6 text-lab-text">{children}</div>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  )
}
