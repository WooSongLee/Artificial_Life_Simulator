import { SIMULATION_STEP_DT } from '../simulation/constants'

export function getSimulationTime(tick: number): number {
  return tick * SIMULATION_STEP_DT
}

export function formatSimulationTime(seconds: number): string {
  const clamped = Math.max(0, seconds)
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const remainder = clamped % 60
  const wholeSeconds = Math.floor(remainder)
  const tenth = Math.floor((remainder - wholeSeconds) * 10)
  const clock = `${minutes.toString().padStart(2, '0')}:${wholeSeconds
    .toString()
    .padStart(2, '0')}.${tenth}`

  return hours > 0 ? `${hours}:${clock}` : clock
}
