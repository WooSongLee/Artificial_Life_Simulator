import type { AgentAction } from '../learning/types'

/**
 * Render-only locomotion / upper-body states derived from observable sim
 * lastAction + locomotion speed + optional Lab drives. No emotion meters.
 */
export type AgentMotionState =
  | 'idle'
  | 'rest'
  | 'slump'
  | 'curious'
  | 'hungry'
  | 'positive'
  | 'walk'
  | 'run'
  | 'turnLeft'
  | 'turnRight'
  | 'gather'
  | 'eat'
  | 'attack'
  | 'defend'
  | 'dead'

/**
 * Lab idle body language mirrors observation drive priority (surv → tired/curious → calm).
 * Thresholds match learning cues so the body and Q-state agree without meters.
 */
export const HUNGRY_HUNGER_THRESHOLD = 66
export const HUNGRY_ENERGY_FLOOR = 30
/** Fatigue / unmet comfort at/above this → tired slump while idle. */
export const SLUMP_FATIGUE_THRESHOLD = 55
/** Comfort at/below this with elevated fatigue also slumps. */
export const SLUMP_COMFORT_FLOOR = 45
export const SLUMP_COMFORT_FATIGUE_MIN = 40
/** Curiosity unmet at/above this → lookout scan while idle. */
export const CURIOUS_THRESHOLD = 55
/** High comfort + low fatigue/curiosity → light positive gesture while idle. */
export const POSITIVE_COMFORT_THRESHOLD = 68
export const POSITIVE_FATIGUE_CEILING = 35
export const POSITIVE_CURIOSITY_CEILING = 40

/** Gentle pulse for slump / curious / hungry / positive gestures (rad/s). */
export const GESTURE_PHASE_SPEED = 4.2

export interface LimbPose {
  leftHip: number
  rightHip: number
  /** Thigh yaw (Y): foot/hip twist while turning in place. */
  leftHipY: number
  rightHipY: number
  leftKnee: number
  rightKnee: number
  leftShoulder: number
  rightShoulder: number
  /** Upper-arm yaw (Y): positive swings the arm toward local +X (agent right). */
  leftShoulderY: number
  rightShoulderY: number
  leftElbow: number
  rightElbow: number
  /** Torso yaw relative to planted feet (positive = turn-left lead). */
  torsoY: number
  /** Forward lean (X): walk/run weight shift; rest/slump hunch. */
  torsoPitch: number
  /** Side sway (Z): gait weight transfer. */
  torsoRoll: number
  /** Head yaw relative to neck (Lab close-cam lookout / seek). */
  headYaw: number
  /** Head pitch: down = seek/tired, up = lookout. */
  headPitch: number
  bob: number
}

export interface Vec2 {
  x: number
  z: number
}

/** Local-space aim toward a world xz actionTarget (render-only). */
export interface LocalReachAim {
  /** atan2(localX, localZ); 0 = forward, + = agent right. */
  azimuth: number
  /** Horizontal distance in world units. */
  distance: number
}

export const IDLE_LIMB_POSE: LimbPose = {
  leftHip: 0.05,
  rightHip: -0.05,
  leftHipY: 0.02,
  rightHipY: -0.02,
  leftKnee: 0.1,
  rightKnee: 0.1,
  leftShoulder: 0.1,
  rightShoulder: -0.1,
  leftShoulderY: 0.04,
  rightShoulderY: -0.04,
  leftElbow: 0.22,
  rightElbow: 0.22,
  torsoY: 0,
  torsoPitch: 0.02,
  torsoRoll: 0,
  headYaw: 0,
  headPitch: 0,
  bob: 0,
}

const DEAD_LIMB_POSE: LimbPose = {
  leftHip: 0.35,
  rightHip: -0.2,
  leftHipY: 0.1,
  rightHipY: -0.08,
  leftKnee: 0.55,
  rightKnee: 0.4,
  leftShoulder: 0.55,
  rightShoulder: -0.35,
  leftShoulderY: 0.25,
  rightShoulderY: -0.15,
  leftElbow: 0.7,
  rightElbow: 0.45,
  torsoY: 0.12,
  torsoPitch: 0.35,
  torsoRoll: 0.08,
  headYaw: 0.08,
  headPitch: 0.25,
  bob: 0,
}

