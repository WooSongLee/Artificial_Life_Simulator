/**
 * Lab ambient environment dynamics (Env-P3): time-of-day → lighting + temperature.
 * Ecology worlds keep `labEnvironment: null`. No new AgentActions.
 */

import type { Agent } from '../types/agent'
import {
  LAB_TIME_PERIODS,
  type LabEnvironmentState,
  type LabTimePeriod,
  type WorldState,
} from '../types/world'
import { clamp, clampStat, finiteNumber } from '../utils/math'
import { isHumanBehaviorLab, clampSimulationMode } from './labMode'

export { LAB_TIME_PERIODS }

/** Full day cycle length in simulated seconds (probe-friendly). */
export const LAB_ENV_DAY_LENGTH_SEC = 60

/** Hours advanced per simulated second. */
export const LAB_ENV_HOURS_PER_SEC = 24 / LAB_ENV_DAY_LENGTH_SEC

/** Seed clock: mid-morning so first probe window starts in daylight. */
export const LAB_ENV_DEFAULT_HOUR = 9

export const LAB_ENV_DAY_TEMP_C = 22
export const LAB_ENV_NIGHT_TEMP_C = 14
/** Toward day/night setpoint (°C per simulated second). */
export const LAB_ENV_TEMP_LERP_PER_SEC = 0.35

/** Extra comfort drain when ambient is cold / dim (mild, curriculum-safe). */
export const LAB_ENV_COLD_COMFORT_BONUS = 0.35
export const LAB_ENV_DIM_COMFORT_BONUS = 0.25
export const LAB_ENV_COLD_THRESHOLD_C = 16
export const LAB_ENV_DIM_THRESHOLD = 0.4
export const LAB_ENV_BRIGHT_THRESHOLD = 0.45

export function createDefaultLabEnvironment(
  partial: Partial<LabEnvironmentState> = {},
): LabEnvironmentState {
  const timeOfDayHours = wrapHours(
    partial.timeOfDayHours ?? LAB_ENV_DEFAULT_HOUR,
  )
  const period = partial.period ?? periodFromHours(timeOfDayHours)
  const lighting =
    typeof partial.lighting === 'number'
      ? clamp01(partial.lighting)
      : sunLightingFromHours(timeOfDayHours)
  const temperatureC =
    typeof partial.temperatureC === 'number'
      ? clampTemp(partial.temperatureC)
      : temperatureTargetForHours(timeOfDayHours)
  return {
    timeOfDayHours,
    period,
    lighting,
    temperatureC,
    periodTransitions: Math.max(0, Math.round(finiteNumber(partial.periodTransitions, 0))),
  }
}

export function sanitizeLabEnvironment(value: unknown): LabEnvironmentState | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object') return createDefaultLabEnvironment()
  const source = value as Partial<LabEnvironmentState>
  return createDefaultLabEnvironment({
    timeOfDayHours: typeof source.timeOfDayHours === 'number' ? source.timeOfDayHours : undefined,
    period: isLabTimePeriod(source.period) ? source.period : undefined,
    lighting: typeof source.lighting === 'number' ? source.lighting : undefined,
    temperatureC: typeof source.temperatureC === 'number' ? source.temperatureC : undefined,
    periodTransitions:
      typeof source.periodTransitions === 'number' ? source.periodTransitions : undefined,
  })
}

/** Ensure Lab worlds have env state; Ecology always null. */
export function ensureWorldLabEnvironment(world: WorldState): WorldState {
  const mode = clampSimulationMode(world.config.mode)
  if (!isHumanBehaviorLab(mode)) {
    return world.labEnvironment === null || world.labEnvironment === undefined
      ? { ...world, labEnvironment: null }
      : { ...world, labEnvironment: null }
  }
  return {
    ...world,
    labEnvironment: sanitizeLabEnvironment(world.labEnvironment) ?? createDefaultLabEnvironment(),
  }
}

/**
 * Advance clock, recompute lighting from sun curve, lerp temperature toward period target.
 * Counts period transitions for probe/logs (substeps so large dt still crosses dawn/dusk/night).
 */
