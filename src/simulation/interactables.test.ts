import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_EVOLUTION_CONFIG } from '../evolution/constants'
import { createBrain, resetBrains, setBrain } from '../learning/brain'
import { legalActionsFor } from '../learning/actionMask'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import { encodeObservation, observeAgent } from '../learning/observation'
import { actionIndex, createEmptyQValues } from '../learning/qLearning'
import { computeReward, driveTradeoffReward } from '../learning/rewards'
import type { Agent } from '../types/agent'
import type {
  DoorInteractable,
  LookoutInteractable,
  MovableBoxInteractable,
  RestBedInteractable,
  SwitchInteractable,
} from '../types/interactable'
import { beginAgentTick, finishAgentTick } from './agentSystem'
import { resolveCombatTick } from './combat'
import { DEFAULT_WORLD_CONFIG, SIMULATION_STEP_DT } from './constants'
import { stepSimulation } from './engine'
import {
  applyLookoutDriveTradeoff,
  applyRestBedDriveTradeoff,
  LAB_DRIVE_SURVIVAL_ENERGY_COST,
  LAB_DRIVE_SURVIVAL_HUNGER_COST,
  LAB_LOOKOUT_CURIOSITY_RELIEF,
  LAB_REST_COMFORT_GAIN,
  LAB_REST_FATIGUE_RELIEF,
} from './labMode'
import {
  agentInInteractReach,
  applyBoxPush,
  applyLookoutUse,
  applyRestBedUse,
  applySwitchToggle,
  BOX_PUSH_DISTANCE,
  closedDoorBlocksPosition,
  DRIVE_SUCCESS_FLASH_TICKS,
  findBoxInInteractRange,
  findRestBedInInteractRange,
  findSwitchInInteractRange,
  isDriveSuccessFresh,
  movableBoxBlocksPosition,
  sanitizeInteractable,
} from './interactables'
import {
  classifyDriveVsSurvivalEvent,
  compareLabOnVsFrozen,
  createEmptyOutcomeStats,
  driveVsSurvivalEarlyLate,
  driveVsSurvivalPickRates,
  driveVsSurvivalTrajectory,
  emptyLabChoiceCounts,
  interactSuccessRate,
  isDriveTargetKind,
  labChoiceCountsFrom,
  labChoiceDriveSurvivalRates,
  labChoiceInteractRate,
  sanitizeOutcomeStats,
} from './outcomes'
import { isBlockedWorldPosition } from './spatial'
import { createInitialWorld } from './worldFactory'

function labWorld() {
  return createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    mode: 'human_behavior_lab',
    agentCount: 1,
    seed: 4242,
  })
}

