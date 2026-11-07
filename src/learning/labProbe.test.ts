import { describe, expect, it } from 'vitest'
import { formatLabProbeSummary, runLabProbe } from './labProbe'
import {
  labCurriculumPhaseFromProgress,
  labLearningCurriculum,
  labWorldCurriculum,
  LAB_CURRICULUM_DRIVE_END,
  LAB_CURRICULUM_SURVIVAL_END,
} from './labCurriculum'

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
  }, 60_000)
})
