import { describe, expect, it } from 'vitest'
import {
  ACTION_HOLD_SECONDS,
  CURIOUS_THRESHOLD,
  HUNGRY_ENERGY_FLOOR,
  HUNGRY_HUNGER_THRESHOLD,
  IDLE_BREATH_SPEED,
  IDLE_LIMB_POSE,
  POSITION_SNAP_DISTANCE,
  POSITIVE_COMFORT_THRESHOLD,
  POSITIVE_FATIGUE_CEILING,
  RUN_PHASE_SPEED,
  RUN_SPEED_REF,
  RUN_SPEED_THRESHOLD,
  SLUMP_COMFORT_FLOOR,
  SLUMP_COMFORT_FATIGUE_MIN,
  SLUMP_FATIGUE_THRESHOLD,
  WALK_PHASE_SPEED,
  WALK_SPEED_REF,
  advanceWalkPhase,
  blendAngle,
  blendPose,
  blendPosition,
  computeLocalReachAim,
  idleFromDrives,
  locomotionPhaseRates,
  poseFromMotion,
  resolveAgentMotionState,
  stepHeldMotion,
} from './agentMotion'

describe('resolveAgentMotionState', () => {
  it('maps MOVE_FORWARD to walk, FLEE to run; high speed upgrades MOVE_FORWARD', () => {
    expect(resolveAgentMotionState({ alive: true, lastAction: 'MOVE_FORWARD' })).toBe('walk')
    expect(
      resolveAgentMotionState({ alive: true, lastAction: 'MOVE_FORWARD', speed: 1.5 }),
    ).toBe('walk')
    expect(
      resolveAgentMotionState({
        alive: true,
        lastAction: 'MOVE_FORWARD',
        speed: RUN_SPEED_THRESHOLD,
      }),
    ).toBe('run')
    expect(resolveAgentMotionState({ alive: true, lastAction: 'FLEE' })).toBe('run')
    expect(resolveAgentMotionState({ alive: true, lastAction: 'FLEE', speed: 1.4 })).toBe('run')
  })

  it('maps gather / pick_up / eat / attack / defend to action poses', () => {
    expect(resolveAgentMotionState({ alive: true, lastAction: 'GATHER' })).toBe('gather')
    expect(resolveAgentMotionState({ alive: true, lastAction: 'PICK_UP' })).toBe('gather')
    expect(resolveAgentMotionState({ alive: true, lastAction: 'EAT' })).toBe('eat')
    expect(resolveAgentMotionState({ alive: true, lastAction: 'ATTACK' })).toBe('attack')
    expect(resolveAgentMotionState({ alive: true, lastAction: 'DEFEND' })).toBe('defend')
  })

  it('maps TURN_LEFT / TURN_RIGHT to dedicated turn poses', () => {
    expect(resolveAgentMotionState({ alive: true, lastAction: 'TURN_LEFT' })).toBe('turnLeft')
    expect(resolveAgentMotionState({ alive: true, lastAction: 'TURN_RIGHT' })).toBe('turnRight')
  })

  it('maps REST to rest; null without drives stays idle', () => {
    expect(resolveAgentMotionState({ alive: true, lastAction: 'REST' })).toBe('rest')
    expect(resolveAgentMotionState({ alive: true, lastAction: null })).toBe('idle')
  })

  it('maps idle Lab drives to tired / curious / hungry / positive body language', () => {
    expect(
      resolveAgentMotionState({
        alive: true,
        lastAction: null,
        fatigue: SLUMP_FATIGUE_THRESHOLD,
        comfort: 50,
        curiosity: 20,
      }),
    ).toBe('slump')
    expect(
      resolveAgentMotionState({
        alive: true,
        lastAction: null,
        fatigue: 20,
        comfort: 70,
        curiosity: CURIOUS_THRESHOLD,
      }),
    ).toBe('curious')
    expect(
      resolveAgentMotionState({
        alive: true,
        lastAction: null,
        fatigue: 20,
        comfort: 70,
        curiosity: 20,
        hunger: HUNGRY_HUNGER_THRESHOLD,
      }),
    ).toBe('hungry')
    expect(
      resolveAgentMotionState({
        alive: true,
        lastAction: null,
        fatigue: POSITIVE_FATIGUE_CEILING,
        comfort: POSITIVE_COMFORT_THRESHOLD,
        curiosity: 10,
      }),
    ).toBe('positive')
    // REST stays rest even when drives would prefer slump.
    expect(
      resolveAgentMotionState({
        alive: true,
        lastAction: 'REST',
        fatigue: 90,
        comfort: 10,
      }),
    ).toBe('rest')
  })

  it('forces dead regardless of lastAction', () => {
    expect(resolveAgentMotionState({ alive: false, lastAction: 'MOVE_FORWARD' })).toBe('dead')
    expect(resolveAgentMotionState({ alive: false, lastAction: 'ATTACK' })).toBe('dead')
    expect(resolveAgentMotionState({ alive: false, lastAction: null })).toBe('dead')
  })
})

