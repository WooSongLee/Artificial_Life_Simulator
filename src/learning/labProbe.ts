import { getBrain, resetBrains } from './brain'
import { createEmptyActionCounts, totalActionCounts } from './actionEvents'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from './constants'
import { LAB_CURRICULUM_SURVIVAL_END } from './labCurriculum'
import { observeAgent } from './observation'
import { emptyRewardComponents, type RewardComponents } from './rewards'
import {
  AGENT_ACTIONS,
  REWARD_COMPONENT_KEYS,
  type AgentAction,
  type HeldLabCue,
  type LabObjectCue,
  type RewardComponentKey,
} from './types'
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

/** P0 baseline: action mix + locomotion proxies (not a full spin detector). */
export interface LabProbeBehaviorMetrics {
  actionCounts: Record<AgentAction, number>
  /** Share of selected actions among total decisions. */
  actionShares: Record<AgentAction, number | null>
  moveShare: number | null
  turnShare: number | null
  eatShare: number | null
  gatherShare: number | null
  restShare: number | null
  /**
   * (TURN_LEFT + TURN_RIGHT) / max(MOVE_FORWARD, 1).
   * High values flag possible in-place turning relative to forward travel.
   */
  turnToMoveRatio: number | null
}

/** P0 reward telemetry: raw component sums + share of |sum|. */
export interface LabProbeRewardBreakdown {
  ticks: number
  /** Applied (post-curriculum) average reward; available for Frozen too. */
  averageApplied: number | null
  sums: RewardComponents
  /** Component / sum(|components|); null when no absolute mass. */
  shares: Record<RewardComponentKey, number | null>
  /** Convenience Lab-facing totals. */
  eat: number
  driveRelief: number
  survivalSeek: number
  spinPenalty: number
  collision: number
  wastedEnergy: number
  interact: number
}

export function summarizeLabRewardBreakdown(input: {
  sums?: RewardComponents
  rewardTicks?: number
  rewardSumApplied?: number
}): LabProbeRewardBreakdown {
  const sums = input.sums ? { ...emptyRewardComponents(), ...input.sums } : emptyRewardComponents()
  const absMass = REWARD_COMPONENT_KEYS.reduce((acc, key) => acc + Math.abs(sums[key]), 0)
  const shares = {} as Record<RewardComponentKey, number | null>
  for (const key of REWARD_COMPONENT_KEYS) {
    shares[key] = absMass > 0 ? sums[key] / absMass : null
  }
  const ticks = input.rewardTicks ?? 0
  return {
    ticks,
    averageApplied:
      ticks > 0 && input.rewardSumApplied !== undefined
        ? input.rewardSumApplied / ticks
        : null,
    sums,
    shares,
    eat: sums.eat,
    driveRelief: sums.driveRelief,
    survivalSeek: sums.survivalSeek,
    spinPenalty: sums.spinPenalty,
    collision: sums.collision,
    wastedEnergy: sums.wastedEnergy,
    interact: sums.interact,
  }
}

export function summarizeLabBehavior(
  actionCounts: Record<AgentAction, number> | undefined,
): LabProbeBehaviorMetrics {
  const counts = actionCounts ? { ...createEmptyActionCounts(), ...actionCounts } : createEmptyActionCounts()
  const total = totalActionCounts(counts)
  const share = (action: AgentAction): number | null =>
    total > 0 ? (counts[action] ?? 0) / total : null
  const actionShares = {} as Record<AgentAction, number | null>
  for (const action of AGENT_ACTIONS) {
    actionShares[action] = share(action)
  }
  const moves = counts.MOVE_FORWARD ?? 0
  const turns = (counts.TURN_LEFT ?? 0) + (counts.TURN_RIGHT ?? 0)
  return {
    actionCounts: counts,
    actionShares,
    moveShare: share('MOVE_FORWARD'),
    turnShare: total > 0 ? turns / total : null,
    eatShare: share('EAT'),
    gatherShare: share('GATHER'),
    restShare: share('REST'),
    turnToMoveRatio: total > 0 ? turns / Math.max(moves, 1) : null,
  }
}

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

/** End-of-arm Lab ambient snapshot (Env-P3). */
export interface LabProbeEnvSnapshot {
  period: string | null
  timeOfDayHours: number | null
  lighting: number | null
  temperatureC: number | null
  periodTransitions: number
}

/** End-of-arm Lab object / held observation cues (Obs v8). */
export interface LabProbeHeldSnapshot {
  labObject: LabObjectCue | null
  heldLab: HeldLabCue | null
  heldObjectType: string | null
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
  /** Ambient clock / lighting / temperature at arm end. */
  env: LabProbeEnvSnapshot
  /** Lab object / held cues at arm end. */
  held: LabProbeHeldSnapshot
  /** End-of-arm action distribution / locomotion proxies. */
  behavior: LabProbeBehaviorMetrics
  /** Raw reward component sums / shares (pre-curriculum). */
  rewardBreakdown: LabProbeRewardBreakdown
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
  // Tally lastAction every tick so Frozen (no Q updates) still gets behavior metrics.
  const observedActions = createEmptyActionCounts()

