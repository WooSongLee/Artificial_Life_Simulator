import { describe, expect, it } from 'vitest'
import { clamp, clampStat, finiteNumber, wrapAngle } from './math'

describe('numeric guards', () => {
  it('replaces NaN and Infinity with a finite fallback', () => {
    expect(finiteNumber(Number.NaN, 3)).toBe(3)
    expect(finiteNumber(Number.POSITIVE_INFINITY, 0)).toBe(0)
    expect(finiteNumber(4.2)).toBe(4.2)
  })

  it('clamps NaN to the minimum instead of producing NaN', () => {
    expect(clamp(Number.NaN, 0, 100)).toBe(0)
    expect(clampStat(Number.NaN)).toBe(0)
    expect(clampStat(140)).toBe(100)
    expect(clampStat(-8)).toBe(0)
  })

  it('wraps non-finite angles to 0', () => {
    expect(wrapAngle(Number.NaN)).toBe(0)
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 10)
  })
})
