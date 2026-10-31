interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  title?: string
}

export function Toggle({ label, checked, onChange, title }: ToggleProps) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5" title={title}>
      <span className="text-[13px] text-lab-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-lab-accent' : 'bg-lab-border'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 block h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}
