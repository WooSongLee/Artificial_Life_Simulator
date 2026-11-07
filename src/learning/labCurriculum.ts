/**
 * Lab-only learning curriculum (no PPO): pressure + reward/ε schedule so
 * survival ↔ human-like drive choices shift within minutes of wall time.
 *
 * World pressure is tick-based (same for Learning & Frozen).
 * Reward / ε / bias scales are learning-step-based (Learning arm only).
 */

import {
  canUseLookout,
  canUseRestBed,
  findVisibleInteractable,
} from '../simulation/interactables'
import {
  effectsFromWorldConfig,
  type LabConditionEffects,
} from '../simulation/labConditions'
import { canDetectAt } from '../simulation/terrain'
import type { Agent } from '../types/agent'
import type { Interactable } from '../types/interactable'
import type { WorldConfig, WorldState } from '../types/world'
import {
  findNearestFood,
  observeBearing,
  observeFoodDirection,
  observeFoodDistance,
  observeInteractable,
} from './observation'
import { actionIndex, createEmptyQValues } from './qLearning'

/** Mirrors labMode / constants defaults (avoid importing them — circular with labMode). */
const BASE_FATIGUE_GAIN = 1.5
const BASE_CURIOSITY_GAIN = 2
const BASE_COMFORT_DECAY = 1.2
const BASE_HUNGER_GAIN = 0.5

/** Hunger where curriculum starts pushing food-seeking hard (below URGENT_HUNGER). */
const CURRICULUM_HUNGER_SEEK = 32
/** Only survival-urgent hunger interrupts drive discovery. */
const CURRICULUM_DRIVE_INTERRUPT_HUNGER = 70

/** ~10 Hz sim: phase boundaries in ticks / learning steps (~1 min / ~2.3 min). */
export const LAB_CURRICULUM_SURVIVAL_END = 600
export const LAB_CURRICULUM_DRIVE_END = 1400

export type LabCurriculumPhase = 'survival_primer' | 'drive_discovery' | 'tradeoff'

export interface LabWorldCurriculum {
  phase: LabCurriculumPhase
  /** Multiplies passive Lab fatigue gain. */
  fatigueGainMult: number
  curiosityGainMult: number
  comfortDecayMult: number
  /**
   * Relative to base HUNGER_GAIN_PER_SEC. Applied as an extra Lab hunger nudge
   * so net hunger gain ≈ base × this mult (Ecology metabolism untouched).
   */
  hungerGainMult: number
}

export interface LabLearningCurriculum {
  phase: LabCurriculumPhase
  /** Scales eatSuccess / survival-shaped rewards. */
  survivalRewardScale: number
  /** Scales rest/lookout drive relief rewards. */
  driveRewardScale: number
  /** Multiplies configured epsilonDecay (lower → faster consolidation). */
  epsilonDecayMult: number
  /** Scales non-survival drive action bias / explore nudges. */
  driveBiasScale: number
  /** Scales survival (food/EAT) bias / explore nudges. */
  survivalBiasScale: number
}

export function labCurriculumPhaseFromProgress(progress: number): LabCurriculumPhase {
  if (progress < LAB_CURRICULUM_SURVIVAL_END) return 'survival_primer'
  if (progress < LAB_CURRICULUM_DRIVE_END) return 'drive_discovery'
  return 'tradeoff'
}

/** Tick-based world teacher (identical for Learning & Frozen arms). */
export function labWorldCurriculum(tick: number): LabWorldCurriculum {
  const phase = labCurriculumPhaseFromProgress(Math.max(0, tick))
  switch (phase) {
    case 'survival_primer':
      return {
        phase,
        fatigueGainMult: 0.3,
        curiosityGainMult: 0.3,
        comfortDecayMult: 0.35,
        hungerGainMult: 3.2,
      }
    case 'drive_discovery':
      return {
        phase,
        fatigueGainMult: 2.4,
        curiosityGainMult: 2.6,
        comfortDecayMult: 2,
        hungerGainMult: 0.35,
      }
    case 'tradeoff':
      return {
        phase,
        fatigueGainMult: 1,
        curiosityGainMult: 1,
        comfortDecayMult: 1,
        hungerGainMult: 1,
      }
  }
}