/** Soft idle breath / micro-sway so Lab figures do not freeze like statues. */
export const IDLE_BREATH_SPEED = 1.7

/** Radians of gait / action phase per second while the body is animating. */
export const WALK_PHASE_SPEED = 9.5

/** Faster cadence for run (FLEE or high agent.speed while moving). */
export const RUN_PHASE_SPEED = 14.5

/**
 * MOVE_FORWARD uses run when agent.speed is at/above this (mid AGENT_SPEED_RANGE).
 * FLEE always runs regardless of speed.
 */
export const RUN_SPEED_THRESHOLD = 2.05

/** Slightly slower pulse for gather / attack reach cycles. */
export const ACTION_PHASE_SPEED = 7.2

/** How quickly limb angles ease toward the target pose (1/s). */
export const POSE_BLEND_RATE = 14

/** Soft world-xz follow rate (1/s) while walking. Planted motions snap (see blendPosition). */
export const POSITION_FOLLOW_RATE_WALK = 11
/** Faster catch-up while running so render lag does not skate under FLEE / fast MOVE. */
export const POSITION_FOLLOW_RATE_RUN = 17
/** Snap xz when sim jumped farther than this (respawn / teleport) — no soft lag. */
export const POSITION_SNAP_DISTANCE = 2.75
/** Reference agent.speed (u/s) for walk cadence scaling (near AGENT_SPEED_RANGE low). */
export const WALK_SPEED_REF = 1.55
/** Reference agent.speed (u/s) for run cadence (near mid/high AGENT_SPEED_RANGE). */
export const RUN_SPEED_REF = 2.4

/**
 * How long gather/eat/attack/defend linger after lastAction flips away
 * (stops single-tick action flicker). Walk/run/dead interrupt immediately.
 */
export const ACTION_HOLD_SECONDS = 0.35

const PLANTED_MOTIONS: ReadonlySet<AgentMotionState> = new Set([
  'idle',
  'rest',
  'slump',
  'curious',
  'hungry',
  'positive',
  'turnLeft',
  'turnRight',
  'gather',
  'eat',
  'attack',
  'defend',
  'dead',
])

/** Sticky poses that should anti-jitter across sim ticks (walk/run/dead interrupt). */
export const HELD_ACTION_MOTIONS: ReadonlySet<AgentMotionState> = new Set([
  'rest',
  'turnLeft',
  'turnRight',
  'gather',
  'eat',
  'attack',
  'defend',
])

export interface HeldMotionClock {
  displayed: AgentMotionState
  holdLeft: number
}

export function resolveAgentMotionState(input: {
  alive: boolean
  lastAction: AgentAction | null
  /** Agent locomotion speed (u/s). Used with MOVE_FORWARD to pick walk vs run. */
  speed?: number
  /** Lab-only drives (absent in Ecology → idle stays idle). */
  fatigue?: number
  comfort?: number
  curiosity?: number
  hunger?: number
  energy?: number
}): AgentMotionState {
  if (!input.alive) return 'dead'
  switch (input.lastAction) {
    case 'FLEE':
      return 'run'
    case 'MOVE_FORWARD':
      return shouldRunFromSpeed(input.speed) ? 'run' : 'walk'
    case 'TURN_LEFT':
      return 'turnLeft'
    case 'TURN_RIGHT':
      return 'turnRight'
    case 'GATHER':
    case 'PICK_UP':
      return 'gather'
    case 'EAT':
      return 'eat'
    case 'ATTACK':
      return 'attack'
    case 'DEFEND':
      return 'defend'
    case 'REST':
      return 'rest'
    default:
      return idleFromDrives({
        fatigue: input.fatigue,
        comfort: input.comfort,
        curiosity: input.curiosity,
        hunger: input.hunger,
        energy: input.energy,
      })
  }
}

