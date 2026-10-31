export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clampStat(value: number): number {
  return clamp(value, 0, 100)
}

export function wrapAngle(angle: number): number {
  const tau = Math.PI * 2
  return ((angle % tau) + tau) % tau
}

export function shortestAngleDelta(from: number, to: number): number {
  return wrapAngle(to - from + Math.PI) - Math.PI
}

export function rotateTowards(current: number, target: number, maxDelta: number): number {
  const delta = shortestAngleDelta(current, target)
  return wrapAngle(current + clamp(delta, -maxDelta, maxDelta))
}

export function distanceSq(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx
  const dz = az - bz
  return dx * dx + dz * dz
}