describe('idleFromDrives', () => {
  it('stays idle when Lab drives are absent (Ecology)', () => {
    expect(idleFromDrives()).toBe('idle')
    expect(idleFromDrives(undefined, undefined)).toBe('idle')
    // Hunger alone must not tint Ecology bipeds.
    expect(idleFromDrives({ hunger: 99, energy: 5 })).toBe('idle')
  })

  it('prioritizes hungry, then tired vs curious, then positive', () => {
    expect(
      idleFromDrives({
        fatigue: 80,
        comfort: 20,
        curiosity: 90,
        hunger: HUNGRY_HUNGER_THRESHOLD,
      }),
    ).toBe('hungry')
    expect(
      idleFromDrives({
        fatigue: 10,
        comfort: 80,
        curiosity: 10,
        energy: HUNGRY_ENERGY_FLOOR,
      }),
    ).toBe('hungry')
    expect(
      idleFromDrives({
        fatigue: SLUMP_FATIGUE_THRESHOLD,
        comfort: 50,
        curiosity: 20,
      }),
    ).toBe('slump')
    expect(
      idleFromDrives({
        fatigue: SLUMP_COMFORT_FATIGUE_MIN,
        comfort: SLUMP_COMFORT_FLOOR,
        curiosity: 10,
      }),
    ).toBe('slump')
    expect(
      idleFromDrives({
        fatigue: 20,
        comfort: 70,
        curiosity: CURIOUS_THRESHOLD + 5,
      }),
    ).toBe('curious')
    expect(
      idleFromDrives({
        fatigue: POSITIVE_FATIGUE_CEILING,
        comfort: POSITIVE_COMFORT_THRESHOLD,
        curiosity: 10,
      }),
    ).toBe('positive')
  })
})

describe('locomotionPhaseRates', () => {
  it('scales walk/run cadence with agent.speed around refs', () => {
    const atRef = locomotionPhaseRates(WALK_SPEED_REF)
    expect(atRef.walk).toBeCloseTo(WALK_PHASE_SPEED)
    const faster = locomotionPhaseRates(WALK_SPEED_REF * 1.2)
    expect(faster.walk).toBeGreaterThan(atRef.walk)
    const runAtRef = locomotionPhaseRates(RUN_SPEED_REF)
    expect(runAtRef.run).toBeCloseTo(RUN_PHASE_SPEED)
    expect(locomotionPhaseRates(RUN_SPEED_REF * 1.2).run).toBeGreaterThan(runAtRef.run)
    expect(locomotionPhaseRates(0.1).walk).toBeGreaterThan(0)
  })
})

