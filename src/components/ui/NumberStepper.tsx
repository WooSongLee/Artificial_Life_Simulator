interface NumberStepperProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

export function NumberStepper({ label, value, min, max, onChange }: NumberStepperProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[13px] text-lab-text">{label}</span>
      <div className="flex items-center gap-1">
        <StepButton label="-" disabled={value <= min} onClick={() => onChange(value - 1)} />
        <span className="min-w-8 text-center font-mono text-[13px] text-lab-text">{value}</span>
        <StepButton label="+" disabled={value >= max} onClick={() => onChange(value + 1)} />
      </div>
    </div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-6 w-6 border border-lab-border bg-lab-elevated text-[13px] text-lab-text transition-colors hover:border-lab-accent/50 disabled:cursor-default disabled:opacity-40"
    >
      {label}
    </button>
  )
}