/**
 * Learning-step schedule. Keep ε high through survival+drive discovery so the
 * agent can sample both policies; consolidate only in tradeoff (~minutes).
 */
export function labLearningCurriculum(steps: number): LabLearningCurriculum {
  const phase = labCurriculumPhaseFromProgress(Math.max(0, steps))
  switch (phase) {
    case 'survival_primer':
      return {
        phase,
        survivalRewardScale: 1.8,
        driveRewardScale: 0.35,
        epsilonDecayMult: 1,
        driveBiasScale: 0.4,
        survivalBiasScale: 1.85,
      }
    case 'drive_discovery':
      return {
        phase,
        survivalRewardScale: 0.7,
        driveRewardScale: 2,
        epsilonDecayMult: 0.999,
        driveBiasScale: 1.7,
        survivalBiasScale: 0.55,
      }
    case 'tradeoff':
      return {
        phase,
        survivalRewardScale: 1,
        driveRewardScale: 1.2,
        epsilonDecayMult: 0.995,
        driveBiasScale: 1.05,
        survivalBiasScale: 1,
      }
  }
}

export function labCurriculumDriveRates(
  tick: number,
  configOrEffects?: Pick<WorldConfig, 'labCondition'> | LabConditionEffects,
): {
  fatigueGain: number
  curiosityGain: number
  comfortDecay: number
  hungerNudgePerSec: number
} {
  const c = labWorldCurriculum(tick)
  const effects =
    configOrEffects && 'foodCountMult' in configOrEffects
      ? configOrEffects
      : configOrEffects
        ? effectsFromWorldConfig(configOrEffects)
        : null
  const hungerMult = c.hungerGainMult * (effects?.hungerGainMult ?? 1)
  return {
    fatigueGain: BASE_FATIGUE_GAIN * c.fatigueGainMult * (effects?.fatigueGainMult ?? 1),
    curiosityGain: BASE_CURIOSITY_GAIN * c.curiosityGainMult * (effects?.curiosityGainMult ?? 1),
    comfortDecay: BASE_COMFORT_DECAY * c.comfortDecayMult * (effects?.comfortDecayMult ?? 1),
    hungerNudgePerSec: BASE_HUNGER_GAIN * (hungerMult - 1),
  }
}

/**
 * Extra selection bias so survival primer actually reaches food (and drive
 * discovery reaches rest/lookout). Complements driveActionBias.
 */
export function curriculumSeekBias(
  agent: Agent,
  world: WorldState,
  curriculum: LabLearningCurriculum,
): number[] {
  const bias = createEmptyQValues()
  const hungry = agent.hunger >= CURRICULUM_HUNGER_SEEK
  const survivalInterrupt = agent.hunger >= CURRICULUM_DRIVE_INTERRUPT_HUNGER || agent.energy <= 30

  if (
    curriculum.phase === 'survival_primer' ||
    (curriculum.phase === 'tradeoff' && hungry) ||
    (curriculum.phase === 'drive_discovery' && survivalInterrupt)
  ) {
    const food = findNearestFood(agent, world)
    const dist = observeFoodDistance(agent, food, world)
    const dir = observeFoodDirection(agent, food)
    const s = curriculum.survivalBiasScale
    if (dist === 'close') {
      bias[actionIndex('EAT')] = 0.9 * s
      bias[actionIndex('MOVE_FORWARD')] = 0.25 * s
    } else if (dir === 'forward') {
      bias[actionIndex('MOVE_FORWARD')] = 0.85 * s
      bias[actionIndex('EAT')] = 0.2 * s
    } else if (dir === 'left') {
      bias[actionIndex('TURN_LEFT')] = 0.75 * s
      bias[actionIndex('MOVE_FORWARD')] = 0.2 * s
    } else if (dir === 'right') {
      bias[actionIndex('TURN_RIGHT')] = 0.75 * s
      bias[actionIndex('MOVE_FORWARD')] = 0.2 * s
    } else if (dir === 'back') {
      // Deterministic single turn — equal L+R bias caused in-place spin.
      bias[actionIndex('TURN_LEFT')] = 0.55 * s
    }
    if (curriculum.phase === 'survival_primer') {
      bias[actionIndex('GATHER')] = -0.45 * s
    }
    return bias
  }

  if (curriculum.phase === 'drive_discovery') {
    const d = curriculum.driveBiasScale
    // Overwhelm survival Q left over from the primer so drive actions can win.
    bias[actionIndex('EAT')] = -8 * d
    const restReady = canUseRestBed(agent, world)
    const lookReady = canUseLookout(agent, world)
    if (restReady || lookReady) {
      bias[actionIndex('GATHER')] = 12 * d
      return bias
    }
    const cue = observeInteractable(agent, world)
    if (cue.startsWith('rest') || cue.startsWith('look')) {
      if (cue.endsWith('_close')) {
        bias[actionIndex('GATHER')] = 12 * d
      } else if (cue.endsWith('_fwd')) {
        bias[actionIndex('MOVE_FORWARD')] = 6 * d
        bias[actionIndex('GATHER')] = 4 * d
      } else if (cue.endsWith('_oth')) {
        applyOffAxisDriveSteer(bias, agent, world, d)
      }
      return bias
    }
    // No vision cue: home toward the nearest rest/lookout (fatigue prefers rest).
    applyHomedDriveSteer(bias, agent, world, d)
  }

  return bias
}

