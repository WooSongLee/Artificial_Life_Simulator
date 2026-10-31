export function shortAgentId(id: string): string {
  const parts = id.split('-')
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1].slice(0, 8)}`
  }
  return id.slice(0, 18)
}

export function formatSigned(value: number, digits = 2): string {
  const abs = Math.abs(value).toFixed(digits)
  if (value > 0) return `+${abs}`
  if (value < 0) return `-${abs}`
  return abs
}
