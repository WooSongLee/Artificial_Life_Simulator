export function shortAgentId(id: string): string {
  const parts = id.split('-')
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1].slice(0, 8)}`
  }
  return id.slice(0, 18)
}
