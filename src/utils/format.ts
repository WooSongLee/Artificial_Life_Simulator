export function shortAgentId(id: string): string {
  const parts = id.split('-')
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1].slice(0, 8)}`
  }
  return id.slice(0, 18)
}

export function formatSpeed(speed: number): string {
  if (speed >= 1_000_000) {
    const millions = speed / 1_000_000
    return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}M x`
  }
  if (speed >= 1_000) {
    const thousands = speed / 1_000
    return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}K x`
  }
  return `${Math.round(speed)}x`
}

export function speedToSlider(speed: number, min: number, max: number): number {
  return Math.log10(Math.max(min, speed)) / Math.log10(max)
}

export function sliderToSpeed(ratio: number, min: number, max: number): number {
  const raw = min * max ** ratio
  if (raw < 10) return Math.max(min, Math.round(raw))
  const exponent = Math.floor(Math.log10(raw))
  const step = 10 ** Math.max(0, exponent - 1)
  return Math.round(raw / step) * step
}

export function formatSigned(value: number, digits = 2): string {
  const abs = Math.abs(value).toFixed(digits)
  if (value > 0) return `+${abs}`
  if (value < 0) return `-${abs}`
  return abs
}