/** Single-direction turn for off-axis rest/lookout (never L and R together). */
function applyOffAxisDriveSteer(
  bias: number[],
  agent: Agent,
  world: WorldState,
  scale: number,
): void {
  const target = findVisibleInteractable(agent, world.interactables ?? [], (x, z, dist) =>
    canDetectAt(agent, x, z, world, dist),
  )
  if (!target) {
    bias[actionIndex('TURN_LEFT')] = 5 * scale
    return
  }
  const dir = observeBearing(agent, target.position.x, target.position.z)
  if (dir === 'forward') {
    bias[actionIndex('MOVE_FORWARD')] = 6 * scale
    bias[actionIndex('GATHER')] = 4 * scale
  } else if (dir === 'right') {
    bias[actionIndex('TURN_RIGHT')] = 5 * scale
  } else {
    bias[actionIndex('TURN_LEFT')] = 5 * scale
  }
}

function preferRestTarget(agent: Agent): boolean {
  const fatigue = agent.fatigue ?? 0
  const comfortNeed = 100 - (agent.comfort ?? 100)
  const curiosity = agent.curiosity ?? 0
  return Math.max(fatigue, comfortNeed) >= curiosity
}

function nearestDriveProp(agent: Agent, world: WorldState): Interactable | null {
  const preferRest = preferRestTarget(agent)
  const props = (world.interactables ?? []).filter((item) =>
    preferRest ? item.kind === 'rest_bed' : item.kind === 'lookout',
  )
  const fallback = (world.interactables ?? []).filter(
    (item) => item.kind === 'rest_bed' || item.kind === 'lookout',
  )
  const list = props.length > 0 ? props : fallback
  let best: Interactable | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const item of list) {
    const dist = Math.hypot(item.position.x - agent.position.x, item.position.z - agent.position.z)
    if (dist < bestDist) {
      bestDist = dist
      best = item
    }
  }
  return best
}

function applyHomedDriveSteer(
  bias: number[],
  agent: Agent,
  world: WorldState,
  scale: number,
): void {
  const target = nearestDriveProp(agent, world)
  if (!target) {
    bias[actionIndex('MOVE_FORWARD')] = 2 * scale
    return
  }
  const dir = observeBearing(agent, target.position.x, target.position.z)
  if (dir === 'forward') {
    bias[actionIndex('MOVE_FORWARD')] = 7 * scale
  } else if (dir === 'left') {
    bias[actionIndex('TURN_LEFT')] = 6 * scale
    bias[actionIndex('MOVE_FORWARD')] = 1.5 * scale
  } else if (dir === 'right') {
    bias[actionIndex('TURN_RIGHT')] = 6 * scale
    bias[actionIndex('MOVE_FORWARD')] = 1.5 * scale
  } else {
    bias[actionIndex('TURN_LEFT')] = 5 * scale
  }
}

/** Keep exploration alive through discovery phases so Q from an earlier phase can be revised. */
export function curriculumEpsilonFloor(curriculum: LabLearningCurriculum): number {
  switch (curriculum.phase) {
    case 'survival_primer':
      return 0.2
    case 'drive_discovery':
      return 0.45
    case 'tradeoff':
      return 0
  }
}

