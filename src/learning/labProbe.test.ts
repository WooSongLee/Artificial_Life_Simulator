import { describe, expect, it } from 'vitest'
import {
  formatLabProbeSummary,
  runLabProbe,
  summarizeLabBehavior,
  summarizeLabRewardBreakdown,
} from './labProbe'
import { emptyRewardComponents } from './rewards'
import {
  labCurriculumPhaseFromProgress,
  labLearningCurriculum,
  labWorldCurriculum,
  LAB_CURRICULUM_DRIVE_END,
  LAB_CURRICULUM_SURVIVAL_END,
} from './labCurriculum'
import { createEmptyActionCounts } from './actionEvents'

describe('labCurriculum', () => {
  it('phases survival → drive → tradeoff on the minutes-scale schedule', () => {
    expect(labCurriculumPhaseFromProgress(0)).toBe('survival_primer')
    expect(labCurriculumPhaseFromProgress(LAB_CURRICULUM_SURVIVAL_END - 1)).toBe('survival_primer')
    expect(labCurriculumPhaseFromProgress(LAB_CURRICULUM_SURVIVAL_END)).toBe('drive_discovery')
    expect(labCurriculumPhaseFromProgress(LAB_CURRICULUM_DRIVE_END)).toBe('tradeoff')

    const survival = labWorldCurriculum(0)
    const drive = labWorldCurriculum(LAB_CURRICULUM_SURVIVAL_END)
    expect(survival.hungerGainMult).toBeGreaterThan(drive.hungerGainMult)
    expect(drive.fatigueGainMult).toBeGreaterThan(survival.fatigueGainMult)

    const learnDrive = labLearningCurriculum(LAB_CURRICULUM_SURVIVAL_END)
    const learnSurv = labLearningCurriculum(0)
    expect(learnDrive.driveRewardScale).toBeGreaterThan(learnSurv.driveRewardScale)
    expect(learnSurv.survivalRewardScale).toBeGreaterThan(learnDrive.survivalRewardScale)
  })
})

describe('summarizeLabBehavior', () => {
  it('reports action shares and turn/move locomotion proxy', () => {
    const counts = createEmptyActionCounts()
    counts.MOVE_FORWARD = 50
    counts.TURN_LEFT = 20
    counts.TURN_RIGHT = 10
    counts.EAT = 15
    counts.GATHER = 5
    const metrics = summarizeLabBehavior(counts)
    expect(metrics.moveShare).toBeCloseTo(0.5)
    expect(metrics.turnShare).toBeCloseTo(0.3)
    expect(metrics.eatShare).toBeCloseTo(0.15)
    expect(metrics.gatherShare).toBeCloseTo(0.05)
    expect(metrics.turnToMoveRatio).toBeCloseTo(30 / 50)
  })
})

describe('summarizeLabRewardBreakdown', () => {
  it('reports component sums and |mass| shares', () => {
    const sums = emptyRewardComponents()
    sums.eat = 10
    sums.spinPenalty = -2
    sums.collision = -2
    const metrics = summarizeLabRewardBreakdown({
      sums,
      rewardTicks: 100,
      rewardSumApplied: 50,
    })
    expect(metrics.eat).toBe(10)
    expect(metrics.spinPenalty).toBe(-2)
    expect(metrics.collision).toBe(-2)
    expect(metrics.averageApplied).toBeCloseTo(0.5)
    expect(metrics.shares.eat).toBeCloseTo(10 / 14)
    expect(metrics.shares.spinPenalty).toBeCloseTo(-2 / 14)
  })
})

describe('labProbe', () => {
  it('runs Lab learn vs frozen with curriculum survival↔drive shift', () => {
    const report = runLabProbe({ ticks: 1800, seed: 42 })
    // eslint-disable-next-line no-console
    console.log(formatLabProbeSummary(report))
    expect(report.mode).toBe('human_behavior_lab')
    expect(report.learning.learningSteps).toBeGreaterThan(0)
    expect(report.learning.fatigue).not.toBeNull()
    expect(report.learning.drivePicks + report.learning.survivalPicks).toBeGreaterThan(0)
    expect(report.learning.survivalPicks).toBeGreaterThan(0)
    expect(report.learning.drivePicks).toBeGreaterThan(0)
    expect(report.learningBeatsFrozenOnDrive).toBe(true)
    expect(report.learningCurriculumShift).toBe(true)
    // Early survival primer → late drive discovery (minutes-scale shift).
    expect(report.learning.early.survivalPicks).toBeGreaterThan(0)
    expect(report.learning.late.drivePicks).toBeGreaterThan(0)
    if (report.learning.early.driveRate !== null && report.learning.late.driveRate !== null) {
      expect(report.learning.late.driveRate).toBeGreaterThan(report.learning.early.driveRate)
    }
    // P0 observability: behavior metrics populated from brain.actionCounts.
    expect(report.learning.behavior.moveShare).not.toBeNull()
    expect(report.learning.behavior.turnShare).not.toBeNull()
    expect(report.learning.behavior.turnToMoveRatio).not.toBeNull()
    // P0 reward breakdown: component telemetry on both arms.
    expect(report.learning.rewardBreakdown.ticks).toBeGreaterThan(0)
    expect(report.frozen.rewardBreakdown.ticks).toBeGreaterThan(0)
    const learnAbs =
      Math.abs(report.learning.rewardBreakdown.eat) +
      Math.abs(report.learning.rewardBreakdown.driveRelief) +
      Math.abs(report.learning.rewardBreakdown.survivalSeek) +
      Math.abs(report.learning.rewardBreakdown.spinPenalty) +
      Math.abs(report.learning.rewardBreakdown.collision)
    expect(learnAbs).toBeGreaterThan(0)
    expect(report.frozen.averageReward).not.toBeNull()
  }, 60_000)
})
