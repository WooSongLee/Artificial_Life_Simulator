import { useState } from 'react'

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  digits?: number
  onChange: (value: number) => void
  hint?: string
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 0.01,
  digits = 2,
  onChange,
  hint,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const text = draft ?? value.toFixed(digits)

  const commit = (raw: string) => {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      setError('Enter a number')
      setDraft(null)
      return
    }
    if (parsed < min || parsed > max) {
      setError(`${min}–${max}`)
      setDraft(null)
      return
    }
    setError(null)
    setDraft(null)
    onChange(parsed)
  }

  return (
    <label className="block py-1.5">
      <span className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-lab-text">{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(null)
          }}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
          className={`w-20 border bg-lab-elevated px-1.5 py-0.5 text-right font-mono text-[12px] outline-none ${
            error
              ? 'border-lab-danger text-lab-danger'
              : 'border-lab-border text-lab-text focus:border-lab-accent/60'
          }`}
        />
      </span>
      {error ? (
        <span className="mt-1 block text-[11px] text-lab-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-lab-muted">{hint}</span>
      ) : null}
    </label>
  )
}
