import type { Agent } from '../types/agent'
import {
  SIMULATION_MODES,
  type SimulationMode,
  type WorldConfig,
  type WorldState,
} from '../types/world'
import { clampStat, finiteNumber } from '../utils/math'

/** Optional rate override from Lab curriculum (learning module supplies values). */
export interface LabDriveTickRates {
  fatigueGain: number
  curiosityGain: number
  comfortDecay: number
  hungerNudgePerSec?: number
}

export const DEFAULT_SIMULATION_MODE: SimulationMode = 'ecology'

/** Lab-only drive defaults / passive tick rates (STEP 19). Ecology agents omit these fields. */
export const LAB_DRIVE_DEFAULTS = {
  fatigue: 15,
  curiosity: 25,
  comfort: 70,
} as const

export const LAB_FATIGUE_GAIN_PER_SEC = 1.5
export const LAB_CURIOSITY_GAIN_PER_SEC = 2
export const LAB_COMFORT_DECAY_PER_SEC = 1.2

/** Rest/lookout fulfill drives but tax survival (STEP 19 tradeoff). */
export const LAB_REST_FATIGUE_RELIEF = 25
export const LAB_REST_COMFORT_GAIN = 20
export const LAB_LOOKOUT_CURIOSITY_RELIEF = 30
export const LAB_DRIVE_SURVIVAL_ENERGY_COST = 8
export const LAB_DRIVE_SURVIVAL_HUNGER_COST = 6

export const SIMULATION_MODE_LABELS: Record<SimulationMode, string> = {
  ecology: 'Ecology',
  human_behavior_lab: 'Human Behavior Lab',
}

export function isSimulationMode(value: unknown): value is SimulationMode {
  return typeof value === 'string' && (SIMULATION_MODES as readonly string[]).includes(value)
}

export function clampSimulationMode(value: unknown): SimulationMode {
  return isSimulationMode(value) ? value : DEFAULT_SIMULATION_MODE
}

export function isHumanBehaviorLab(mode: SimulationMode | undefined): boolean {
  return mode === 'human_behavior_lab'
}

export function allowsMultiAgent(mode: SimulationMode): boolean {
  return mode === 'ecology'
}

export function allowsGenetics(mode: SimulationMode): boolean {
  return mode === 'ecology'
}

export function allowsMating(mode: SimulationMode): boolean {
  return mode === 'ecology'
}

export function allowsCombat(mode: SimulationMode): boolean {
  return mode === 'ecology'
}

export function allowsAgentSensing(mode: SimulationMode): boolean {
  return mode === 'ecology'
}

/** Ecology only. Human Behavior Lab never kills the single learner. */
export function allowsDeath(mode: SimulationMode): boolean {
  return mode === 'ecology'
}

/** Soft floor so Lab survival pressure can still hurt stats without ending the run. */
export const LAB_HEALTH_FLOOR = 5

/** Effective genetics flag after mode gates. HBL always disables genetics/mating/aging death. */
export function effectiveGeneticsEnabled(mode: SimulationMode, geneticsEnabled: boolean | undefined): boolean {
  if (!allowsGenetics(mode)) return false
  return geneticsEnabled !== false
}

/** Revive / clamp a Lab agent so death cannot stick across ticks or saves. */
export function keepLabAgentAlive(agent: Agent): Agent {
  const withDrives = ensureLabDrives(agent)
  const health = Math.max(LAB_HEALTH_FLOOR, clampStat(withDrives.health))
  return {
    ...withDrives,
    health,
    alive: true,
    deathCause: null,
  }
}

export function applyModeToWorldConfig(config: WorldConfig): WorldConfig {
  const mode = clampSimulationMode(config.mode)
  if (!isHumanBehaviorLab(mode)) {
    return { ...config, mode }
  }
  return {
    ...config,
    mode,
    agentCount: 1,
  }
}

function clampLabDrive(value: unknown, fallback: number): number {
  return clampStat(typeof value === 'number' ? finiteNumber(value, fallback) : fallback)
}

/** Ensure Lab agents carry clamped drive fields. */
export function ensureLabDrives(agent: Agent): Agent {
  return {
    ...agent,
    fatigue: clampLabDrive(agent.fatigue, LAB_DRIVE_DEFAULTS.fatigue),
    curiosity: clampLabDrive(agent.curiosity, LAB_DRIVE_DEFAULTS.curiosity),
    comfort: clampLabDrive(agent.comfort, LAB_DRIVE_DEFAULTS.comfort),
    heldLabObjectId: agent.heldLabObjectId ?? null,
  }
}

