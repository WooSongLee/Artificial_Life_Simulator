import { describe, expect, it } from 'vitest'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import { decodeObservation, encodeObservation, observeAgent } from '../learning/observation'
import { resetBrains } from '../learning/brain'
import { STATE_SPACE_SIZE } from '../learning/constants'
import { DEFAULT_WORLD_CONFIG, SIMULATION_STEP_DT } from './constants'
import { updateAgent } from './agentSystem'
import {
  cellIndex,
  createEmptyTerrain,
  generateTerrainGrid,
  getTerrainTypeAt,
  terrainMatchesGeneration,
  terrainsEqual,
  worldToCell,
} from './terrain'
import { createInitialWorld } from './worldFactory'
import type { TerrainType } from '../types/terrain'
import type { WorldState } from '../types/world'

function uniformWorld(type: TerrainType, seed = 11): WorldState {
  const world = createInitialWorld({
    ...DEFAULT_WORLD_CONFIG,
    agentCount: 1,
    obstacleDensity: 0,
    initialFoodCount: 4,
    initialBerryCount: 0,
    initialRootCount: 0,
    initialBasketCount: 0,
    initialStickCount: 0,
    initialSpearCount: 0,
    initialShieldCount: 0,
    seed,
  })
  return {
    ...world,
    terrain: {
      ...world.terrain,
      cells: world.terrain.cells.map(() => type),
    },
  }
}

function learningOff(rng = () => 0) {
  return {
    learningEnabled: false,
    learningConfig: DEFAULT_LEARNING_CONFIG,
    rewardConfig: DEFAULT_REWARD_CONFIG,
    rng,
  }
}

describe('terrain generation', () => {
  it('recreates the same clustered layout for the same seed and preset', () => {
    const config = { ...DEFAULT_WORLD_CONFIG, seed: 42, terrainPreset: 'lakes' as const }
    const first = generateTerrainGrid(config)
    const second = generateTerrainGrid(config)
    expect(terrainsEqual(first, second)).toBe(true)
    expect(terrainMatchesGeneration(first, config)).toBe(true)
    expect(first.cells.some((cell) => cell === 'water')).toBe(true)
    expect(first.cells.some((cell) => cell === 'grassland')).toBe(true)
  })

  it('changes layout when the seed changes', () => {
    const left = generateTerrainGrid({ ...DEFAULT_WORLD_CONFIG, seed: 10 })
    const right = generateTerrainGrid({ ...DEFAULT_WORLD_CONFIG, seed: 11 })
    expect(terrainsEqual(left, right)).toBe(false)
  })
})