describe('interactables STEP 16 slice', () => {
  beforeEach(() => {
    resetBrains([])
  })

  it('seeds door, switch, box, rest bed, and lookout only in Human Behavior Lab', () => {
    const ecology = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      seed: 11,
    })
    expect(ecology.interactables).toEqual([])
    expect(ecology.objects.some((object) => object.type === 'tree')).toBe(true)

    const lab = labWorld()
    expect(lab.interactables).toHaveLength(5)
    expect(lab.objects.every((object) => object.type === 'food')).toBe(true)
    expect(lab.forageNodes).toEqual([])
    const door = lab.interactables.find((item) => item.kind === 'door') as DoorInteractable
    const sw = lab.interactables.find((item) => item.kind === 'switch') as SwitchInteractable
    const box = lab.interactables.find((item) => item.kind === 'movable_box') as MovableBoxInteractable
    const bed = lab.interactables.find((item) => item.kind === 'rest_bed') as RestBedInteractable
    const lookout = lab.interactables.find((item) => item.kind === 'lookout') as LookoutInteractable
    // Baseline opens the rest-chamber gate so survival↔drive are both reachable.
    expect(door.open).toBe(true)
    expect(sw.on).toBe(true)
    expect(sw.controlsId).toBe(door.id)
    expect(box.position.x).toBeTypeOf('number')
    expect(bed.used).toBe(false)
    expect(lookout.used).toBe(false)
    expect(bed.lastUsedTick).toBe(0)
    expect(lookout.lastUsedTick).toBe(0)
    // Chambers: rest (−X) · vestibule · lookout (+X); survival food at +Z.
    expect(bed.position.x).toBeLessThan(door.position.x)
    expect(door.position.x).toBeLessThan(0)
    expect(lookout.position.x).toBeGreaterThan(0)
    const bedToLook = Math.hypot(
      bed.position.x - lookout.position.x,
      bed.position.z - lookout.position.z,
    )
    expect(bedToLook).toBeGreaterThan(8)
    for (const food of lab.objects.filter((object) => object.type === 'food')) {
      expect(food.position.z).toBeGreaterThan(3)
      expect(Math.abs(food.position.x)).toBeLessThan(3.5)
    }
  })

  it('locks the rest-chamber gate under rest_locked / tradeoff_hard conditions', () => {
    const locked = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      labCondition: 'rest_locked',
      agentCount: 1,
      seed: 77,
    })
    const door = locked.interactables.find((item) => item.kind === 'door') as DoorInteractable
    const sw = locked.interactables.find((item) => item.kind === 'switch') as SwitchInteractable
    expect(door.open).toBe(false)
    expect(sw.on).toBe(false)

    const scarce = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      labCondition: 'food_scarce',
      agentCount: 1,
      initialFoodCount: 40,
      seed: 88,
    })
    const foodCount = scarce.objects.filter((object) => object.type === 'food').length
    expect(foodCount).toBeLessThan(20)
    expect(foodCount).toBeGreaterThanOrEqual(4)
  })

  it('blocks movement through a closed door and clears after switch toggle', () => {
    const lab = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      labCondition: 'rest_locked',
      agentCount: 1,
      seed: 4242,
    })
    const door = lab.interactables.find((item) => item.kind === 'door') as DoorInteractable
    const x = door.position.x
    const z = door.position.z
    expect(door.open).toBe(false)
    expect(closedDoorBlocksPosition(x, z, 0.4, lab.interactables)).toBe(true)
    expect(isBlockedWorldPosition(x, z, lab, 0.4)).toBe(true)

    const sw = lab.interactables.find((item) => item.kind === 'switch') as SwitchInteractable
    const toggled = applySwitchToggle(lab.interactables, sw.id)
    expect(toggled).not.toBeNull()
    expect(toggled!.switchItem.on).toBe(true)
    expect(toggled!.door?.open).toBe(true)
    expect(closedDoorBlocksPosition(x, z, 0.4, toggled!.interactables)).toBe(false)

    // Open door must not add blocking beyond terrain/obstacles already present.
    const withoutDoors = isBlockedWorldPosition(x, z, { ...lab, interactables: [] }, 0.4)
    expect(
      isBlockedWorldPosition(x, z, { ...lab, interactables: toggled!.interactables }, 0.4),
    ).toBe(withoutDoors)
  })

  it('detect→GATHER→switch toggle updates world state, reward, and learning outcome', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      labCondition: 'rest_locked',
      agentCount: 1,
      seed: 4242,
    })
    const sw = world.interactables.find((item) => item.kind === 'switch') as SwitchInteractable
    const door = world.interactables.find((item) => item.kind === 'door') as DoorInteractable
    expect(door.open).toBe(false)
    const agent = {
      ...world.agents[0]!,
      position: { x: sw.position.x, z: sw.position.z },
      alive: true,
      energy: 80,
      hunger: 20,
      health: 100,
      equipment: null,
      fatigue: 15,
      curiosity: 25,
      comfort: 70,
    } as Agent

    const withAgent = { ...world, agents: [agent] }
    expect(findSwitchInInteractRange(agent, withAgent.interactables)).not.toBeNull()
    expect(legalActionsFor(agent, withAgent)).toContain('GATHER')

    const brain = createBrain(DEFAULT_LEARNING_CONFIG, 0)
    brain.epsilon = 0
    const stateKey = encodeObservation(observeAgent(agent, withAgent))
    const qValues = createEmptyQValues()
    qValues[actionIndex('GATHER')] = 50
    brain.qTable.set(stateKey, qValues)
    setBrain(agent.id, brain)

    const context = {
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      rng: () => 0.99,
      tick: 1,
      geneticsEnabled: false,
    }

    const plan = beginAgentTick(agent, withAgent, 0.2, context)
    expect(plan.decision?.selection.action).toBe('GATHER')
    expect(plan.interactedId).toBe(sw.id)
    expect(plan.interactables).not.toBeNull()
    const opened = plan.interactables!.find((item) => item.id === door.id) as DoorInteractable
    expect(opened.open).toBe(true)

    const combat = resolveCombatTick([], [plan.agent], 1)
    const result = finishAgentTick(plan, combat, { ...withAgent, interactables: plan.interactables! }, context)
    expect(result.interactedId).toBe(sw.id)
    expect(result.agent.lastReward).toBe(DEFAULT_REWARD_CONFIG.interactSuccess)
    expect(
      computeReward(
        {
          action: 'GATHER',
          ate: false,
          collided: false,
          died: false,
          energyBefore: 80,
          hungerBefore: 20,
          foodInEatRange: false,
          gatheredAmount: 0,
          pickedUp: false,
          interacted: true,
        },
        DEFAULT_REWARD_CONFIG,
      ),
    ).toBe(DEFAULT_REWARD_CONFIG.interactSuccess)

    // Closing again via a second toggle proves state is reversible from real outcomes.
    const toggledOff = applySwitchToggle(plan.interactables!, sw.id)!
    expect(toggledOff.door?.open).toBe(false)
  })

  it('interactAttempts/Successes still increment under Learning On', () => {
    const world = labWorld()
    const sw = world.interactables.find((item) => item.kind === 'switch') as SwitchInteractable
    const agent = {
      ...world.agents[0]!,
      position: { x: sw.position.x, z: sw.position.z },
      alive: true,
      energy: 80,
      hunger: 20,
      health: 100,
      equipment: null,
      fatigue: 15,
      curiosity: 25,
      comfort: 70,
    } as Agent
    const withAgent = { ...world, agents: [agent] }

    const brain = createBrain(DEFAULT_LEARNING_CONFIG, 0)
    brain.epsilon = 0
    const stateKey = encodeObservation(observeAgent(agent, withAgent))
    const qValues = createEmptyQValues()
    qValues[actionIndex('GATHER')] = 50
    brain.qTable.set(stateKey, qValues)
    setBrain(agent.id, brain)

    const before = withAgent.outcomeStats
    expect(before.interactAttempts).toBe(0)
    expect(before.interactSuccesses).toBe(0)

    const stepped = stepSimulation(
      { tick: 0, world: withAgent },
      SIMULATION_STEP_DT,
      {
        learningEnabled: true,
        learningConfig: DEFAULT_LEARNING_CONFIG,
        rewardConfig: DEFAULT_REWARD_CONFIG,
        evolutionConfig: DEFAULT_EVOLUTION_CONFIG,
        rng: () => 0.99,
      },
    )

    expect(stepped.world.outcomeStats.interactAttempts).toBe(1)
    expect(stepped.world.outcomeStats.interactSuccesses).toBe(1)
    expect(interactSuccessRate(stepped.world.outcomeStats)).toBe(1)
  })

  it('blocks movement into a movable box and clears the old cell after a successful push', () => {
    const lab = labWorld()
    const box = lab.interactables.find((item) => item.kind === 'movable_box') as MovableBoxInteractable
    expect(movableBoxBlocksPosition(box.position.x, box.position.z, 0.4, lab.interactables)).toBe(true)
    expect(isBlockedWorldPosition(box.position.x, box.position.z, lab, 0.4)).toBe(true)

    const facings = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4]
    let pushed: ReturnType<typeof applyBoxPush> = null
    let facing = 0
    for (const candidate of facings) {
      pushed = applyBoxPush(lab.interactables, box.id, candidate, lab)
      if (pushed) {
        facing = candidate
        break
      }
    }
    expect(pushed).not.toBeNull()
    expect(pushed!.box.position.x).toBeCloseTo(
      box.position.x + Math.sin(facing) * BOX_PUSH_DISTANCE,
      5,
    )
    expect(pushed!.box.position.z).toBeCloseTo(
      box.position.z + Math.cos(facing) * BOX_PUSH_DISTANCE,
      5,
    )
    expect(movableBoxBlocksPosition(box.position.x, box.position.z, 0.4, pushed!.interactables)).toBe(
      false,
    )
    expect(
      movableBoxBlocksPosition(pushed!.box.position.x, pushed!.box.position.z, 0.4, pushed!.interactables),
    ).toBe(true)
  })

  it('detect→GATHER→box push updates world state, reward, and learning outcome', () => {
    const world = labWorld()
    const box = world.interactables.find((item) => item.kind === 'movable_box') as MovableBoxInteractable
    const facings = [Math.PI / 2, -Math.PI / 2, 0, Math.PI, Math.PI / 4, -Math.PI / 4]
    const facing =
      facings.find((candidate) => applyBoxPush(world.interactables, box.id, candidate, world) !== null) ??
      Math.PI / 2

    const agent = {
      ...world.agents[0]!,
      position: { x: box.position.x, z: box.position.z },
      rotation: facing,
      alive: true,
      energy: 80,
      hunger: 20,
      health: 100,
      equipment: null,
      fatigue: 15,
      curiosity: 25,
      comfort: 70,
    } as Agent

    const withAgent = { ...world, agents: [agent] }
    expect(findBoxInInteractRange(agent, withAgent.interactables)).not.toBeNull()
    expect(legalActionsFor(agent, withAgent)).toContain('GATHER')

    const brain = createBrain(DEFAULT_LEARNING_CONFIG, 0)
    brain.epsilon = 0
    const stateKey = encodeObservation(observeAgent(agent, withAgent))
    const qValues = createEmptyQValues()
    qValues[actionIndex('GATHER')] = 50
    brain.qTable.set(stateKey, qValues)
    setBrain(agent.id, brain)

    const context = {
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      rng: () => 0.99,
      tick: 1,
      geneticsEnabled: false,
    }

    const before = { x: box.position.x, z: box.position.z }
    const plan = beginAgentTick(agent, withAgent, 0.2, context)
    expect(plan.decision?.selection.action).toBe('GATHER')
    expect(plan.interactedId).toBe(box.id)
    expect(plan.targetKind).toBe('movable_box')
    expect(plan.interactables).not.toBeNull()
    const moved = plan.interactables!.find((item) => item.id === box.id) as MovableBoxInteractable
    expect(moved.position.x).toBeCloseTo(before.x + Math.sin(facing) * BOX_PUSH_DISTANCE, 5)
    expect(moved.position.z).toBeCloseTo(before.z + Math.cos(facing) * BOX_PUSH_DISTANCE, 5)

    const combat = resolveCombatTick([], [plan.agent], 1)
    const result = finishAgentTick(plan, combat, { ...withAgent, interactables: plan.interactables! }, context)
    expect(result.interactedId).toBe(box.id)
    expect(result.agent.lastReward).toBe(DEFAULT_REWARD_CONFIG.interactSuccess)
  })

  it('detect→GATHER→rest bed toggles used state, reward, and learning outcome', () => {
    const world = labWorld()
    const bed = world.interactables.find((item) => item.kind === 'rest_bed') as RestBedInteractable
    expect(bed.used).toBe(false)

    const agent = {
      ...world.agents[0]!,
      position: { x: bed.position.x, z: bed.position.z },
      alive: true,
      energy: 80,
      hunger: 20,
      health: 100,
      equipment: null,
      fatigue: 40,
      curiosity: 40,
      comfort: 50,
    } as Agent

    const withAgent = { ...world, agents: [agent] }
    expect(findRestBedInInteractRange(agent, withAgent.interactables)).not.toBeNull()
    expect(legalActionsFor(agent, withAgent)).toContain('GATHER')

    const brain = createBrain(DEFAULT_LEARNING_CONFIG, 0)
    brain.epsilon = 0
    const stateKey = encodeObservation(observeAgent(agent, withAgent))
    const qValues = createEmptyQValues()
    qValues[actionIndex('GATHER')] = 50
    brain.qTable.set(stateKey, qValues)
    setBrain(agent.id, brain)

    const context = {
      learningEnabled: true,
      learningConfig: DEFAULT_LEARNING_CONFIG,
      rewardConfig: DEFAULT_REWARD_CONFIG,
      rng: () => 0.99,
      tick: 1,
      geneticsEnabled: false,
    }

    const plan = beginAgentTick(agent, withAgent, 0.2, context)
    expect(plan.decision?.selection.action).toBe('GATHER')
    expect(plan.interactedId).toBe(bed.id)
    expect(plan.targetKind).toBe('rest_bed')
    const toggled = plan.interactables!.find((item) => item.id === bed.id) as RestBedInteractable
    expect(toggled.used).toBe(true)
    expect(toggled.lastUsedTick).toBe(1)
    expect(plan.agent.fatigue!).toBeLessThan(agent.fatigue!)
    expect(plan.agent.energy).toBeLessThan(agent.energy)

    const combat = resolveCombatTick([], [plan.agent], 1)
    const result = finishAgentTick(plan, combat, { ...withAgent, interactables: plan.interactables! }, context)
    expect(result.interactedId).toBe(bed.id)
    expect(result.agent.lastReward).toBeGreaterThan(DEFAULT_REWARD_CONFIG.interactSuccess)

    const again = applyRestBedUse(plan.interactables!, bed.id, 9)!
    expect(again.bed.used).toBe(false)
    expect(again.bed.lastUsedTick).toBe(9)
  })

  it('stamps lastUsedTick and drives success/reach helpers for rest/lookout cues', () => {
    const world = labWorld()
    const bed = world.interactables.find((item) => item.kind === 'rest_bed') as RestBedInteractable
    const lookout = world.interactables.find((item) => item.kind === 'lookout') as LookoutInteractable

    const rested = applyRestBedUse(world.interactables, bed.id, 42)!
    expect(rested.bed.lastUsedTick).toBe(42)
    expect(isDriveSuccessFresh(rested.bed.lastUsedTick, 42)).toBe(true)
    expect(isDriveSuccessFresh(rested.bed.lastUsedTick, 42 + DRIVE_SUCCESS_FLASH_TICKS)).toBe(true)
    expect(isDriveSuccessFresh(rested.bed.lastUsedTick, 42 + DRIVE_SUCCESS_FLASH_TICKS + 1)).toBe(
      false,
    )
    expect(isDriveSuccessFresh(0, 10)).toBe(false)

    const looked = applyLookoutUse(rested.interactables, lookout.id, 7)!
    expect(looked.lookout.lastUsedTick).toBe(7)

    const near = agentInInteractReach(bed.position.x, bed.position.z, [
      { alive: true, position: { x: bed.position.x + 0.4, z: bed.position.z } },
    ])
    const far = agentInInteractReach(bed.position.x, bed.position.z, [
      { alive: true, position: { x: bed.position.x + 8, z: bed.position.z } },
    ])
    const dead = agentInInteractReach(bed.position.x, bed.position.z, [
      { alive: false, position: { x: bed.position.x, z: bed.position.z } },
    ])
    expect(near).toBe(true)
    expect(far).toBe(false)
    expect(dead).toBe(false)

    const sanitized = sanitizeInteractable({
      ...bed,
      used: true,
      lastUsedTick: 12.7,
    }) as RestBedInteractable
    expect(sanitized.lastUsedTick).toBe(12)
    const legacy = sanitizeInteractable({
      id: 'legacy-bed',
      kind: 'rest_bed',
      position: { x: 0, y: 0, z: 0 },
      used: false,
    }) as RestBedInteractable
    expect(legacy.lastUsedTick).toBe(0)
  })

  it('rest/lookout drive tradeoff beats eat when drives high, loses when survival urgent', () => {
    const tired = {
      fatigue: 80,
      curiosity: 90,
      comfort: 20,
      energy: 70,
      hunger: 20,
    }
    const rested = applyRestBedDriveTradeoff(tired as Agent)
    expect(rested.fatigue).toBeCloseTo(80 - LAB_REST_FATIGUE_RELIEF)
    expect(rested.comfort).toBeCloseTo(20 + LAB_REST_COMFORT_GAIN)
    expect(rested.energy).toBeCloseTo(70 - LAB_DRIVE_SURVIVAL_ENERGY_COST)
    expect(rested.hunger).toBeCloseTo(20 + LAB_DRIVE_SURVIVAL_HUNGER_COST)
    const looked = applyLookoutDriveTradeoff(tired as Agent)
    expect(looked.curiosity).toBeCloseTo(90 - LAB_LOOKOUT_CURIOSITY_RELIEF)

    const highDrive = computeReward(
      {
        action: 'GATHER',
        ate: false,
        collided: false,
        died: false,
        energyBefore: 70,
        hungerBefore: 20,
        foodInEatRange: false,
        gatheredAmount: 0,
        pickedUp: false,
        interacted: true,
        targetKind: 'rest_bed',
        fatigueBefore: 80,
        comfortBefore: 20,
      },
      DEFAULT_REWARD_CONFIG,
    )
    const urgent = computeReward(
      {
        action: 'GATHER',
        ate: false,
        collided: false,
        died: false,
        energyBefore: 20,
        hungerBefore: 80,
        foodInEatRange: true,
        gatheredAmount: 0,
        pickedUp: false,
        interacted: true,
        targetKind: 'rest_bed',
        fatigueBefore: 80,
        comfortBefore: 20,
      },
      DEFAULT_REWARD_CONFIG,
    )
    expect(highDrive).toBeGreaterThan(DEFAULT_REWARD_CONFIG.eatSuccess)
    expect(urgent).toBeLessThan(DEFAULT_REWARD_CONFIG.eatSuccess)
    expect(
      driveTradeoffReward({
        action: 'GATHER',
        ate: false,
        collided: false,
        died: false,
        energyBefore: 70,
        hungerBefore: 20,
        foodInEatRange: false,
        gatheredAmount: 0,
        pickedUp: false,
        interacted: true,
        targetKind: 'lookout',
        curiosityBefore: 90,
      }),
    ).toBeGreaterThan(0)
  })

  it('drive vs survival pick rates from outcome stats', () => {
    expect(isDriveTargetKind('rest_bed')).toBe(true)
    expect(isDriveTargetKind('lookout')).toBe(true)
    expect(isDriveTargetKind('switch')).toBe(false)
    expect(driveVsSurvivalPickRates(createEmptyOutcomeStats())).toBeNull()
    const rates = driveVsSurvivalPickRates({
      ...createEmptyOutcomeStats(),
      drivePicks: 1,
      survivalPicks: 3,
    })
    expect(rates?.driveRate).toBeCloseTo(0.25)
    expect(rates?.survivalRate).toBeCloseTo(0.75)
    expect(sanitizeOutcomeStats({}).drivePicks).toBe(0)
    expect(sanitizeOutcomeStats({ drivePicks: 2, survivalPicks: 5 }).survivalPicks).toBe(5)
  })

  it('Learning On vs Frozen Q Lab choice compare deltas', () => {
    expect(compareLabOnVsFrozen(null, null)).toBeNull()
    const learning = labChoiceCountsFrom({
      ...createEmptyOutcomeStats(),
      drivePicks: 2,
      survivalPicks: 2,
      interactAttempts: 4,
      interactSuccesses: 2,
    })
    const frozen = labChoiceCountsFrom({
      ...createEmptyOutcomeStats(),
      drivePicks: 1,
      survivalPicks: 3,
      interactAttempts: 5,
      interactSuccesses: 1,
    })
    const compare = compareLabOnVsFrozen(learning, frozen)
    expect(compare?.learningRates?.driveRate).toBeCloseTo(0.5)
    expect(compare?.frozenRates?.driveRate).toBeCloseTo(0.25)
    expect(compare?.driveRateDelta).toBeCloseTo(0.25)
    expect(compare?.survivalRateDelta).toBeCloseTo(-0.25)
    expect(compare?.learningInteractRate).toBeCloseTo(0.5)
    expect(compare?.frozenInteractRate).toBeCloseTo(0.2)
    expect(compare?.interactRateDelta).toBeCloseTo(0.3)
    expect(labChoiceDriveSurvivalRates(emptyLabChoiceCounts())).toBeNull()
    expect(labChoiceInteractRate(emptyLabChoiceCounts())).toBeNull()
  })

  it('drive vs survival trajectory filters Eat and rest/lookout only', () => {
    expect(classifyDriveVsSurvivalEvent({ selectedAction: 'EAT', targetKind: null })).toBe(
      'survival',
    )
    expect(
      classifyDriveVsSurvivalEvent({ selectedAction: 'GATHER', targetKind: 'rest_bed' }),
    ).toBe('drive')
    expect(classifyDriveVsSurvivalEvent({ selectedAction: 'GATHER', targetKind: 'switch' })).toBeNull()
    const traj = driveVsSurvivalTrajectory([
      {
        eventId: 'a',
        simulationTime: 3,
        selectedAction: 'EAT',
        targetKind: null,
        outcome: 'success',
      },
      {
        eventId: 'b',
        simulationTime: 2,
        selectedAction: 'MOVE_FORWARD',
        targetKind: null,
      },
      {
        eventId: 'c',
        simulationTime: 1,
        selectedAction: 'GATHER',
        targetKind: 'lookout',
        outcome: 'success',
      },
    ])
    expect(traj).toHaveLength(2)
    expect(traj[0]).toMatchObject({ kind: 'survival', label: 'Eat' })
    expect(traj[1]).toMatchObject({ kind: 'drive', label: 'Lookout' })
  })

  it('early/late trajectory windows mirror curriculum survival split from real events', () => {
    const traj = driveVsSurvivalTrajectory([
      {
        eventId: 'e1',
        simulationTime: 10,
        selectedAction: 'EAT',
        targetKind: null,
        outcome: 'success',
      },
      {
        eventId: 'e2',
        simulationTime: 20,
        selectedAction: 'EAT',
        targetKind: null,
        outcome: 'success',
      },
      {
        eventId: 'l1',
        simulationTime: 70,
        selectedAction: 'GATHER',
        targetKind: 'rest_bed',
        outcome: 'success',
      },
      {
        eventId: 'l2',
        simulationTime: 80,
        selectedAction: 'GATHER',
        targetKind: 'lookout',
        outcome: 'success',
      },
    ])
    const windows = driveVsSurvivalEarlyLate(traj, 60)
    expect(windows?.early.survivalPicks).toBe(2)
    expect(windows?.early.drivePicks).toBe(0)
    expect(windows?.late.drivePicks).toBe(2)
    expect(windows?.late.survivalPicks).toBe(0)
    expect(windows?.driveShareShift).toBe(true)
  })

  it('Observation encodes lookout as look_* cue', () => {
    const base = labWorld()
    const lookout = base.interactables.find((item) => item.kind === 'lookout') as LookoutInteractable
    const agent = {
      ...base.agents[0]!,
      position: { x: lookout.position.x, z: lookout.position.z },
      rotation: 0,
      alive: true,
    } as Agent
    expect(observeAgent(agent, { ...base, agents: [agent] }).interactable).toBe('look_close')
  })

  it('Observation v5 encodes nearest interactable cue; Ecology stays none', () => {
    const ecology = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      agentCount: 1,
      seed: 7,
    })
    const ecoAgent = ecology.agents[0]!
    const ecoObs = observeAgent(ecoAgent, ecology)
    expect(ecoObs.interactable).toBe('none')
    expect(encodeObservation(ecoObs).split('|')).toHaveLength(15)

    const base = labWorld()
    const onlySwitch: SwitchInteractable = {
      id: 'sw-cue',
      kind: 'switch',
      position: { x: 0, y: 0, z: 4 },
      rotation: 0,
      scale: 1,
      on: false,
      controlsId: 'door-missing',
    }
    const world = { ...base, interactables: [onlySwitch] }

    const closeAgent = {
      ...world.agents[0]!,
      position: { x: 0, z: 4 },
      rotation: 0,
      alive: true,
    } as Agent
    expect(observeAgent(closeAgent, { ...world, agents: [closeAgent] }).interactable).toBe('switch_close')

    const facingAgent = {
      ...closeAgent,
      position: { x: 0, z: 1 },
      rotation: 0,
    } as Agent
    expect(observeAgent(facingAgent, { ...world, agents: [facingAgent] }).interactable).toBe('switch_fwd')

    const sideAgent = {
      ...closeAgent,
      position: { x: 0, z: 1 },
      rotation: Math.PI / 2,
    } as Agent
    expect(observeAgent(sideAgent, { ...world, agents: [sideAgent] }).interactable).toBe('switch_oth')
  })
})