/** Strip Lab drive fields so Ecology agent schema stays free of them. */
export function stripLabDrives(agent: Agent): Agent {
  if (
    agent.fatigue === undefined &&
    agent.curiosity === undefined &&
    agent.comfort === undefined &&
    agent.heldLabObjectId === undefined
  ) {
    return agent
  }
  const next: Agent = { ...agent }
  delete next.fatigue
  delete next.curiosity
  delete next.comfort
  delete next.heldLabObjectId
  return next
}

/**
 * Passive Lab drive tick: fatigue/curiosity rise; comfort decays.
 * Pass curriculum `rates` (from learning/labCurriculum) for minutes-scale
 * survival → drive → tradeoff pressure. Omit for baseline rates.
 */
export function tickLabDrives(agent: Agent, dt: number, rates?: LabDriveTickRates): Agent {
  const withDrives = ensureLabDrives(agent)
  if (!withDrives.alive) return withDrives
  const step = Math.max(0, finiteNumber(dt))
  const fatigueGain = rates?.fatigueGain ?? LAB_FATIGUE_GAIN_PER_SEC
  const curiosityGain = rates?.curiosityGain ?? LAB_CURIOSITY_GAIN_PER_SEC
  const comfortDecay = rates?.comfortDecay ?? LAB_COMFORT_DECAY_PER_SEC
  const hungerNudge = rates?.hungerNudgePerSec ?? 0
  return {
    ...withDrives,
    fatigue: clampStat(withDrives.fatigue! + fatigueGain * step),
    curiosity: clampStat(withDrives.curiosity! + curiosityGain * step),
    comfort: clampStat(withDrives.comfort! - comfortDecay * step),
    hunger: hungerNudge === 0 ? withDrives.hunger : clampStat(withDrives.hunger + hungerNudge * step),
  }
}

/** Rest bed: comfort/fatigue relief at survival energy/hunger cost. Ecology (no drives) unchanged. */
export function applyRestBedDriveTradeoff(agent: Agent): Agent {
  if (agent.fatigue === undefined && agent.curiosity === undefined && agent.comfort === undefined) {
    return agent
  }
  const withDrives = ensureLabDrives(agent)
  return {
    ...withDrives,
    fatigue: clampStat(withDrives.fatigue! - LAB_REST_FATIGUE_RELIEF),
    comfort: clampStat(withDrives.comfort! + LAB_REST_COMFORT_GAIN),
    energy: clampStat(withDrives.energy - LAB_DRIVE_SURVIVAL_ENERGY_COST),
    hunger: clampStat(withDrives.hunger + LAB_DRIVE_SURVIVAL_HUNGER_COST),
  }
}

/** Lookout: curiosity relief at survival energy/hunger cost. Ecology (no drives) unchanged. */
export function applyLookoutDriveTradeoff(agent: Agent): Agent {
  if (agent.fatigue === undefined && agent.curiosity === undefined && agent.comfort === undefined) {
    return agent
  }
  const withDrives = ensureLabDrives(agent)
  return {
    ...withDrives,
    curiosity: clampStat(withDrives.curiosity! - LAB_LOOKOUT_CURIOSITY_RELIEF),
    energy: clampStat(withDrives.energy - LAB_DRIVE_SURVIVAL_ENERGY_COST),
    hunger: clampStat(withDrives.hunger + LAB_DRIVE_SURVIVAL_HUNGER_COST),
  }
}

/** Keep exactly one agent in Human Behavior Lab (prefer a living agent). */
export function enforceLabPopulation(world: WorldState): WorldState {
  const mode = clampSimulationMode(world.config.mode)
  if (!isHumanBehaviorLab(mode)) {
    return {
      ...world,
      config: { ...world.config, mode },
      agents: world.agents.map(stripLabDrives),
    }
  }

  const living = world.agents.find((agent) => agent.alive)
  const kept: Agent | undefined = living ?? world.agents[0]
  const agents = kept ? [keepLabAgentAlive(kept)] : []

  return {
    ...world,
    config: {
      ...world.config,
      mode,
      agentCount: 1,
    },
    agents,
  }
}