export interface IdleDriveInput {
  fatigue?: number
  comfort?: number
  curiosity?: number
  hunger?: number
  energy?: number
}

/**
 * Idle variants from Lab drives only; Ecology (no fatigue/curiosity/comfort) → plain idle.
 * Priority matches observeDrive: hungry/surv → tired vs curious → calm/positive.
 */
export function idleFromDrives(
  fatigueOrInput?: number | IdleDriveInput,
  comfortLegacy?: number,
): AgentMotionState {
  const input: IdleDriveInput =
    typeof fatigueOrInput === 'object' && fatigueOrInput !== null
      ? fatigueOrInput
      : { fatigue: fatigueOrInput, comfort: comfortLegacy }

  if (input.fatigue === undefined && input.curiosity === undefined && input.comfort === undefined) {
    return 'idle'
  }

  const fat = input.fatigue ?? 0
  const com = input.comfort ?? 50
  const cur = input.curiosity ?? 0
  const hunger = input.hunger ?? 0
  const energy = input.energy ?? 100

  if (hunger >= HUNGRY_HUNGER_THRESHOLD || energy <= HUNGRY_ENERGY_FLOOR) {
    return 'hungry'
  }

  const comfortNeed = 100 - com
  const tiredScore = Math.max(fat, comfortNeed)
  const tired =
    tiredScore >= SLUMP_FATIGUE_THRESHOLD ||
    (com <= SLUMP_COMFORT_FLOOR && fat >= SLUMP_COMFORT_FATIGUE_MIN)

  if (tiredScore < SLUMP_FATIGUE_THRESHOLD && cur < CURIOUS_THRESHOLD) {
    if (
      com >= POSITIVE_COMFORT_THRESHOLD &&
      fat <= POSITIVE_FATIGUE_CEILING &&
      cur <= POSITIVE_CURIOSITY_CEILING
    ) {
      return 'positive'
    }
    return 'idle'
  }

  if (tired && tiredScore >= cur) return 'slump'
  if (cur >= CURIOUS_THRESHOLD && cur > tiredScore) return 'curious'
  if (tired) return 'slump'
  if (cur >= CURIOUS_THRESHOLD) return 'curious'
  return 'idle'
}

function shouldRunFromSpeed(speed: number | undefined): boolean {
  return typeof speed === 'number' && Number.isFinite(speed) && speed >= RUN_SPEED_THRESHOLD
}

/**
 * Hold sticky action poses briefly so single-tick lastAction flips do not
 * flash idle. Walk/run and dead interrupt immediately (no plant-while-moving).
 */
export function stepHeldMotion(
  clock: HeldMotionClock,
  resolved: AgentMotionState,
  dt: number,
  holdSeconds = ACTION_HOLD_SECONDS,
): HeldMotionClock {
  if (resolved === 'dead') {
    return { displayed: 'dead', holdLeft: 0 }
  }
  if (resolved === 'walk' || resolved === 'run') {
    return { displayed: resolved, holdLeft: 0 }
  }
  if (HELD_ACTION_MOTIONS.has(resolved)) {
    return { displayed: resolved, holdLeft: holdSeconds }
  }
  if (HELD_ACTION_MOTIONS.has(clock.displayed) && clock.holdLeft > 0) {
    const holdLeft = clock.holdLeft - Math.max(0, dt)
    if (holdLeft > 0) {
      return { displayed: clock.displayed, holdLeft }
    }
  }
  return { displayed: resolved, holdLeft: 0 }
}

/**
 * World xz target → agent-local aim. Agent yaw matches Three.js Y rotation
 * (forward = (sin yaw, cos yaw) in xz).
 */
