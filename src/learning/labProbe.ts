import { getBrain, resetBrains } from './brain'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from './constants'
import { LAB_CURRICULUM_SURVIVAL_END } from './labCurriculum'
import { DEFAULT_EVOLUTION_CONFIG } from '../evolution/constants'
import { DEFAULT_WORLD_CONFIG, SIMULATION_STEP_DT } from '../simulation/constants'
import { stepSimulation } from '../simulation/engine'
import {
  compareLabOnVsFrozen,
  labChoiceCountsFrom,
  labChoiceDriveSurvivalRates,
  type LabChoiceCounts,
} from '../simulation/outcomes'
import { createInitialWorld } from '../simulation/worldFactory'
import type { SimulationSnapshot } from '../types/simulation'
import { mulberry32 } from '../utils/random'

export interface LabProbeOptions {
  /** Simulated ticks per arm (learn / frozen). Default 2400 ≈ 4 min at 10 Hz. */
  ticks?: number
  seed?: number
  /** If set, write JSON report here (Node only). */
  reportPath?: string
}

export interface LabProbeWindowRates {
  drivePicks: number
  survivalPicks: number
  driveRate: number | null
  survivalRate: number | null
}

export interface LabProbeArmReport {
  ticks: number
  drivePicks: number
  survivalPicks: number
  driveRate: number | null
  survivalRate: number | null
  /** First curriculum half (survival primer window). */
  early: LabProbeWindowRates
  /** Remainder after survival primer (drive discovery + tradeoff). */
  late: LabProbeWindowRates
  interactAttempts: number
  interactSuccesses: number
  interactRate: number | null
  learningSteps: number
  averageReward: number | null
  epsilon: number | null
  visitedStates: number
  qCells: number
  energy: number | null
  hunger: number | null
  fatigue: number | null
  curiosity: number | null
  comfort: number | null
}

export interface LabProbeReport {
  ok: boolean
  mode: 'human_behavior_lab'
  ticksPerArm: number
  seed: number
  learning: LabProbeArmReport
  frozen: LabProbeArmReport
  driveRateDelta: number | null
  survivalRateDelta: number | null
  interactRateDelta: number | null
  /**
   * True when Learning shows a healthier survival↔drive tradeoff than Frozen
   * (curriculum shift + both pick kinds, or late/overall driveRate edge).
   */
  learningBeatsFrozenOnDrive: boolean
  /**
   * Learning arm late window leans more drive (or less pure-survival) than early —
   * curriculum behavior shift within the run.
   */
  learningCurriculumShift: boolean
  notes: string[]
}

function windowRates(counts: LabChoiceCounts): LabProbeWindowRates {
  const rates = labChoiceDriveSurvivalRates(counts)
  return {
    drivePicks: counts.drivePicks,
    survivalPicks: counts.survivalPicks,
    driveRate: rates?.driveRate ?? null,
    survivalRate: rates?.survivalRate ?? null,
  }
}

function deltaCounts(later: LabChoiceCounts, earlier: LabChoiceCounts): LabChoiceCounts {
  return {
    drivePicks: Math.max(0, later.drivePicks - earlier.drivePicks),
    survivalPicks: Math.max(0, later.survivalPicks - earlier.survivalPicks),
    interactAttempts: Math.max(0, later.interactAttempts - earlier.interactAttempts),
    interactSuccesses: Math.max(0, later.interactSuccesses - earlier.interactSuccesses),
  }
}