describe('advanceWalkPhase', () => {
  it('advances while walking, running, or pulsing actions', () => {
    expect(advanceWalkPhase(1, 0.1, 'walk', 10, 8, 14)).toBeCloseTo(2)
    expect(advanceWalkPhase(1, 0.1, 'run', 10, 8, 14)).toBeCloseTo(2.4)
    expect(advanceWalkPhase(1, 0.1, 'gather', 10, 8, 14)).toBeCloseTo(1.8)
    expect(advanceWalkPhase(1, 0.1, 'attack', 10, 8, 14)).toBeCloseTo(1.8)
  })

  it('breathes idle/rest and freezes other planted poses', () => {
    expect(advanceWalkPhase(1, 0.1, 'idle', 10, 8, 14, 5, 2)).toBeCloseTo(1.2)
    expect(advanceWalkPhase(1, 0.1, 'rest', 10, 8, 14, 5, 2)).toBeCloseTo(1.2)
    expect(advanceWalkPhase(1, 0.1, 'turnLeft', 10, 8)).toBe(1)
    expect(advanceWalkPhase(1, 0.1, 'turnRight', 10, 8)).toBe(1)
    expect(advanceWalkPhase(1, 0.1, 'eat', 10, 8)).toBe(1)
    expect(advanceWalkPhase(1, 0.1, 'defend', 10, 8)).toBe(1)
    expect(advanceWalkPhase(1, 0.1, 'dead', 10, 8)).toBe(1)
    expect(IDLE_BREATH_SPEED).toBeGreaterThan(0)
  })

  it('pulses phase for drive body-language gestures', () => {
    expect(advanceWalkPhase(1, 0.1, 'slump', 10, 8, 14, 5)).toBeCloseTo(1.5)
    expect(advanceWalkPhase(1, 0.1, 'curious', 10, 8, 14, 5)).toBeCloseTo(1.5)
    expect(advanceWalkPhase(1, 0.1, 'hungry', 10, 8, 14, 5)).toBeCloseTo(1.5)
    expect(advanceWalkPhase(1, 0.1, 'positive', 10, 8, 14, 5)).toBeCloseTo(1.5)
  })

  it('ignores non-positive dt', () => {
    expect(advanceWalkPhase(1.5, 0, 'walk', 10)).toBe(1.5)
    expect(advanceWalkPhase(1.5, -0.2, 'gather', 10, 8)).toBe(1.5)
    expect(advanceWalkPhase(1.5, 0, 'run', 10, 8, 14)).toBe(1.5)
  })
})

describe('poseFromMotion', () => {
  it('uses a breathing idle pose near the shared rest base', () => {
    const pose = poseFromMotion('idle', 0)
    expect(pose.leftHip).toBeCloseTo(IDLE_LIMB_POSE.leftHip, 2)
    expect(pose.torsoPitch).toBeGreaterThan(0)
    const swayed = poseFromMotion('idle', Math.PI / 2)
    expect(swayed.bob).not.toBe(pose.bob)
  })

  it('uses a planted rest pose distinct from idle', () => {
    const pose = poseFromMotion('rest', 0)
    expect(pose.leftKnee).toBeGreaterThan(IDLE_LIMB_POSE.leftKnee)
    expect(pose.bob).toBeLessThan(IDLE_LIMB_POSE.bob)
  })

  it('reads tired / curious / hungry distinctly on the body', () => {
    const slump = poseFromMotion('slump', 0)
    expect(slump.bob).toBeLessThan(IDLE_LIMB_POSE.bob)
    expect(slump.leftKnee).toBeGreaterThan(IDLE_LIMB_POSE.leftKnee)
    expect(slump.torsoPitch).toBeGreaterThan(IDLE_LIMB_POSE.torsoPitch)
    expect(slump.headPitch).toBeGreaterThan(0.15)

    const curious = poseFromMotion('curious', Math.PI / 2)
    expect(Math.abs(curious.headYaw)).toBeGreaterThan(0.2)
    expect(curious.headPitch).toBeLessThan(0)
    expect(curious.leftShoulder).toBeLessThan(IDLE_LIMB_POSE.leftShoulder)

    const hungry = poseFromMotion('hungry', 0)
    expect(hungry.torsoPitch).toBeGreaterThan(0.15)
    expect(hungry.rightElbow).toBeGreaterThan(0.8)
    expect(hungry.headPitch).toBeGreaterThan(0.1)

    const positive = poseFromMotion('positive', Math.PI / 2)
    expect(positive.rightShoulder).toBeLessThan(IDLE_LIMB_POSE.rightShoulder)
    expect(positive.bob).toBeGreaterThan(IDLE_LIMB_POSE.bob)
  })

  it('uses opposite limb swing and weight transfer for walk', () => {
    const pose = poseFromMotion('walk', Math.PI / 2)
    expect(pose.leftHip).toBeGreaterThan(0)
    expect(pose.rightHip).toBeLessThan(0)
    expect(pose.leftShoulder).toBeLessThan(0)
    expect(pose.rightShoulder).toBeGreaterThan(0)
    expect(pose.torsoRoll).not.toBe(0)
    expect(pose.torsoPitch).toBeGreaterThan(0)
    expect(pose.bob).toBeGreaterThanOrEqual(0)
  })

  it('uses a larger stride / lean / bob for run than walk', () => {
    const walk = poseFromMotion('walk', Math.PI / 2)
    const run = poseFromMotion('run', Math.PI / 2)
    expect(Math.abs(run.leftHip)).toBeGreaterThan(Math.abs(walk.leftHip))
    expect(Math.abs(run.leftShoulder)).toBeGreaterThan(Math.abs(walk.leftShoulder))
    expect(run.torsoPitch).toBeGreaterThan(walk.torsoPitch)
    expect(run.bob).toBeGreaterThan(walk.bob)
  })

  it('twists torso and counter-twists feet for turnLeft / turnRight', () => {
    const left = poseFromMotion('turnLeft', 0)
    expect(left.torsoY).toBeGreaterThan(0.3)
    expect(left.leftHipY).toBeLessThan(0)
    expect(left.rightHipY).toBeLessThan(0)

    const right = poseFromMotion('turnRight', 0)
    expect(right.torsoY).toBeLessThan(-0.3)
    expect(right.leftHipY).toBeGreaterThan(0)
    expect(right.rightHipY).toBeGreaterThan(0)
    expect(right.torsoY).toBeCloseTo(-left.torsoY)
  })

  it('keeps legs planted and reaches forward for gather', () => {
    const pose = poseFromMotion('gather', Math.PI / 2)
    expect(pose.leftHip).toBeCloseTo(IDLE_LIMB_POSE.leftHip)
    expect(pose.rightHip).toBeCloseTo(IDLE_LIMB_POSE.rightHip)
    expect(pose.rightShoulder).toBeLessThan(-0.4)
    expect(pose.rightShoulderY).toBe(0)
  })

  it('yaws the right arm toward a local actionTarget for gather/attack', () => {
    const aimRight = { azimuth: 0.8, distance: 1.2 }
    const gather = poseFromMotion('gather', Math.PI / 2, aimRight)
    expect(gather.rightShoulderY).toBeGreaterThan(0.5)
    expect(gather.rightShoulder).toBeLessThan(poseFromMotion('gather', Math.PI / 2).rightShoulder)

    const aimLeft = { azimuth: -0.9, distance: 2 }
    const attack = poseFromMotion('attack', Math.PI / 2, aimLeft)
    expect(attack.rightShoulderY).toBeLessThan(-0.5)
  })

  it('raises the right arm toward the head for eat', () => {
    const pose = poseFromMotion('eat', 0)
    expect(pose.rightShoulder).toBeLessThan(-0.7)
    expect(pose.rightElbow).toBeGreaterThan(0.9)
  })

  it('thrusts the right arm for attack and guards both for defend', () => {
    const attack = poseFromMotion('attack', Math.PI / 2)
    expect(attack.rightShoulder).toBeLessThan(-0.5)
    const defend = poseFromMotion('defend', 0)
    expect(defend.leftShoulder).toBeLessThan(-0.6)
    expect(defend.rightShoulder).toBeLessThan(-0.6)
  })

  it('keeps a collapsed dead pose independent of phase', () => {
    expect(poseFromMotion('dead', 0)).toEqual(poseFromMotion('dead', 12))
  })
})

