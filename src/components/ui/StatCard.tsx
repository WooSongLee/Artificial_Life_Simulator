interface StatCardProps {
  label: string
  value: string | number
  tone?: 'green' | 'stone' | 'amber' | 'cyan' | 'rose' | 'neutral'
}

const TONE_CLASS: Record<NonNullable<StatCardProps['tone']>, string> = {
  green: 'text-lab-accent',
  stone: 'text-stone-300',
  amber: 'text-lab-warn',
  cyan: 'text-lab-info',
  rose: 'text-lab-danger',
  neutral: 'text-lab-text',
}

export function StatCard({ label, value, tone = 'neutral' }: StatCardProps) {
  return (
    <div className="border border-lab-border bg-lab-elevated px-3 py-2.5">
      <p className="text-[11px] tracking-wide text-lab-muted uppercase">{label}</p>
      <p className={`mt-1 font-mono text-xl tabular-nums ${TONE_CLASS[tone]}`}>
        {value}
      </p>
    </div>
  )
}