  for (let i = 0; i < input.ticks; i += 1) {
    snapshot = stepSimulation(snapshot, SIMULATION_STEP_DT, context)
    const last = snapshot.world.agents[0]?.lastAction
    if (last) observedActions[last] += 1
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
  // Prefer brain counts when learning recorded steps; else tick-observed lastAction.
  const behaviorSource =
    brain && brain.totalSteps > 0 ? brain.actionCounts : observedActions

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
      // Prefer learning-step avg; else applied telemetry so Frozen is not blank.
      averageReward:
        brain && brain.totalSteps > 0
          ? brain.totalReward / brain.totalSteps
          : brain && brain.rewardTicks > 0
            ? brain.rewardSumApplied / brain.rewardTicks
            : null,
      epsilon: brain?.epsilon ?? null,
      visitedStates: brain?.qTable.size ?? 0,
      qCells,
      energy: agent?.energy ?? null,
      hunger: agent?.hunger ?? null,
      fatigue: agent?.fatigue ?? null,
      curiosity: agent?.curiosity ?? null,
      comfort: agent?.comfort ?? null,
      env: {
        period: snapshot.world.labEnvironment?.period ?? null,
        timeOfDayHours: snapshot.world.labEnvironment?.timeOfDayHours ?? null,
        lighting: snapshot.world.labEnvironment?.lighting ?? null,
        temperatureC: snapshot.world.labEnvironment?.temperatureC ?? null,
        periodTransitions: snapshot.world.labEnvironment?.periodTransitions ?? 0,
      },
      held: (() => {
        if (!agent) {
          return { labObject: null, heldLab: null, heldObjectType: null }
        }
        const obs = observeAgent(agent, snapshot.world)
        const heldId = agent.heldLabObjectId
        const heldObj =
          heldId != null
            ? (snapshot.world.labObjects ?? []).find((item) => item.id === heldId)
            : null
        return {
          labObject: obs.labObject,
          heldLab: obs.heldLab,
          heldObjectType: heldObj?.objectType ?? null,
        }
      })(),
      behavior: summarizeLabBehavior(behaviorSource),
      rewardBreakdown: summarizeLabRewardBreakdown({
        sums: brain?.rewardComponentSums,
        rewardTicks: brain?.rewardTicks,
        rewardSumApplied: brain?.rewardSumApplied,
      }),
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
  const behav = (b: LabProbeBehaviorMetrics) =>
    `move=${pct(b.moveShare)} turn=${pct(b.turnShare)} eat=${pct(b.eatShare)} gather=${pct(b.gatherShare)} turn/move=${b.turnToMoveRatio?.toFixed(2) ?? '—'}`
  const reward = (r: LabProbeRewardBreakdown) =>
    `eat=${r.eat.toFixed(1)} drive=${r.driveRelief.toFixed(1)} seek=${r.survivalSeek.toFixed(1)} spin=${r.spinPenalty.toFixed(1)} coll=${r.collision.toFixed(1)} waste=${r.wastedEnergy.toFixed(1)} interact=${r.interact.toFixed(1)} (|share| eat=${pct(r.shares.eat)} drive=${pct(r.shares.driveRelief)} seek=${pct(r.shares.survivalSeek)} spin=${pct(r.shares.spinPenalty)})`
  const drives = (arm: LabProbeArmReport) =>
    `E=${arm.energy?.toFixed(0) ?? '—'} H=${arm.hunger?.toFixed(0) ?? '—'} F=${arm.fatigue?.toFixed(0) ?? '—'} C=${arm.curiosity?.toFixed(0) ?? '—'} Cm=${arm.comfort?.toFixed(0) ?? '—'} avgR=${arm.averageReward?.toFixed(3) ?? '—'}`
  const envLine = (arm: LabProbeArmReport) =>
    `period=${arm.env.period ?? '—'} t=${arm.env.timeOfDayHours?.toFixed(1) ?? '—'}h light=${arm.env.lighting?.toFixed(2) ?? '—'} temp=${arm.env.temperatureC?.toFixed(1) ?? '—'}C transitions=${arm.env.periodTransitions}`
  const heldLine = (arm: LabProbeArmReport) =>
    `labObject=${arm.held.labObject ?? '—'} heldLab=${arm.held.heldLab ?? '—'} type=${arm.held.heldObjectType ?? '—'}`
  const lines = [
    `Lab probe seed=${report.seed} ticks/arm=${report.ticksPerArm}`,
    `  Learning: driveRate=${pct(report.learning.driveRate)} survivalRate=${pct(report.learning.survivalRate)} interact=${pct(report.learning.interactRate)} steps=${report.learning.learningSteps} ε=${report.learning.epsilon?.toFixed(3) ?? '—'} states=${report.learning.visitedStates}`,
    `    early: ${win(report.learning.early)}`,
    `    late:  ${win(report.learning.late)}`,
    `    drives@end: ${drives(report.learning)}`,
    `    env@end: ${envLine(report.learning)}`,
    `    held@end: ${heldLine(report.learning)}`,
    `    behavior: ${behav(report.learning.behavior)}`,
    `    rewardΣ: ${reward(report.learning.rewardBreakdown)}`,
    `  Frozen:   driveRate=${pct(report.frozen.driveRate)} survivalRate=${pct(report.frozen.survivalRate)} interact=${pct(report.frozen.interactRate)}`,
    `    drives@end: ${drives(report.frozen)}`,
    `    behavior: ${behav(report.frozen.behavior)}`,
    `    rewardΣ: ${reward(report.frozen.rewardBreakdown)}`,
    `  ΔdriveRate=${report.driveRateDelta === null ? '—' : report.driveRateDelta.toFixed(3)} learningBeatsFrozen=${report.learningBeatsFrozenOnDrive} curriculumShift=${report.learningCurriculumShift} (early→late)`,
  ]
  for (const note of report.notes) lines.push(`  note: ${note}`)
  return lines.join('\n')
}
