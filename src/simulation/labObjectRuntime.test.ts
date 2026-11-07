import { beforeEach, describe, expect, it } from 'vitest'
import { createBrain, resetBrains, setBrain } from '../learning/brain'
import { legalActionsFor } from '../learning/actionMask'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import {
  decodeObservation,
  encodeObservation,
  observeAgent,
  observeHeldLab,
  observeLabObject,
} from '../learning/observation'
import { actionIndex, createEmptyQValues } from '../learning/qLearning'
import type { Agent } from '../types/agent'
import { DEFAULT_WORLD_CONFIG } from './constants'
import { beginAgentTick, finishAgentTick } from './agentSystem'
import { resolveCombatTick } from './combat'
import { getLabObjectType } from './labObjectCatalog'
import {
  affordancePreconditionsMet,
  applyLabAffordance,
  applyNeedDeltas,
  canConsumeLabFood,
  canPickOrDropLabObject,
  createKitchenBedroomLabObjects,
  findBlockedLabGather,
  findVisibleLabObject,
  getHeldLabObject,
  isLabObjectObservable,
  LAB_KITCHEN_ANCHORS,
  tryExecuteLabEat,
  tryExecuteLabGather,
  tryExecuteLabPickUp,
} from './labObjectRuntime'
import { findAffordance } from './labAffordance'
import { createInitialWorld } from './worldFactory'

beforeEach(() => {
  resetBrains([])
})

function labWorld(seed = 11) {
  return createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    mode: 'human_behavior_lab',
    agentCount: 1,
    seed,
  })
}

function placeAgentNear(
  world: ReturnType<typeof labWorld>,
  x: number,
  z: number,
  patch: Partial<Agent> = {},
): { world: ReturnType<typeof labWorld>; agent: Agent } {
  const agent: Agent = {
    ...world.agents[0]!,
    position: { x, z },
    hunger: 80,
    energy: 40,
    ...patch,
  }
  return { world: { ...world, agents: [agent] }, agent }
}

describe('Env-P1 Lab object runtime — seed', () => {
  it('seeds fridge/stove/sink/table/food in Lab and nothing in Ecology', () => {
    const lab = labWorld()
    expect(lab.labObjects.map((item) => item.objectType).sort()).toEqual([
      'dining_table',
      'food_item',
      'refrigerator',
      'sink',
      'stove',
    ])
    expect(
      lab.labObjects.every((item) => getLabObjectType(item.objectType)?.implementation === 'runtime'),
    ).toBe(true)
    expect(lab.interactables.some((item) => item.kind === 'rest_bed')).toBe(true)
    expect(lab.agents[0]?.heldLabObjectId ?? null).toBeNull()

    const ecology = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      seed: 3,
    })
    expect(ecology.labObjects).toEqual([])
    expect(createKitchenBedroomLabObjects(ecology.config)).toEqual([])
  })

  it('keeps contained food locked until fridge retrieve', () => {
    const lab = labWorld()
    const food = lab.labObjects.find((item) => item.objectType === 'food_item')!
    expect(food.objectState.locked).toBe(true)
    const agent = { ...lab.agents[0]!, position: { ...food.position } }
    expect(canConsumeLabFood(agent, lab.labObjects)).toBe(false)
  })
})

