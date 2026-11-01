import { describe, expect, it } from 'vitest'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import { legalActionsFor } from '../learning/actionMask'
import { computeReward } from '../learning/rewards'
import { resetBrains } from '../learning/brain'
import { updateAgent } from './agentSystem'
import { DEFAULT_WORLD_CONFIG, SIMULATION_STEP_DT, TOOL_MAX_DURABILITY } from './constants'
import { applyGather, applyPickup, findGatherableNode, findPickupTool } from './forage'
import { createInitialWorld } from './worldFactory'
import type { Agent } from '../types/agent'
import type { ForageNode, WorldTool } from '../types/forage'

function learningOff(rng = () => 0) {
  return {
    learningEnabled: false,
    learningConfig: DEFAULT_LEARNING_CONFIG,
    rewardConfig: DEFAULT_REWARD_CONFIG,
    rng,
  }
}

function emptyWorld() {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 1,
    obstacleDensity: 0,
    initialFoodCount: 0,
    initialBerryCount: 0,
    initialRootCount: 0,
    initialBasketCount: 0,
    initialStickCount: 0,
    initialSpearCount: 0,
    initialShieldCount: 0,
  })
  const agent = world.agents[0]
  if (!agent) throw new Error('expected an agent')
  const ready: Agent = {
    ...agent,
    desire: 0,
    equipment: null,
    position: { x: 0, z: 0 },
    genome: { ...agent.genome, libido: 0, explorationRate: 1, toolAffinity: 1, strength: 1 },
  }
  resetBrains([ready], DEFAULT_LEARNING_CONFIG)
  return { world: { ...world, agents: [ready] }, agent: ready }
}

function berry(overrides: Partial<ForageNode> = {}): ForageNode {
  return {
    id: 'berry-1',
    kind: 'berry_bush',
    position: { x: 0.4, y: 0, z: 0.2 },
    scale: 1,
    rotation: 0,
    quantity: 4,
    maxQuantity: 4,
    ...overrides,
  }
}

function root(overrides: Partial<ForageNode> = {}): ForageNode {
  return {
    id: 'root-1',
    kind: 'root_patch',
    position: { x: 0.3, y: 0, z: 0.1 },
    scale: 1,
    rotation: 0,
    quantity: 3,
    maxQuantity: 3,
    ...overrides,
  }
}

function stick(overrides: Partial<WorldTool> = {}): WorldTool {
  return {
    id: 'stick-1',
    toolType: 'digging_stick',
    position: { x: 0.2, y: 0, z: 0.1 },
    scale: 1,
    rotation: 0,
    durability: TOOL_MAX_DURABILITY,
    maxDurability: TOOL_MAX_DURABILITY,
    ...overrides,
  }
}

function basket(overrides: Partial<WorldTool> = {}): WorldTool {
  return {
    id: 'basket-1',
    toolType: 'basket',
    position: { x: 0.2, y: 0, z: 0.1 },
    scale: 1,
    rotation: 0,
    durability: TOOL_MAX_DURABILITY,
    maxDurability: TOOL_MAX_DURABILITY,
    ...overrides,
  }
}

describe('tool pickup', () => {
  it('moves a world tool into the agent equipment slot and removes it from the world', () => {
    const { world, agent } = emptyWorld()
    const tool = stick()
    const nextWorld = { ...world, worldTools: [tool] }
    expect(findPickupTool(agent, nextWorld)?.id).toBe(tool.id)
    expect(legalActionsFor(agent, nextWorld)).toContain('PICK_UP')

    const picked = applyPickup(agent, tool)
    expect(picked.agent.equipment?.toolType).toBe('digging_stick')
    expect(picked.agent.equipment?.durability).toBe(TOOL_MAX_DURABILITY)
    expect(legalActionsFor(picked.agent, { ...nextWorld, worldTools: [] })).not.toContain('PICK_UP')
  })

  it('does not allow a second pickup while a tool is already equipped', () => {
    const { world, agent } = emptyWorld()
    const equipped = applyPickup(agent, stick()).agent
    const nextWorld = { ...world, agents: [equipped], worldTools: [basket()] }
    expect(findPickupTool(equipped, nextWorld)).toBeNull()
    expect(legalActionsFor(equipped, nextWorld)).not.toContain('PICK_UP')
  })
})