export function computeLocalReachAim(input: {
  agentX: number
  agentZ: number
  agentYaw: number
  targetX: number
  targetZ: number
}): LocalReachAim | null {
  const dx = input.targetX - input.agentX
  const dz = input.targetZ - input.agentZ
  const distance = Math.hypot(dx, dz)
  if (distance < 1e-4) return null
  const cos = Math.cos(input.agentYaw)
  const sin = Math.sin(input.agentYaw)
  const localX = dx * cos - dz * sin
  const localZ = dx * sin + dz * cos
  return {
    azimuth: Math.atan2(localX, localZ),
    distance,
  }
}

/**
 * Scale walk/run phase rates by observable agent.speed so foot cadence tracks
 * sim displacement (moonwalk / skate when cadence is fixed).
 */
export function locomotionPhaseRates(speed?: number): { walk: number; run: number } {
  const s =
    typeof speed === 'number' && Number.isFinite(speed) && speed > 0 ? speed : WALK_SPEED_REF
  const walkScale = clamp(s / WALK_SPEED_REF, 0.65, 1.35)
  const runScale = clamp(s / RUN_SPEED_REF, 0.75, 1.45)
  return {
    walk: WALK_PHASE_SPEED * walkScale,
    run: RUN_PHASE_SPEED * runScale,
  }
}

/**
 * Advance phase while walking/running or performing a pulsed upper-body action.
 * Idle/rest breathe gently; turn/dead/defend/eat freeze feet.
 * Slump/curious/hungry/positive pulse gently. (Render clock, independent of sim ticks.)
 */
export function advanceWalkPhase(
  phase: number,
  dt: number,
  motion: AgentMotionState,
  walkSpeed = WALK_PHASE_SPEED,
  actionSpeed = ACTION_PHASE_SPEED,
  runSpeed = RUN_PHASE_SPEED,
  gestureSpeed = GESTURE_PHASE_SPEED,
  breathSpeed = IDLE_BREATH_SPEED,
): number {
  if (dt <= 0) return phase
  if (motion === 'walk') return phase + dt * walkSpeed
  if (motion === 'run') return phase + dt * runSpeed
  if (motion === 'gather' || motion === 'attack') return phase + dt * actionSpeed
  if (
    motion === 'slump' ||
    motion === 'curious' ||
    motion === 'hungry' ||
    motion === 'positive'
  ) {
    return phase + dt * gestureSpeed
  }
  if (motion === 'idle' || motion === 'rest') return phase + dt * breathSpeed
  return phase
}

function plantedLegs(
  shoulderBias = 0,
): Pick<LimbPose, 'leftHip' | 'rightHip' | 'leftHipY' | 'rightHipY' | 'leftKnee' | 'rightKnee'> {
  return {
    leftHip: IDLE_LIMB_POSE.leftHip,
    rightHip: IDLE_LIMB_POSE.rightHip,
    leftHipY: 0,
    rightHipY: 0,
    leftKnee: IDLE_LIMB_POSE.leftKnee + shoulderBias * 0.02,
    rightKnee: IDLE_LIMB_POSE.rightKnee + shoulderBias * 0.02,
  }
}

/**
 * In-place turn: torso leads yaw, feet counter-twist (planted, no gait cycle).
 * sign +1 = TURN_LEFT, -1 = TURN_RIGHT (matches sim yaw increase / decrease).
 */