describe('terrain effects', () => {
  it('moves farther on grassland than on forest', () => {
    const grass = uniformWorld('grassland')
    const forest = uniformWorld('forest')
    const grassAgent = { ...grass.agents[0]!, position: { x: 0, z: 0 }, rotation: 0, speed: 2 }
    const forestAgent = { ...forest.agents[0]!, position: { x: 0, z: 0 }, rotation: 0, speed: 2 }
    resetBrains([grassAgent, forestAgent], DEFAULT_LEARNING_CONFIG)

    const movedGrass = updateAgent(grassAgent, { ...grass, agents: [grassAgent] }, SIMULATION_STEP_DT, learningOff())
    const movedForest = updateAgent(forestAgent, { ...forest, agents: [forestAgent] }, SIMULATION_STEP_DT, learningOff())

    expect(movedGrass.agent.lastAction).toBe('MOVE_FORWARD')
    expect(movedForest.agent.lastAction).toBe('MOVE_FORWARD')
    expect(movedGrass.agent.position.z - grassAgent.position.z).toBeGreaterThan(
      movedForest.agent.position.z - forestAgent.position.z,
    )
  })

  it('drains more energy on wetland than on grassland while resting', () => {
    const grass = uniformWorld('grassland')
    const wetland = uniformWorld('wetland')
    const grassAgent = {
      ...grass.agents[0]!,
      energy: 80,
      hunger: 10,
      position: { x: 0, z: 0 },
      genome: { ...grass.agents[0]!.genome, explorationRate: 1 },
    }
    const wetlandAgent = {
      ...wetland.agents[0]!,
      energy: 80,
      hunger: 10,
      position: { x: 0, z: 0 },
      genome: { ...wetland.agents[0]!.genome, explorationRate: 1 },
    }
    resetBrains([grassAgent, wetlandAgent], DEFAULT_LEARNING_CONFIG)

    const restedGrass = updateAgent(grassAgent, { ...grass, agents: [grassAgent] }, SIMULATION_STEP_DT, learningOff(() => 0.95))
    const restedWetland = updateAgent(
      wetlandAgent,
      { ...wetland, agents: [wetlandAgent] },
      SIMULATION_STEP_DT,
      learningOff(() => 0.95),
    )

    expect(restedGrass.agent.lastAction).toBe('REST')
    expect(restedWetland.agent.lastAction).toBe('REST')
    expect(restedWetland.agent.energy).toBeLessThan(restedGrass.agent.energy)
  })

  it('blocks movement into water and treats it as a collision', () => {
    const world = uniformWorld('grassland')
    const destination = { x: 0, z: 2.02 }
    const cell = worldToCell(destination.x, destination.z, world.config.size, world.terrain)
    world.terrain.cells[cellIndex(cell.col, cell.row, world.terrain.size)] = 'water'

    const agent = {
      ...world.agents[0]!,
      position: { x: 0, z: 1.92 },
      rotation: 0,
      speed: 2,
    }
    resetBrains([agent], DEFAULT_LEARNING_CONFIG)
    const result = updateAgent(agent, { ...world, agents: [agent] }, SIMULATION_STEP_DT, learningOff())

    expect(result.agent.lastAction).toBe('MOVE_FORWARD')
    expect(result.agent.position).toEqual(agent.position)
    expect(getTerrainTypeAt(world.terrain, agent.position.x, agent.position.z, world.config.size)).not.toBe('water')
  })
})

describe('terrain observation', () => {
  it('encodes current and ahead terrain without preallocating the Q-table', () => {
    const grass = uniformWorld('grassland')
    const forest = {
      ...grass,
      terrain: { ...grass.terrain, cells: grass.terrain.cells.map(() => 'forest' as const) },
    }
    const agent = { ...grass.agents[0]!, position: { x: 0, z: 0 }, rotation: 0 }
    const grassKey = encodeObservation(observeAgent(agent, { ...grass, agents: [agent] }))
    const forestKey = encodeObservation(observeAgent(agent, { ...forest, agents: [agent] }))

    expect(grassKey).not.toBe(forestKey)
    expect(grassKey.split('|')[5]).toBe('grassland')
    expect(grassKey.split('|')[6]).toBe('grassland')
    expect(forestKey.split('|')[5]).toBe('forest')
    expect(forestKey.split('|')[6]).toBe('forest')
    expect(decodeObservation(grassKey)?.terrain).toBe('grassland')
    expect(STATE_SPACE_SIZE).toBe(170_100_000)
  })

  it('hides food that is beyond forest-reduced vision', () => {
    const world = uniformWorld('forest')
    const agent = { ...world.agents[0]!, position: { x: 0, z: 0 }, vision: 8 }
    const food = {
      id: 'food-far',
      type: 'food' as const,
      position: { x: 0, y: 0, z: 7.4 },
      scale: 1,
      rotation: 0,
    }
    const observed = observeAgent(agent, {
      ...world,
      objects: [food],
      agents: [agent],
    })
    expect(observed.foodDirection).toBe('none')
    expect(observed.foodDistance).toBe('out')
    expect(observed.terrain).toBe('forest')
  })
})

describe('empty terrain helper', () => {
  it('builds a walkable grassland grid for the world size', () => {
    const terrain = createEmptyTerrain(48)
    expect(terrain.size).toBe(24)
    expect(terrain.cells).toHaveLength(576)
    expect(terrain.cells.every((cell) => cell === 'grassland')).toBe(true)
  })
})