describe('gathering', () => {
  it('lets an agent gather berries without a tool and reduces node quantity', () => {
    const { agent } = emptyWorld()
    const node = berry()
    const result = applyGather(agent, node)
    expect(result.amount).toBe(1)
    expect(result.node.quantity).toBe(3)
    expect(result.agent.energy).toBeGreaterThan(agent.energy)
    expect(result.agent.hunger).toBeLessThan(agent.hunger)
    expect(result.durabilityDelta).toBe(0)
  })

  it('increases berry yield and hunger relief when a basket is used', () => {
    const { agent } = emptyWorld()
    const hungry = { ...agent, energy: 40, hunger: 70 }
    const withBasket = applyPickup(hungry, basket()).agent
    const plain = applyGather(hungry, berry())
    const boosted = applyGather(withBasket, berry())
    expect(boosted.amount).toBe(2)
    expect(boosted.amount).toBeGreaterThan(plain.amount)
    expect(boosted.agent.energy - withBasket.energy).toBeGreaterThan(plain.agent.energy - hungry.energy)
    expect(withBasket.hunger - boosted.agent.hunger).toBeGreaterThan(hungry.hunger - plain.agent.hunger)
    expect(boosted.durabilityDelta).toBe(-1)
  })

  it('requires a digging stick for roots and wears the stick', () => {
    const { world, agent } = emptyWorld()
    const node = root()
    expect(findGatherableNode(agent, { ...world, forageNodes: [node] })).toBeNull()
    expect(legalActionsFor(agent, { ...world, forageNodes: [node] })).not.toContain('GATHER')

    const withStick = applyPickup(agent, stick()).agent
    expect(findGatherableNode(withStick, { ...world, forageNodes: [node] })?.id).toBe(node.id)
    const gathered = applyGather(withStick, node)
    expect(gathered.amount).toBe(1)
    expect(gathered.node.quantity).toBe(2)
    expect(gathered.agent.equipment?.durability).toBe(TOOL_MAX_DURABILITY - 1)
    expect(gathered.agent.energy).toBeGreaterThan(withStick.energy)
  })

  it('breaks a tool at durability 0 and then blocks root gathering', () => {
    const { world, agent } = emptyWorld()
    const worn = applyPickup(agent, stick({ durability: 1 })).agent
    const gathered = applyGather(worn, root())
    expect(gathered.amount).toBe(1)
    expect(gathered.agent.equipment).toBeNull()
    expect(findGatherableNode(gathered.agent, { ...world, forageNodes: [root({ quantity: 2 })] })).toBeNull()
  })

  it('lets Tool Affinity change tool restore and durability cost', () => {
    const { agent } = emptyWorld()
    const hungry = { ...agent, energy: 40, hunger: 70 }
    const efficient = applyPickup(
      { ...hungry, genome: { ...hungry.genome, toolAffinity: 1.4 } },
      basket(),
    ).agent
    const wasteful = applyPickup(
      { ...hungry, id: 'wasteful', genome: { ...hungry.genome, toolAffinity: 0.6 } },
      basket({ id: 'basket-2' }),
    ).agent
    const high = applyGather(efficient, berry())
    const low = applyGather(wasteful, berry({ id: 'berry-2' }))
    expect(high.agent.energy - efficient.energy).toBeGreaterThan(low.agent.energy - wasteful.energy)
    expect(Math.abs(high.durabilityDelta)).toBeLessThan(Math.abs(low.durabilityDelta))
    expect(efficient.equipment?.durability).toBe(TOOL_MAX_DURABILITY)
    expect(high.agent.equipment?.durability).toBeGreaterThan(low.agent.equipment?.durability ?? 0)
  })

  it('does not gather a depleted node twice', () => {
    const { agent } = emptyWorld()
    const first = applyGather(agent, berry({ quantity: 1 }))
    expect(first.amount).toBe(1)
    const second = applyGather(first.agent, first.node)
    expect(second.amount).toBe(0)
    expect(second.node.quantity).toBe(0)
  })

  it('scales gather reward with the actual yield and does not use eatSuccess', () => {
    const unit = computeReward(
      {
        action: 'GATHER',
        ate: false,
        collided: false,
        died: false,
        energyBefore: 50,
        hungerBefore: 40,
        foodInEatRange: false,
        gatheredAmount: 1,
        pickedUp: false,
      },
      DEFAULT_REWARD_CONFIG,
    )
    const doubled = computeReward(
      {
        action: 'GATHER',
        ate: false,
        collided: false,
        died: false,
        energyBefore: 50,
        hungerBefore: 40,
        foodInEatRange: false,
        gatheredAmount: 2,
        pickedUp: false,
      },
      DEFAULT_REWARD_CONFIG,
    )
    expect(unit).toBe(DEFAULT_REWARD_CONFIG.gatherUnit)
    expect(doubled).toBe(DEFAULT_REWARD_CONFIG.gatherUnit * 2)
    expect(unit).toBeLessThan(DEFAULT_REWARD_CONFIG.eatSuccess)
  })
})

describe('engine integration', () => {
  it('records PICK_UP and GATHER through updateAgent', () => {
    const { world, agent } = emptyWorld()
    const nextWorld = {
      ...world,
      worldTools: [stick()],
      forageNodes: [root()],
    }
    const picked = updateAgent(
      { ...agent, lastAction: null },
      nextWorld,
      SIMULATION_STEP_DT,
      learningOff(() => 0.92),
    )
    expect(picked.agent.equipment?.toolType).toBe('digging_stick')
    expect(picked.pickedUpToolId).toBe('stick-1')

    const afterPickup = {
      ...nextWorld,
      agents: [picked.agent],
      worldTools: [],
    }
    const gathered = updateAgent(picked.agent, afterPickup, SIMULATION_STEP_DT, learningOff(() => 0.95))
    expect(gathered.gatheredAmount).toBe(1)
    expect(gathered.gatheredNode?.quantity).toBe(2)
    expect(gathered.agent.energy).toBeGreaterThan(picked.agent.energy)
  })
})