function turnPose(sign: 1 | -1): LimbPose {
  return {
    leftHip: IDLE_LIMB_POSE.leftHip + sign * 0.1,
    rightHip: IDLE_LIMB_POSE.rightHip - sign * 0.1,
    leftHipY: -sign * 0.22,
    rightHipY: -sign * 0.28,
    leftKnee: IDLE_LIMB_POSE.leftKnee + 0.04,
    rightKnee: IDLE_LIMB_POSE.rightKnee + 0.06,
    leftShoulder: sign * 0.22,
    rightShoulder: -sign * 0.22,
    leftShoulderY: sign * 0.12,
    rightShoulderY: sign * 0.12,
    leftElbow: 0.28,
    rightElbow: 0.28,
    torsoY: sign * 0.42,
    torsoPitch: 0.04,
    torsoRoll: -sign * 0.06,
    headYaw: sign * 0.18,
    headPitch: 0,
    bob: 0.004,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function gatherPose(phase: number, aim: LocalReachAim | null): LimbPose {
  const reach = 0.55 + Math.sin(phase) * 0.22
  const yaw = aim ? clamp(aim.azimuth * 0.9, -1.05, 1.05) : 0
  const stretch = aim ? clamp(aim.distance * 0.12, 0, 0.28) : 0
  return {
    ...plantedLegs(0.1),
    leftShoulder: -0.15,
    rightShoulder: -(reach + stretch),
    leftShoulderY: yaw * -0.2,
    rightShoulderY: yaw,
    leftElbow: 0.35,
    rightElbow: 0.15 + Math.max(0, Math.sin(phase)) * 0.45,
    torsoY: yaw * 0.12,
    torsoPitch: 0.18 + stretch * 0.35,
    torsoRoll: yaw * -0.08,
    headYaw: yaw * 0.45,
    headPitch: 0.12,
    bob: Math.abs(Math.sin(phase)) * 0.012,
  }
}

function eatPose(): LimbPose {
  return {
    ...plantedLegs(),
    leftShoulder: 0.12,
    rightShoulder: -0.95,
    leftShoulderY: 0.08,
    rightShoulderY: -0.35,
    leftElbow: 0.25,
    rightElbow: 1.15,
    torsoY: 0.05,
    torsoPitch: 0.12,
    torsoRoll: -0.04,
    headYaw: 0.05,
    headPitch: 0.18,
    bob: 0.004,
  }
}

function attackPose(phase: number, aim: LocalReachAim | null): LimbPose {
  const strike = 0.35 + Math.sin(phase) * 0.55
  const yaw = aim ? clamp(aim.azimuth * 0.95, -1.15, 1.15) : 0
  const stretch = aim ? clamp(aim.distance * 0.1, 0, 0.35) : 0
  return {
    ...plantedLegs(0.15),
    leftShoulder: 0.25,
    rightShoulder: -(strike + stretch),
    leftShoulderY: yaw * -0.15,
    rightShoulderY: yaw,
    leftElbow: 0.4,
    rightElbow: 0.2 + Math.max(0, -Math.sin(phase)) * 0.5,
    torsoY: yaw * 0.15,
    torsoPitch: 0.1 + Math.max(0, Math.sin(phase)) * 0.12,
    torsoRoll: yaw * -0.1,
    headYaw: yaw * 0.55,
    headPitch: -0.04,
    bob: Math.abs(Math.sin(phase)) * 0.018,
  }
}

function defendPose(): LimbPose {
  return {
    ...plantedLegs(),
    leftShoulder: -0.85,
    rightShoulder: -0.85,
    leftShoulderY: 0.35,
    rightShoulderY: -0.35,
    leftElbow: 1.05,
    rightElbow: 1.05,
    torsoY: 0,
    torsoPitch: 0.08,
    torsoRoll: 0,
    headYaw: 0,
    headPitch: 0.06,
    bob: 0.002,
  }
}

/** Calm planted rest (REST action) — soft knees, arms loose, breathing. */
function restPose(phase = 0): LimbPose {
  const breath = Math.sin(phase) * 0.012
  return {
    leftHip: 0.18,
    rightHip: -0.12,
    leftHipY: 0.04,
    rightHipY: -0.04,
    leftKnee: 0.42,
    rightKnee: 0.38,
    leftShoulder: 0.22 + breath,
    rightShoulder: -0.18 - breath,
    leftShoulderY: 0.06,
    rightShoulderY: -0.06,
    leftElbow: 0.55,
    rightElbow: 0.5,
    torsoY: 0,
    torsoPitch: 0.1 + breath * 0.4,
    torsoRoll: Math.sin(phase * 0.5) * 0.02,
    headYaw: Math.sin(phase * 0.35) * 0.04,
    headPitch: 0.08,
    bob: -0.03 + breath * 0.5,
  }
}

/** Tired: hunched, inward arms, soft shudder — wants rest. */
function slumpPose(phase: number): LimbPose {
  const shudder = Math.sin(phase) * 0.04
  return {
    leftHip: 0.28,
    rightHip: -0.22,
    leftHipY: 0.08,
    rightHipY: -0.06,
    leftKnee: 0.62,
    rightKnee: 0.58,
    leftShoulder: 0.55 + shudder,
    rightShoulder: -0.48 - shudder,
    leftShoulderY: 0.32,
    rightShoulderY: -0.28,
    leftElbow: 0.95,
    rightElbow: 0.9,
    torsoY: 0.04,
    torsoPitch: 0.32,
    torsoRoll: shudder * 0.5,
    headYaw: shudder * 0.35,
    headPitch: 0.28,
    bob: -0.07 + Math.abs(Math.sin(phase)) * 0.008,
  }
}

/**
 * Curious lookout: upright scan, hand shade, head leads the search —
 * readable under Lab close-cam without meters.
 */
function curiousPose(phase: number): LimbPose {
  const scan = Math.sin(phase * 0.7) * 0.42
  const lift = 0.08 + Math.abs(Math.sin(phase)) * 0.1
  return {
    ...plantedLegs(-0.04),
    leftShoulder: -0.55 - lift,
    rightShoulder: -0.12,
    leftShoulderY: 0.45 + scan * 0.15,
    rightShoulderY: -0.08,
    leftElbow: 0.85,
    rightElbow: 0.28,
    torsoY: scan * 0.35,
    torsoPitch: -0.08,
    torsoRoll: scan * -0.04,
    headYaw: scan,
    headPitch: -0.18 + Math.sin(phase * 0.9) * 0.06,
    bob: 0.01 + Math.abs(Math.sin(phase * 0.5)) * 0.008,
  }
}

/** Hungry: forward seek lean, hand to gut, restless weight — wants food. */
function hungryPose(phase: number): LimbPose {
  const restless = Math.sin(phase) * 0.05
  return {
    leftHip: 0.14 + restless,
    rightHip: -0.1 - restless,
    leftHipY: 0.05,
    rightHipY: -0.04,
    leftKnee: 0.28,
    rightKnee: 0.32,
    leftShoulder: 0.18,
    rightShoulder: 0.35 + Math.abs(restless),
    leftShoulderY: 0.08,
    rightShoulderY: -0.42,
    leftElbow: 0.35,
    rightElbow: 1.05,
    torsoY: restless * 0.6,
    torsoPitch: 0.22,
    torsoRoll: restless * 0.4,
    headYaw: restless * 1.2,
    headPitch: 0.22,
    bob: -0.02 + Math.abs(restless) * 0.3,
  }
}

/** Light positive gesture — open chest, soft arm lift pulse. */
function positivePose(phase: number): LimbPose {
  const lift = 0.12 + Math.sin(phase) * 0.18
  return {
    ...plantedLegs(-0.05),
    leftShoulder: -0.35 - lift * 0.35,
    rightShoulder: -0.45 - lift,
    leftShoulderY: 0.18,
    rightShoulderY: -0.22,
    leftElbow: 0.35,
    rightElbow: 0.28 + Math.max(0, Math.sin(phase)) * 0.25,
    torsoY: 0,
    torsoPitch: -0.06,
    torsoRoll: Math.sin(phase) * 0.03,
    headYaw: Math.sin(phase * 0.6) * 0.08,
    headPitch: -0.05,
    bob: 0.012 + Math.abs(Math.sin(phase)) * 0.01,
  }
}

function idlePose(phase: number): LimbPose {
  const breath = Math.sin(phase) * 0.015
  const sway = Math.sin(phase * 0.55) * 0.025
  return {
    leftHip: IDLE_LIMB_POSE.leftHip + sway * 0.3,
    rightHip: IDLE_LIMB_POSE.rightHip - sway * 0.3,
    leftHipY: IDLE_LIMB_POSE.leftHipY,
    rightHipY: IDLE_LIMB_POSE.rightHipY,
    leftKnee: IDLE_LIMB_POSE.leftKnee + Math.abs(sway) * 0.15,
    rightKnee: IDLE_LIMB_POSE.rightKnee + Math.abs(sway) * 0.15,
    leftShoulder: IDLE_LIMB_POSE.leftShoulder + breath,
    rightShoulder: IDLE_LIMB_POSE.rightShoulder - breath,
    leftShoulderY: IDLE_LIMB_POSE.leftShoulderY + sway * 0.4,
    rightShoulderY: IDLE_LIMB_POSE.rightShoulderY + sway * 0.4,
    leftElbow: IDLE_LIMB_POSE.leftElbow,
    rightElbow: IDLE_LIMB_POSE.rightElbow,
    torsoY: sway * 0.35,
    torsoPitch: 0.02 + breath * 0.35,
    torsoRoll: sway * 0.45,
    headYaw: sway * 0.5,
    headPitch: breath * 0.4,
    bob: breath * 0.55,
  }
}

export function poseFromMotion(
  motion: AgentMotionState,
  phase: number,
  aim: LocalReachAim | null = null,
): LimbPose {
  switch (motion) {
    case 'dead':
      return DEAD_LIMB_POSE
    case 'idle':
      return idlePose(phase)
    case 'rest':
      return restPose(phase)
    case 'slump':
      return slumpPose(phase)
    case 'curious':
      return curiousPose(phase)
    case 'hungry':
      return hungryPose(phase)
    case 'positive':
      return positivePose(phase)
    case 'turnLeft':
      return turnPose(1)
    case 'turnRight':
      return turnPose(-1)
    case 'gather':
      return gatherPose(phase, aim)
    case 'eat':
      return eatPose()
    case 'attack':
      return attackPose(phase, aim)
    case 'defend':
      return defendPose()
    case 'walk':
      return gaitPose(phase, 0.58, 0.72, 0.92, 0.03, 0.08, 0.05)
    case 'run':
      // Bigger stride / arm drive / lean so close Lab cam reads run ≠ walk.
      return gaitPose(phase, 0.88, 1.02, 1.15, 0.055, 0.18, 0.08)
  }
}

/**
 * Human-like opposite-limb cycle with stance knee soft bend, contralateral
 * arm swing, pelvic yaw, and weight-transfer roll/pitch.
 */
function gaitPose(
  phase: number,
  hipAmp: number,
  kneeAmp: number,
  armScale: number,
  bobAmp: number,
  lean = 0.08,
  rollAmp = 0.05,
): LimbPose {
  const swing = Math.sin(phase) * hipAmp
  const opposite = -swing
  // Swing-leg knee lifts; stance leg keeps a soft human bend.
  const swingKnee = Math.max(0, Math.sin(phase)) * kneeAmp
  const swingKneeOpp = Math.max(0, Math.sin(phase + Math.PI)) * kneeAmp
  const stanceSoft = 0.14 + Math.max(0, -Math.sin(phase)) * 0.08
  const stanceSoftOpp = 0.14 + Math.max(0, -Math.sin(phase + Math.PI)) * 0.08
  const weight = Math.sin(phase)
  return {
    leftHip: swing,
    rightHip: opposite,
    leftHipY: weight * 0.06,
    rightHipY: -weight * 0.06,
    leftKnee: stanceSoft + swingKnee,
    rightKnee: stanceSoftOpp + swingKneeOpp,
    leftShoulder: opposite * armScale * 0.95,
    rightShoulder: swing * armScale * 0.95,
    leftShoulderY: -weight * 0.08,
    rightShoulderY: weight * 0.08,
    leftElbow: 0.32 + swingKneeOpp * 0.42,
    rightElbow: 0.32 + swingKnee * 0.42,
    torsoY: -weight * 0.07,
    torsoPitch: lean + Math.abs(Math.sin(phase * 2)) * lean * 0.25,
    torsoRoll: -weight * rollAmp,
    headYaw: -weight * 0.04,
    headPitch: lean * 0.35,
    bob: Math.abs(Math.sin(phase * 2)) * bobAmp,
  }
}

export function blendPose(current: LimbPose, target: LimbPose, t: number): LimbPose {
  const a = Math.min(1, Math.max(0, t))
  return {
    leftHip: current.leftHip + (target.leftHip - current.leftHip) * a,
    rightHip: current.rightHip + (target.rightHip - current.rightHip) * a,
    leftHipY: current.leftHipY + (target.leftHipY - current.leftHipY) * a,
    rightHipY: current.rightHipY + (target.rightHipY - current.rightHipY) * a,
    leftKnee: current.leftKnee + (target.leftKnee - current.leftKnee) * a,
    rightKnee: current.rightKnee + (target.rightKnee - current.rightKnee) * a,
    leftShoulder: current.leftShoulder + (target.leftShoulder - current.leftShoulder) * a,
    rightShoulder: current.rightShoulder + (target.rightShoulder - current.rightShoulder) * a,
    leftShoulderY: current.leftShoulderY + (target.leftShoulderY - current.leftShoulderY) * a,
    rightShoulderY: current.rightShoulderY + (target.rightShoulderY - current.rightShoulderY) * a,
    leftElbow: current.leftElbow + (target.leftElbow - current.leftElbow) * a,
    rightElbow: current.rightElbow + (target.rightElbow - current.rightElbow) * a,
    torsoY: current.torsoY + (target.torsoY - current.torsoY) * a,
    torsoPitch: current.torsoPitch + (target.torsoPitch - current.torsoPitch) * a,
    torsoRoll: current.torsoRoll + (target.torsoRoll - current.torsoRoll) * a,
    headYaw: current.headYaw + (target.headYaw - current.headYaw) * a,
    headPitch: current.headPitch + (target.headPitch - current.headPitch) * a,
    bob: current.bob + (target.bob - current.bob) * a,
  }
}

export function blendPoseExp(
  current: LimbPose,
  target: LimbPose,
  dt: number,
  rate = POSE_BLEND_RATE,
): LimbPose {
  if (dt <= 0) return current
  const t = 1 - Math.exp(-rate * dt)
  return blendPose(current, target, t)
}

function wrapAngle(radians: number): number {
  let a = radians
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

/** Shortest-path yaw blend for render-smoothed facing (sim rotation stays authoritative). */
export function blendAngle(current: number, target: number, dt: number, rate = 12): number {
  if (dt <= 0) return wrapAngle(current)
  const delta = wrapAngle(target - current)
  return wrapAngle(current + delta * (1 - Math.exp(-rate * dt)))
}

/**
 * Soft world-xz follow while walking/running. Sim position remains authoritative;
 * render eases toward it so locomotion is less tick-snappy.
 * Planted motions (idle/turn/actions/dead) snap immediately — soft catch-up
 * while feet are planted reads as foot slide (STEP 17 completion criteria).
 * Run uses a higher follow rate; large sim jumps snap (respawn consistency).
 */
export function blendPosition(
  current: Vec2,
  target: Vec2,
  dt: number,
  motion: AgentMotionState,
): Vec2 {
  if (PLANTED_MOTIONS.has(motion)) {
    return { x: target.x, z: target.z }
  }
  const gap = Math.hypot(target.x - current.x, target.z - current.z)
  if (gap >= POSITION_SNAP_DISTANCE) {
    return { x: target.x, z: target.z }
  }
  if (dt <= 0) return current
  const rate = motion === 'run' ? POSITION_FOLLOW_RATE_RUN : POSITION_FOLLOW_RATE_WALK
  const t = 1 - Math.exp(-rate * dt)
  return {
    x: current.x + (target.x - current.x) * t,
    z: current.z + (target.z - current.z) * t,
  }
}
