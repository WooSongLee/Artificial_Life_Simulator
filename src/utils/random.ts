export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let state = seed

  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomInRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng()
}

export function mixSeed(seed: number, salt: number): number {
  return (Math.imul(seed ^ salt, 0x9e3779b9) >>> 0)
}