describe('Env-P1 Lab object runtime — GATHER/EAT state changes', () => {
  it('GATHER opens then retrieves food from refrigerator', () => {
    const base = labWorld()
    const fridge = base.labObjects.find((item) => item.objectType === 'refrigerator')!
    expect(fridge.objectState.open).toBe(false)
    expect(fridge.objectState.filled).toBe(true)

    const { world, agent } = placeAgentNear(
      base,
      LAB_KITCHEN_ANCHORS.refrigerator.x,
      LAB_KITCHEN_ANCHORS.refrigerator.z,
    )
    expect(legalActionsFor(agent, world)).toContain('GATHER')

    const opened = tryExecuteLabGather(agent, world.labObjects)!
    expect(opened.affordance.kind).toBe('open')
    expect(opened.target.objectState.open).toBe(true)
    expect(opened.tags).toContain('fridge_open')

    const retrieved = tryExecuteLabGather(agent, opened.labObjects)!
    expect(retrieved.affordance.kind).toBe('retrieve')
    expect(retrieved.target.objectState.filled).toBe(false)
    expect(retrieved.tags).toContain('fridge_retrieve')

    const food = retrieved.labObjects.find((item) => item.objectType === 'food_item')!
    expect(food.objectState.locked).toBe(false)
    expect(food.position.x).toBeCloseTo(LAB_KITCHEN_ANCHORS.foodRetrieve.x, 5)
    expect(food.position.z).toBeCloseTo(LAB_KITCHEN_ANCHORS.foodRetrieve.z, 5)
  })

  it('GATHER toggles stove and sink powered state', () => {
    const base = labWorld()
    expect(base.labObjects.find((item) => item.objectType === 'stove')!.objectState.powered).toBe(false)

    const nearStove = placeAgentNear(base, LAB_KITCHEN_ANCHORS.stove.x, LAB_KITCHEN_ANCHORS.stove.z)
    const ignited = tryExecuteLabGather(nearStove.agent, nearStove.world.labObjects)!
    expect(ignited.affordance.kind).toBe('toggle')
    expect(ignited.target.objectState.powered).toBe(true)

    const nearSink = placeAgentNear(base, LAB_KITCHEN_ANCHORS.sink.x, LAB_KITCHEN_ANCHORS.sink.z)
    const sinkOn = tryExecuteLabGather(nearSink.agent, nearSink.world.labObjects)!
    expect(sinkOn.affordance.kind).toBe('toggle')
    expect(sinkOn.target.objectState.powered).toBe(true)
  })

  it('EAT on released food_item depletes freshness and applies need deltas', () => {
    const base = labWorld()
    const fridge = base.labObjects.find((item) => item.objectType === 'refrigerator')!
    const opened = applyLabAffordance(base.labObjects, fridge.id, 'open')!
    const retrieved = applyLabAffordance(opened.labObjects, fridge.id, 'retrieve')!
    const food = retrieved.labObjects.find((item) => item.objectType === 'food_item')!

    const cleared = {
      ...base,
      objects: base.objects.filter((object) => object.type !== 'food'),
      labObjects: retrieved.labObjects,
    }
    const { world, agent } = placeAgentNear(cleared, food.position.x, food.position.z)
    expect(legalActionsFor(agent, world)).toContain('EAT')
    expect(canConsumeLabFood(agent, world.labObjects)).toBe(true)

    const eaten = tryExecuteLabEat(agent, world.labObjects)!
    expect(eaten.affordance.kind).toBe('consume')
    expect(eaten.target.objectState.freshness).toBe(0)
    expect(eaten.needDeltas.hunger).toBe(-35)
    expect(eaten.needDeltas.energy).toBe(12)

    const after = applyNeedDeltas(agent, eaten.needDeltas)
    expect(after.hunger).toBeLessThan(agent.hunger)
    expect(after.energy).toBeGreaterThan(agent.energy)
    expect(canConsumeLabFood(agent, eaten.labObjects)).toBe(false)
  })

  it('detect→GATHER→fridge open updates labObjects through agent tick', () => {
    const base = labWorld()
    const { world, agent: placed } = placeAgentNear(
      base,
      LAB_KITCHEN_ANCHORS.refrigerator.x,
      LAB_KITCHEN_ANCHORS.refrigerator.z,
    )
    const agent = {
      ...placed,
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
    expect(plan.labObjects).not.toBeNull()
    expect(plan.targetKind).toBe('refrigerator')
    const fridge = plan.labObjects!.find((item) => item.objectType === 'refrigerator')!
    expect(fridge.objectState.open).toBe(true)

    const combat = resolveCombatTick([], [plan.agent], 1)
    const result = finishAgentTick(
      plan,
      combat,
      { ...withAgent, labObjects: plan.labObjects! },
      context,
    )
    expect(result.interactedId).toBe(fridge.id)
  })
})

function releaseFood(world: ReturnType<typeof labWorld>) {
  const fridge = world.labObjects.find((item) => item.objectType === 'refrigerator')!
  const opened = applyLabAffordance(world.labObjects, fridge.id, 'open')!
  return applyLabAffordance(opened.labObjects, fridge.id, 'retrieve')!.labObjects
}

describe('Env-P2 Lab object runtime — held chains', () => {
  it('PICK_UP holds released food and drop returns it to the agent feet', () => {
    const base = labWorld()
    const labObjects = releaseFood(base)
    const food = labObjects.find((item) => item.objectType === 'food_item')!
    const { world, agent } = placeAgentNear(
      { ...base, labObjects },
      food.position.x,
      food.position.z,
    )
    expect(canPickOrDropLabObject(agent, world.labObjects)).toBe(true)
    expect(legalActionsFor(agent, world)).toContain('PICK_UP')

    const picked = tryExecuteLabPickUp(agent, world.labObjects)!
    expect(picked.affordance.kind).toBe('pick')
    expect(picked.heldLabObjectId).toBe(food.id)
    expect(picked.tags).toContain('food_pick')

    const holding = { ...agent, heldLabObjectId: picked.heldLabObjectId }
    expect(getHeldLabObject(holding, picked.labObjects)?.id).toBe(food.id)
    expect(canPickOrDropLabObject(holding, picked.labObjects)).toBe(true)

    const dropped = tryExecuteLabPickUp(holding, picked.labObjects)!
    expect(dropped.affordance.kind).toBe('drop')
    expect(dropped.heldLabObjectId).toBeNull()
    expect(dropped.target.position.x).toBeCloseTo(holding.position.x, 5)
    expect(dropped.target.position.z).toBeCloseTo(holding.position.z, 5)
  })

  it('stove operate requires held food; blocked when powered without hold', () => {
    const base = labWorld()
    const labObjects = releaseFood(base)
    const food = labObjects.find((item) => item.objectType === 'food_item')!
    const stoveType = getLabObjectType('stove')!
    const operate = findAffordance(stoveType, 'operate')!

    const nearStove = placeAgentNear(base, LAB_KITCHEN_ANCHORS.stove.x, LAB_KITCHEN_ANCHORS.stove.z)
    const ignited = tryExecuteLabGather(nearStove.agent, labObjects)!
    expect(ignited.affordance.kind).toBe('toggle')
    expect(ignited.target.objectState.powered).toBe(true)

    const powered = ignited.labObjects
    const emptyHands = nearStove.agent
    expect(affordancePreconditionsMet(operate, ignited.target, emptyHands, powered)).toBe(false)
    const blocked = tryExecuteLabGather(emptyHands, powered)!
    expect(blocked.blocked).toBe(true)
    expect(blocked.tags).toContain('blocked_affordance')
    expect(blocked.tags.some((tag) => tag.startsWith('requires_held:'))).toBe(true)
    expect(findBlockedLabGather(emptyHands, powered)?.blocked).toBe(true)

    const holding = { ...emptyHands, heldLabObjectId: food.id }
    expect(affordancePreconditionsMet(operate, ignited.target, holding, powered)).toBe(true)
    const cooked = tryExecuteLabGather(holding, powered)!
    expect(cooked.blocked).toBeFalsy()
    expect(cooked.affordance.kind).toBe('operate')
    expect(cooked.tags).toContain('cook')
    expect(cooked.tags).toContain('food_cooked')
    const heldFood = getHeldLabObject(holding, cooked.labObjects)!
    expect(heldFood.objectState.used).toBe(true)
    expect(holding.heldLabObjectId).toBe(food.id)
  })

  it('table consume eats held food with comfort; cooked food gets bonus', () => {
    const base = labWorld()
    let labObjects = releaseFood(base)
    const food = labObjects.find((item) => item.objectType === 'food_item')!
    const stove = labObjects.find((item) => item.objectType === 'stove')!

    // Power + cook while holding.
    const powered = applyLabAffordance(labObjects, stove.id, 'toggle')!
    labObjects = powered.labObjects
    const holdingRaw = {
      ...base.agents[0]!,
      position: { ...LAB_KITCHEN_ANCHORS.stove },
      heldLabObjectId: food.id,
      hunger: 80,
      comfort: 40,
      energy: 40,
    }
    const cooked = applyLabAffordance(labObjects, stove.id, 'operate', holdingRaw)!
    labObjects = cooked.labObjects
    expect(getHeldLabObject(holdingRaw, labObjects)!.objectState.used).toBe(true)

    const atTable = {
      ...holdingRaw,
      position: { ...LAB_KITCHEN_ANCHORS.dining_table },
    }
    const { world, agent } = placeAgentNear(
      { ...base, labObjects, objects: base.objects.filter((object) => object.type !== 'food') },
      LAB_KITCHEN_ANCHORS.dining_table.x,
      LAB_KITCHEN_ANCHORS.dining_table.z,
      { heldLabObjectId: food.id, hunger: 80, comfort: 40, energy: 40 },
    )
    expect(legalActionsFor(agent, world)).toContain('EAT')
    expect(canConsumeLabFood(agent, world.labObjects)).toBe(true)

    const eaten = tryExecuteLabEat(atTable, labObjects)!
    expect(eaten.affordance.kind).toBe('consume')
    expect(eaten.target.objectType).toBe('dining_table')
    expect(eaten.tags).toContain('eat_at_table')
    expect(eaten.tags).toContain('eat_cooked')
    expect(eaten.heldLabObjectId).toBeNull()
    expect(eaten.needDeltas.hunger).toBe(-40)
    expect(eaten.needDeltas.comfort).toBe(10)

    const after = applyNeedDeltas(agent, eaten.needDeltas)
    expect(after.hunger).toBeLessThan(agent.hunger)
    expect(after.comfort).toBeGreaterThan(agent.comfort!)
  })

  it('ground EAT without pick still works (Env-P1 regression)', () => {
    const base = labWorld()
    const labObjects = releaseFood(base)
    const food = labObjects.find((item) => item.objectType === 'food_item')!
    const cleared = {
      ...base,
      objects: base.objects.filter((object) => object.type !== 'food'),
      labObjects,
    }
    const { world, agent } = placeAgentNear(cleared, food.position.x, food.position.z)
    const eaten = tryExecuteLabEat(agent, world.labObjects)!
    expect(eaten.affordance.kind).toBe('consume')
    expect(eaten.target.objectType).toBe('food_item')
    expect(eaten.heldLabObjectId).toBeUndefined()
  })
})

describe('Obs v8 Lab object / held observation cues', () => {
  it('hides locked food and reports fridge_close / empty held at fridge', () => {
    const base = labWorld()
    const fridge = base.labObjects.find((item) => item.objectType === 'refrigerator')!
    const food = base.labObjects.find((item) => item.objectType === 'food_item')!
    expect(isLabObjectObservable(food)).toBe(false)
    expect(isLabObjectObservable(fridge)).toBe(true)

    const { world, agent } = placeAgentNear(base, fridge.position.x, fridge.position.z, {
      rotation: 0,
      heldLabObjectId: null,
    })
    expect(observeLabObject(agent, world)).toBe('fridge_close')
    expect(observeHeldLab(agent, world)).toBe('none')

    const visible = findVisibleLabObject(agent, world.labObjects, () => true)
    expect(visible?.objectType).toBe('refrigerator')
  })

  it('conditions stove_close + food / food_ck held after pick→cook', () => {
    const base = labWorld()
    let labObjects = releaseFood(base)
    const food = labObjects.find((item) => item.objectType === 'food_item')!
    const stove = labObjects.find((item) => item.objectType === 'stove')!

    const nearFood = placeAgentNear(
      { ...base, labObjects },
      food.position.x,
      food.position.z,
    )
    const picked = tryExecuteLabPickUp(nearFood.agent, labObjects)!
    labObjects = picked.labObjects
    const holdingRaw = {
      ...nearFood.agent,
      heldLabObjectId: picked.heldLabObjectId,
      position: { x: stove.position.x, z: stove.position.z },
      rotation: 0,
    }
    const atStove = { ...base, labObjects, agents: [holdingRaw] }
    expect(observeHeldLab(holdingRaw, atStove)).toBe('food')
    expect(observeLabObject(holdingRaw, atStove)).toBe('stove_close')

    const powered = applyLabAffordance(labObjects, stove.id, 'toggle')!
    labObjects = powered.labObjects
    const cooked = applyLabAffordance(labObjects, stove.id, 'operate', holdingRaw)!
    labObjects = cooked.labObjects
    const holdingCooked = { ...holdingRaw, heldLabObjectId: food.id }
    const afterCook = { ...base, labObjects, agents: [holdingCooked] }
    expect(observeHeldLab(holdingCooked, afterCook)).toBe('food_ck')
    expect(observeLabObject(holdingCooked, afterCook)).toBe('stove_close')

    const key = encodeObservation(observeAgent(holdingCooked, afterCook))
    expect(key.split('|')).toHaveLength(18)
    expect(decodeObservation(key)?.heldLab).toBe('food_ck')
    expect(decodeObservation(key)?.labObject).toBe('stove_close')
  })

  it('Ecology observations stay na for labObject/heldLab', () => {
    const ecology = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      agentCount: 1,
      seed: 3,
    })
    const agent = ecology.agents[0]!
    expect(observeLabObject(agent, ecology)).toBe('na')
    expect(observeHeldLab(agent, ecology)).toBe('na')
  })
})