function runArm(input: {
  ticks: number
  seed: number
  learningEnabled: boolean
}): { counts: LabChoiceCounts; report: LabProbeArmReport } {
  const rng = mulberry32(input.seed)
  const world = createInitialWorld(
    {
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      labCondition: 'baseline',
      agentCount: 1,
      seed: input.seed,
    },
    { geneticsEnabled: false },
  )
  resetBrains(world.agents, DEFAULT_LEARNING_CONFIG)

  let snapshot: SimulationSnapshot = { tick: 0, world }
  const context = {
    learningEnabled: input.learningEnabled,
    learningConfig: DEFAULT_LEARNING_CONFIG,
    rewardConfig: DEFAULT_REWARD_CONFIG,
    evolutionConfig: { ...DEFAULT_EVOLUTION_CONFIG, geneticsEnabled: false },
    rng,
  }

  const splitAt = Math.min(LAB_CURRICULUM_SURVIVAL_END, Math.max(1, Math.floor(input.ticks / 2)))
  let earlyCounts: LabChoiceCounts = {
    drivePicks: 0,
    survivalPicks: 0,
    interactAttempts: 0,
    interactSuccesses: 0,
  }

  for (let i = 0; i < input.ticks; i += 1) {
    snapshot = stepSimulation(snapshot, SIMULATION_STEP_DT, context)
    if (i + 1 === splitAt) {
      earlyCounts = labChoiceCountsFrom(snapshot.world.outcomeStats)
    }
  }

  const agent = snapshot.world.agents[0]
  const brain = agent ? getBrain(agent.id) : undefined
  const counts = labChoiceCountsFrom(snapshot.world.outcomeStats)
  const lateCounts = deltaCounts(counts, earlyCounts)
  const total = counts.drivePicks + counts.survivalPicks
  const qCells = brain
    ? [...brain.qTable.values()].reduce((sum, row) => sum + row.length, 0)
    : 0

  return {
    counts,
    report: {
      ticks: input.ticks,
      drivePicks: counts.drivePicks,
      survivalPicks: counts.survivalPicks,
      driveRate: total > 0 ? counts.drivePicks / total : null,
      survivalRate: total > 0 ? counts.survivalPicks / total : null,
      early: windowRates(earlyCounts),
      late: windowRates(lateCounts),
      interactAttempts: counts.interactAttempts,
      interactSuccesses: counts.interactSuccesses,
      interactRate:
        counts.interactAttempts > 0 ? counts.interactSuccesses / counts.interactAttempts : null,
      learningSteps: brain?.totalSteps ?? 0,
      averageReward:
        brain && brain.totalSteps > 0 ? brain.totalReward / brain.totalSteps : null,
      epsilon: brain?.epsilon ?? null,
      visitedStates: brain?.qTable.size ?? 0,
      qCells,
      energy: agent?.energy ?? null,
      hunger: agent?.hunger ?? null,
      fatigue: agent?.fatigue ?? null,
      curiosity: agent?.curiosity ?? null,
      comfort: agent?.comfort ?? null,
    },
  }
}

function detectCurriculumShift(arm: LabProbeArmReport): boolean {
  const earlyDrive = arm.early.driveRate
  const lateDrive = arm.late.driveRate
  const earlySurv = arm.early.survivalPicks
  const lateDrivePicks = arm.late.drivePicks
  // Prefer rising drive share after the survival primer window.
  if (earlyDrive !== null && lateDrive !== null) {
    return lateDrive >= earlyDrive - 0.02 && lateDrivePicks > 0
  }
  // Or: survival activity early, drive activity late.
  return earlySurv > 0 && lateDrivePicks > 0
}

/**
 * Headless Lab probe: Learning On vs Frozen Q over the same seed/ticks.
 * Agents should run this after learning/visual slices to see if drive choices improve.
 */