export function scaleCurriculumBias(
  bias: readonly number[],
  curriculum: LabLearningCurriculum,
): number[] {
  const out = bias.slice()
  const eat = actionIndex('EAT')
  const move = actionIndex('MOVE_FORWARD')
  const gather = actionIndex('GATHER')
  const turnL = actionIndex('TURN_LEFT')
  const turnR = actionIndex('TURN_RIGHT')

  out[eat] = (out[eat] ?? 0) * curriculum.survivalBiasScale
  if ((out[move] ?? 0) > 0 && (out[gather] ?? 0) <= 0) {
    out[move] = (out[move] ?? 0) * curriculum.survivalBiasScale
  }
  out[gather] = (out[gather] ?? 0) * curriculum.driveBiasScale
  out[turnL] = (out[turnL] ?? 0) * curriculum.driveBiasScale
  out[turnR] = (out[turnR] ?? 0) * curriculum.driveBiasScale
  if ((out[gather] ?? 0) > 0 && (bias[move] ?? 0) > 0) {
    out[move] = (bias[move] ?? 0) * curriculum.driveBiasScale
  }
  return out
}

export function scaleCurriculumExploreWeights(
  weights: readonly number[],
  curriculum: LabLearningCurriculum,
): number[] {
  const out = weights.slice()
  const eat = actionIndex('EAT')
  const gather = actionIndex('GATHER')
  const move = actionIndex('MOVE_FORWARD')
  const turnL = actionIndex('TURN_LEFT')
  const turnR = actionIndex('TURN_RIGHT')

  out[eat] = Math.max(0.01, (out[eat] ?? 0) * curriculum.survivalBiasScale)
  out[gather] = Math.max(0.01, (out[gather] ?? 0) * curriculum.driveBiasScale)

  if (curriculum.phase === 'survival_primer') {
    out[move] = Math.max(out[move] ?? 0, 0.55) * curriculum.survivalBiasScale
    out[gather] = Math.max(0.02, (out[gather] ?? 0) * 0.35)
    out[turnL] = Math.max(out[turnL] ?? 0, 0.18)
    out[turnR] = Math.max(out[turnR] ?? 0, 0.18)
  } else if (curriculum.phase === 'drive_discovery') {
    out[gather] = Math.max(out[gather] ?? 0, 0.5) * curriculum.driveBiasScale
    out[move] = Math.max(out[move] ?? 0, 0.35) * curriculum.driveBiasScale
  } else if ((weights[gather] ?? 0) > (weights[eat] ?? 0)) {
    out[move] = Math.max(0.01, (out[move] ?? 0) * curriculum.driveBiasScale)
  } else if ((weights[eat] ?? 0) > 0.2) {
    out[move] = Math.max(0.01, (out[move] ?? 0) * curriculum.survivalBiasScale)
  }
  return out
}

export function curriculumEpsilonDecay(baseDecay: number, curriculum: LabLearningCurriculum): number {
  const next = baseDecay * curriculum.epsilonDecayMult
  return Math.min(0.9995, Math.max(0.99, next))
}

/** Scale Lab rewards by curriculum phase (drive relief wins over auto-eat same tick). */
export function scaleCurriculumReward(
  reward: number,
  parts: { ate: boolean; driveRelief: boolean; survivalSeek?: boolean },
  curriculum: LabLearningCurriculum,
  conditionEffects?: Pick<LabConditionEffects, 'driveRewardMult' | 'survivalRewardMult'> | null,
): number {
  let scaled = reward
  if (parts.driveRelief) scaled *= curriculum.driveRewardScale
  else if (parts.ate) scaled *= curriculum.survivalRewardScale
  else if (parts.survivalSeek) scaled *= curriculum.survivalRewardScale

  if (conditionEffects) {
    if (parts.driveRelief) scaled *= conditionEffects.driveRewardMult
    else if (parts.ate || parts.survivalSeek) scaled *= conditionEffects.survivalRewardMult
  }
  return scaled
}

export function isDriveReliefTarget(targetKind: string | null | undefined): boolean {
  return targetKind === 'rest_bed' || targetKind === 'lookout'
}
