import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_EVOLUTION_CONFIG } from '../evolution/constants'
import { legalActionsFor } from '../learning/actionMask'
import { DEFAULT_LEARNING_CONFIG, DEFAULT_REWARD_CONFIG } from '../learning/constants'
import { observeAgent } from '../learning/observation'
import { useSimulationStore } from '../store/useSimulationStore'
import { sanitizeWorld } from './sanitize'
import { DEFAULT_WORLD_CONFIG, SIMULATION_STEP_DT } from './constants'
import { stepSimulation } from './engine'
import {
  allowsDeath,
  applyModeToWorldConfig,
  effectiveGeneticsEnabled,
  enforceLabPopulation,
  isHumanBehaviorLab,
  keepLabAgentAlive,
  LAB_COMFORT_DECAY_PER_SEC,
  LAB_CURIOSITY_GAIN_PER_SEC,
  LAB_DRIVE_DEFAULTS,
  LAB_FATIGUE_GAIN_PER_SEC,
  LAB_HEALTH_FLOOR,
  tickLabDrives,
} from './labMode'
import { createInitialWorld } from './worldFactory'

describe('Human Behavior Lab mode', () => {
  it('forces agentCount to 1 for human_behavior_lab configs', () => {
    const config = applyModeToWorldConfig({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      agentCount: 20,
    })
    expect(config.agentCount).toBe(1)
    expect(isHumanBehaviorLab(config.mode)).toBe(true)
  })

  it('creates exactly one agent when the world starts in lab mode', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      agentCount: 12,
    })
    expect(world.config.mode).toBe('human_behavior_lab')
    expect(world.config.agentCount).toBe(1)
    expect(world.agents).toHaveLength(1)
  })

  it('trims extra agents when sanitizing a lab world', () => {
    const ecology = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      agentCount: 3,
    })
    const trimmed = enforceLabPopulation({
      ...ecology,
      config: { ...ecology.config, mode: 'human_behavior_lab', agentCount: 3 },
    })
    expect(trimmed.agents).toHaveLength(1)
    expect(trimmed.config.agentCount).toBe(1)

    const sanitized = sanitizeWorld({
      ...ecology,
      config: { ...ecology.config, mode: 'human_behavior_lab', agentCount: 3 },
    })
    expect(sanitized.agents).toHaveLength(1)
  })

  it('disables genetics effectively even if the stored toggle is on', () => {
    expect(effectiveGeneticsEnabled('human_behavior_lab', true)).toBe(false)
    expect(effectiveGeneticsEnabled('ecology', true)).toBe(true)
    expect(effectiveGeneticsEnabled('ecology', false)).toBe(false)
  })

  it('does not mate or grow the population in lab mode', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      agentCount: 1,
    })
    const result = stepSimulation(
      { tick: 0, world },
      SIMULATION_STEP_DT,
      {
        learningEnabled: false,
        learningConfig: DEFAULT_LEARNING_CONFIG,
        rewardConfig: DEFAULT_REWARD_CONFIG,
        evolutionConfig: { ...DEFAULT_EVOLUTION_CONFIG, geneticsEnabled: true },
      },
    )
    expect(result.world.agents).toHaveLength(1)
    expect(result.born).toHaveLength(0)
  })

  it('masks combat actions in lab mode', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      agentCount: 1,
    })
    const agent = world.agents[0]
    if (!agent) throw new Error('expected agent')
    const legal = legalActionsFor(agent, world)
    expect(legal).not.toContain('ATTACK')
    expect(legal).not.toContain('DEFEND')
    expect(legal).not.toContain('FLEE')
  })

  it('never allows death in lab and revives collapsed agents on sanitize', () => {
    expect(allowsDeath('human_behavior_lab')).toBe(false)
    expect(allowsDeath('ecology')).toBe(true)

    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      agentCount: 1,
    })
    const agent = world.agents[0]
    if (!agent) throw new Error('expected agent')
    const collapsed = {
      ...agent,
      energy: 0,
      hunger: 100,
      health: 0,
      alive: false,
      deathCause: 'health' as const,
    }
    const revived = keepLabAgentAlive(collapsed)
    expect(revived.alive).toBe(true)
    expect(revived.health).toBeGreaterThanOrEqual(LAB_HEALTH_FLOOR)
    expect(revived.deathCause).toBeNull()

    const sanitized = sanitizeWorld({
      ...world,
      agents: [collapsed],
    })
    expect(sanitized.agents).toHaveLength(1)
    expect(sanitized.agents[0]?.alive).toBe(true)
    expect(sanitized.agents[0]?.health).toBeGreaterThanOrEqual(LAB_HEALTH_FLOOR)
    expect(sanitized.agents[0]?.deathCause).toBeNull()

    let worldAfter = sanitized
    for (let i = 0; i < 240; i += 1) {
      worldAfter = stepSimulation(
        { tick: i, world: worldAfter },
        SIMULATION_STEP_DT,
        {
          learningEnabled: false,
          learningConfig: DEFAULT_LEARNING_CONFIG,
          rewardConfig: DEFAULT_REWARD_CONFIG,
          evolutionConfig: DEFAULT_EVOLUTION_CONFIG,
        },
      ).world
    }
    const after = worldAfter.agents[0]
    if (!after) throw new Error('expected agent')
    expect(after.alive).toBe(true)
    expect(after.health).toBeGreaterThanOrEqual(LAB_HEALTH_FLOOR)
    expect(after.deathCause).toBeNull()
  })

  it('leaves ecology multi-agent worlds unchanged', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      agentCount: 5,
    })
    expect(world.agents).toHaveLength(5)
    expect(world.config.mode).toBe('ecology')
  })

  it('ensures lab agents have fatigue/curiosity/comfort and ticks them', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'human_behavior_lab',
      agentCount: 1,
    })
    const sanitized = sanitizeWorld(world)
    const agent = sanitized.agents[0]
    if (!agent) throw new Error('expected agent')
    expect(agent.fatigue).toBe(LAB_DRIVE_DEFAULTS.fatigue)
    expect(agent.curiosity).toBe(LAB_DRIVE_DEFAULTS.curiosity)
    expect(agent.comfort).toBe(LAB_DRIVE_DEFAULTS.comfort)

    const dt = 1
    const ticked = tickLabDrives(agent, dt)
    expect(ticked.fatigue).toBeCloseTo(LAB_DRIVE_DEFAULTS.fatigue + LAB_FATIGUE_GAIN_PER_SEC * dt)
    expect(ticked.curiosity).toBeCloseTo(
      LAB_DRIVE_DEFAULTS.curiosity + LAB_CURIOSITY_GAIN_PER_SEC * dt,
    )
    expect(ticked.comfort).toBeCloseTo(LAB_DRIVE_DEFAULTS.comfort - LAB_COMFORT_DECAY_PER_SEC * dt)

    const stepped = stepSimulation(
      { tick: 0, world: sanitized },
      SIMULATION_STEP_DT,
      {
        learningEnabled: false,
        learningConfig: DEFAULT_LEARNING_CONFIG,
        rewardConfig: DEFAULT_REWARD_CONFIG,
        evolutionConfig: DEFAULT_EVOLUTION_CONFIG,
      },
    )
    const after = stepped.world.agents[0]
    if (!after) throw new Error('expected agent')
    expect(after.fatigue!).toBeGreaterThan(agent.fatigue!)
    expect(after.curiosity!).toBeGreaterThan(agent.curiosity!)
    expect(after.comfort!).toBeLessThan(agent.comfort!)
  })

  it('strips lab drives from ecology agents on sanitize', () => {
    const ecology = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      agentCount: 2,
    })
    const polluted = {
      ...ecology,
      agents: ecology.agents.map((agent) => ({
        ...agent,
        fatigue: 40,
        curiosity: 50,
        comfort: 60,
      })),
    }
    const sanitized = sanitizeWorld(polluted)
    for (const agent of sanitized.agents) {
      expect(agent.fatigue).toBeUndefined()
      expect(agent.curiosity).toBeUndefined()
      expect(agent.comfort).toBeUndefined()
    }
  })

  it('forces agent observation tokens to none/out in lab even with extra agents present', () => {
    const ecology = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      agentCount: 2,
      obstacleDensity: 0,
    })
    const [first, second] = ecology.agents
    if (!first || !second) throw new Error('expected agents')
    const self = { ...first, position: { x: 0, z: 0 }, rotation: 0 }
    const peer = { ...second, position: { x: 0, z: 1.2 }, alive: true, health: 90 }
    const withPeers = {
      ...ecology,
      config: { ...ecology.config, mode: 'human_behavior_lab' as const, agentCount: 1 },
      agents: [self, peer],
    }
    const observation = observeAgent(self, withPeers)
    expect(observation.agentDirection).toBe('none')
    expect(observation.agentDistance).toBe('out')
  })

  it('still senses nearby agents in ecology mode', () => {
    const world = createInitialWorld({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      agentCount: 2,
      obstacleDensity: 0,
    })
    const [first, second] = world.agents
    if (!first || !second) throw new Error('expected agents')
    const self = { ...first, position: { x: 0, z: 0 }, rotation: 0 }
    const peer = { ...second, position: { x: 0, z: 1.2 }, alive: true, health: 90 }
    const observation = observeAgent(self, { ...world, agents: [self, peer] })
    expect(observation.agentDirection).not.toBe('none')
    expect(observation.agentDistance).not.toBe('out')
  })
})

describe('Human Behavior Lab store mode round-trip', () => {
  beforeEach(() => {
    useSimulationStore.getState().reset()
    useSimulationStore.getState().setWorldConfig({
      ...DEFAULT_WORLD_CONFIG,
      mode: 'ecology',
      agentCount: 12,
    })
  })

  it('restores multi-agent ecology config after Lab round-trip', () => {
    const store = useSimulationStore.getState()
    expect(store.world.config.mode).toBe('ecology')
    expect(store.world.config.agentCount).toBe(12)
    expect(store.world.agents).toHaveLength(12)

    store.setWorldConfig({ mode: 'human_behavior_lab' })
    const inLab = useSimulationStore.getState()
    expect(inLab.world.config.mode).toBe('human_behavior_lab')
    expect(inLab.world.config.agentCount).toBe(1)
    expect(inLab.world.agents).toHaveLength(1)

    inLab.setWorldConfig({ mode: 'ecology' })
    const back = useSimulationStore.getState()
    expect(back.world.config.mode).toBe('ecology')
    expect(back.world.config.agentCount).toBe(12)
    expect(back.world.agents).toHaveLength(12)
  })
})