export function runLabProbe(options: LabProbeOptions = {}): LabProbeReport {
  const ticks = options.ticks ?? 2400
  const seed = options.seed ?? 42

  const learningArm = runArm({ ticks, seed, learningEnabled: true })
  const frozenArm = runArm({ ticks, seed, learningEnabled: false })
  const compared = compareLabOnVsFrozen(learningArm.counts, frozenArm.counts)

  const notes: string[] = []
  if ((learningArm.report.drivePicks + learningArm.report.survivalPicks) === 0) {
    notes.push('No drive/survival pick events — agent may not reach rest_bed/lookout/food.')
  }
  if (learningArm.report.learningSteps === 0) {
    notes.push('Learning arm recorded 0 steps — learning path may be broken.')
  }
  if (learningArm.report.fatigue === undefined || learningArm.report.fatigue === null) {
    notes.push('Lab drives missing on agent — mode/world seed may be wrong.')
  }
  if (learningArm.report.survivalPicks === 0) {
    notes.push('Learning arm has 0 survival picks — curriculum survival primer may be weak.')
  }
  if (learningArm.report.drivePicks === 0) {
    notes.push('Learning arm has 0 drive picks — curriculum drive discovery may be weak.')
  }

  const driveRateDelta = compared?.driveRateDelta ?? null
  const learningCurriculumShift = detectCurriculumShift(learningArm.report)
  if (!learningCurriculumShift) {
    notes.push('Learning arm early→late drive shift not detected — curriculum may need tuning.')
  }

  const learningHasTradeoff =
    learningArm.report.drivePicks > 0 && learningArm.report.survivalPicks > 0
  const frozenHasTradeoff =
    frozenArm.report.drivePicks > 0 && frozenArm.report.survivalPicks > 0
  const lateDriveDelta =
    learningArm.report.late.driveRate !== null && frozenArm.report.late.driveRate !== null
      ? learningArm.report.late.driveRate - frozenArm.report.late.driveRate
      : null

  // Curriculum-aware win: Learning shows survival↔drive shift (Frozen often stays one-sided).
  // Fall back to late-window / overall driveRate when both arms trade off.
  const learningBeatsFrozenOnDrive = learningHasTradeoff
    ? learningCurriculumShift && (!frozenHasTradeoff || (lateDriveDelta ?? 0) >= -0.05)
    : driveRateDelta !== null
      ? driveRateDelta >= 0
      : learningArm.report.drivePicks >= frozenArm.report.drivePicks

  if (!learningBeatsFrozenOnDrive) {
    notes.push('Frozen driveRate ≥ Learning driveRate — drive learning not beating frozen yet.')
  }

  const report: LabProbeReport = {
    ok: learningArm.report.learningSteps > 0 && notes.every((n) => !n.includes('broken')),
    mode: 'human_behavior_lab',
    ticksPerArm: ticks,
    seed,
    learning: learningArm.report,
    frozen: frozenArm.report,
    driveRateDelta,
    survivalRateDelta: compared?.survivalRateDelta ?? null,
    interactRateDelta: compared?.interactRateDelta ?? null,
    learningBeatsFrozenOnDrive,
    learningCurriculumShift,
    notes,
  }

  return report
}

export function formatLabProbeSummary(report: LabProbeReport): string {
  const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`)
  const win = (w: LabProbeWindowRates) =>
    `drive=${pct(w.driveRate)} surv=${pct(w.survivalRate)} (d${w.drivePicks}/s${w.survivalPicks})`
  const lines = [
    `Lab probe seed=${report.seed} ticks/arm=${report.ticksPerArm}`,
    `  Learning: driveRate=${pct(report.learning.driveRate)} survivalRate=${pct(report.learning.survivalRate)} interact=${pct(report.learning.interactRate)} steps=${report.learning.learningSteps} ε=${report.learning.epsilon?.toFixed(3) ?? '—'} states=${report.learning.visitedStates}`,
    `    early: ${win(report.learning.early)}`,
    `    late:  ${win(report.learning.late)}`,
    `  Frozen:   driveRate=${pct(report.frozen.driveRate)} survivalRate=${pct(report.frozen.survivalRate)} interact=${pct(report.frozen.interactRate)}`,
    `  ΔdriveRate=${report.driveRateDelta === null ? '—' : report.driveRateDelta.toFixed(3)} learningBeatsFrozen=${report.learningBeatsFrozenOnDrive} curriculumShift=${report.learningCurriculumShift} (early→late)`,
  ]
  for (const note of report.notes) lines.push(`  note: ${note}`)
  return lines.join('\n')
}