export function tickLabEnvironment(
  env: LabEnvironmentState,
  dt: number,
): LabEnvironmentState {
  const step = Math.max(0, finiteNumber(dt))
  if (step === 0) return env

  const hoursToAdvance = LAB_ENV_HOURS_PER_SEC * step
  // Half-hour chunks catch dawn/dusk/day/night boundaries under coarse stepping.
  const maxChunkHours = 0.5
  let timeOfDayHours = env.timeOfDayHours
  let period = env.period
  let periodTransitions = env.periodTransitions
  let remaining = hoursToAdvance
  while (remaining > 1e-9) {
    const chunk = Math.min(remaining, maxChunkHours)
    timeOfDayHours = wrapHours(timeOfDayHours + chunk)
    const nextPeriod = periodFromHours(timeOfDayHours)
    if (nextPeriod !== period) {
      periodTransitions += 1
      period = nextPeriod
    }
    remaining -= chunk
  }

  const lighting = sunLightingFromHours(timeOfDayHours)
  const targetTemp = temperatureTargetForHours(timeOfDayHours)
  const temperatureC = approach(env.temperatureC, targetTemp, LAB_ENV_TEMP_LERP_PER_SEC * step)

  return {
    timeOfDayHours,
    period,
    lighting,
    temperatureC,
    periodTransitions,
  }
}

/** Mild comfort pressure from cold/dim ambient. Ecology / missing env → no-op. */
export function applyLabEnvironmentDriveEffects(
  agent: Agent,
  env: LabEnvironmentState | null | undefined,
  dt: number,
): Agent {
  if (!env) return agent
  if (agent.fatigue === undefined && agent.curiosity === undefined && agent.comfort === undefined) {
    return agent
  }
  const step = Math.max(0, finiteNumber(dt))
  if (step === 0 || agent.comfort === undefined) return agent

  let bonus = 0
  if (env.temperatureC < LAB_ENV_COLD_THRESHOLD_C) bonus += LAB_ENV_COLD_COMFORT_BONUS
  if (env.lighting < LAB_ENV_DIM_THRESHOLD) bonus += LAB_ENV_DIM_COMFORT_BONUS
  if (bonus === 0) return agent

  return {
    ...agent,
    comfort: clampStat(agent.comfort - bonus * step),
  }
}

export function periodFromHours(hours: number): LabTimePeriod {
  const h = wrapHours(hours)
  if (h >= 5 && h < 7) return 'dawn'
  if (h >= 7 && h < 18) return 'day'
  if (h >= 18 && h < 20) return 'dusk'
  return 'night'
}

/** Smooth-ish solar curve: bright midday, dark night, soft dusk/dawn. */
export function sunLightingFromHours(hours: number): number {
  const h = wrapHours(hours)
  // Cosine peak at 12:00 → lighting in [0.08, 1].
  const angle = ((h - 12) / 24) * Math.PI * 2
  const sun = 0.5 + 0.5 * Math.cos(angle)
  // Night floor slightly above zero so "dim" is distinguishable from blackout.
  return clamp01(0.08 + sun * 0.92)
}

export function temperatureTargetForHours(hours: number): number {
  const period = periodFromHours(hours)
  if (period === 'day') return LAB_ENV_DAY_TEMP_C
  if (period === 'night') return LAB_ENV_NIGHT_TEMP_C
  // Dawn/dusk midpoints.
  return (LAB_ENV_DAY_TEMP_C + LAB_ENV_NIGHT_TEMP_C) / 2
}

export function isLabTimePeriod(value: unknown): value is LabTimePeriod {
  return typeof value === 'string' && (LAB_TIME_PERIODS as readonly string[]).includes(value)
}

function wrapHours(value: number): number {
  const raw = finiteNumber(value, LAB_ENV_DEFAULT_HOUR)
  const wrapped = raw % 24
  return wrapped < 0 ? wrapped + 24 : wrapped
}

function clamp01(value: number): number {
  return clamp(finiteNumber(value), 0, 1)
}

function clampTemp(value: number): number {
  return clamp(finiteNumber(value, LAB_ENV_DAY_TEMP_C), -20, 50)
}

function approach(current: number, target: number, maxDelta: number): number {
  const delta = target - current
  if (Math.abs(delta) <= maxDelta) return target
  return current + Math.sign(delta) * maxDelta
}