describe('stepHeldMotion', () => {
  it('holds sticky actions after lastAction returns to idle', () => {
    const afterGather = stepHeldMotion(
      { displayed: 'idle', holdLeft: 0 },
      'gather',
      0.016,
      ACTION_HOLD_SECONDS,
    )
    expect(afterGather.displayed).toBe('gather')
    expect(afterGather.holdLeft).toBe(ACTION_HOLD_SECONDS)

    const whileIdle = stepHeldMotion(afterGather, 'idle', 0.1, ACTION_HOLD_SECONDS)
    expect(whileIdle.displayed).toBe('gather')
    expect(whileIdle.holdLeft).toBeCloseTo(ACTION_HOLD_SECONDS - 0.1)

    let clock = whileIdle
    for (let i = 0; i < 20; i += 1) {
      clock = stepHeldMotion(clock, 'idle', 0.05, ACTION_HOLD_SECONDS)
    }
    expect(clock.displayed).toBe('idle')
    expect(clock.holdLeft).toBe(0)
  })

  it('holds rest after lastAction leaves REST', () => {
    const afterRest = stepHeldMotion(
      { displayed: 'idle', holdLeft: 0 },
      'rest',
      0.016,
      ACTION_HOLD_SECONDS,
    )
    expect(afterRest.displayed).toBe('rest')
    expect(stepHeldMotion(afterRest, 'idle', 0.1).displayed).toBe('rest')
  })

  it('lets walk, run, and dead interrupt the hold immediately', () => {
    const held = { displayed: 'attack' as const, holdLeft: 0.3 }
    expect(stepHeldMotion(held, 'walk', 0.016).displayed).toBe('walk')
    expect(stepHeldMotion(held, 'run', 0.016).displayed).toBe('run')
    expect(stepHeldMotion(held, 'dead', 0.016).displayed).toBe('dead')
  })

  it('holds turn poses after lastAction returns to idle', () => {
    const afterTurn = stepHeldMotion(
      { displayed: 'idle', holdLeft: 0 },
      'turnLeft',
      0.016,
      ACTION_HOLD_SECONDS,
    )
    expect(afterTurn.displayed).toBe('turnLeft')
    expect(afterTurn.holdLeft).toBe(ACTION_HOLD_SECONDS)
    expect(stepHeldMotion(afterTurn, 'idle', 0.1).displayed).toBe('turnLeft')
  })
})

describe('computeLocalReachAim', () => {
  it('maps a forward world target to near-zero azimuth', () => {
    const aim = computeLocalReachAim({
      agentX: 0,
      agentZ: 0,
      agentYaw: 0,
      targetX: 0,
      targetZ: 2,
    })
    expect(aim).not.toBeNull()
    expect(aim!.azimuth).toBeCloseTo(0)
    expect(aim!.distance).toBeCloseTo(2)
  })

  it('maps a target to the agent right as positive azimuth', () => {
    const aim = computeLocalReachAim({
      agentX: 0,
      agentZ: 0,
      agentYaw: 0,
      targetX: 1,
      targetZ: 1,
    })
    expect(aim).not.toBeNull()
    expect(aim!.azimuth).toBeGreaterThan(0)
  })

  it('returns null when agent and target coincide', () => {
    expect(
      computeLocalReachAim({
        agentX: 1,
        agentZ: 2,
        agentYaw: 0.4,
        targetX: 1,
        targetZ: 2,
      }),
    ).toBeNull()
  })
})

describe('blendPose / blendAngle / blendPosition', () => {
  it('blends limb angles toward the target', () => {
    const mid = blendPose(IDLE_LIMB_POSE, poseFromMotion('walk', 1), 0.5)
    expect(mid.leftHip).toBeCloseTo((IDLE_LIMB_POSE.leftHip + poseFromMotion('walk', 1).leftHip) / 2)
  })

  it('takes the shortest yaw path across ±π and keeps the result wrapped', () => {
    const from = Math.PI - 0.05
    const to = -Math.PI + 0.05
    const next = blendAngle(from, to, 0.05, 12)
    // Short arc is +0.1 rad (crosses the ±π seam), not ~−6.2.
    expect(next).toBeGreaterThan(from)
    expect(next).toBeLessThanOrEqual(Math.PI)
    expect(next - from).toBeLessThan(0.15)
    expect(blendAngle(Math.PI * 2 - 0.01, 0, 1, 20)).toBeCloseTo(0, 5)
  })

  it('soft-follows xz while walking/running and snaps when planted (no stop slide)', () => {
    const from = { x: 0, z: 0 }
    const to = { x: 2, z: -1 }
    const walking = blendPosition(from, to, 0.05, 'walk')
    expect(walking.x).toBeGreaterThan(0)
    expect(walking.x).toBeLessThan(2)
    expect(walking.z).toBeLessThan(0)
    expect(blendPosition(from, to, 0, 'walk')).toEqual(from)
    const running = blendPosition(from, to, 0.05, 'run')
    expect(running.x).toBeGreaterThan(0)
    expect(running.x).toBeLessThan(2)
    // Run catches up faster than walk for the same gap/dt.
    expect(running.x).toBeGreaterThan(walking.x)
    // Planted = immediate snap so idle/turn/action feet do not slide catching up.
    expect(blendPosition(from, to, 0.05, 'idle')).toEqual(to)
    expect(blendPosition(from, to, 0, 'turnLeft')).toEqual(to)
    expect(blendPosition(from, to, 0.016, 'gather')).toEqual(to)
    expect(blendPosition(from, to, 0.016, 'dead')).toEqual(to)
  })

  it('snaps locomotion follow when sim jumps farther than POSITION_SNAP_DISTANCE', () => {
    const from = { x: 0, z: 0 }
    const far = { x: POSITION_SNAP_DISTANCE + 0.5, z: 0 }
    expect(blendPosition(from, far, 0.016, 'walk')).toEqual(far)
    expect(blendPosition(from, far, 0.016, 'run')).toEqual(far)
  })
})
