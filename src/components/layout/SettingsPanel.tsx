import { RESOURCE_DISTRIBUTION_LABELS } from '../../experiments/constants'
import { formatSpeed } from '../../utils/format'
import {
  EPSILON_DECAY_OPTIONS,
  LEARNING_CONFIG_RANGES,
  REWARD_CONFIG_RANGES,
} from '../../learning/constants'
import {
  AGENT_COUNT_PRESETS,
  FOOD_REGEN_RATE_PRESETS,
  FORAGE_REGEN_RATE_PRESETS,
  MAX_AGENT_COUNT,
  MAX_BERRY_COUNT,
  MAX_FOOD_COUNT,
  MAX_ROOT_COUNT,
  MAX_TOOL_COUNT,
  MIN_AGENT_COUNT,
  MIN_BERRY_COUNT,
  MAX_WORLD_SEED,
  MIN_FOOD_COUNT,
  MIN_ROOT_COUNT,
  MIN_TOOL_COUNT,
  MIN_WORLD_SEED,
  OBSTACLE_DENSITY_PRESETS,
  TERRAIN_PRESET_LABELS,
  WORLD_SIZE_PRESETS,
} from '../../simulation/constants'
import {
  LAB_CONDITION_LABELS,
  LAB_CONDITIONS,
} from '../../simulation/labConditions'
import { SIMULATION_MODE_LABELS } from '../../simulation/labMode'
import { OBJECT_REGISTRY } from '../../simulation/objectRegistry'
import { useSimulationStore } from '../../store/useSimulationStore'
import { TERRAIN_PRESETS } from '../../types/terrain'
import {
  RESOURCE_DISTRIBUTIONS,
  SIMULATION_MODES,
  type LabCondition,
  type SimulationMode,
  type WorldObjectType,
} from '../../types/world'
import { Hint } from '../ui/Hint'
import { NumberField } from '../ui/NumberField'
import { NumberStepper } from '../ui/NumberStepper'
import { Toggle } from '../ui/Toggle'

const PLACEABLE_TYPES: WorldObjectType[] = ['tree', 'rock', 'food']

export function SettingsPanel() {
  const worldConfig = useSimulationStore((state) => state.pendingWorldConfig ?? state.world.config)
  const pendingWorldConfig = useSimulationStore((state) => state.pendingWorldConfig)
  const settings = useSimulationStore((state) => state.settings)
  const setSetting = useSimulationStore((state) => state.setSetting)
  const addObject = useSimulationStore((state) => state.addObject)
  const resetCamera = useSimulationStore((state) => state.resetCamera)
  const learningEnabled = useSimulationStore((state) => state.learningEnabled)
  const setLearningEnabled = useSimulationStore((state) => state.setLearningEnabled)
  const setAgentCount = useSimulationStore((state) => state.setAgentCount)
  const setWorldConfig = useSimulationStore((state) => state.setWorldConfig)
  const learningConfig = useSimulationStore((state) => state.learningConfig)
  const setLearningConfig = useSimulationStore((state) => state.setLearningConfig)
  const rewardConfig = useSimulationStore((state) => state.rewardConfig)
  const setRewardConfig = useSimulationStore((state) => state.setRewardConfig)
  const geneticsEnabled = useSimulationStore((state) => state.evolutionConfig.geneticsEnabled)
  const setGeneticsEnabled = useSimulationStore((state) => state.setGeneticsEnabled)
  const inheritQTable = useSimulationStore((state) => state.evolutionConfig.inheritQTable)
  const setInheritQTable = useSimulationStore((state) => state.setInheritQTable)
  const populationLimit = useSimulationStore((state) => state.evolutionConfig.populationLimit)
  const setPopulationLimit = useSimulationStore((state) => state.setPopulationLimit)
  const mutationRate = useSimulationStore((state) => state.evolutionConfig.mutationRate)
  const speed = useSimulationStore((state) => state.speed)
  const isLab = worldConfig.mode === 'human_behavior_lab'

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-lab-border bg-lab-panel xl:w-72">
      <PanelTitle>설정</PanelTitle>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <section>
          <SectionLabel hint="시작 전 변경은 월드를 다시 만든다. 실행 중 구조 변경은 Reset 때 적용된다.">
            월드
          </SectionLabel>
          <div className="mt-2 space-y-1">
            <Readout label="Mode" value={SIMULATION_MODE_LABELS[worldConfig.mode]} />
            <div className="grid grid-cols-1 gap-1">
              {SIMULATION_MODES.map((mode) => (
                <PresetButton
                  key={mode}
                  active={worldConfig.mode === mode}
                  onClick={() => setWorldConfig({ mode: mode as SimulationMode })}
                >
                  {SIMULATION_MODE_LABELS[mode]}
                </PresetButton>
              ))}
            </div>
            {isLab ? (
              <>
                <p className="pt-1 text-[12px] leading-5 text-lab-muted">
                  Conditioned Behavior Lab: one agent, three chambers (survival / rest / lookout).
                  Population, genetics, mating, lifespan death, and combat are disabled.
                </p>
                <Readout
                  label="Lab Condition"
                  value={LAB_CONDITION_LABELS[worldConfig.labCondition ?? 'baseline']}
                />
                <div className="grid grid-cols-1 gap-1">
                  {LAB_CONDITIONS.map((condition) => (
                    <PresetButton
                      key={condition}
                      active={(worldConfig.labCondition ?? 'baseline') === condition}
                      onClick={() =>
                        setWorldConfig({ labCondition: condition as LabCondition })
                      }
                    >
                      {LAB_CONDITION_LABELS[condition]}
                    </PresetButton>
                  ))}
                </div>
                <p className="pt-1 text-[12px] leading-5 text-lab-muted">
                  Conditions change chamber gates, food scarcity, and drive pressure. Apply / Reset
                  to rebuild the lab.
                </p>
              </>
            ) : null}
            <Readout label="World Size" value={`${worldConfig.size} × ${worldConfig.size}`} />
            <PresetRow
              values={WORLD_SIZE_PRESETS}
              selected={worldConfig.size}
              format={(value) => `${value}`}
              onSelect={(size) => setWorldConfig({ size })}
            />
            {!isLab ? (
              <>
                <NumberStepper
                  label="Initial Population"
                  value={worldConfig.agentCount}
                  min={MIN_AGENT_COUNT}
                  max={MAX_AGENT_COUNT}
                  onChange={setAgentCount}
                  title="시작 개체 수. 실행 중 줄이면 살아있는 개체부터 제거한다."
                />
                <div className="grid grid-cols-4 gap-1">
                  {AGENT_COUNT_PRESETS.map((count) => (
                    <PresetButton
                      key={count}
                      active={worldConfig.agentCount === count}
                      onClick={() => setAgentCount(count)}
                    >
                      {count}
                    </PresetButton>
                  ))}
                </div>
              </>
            ) : (
              <Readout label="Active Agents" value="1 (fixed)" />
            )}
            <NumberStepper
              label="Initial Food"
              value={worldConfig.initialFoodCount}
              min={MIN_FOOD_COUNT}
              max={MAX_FOOD_COUNT}
              onChange={(initialFoodCount) => setWorldConfig({ initialFoodCount })}
            />
            <Readout label="Food Regen Rate" value={`${worldConfig.foodRegenRate.toFixed(1)} /s`} />
            <PresetRow
              values={FOOD_REGEN_RATE_PRESETS}
              selected={worldConfig.foodRegenRate}
              format={(value) => `${value}`}
              onSelect={(foodRegenRate) => setWorldConfig({ foodRegenRate })}
              isSelected={(value, selected) => Math.abs(value - selected) < 0.05}
            />
            <NumberStepper
              label="Berry Bushes"
              value={worldConfig.initialBerryCount}
              min={MIN_BERRY_COUNT}
              max={MAX_BERRY_COUNT}
              onChange={(initialBerryCount) => setWorldConfig({ initialBerryCount })}
            />
            <NumberStepper
              label="Root Patches"
              value={worldConfig.initialRootCount}
              min={MIN_ROOT_COUNT}
              max={MAX_ROOT_COUNT}
              onChange={(initialRootCount) => setWorldConfig({ initialRootCount })}
            />
            <Readout label="Forage Regen Rate" value={`${worldConfig.forageRegenRate.toFixed(1)} /s`} />
            <PresetRow
              values={FORAGE_REGEN_RATE_PRESETS}
              selected={worldConfig.forageRegenRate}
              format={(value) => `${value}`}
              onSelect={(forageRegenRate) => setWorldConfig({ forageRegenRate })}
              isSelected={(value, selected) => Math.abs(value - selected) < 0.05}
            />
            <NumberStepper
              label="Baskets"
              value={worldConfig.initialBasketCount}
              min={MIN_TOOL_COUNT}
              max={MAX_TOOL_COUNT}
              onChange={(initialBasketCount) => setWorldConfig({ initialBasketCount })}
            />
            <NumberStepper
              label="Digging Sticks"
              value={worldConfig.initialStickCount}
              min={MIN_TOOL_COUNT}
              max={MAX_TOOL_COUNT}
              onChange={(initialStickCount) => setWorldConfig({ initialStickCount })}
            />
            {!isLab ? (
              <>
                <NumberStepper
                  label="Spears"
                  value={worldConfig.initialSpearCount}
                  min={MIN_TOOL_COUNT}
                  max={MAX_TOOL_COUNT}
                  onChange={(initialSpearCount) => setWorldConfig({ initialSpearCount })}
                />
                <NumberStepper
                  label="Shields"
                  value={worldConfig.initialShieldCount}
                  min={MIN_TOOL_COUNT}
                  max={MAX_TOOL_COUNT}
                  onChange={(initialShieldCount) => setWorldConfig({ initialShieldCount })}
                />
              </>
            ) : null}
            <Readout
              label="Obstacle Density"
              value={`${Math.round(worldConfig.obstacleDensity * 100)}%`}
            />
            <PresetRow
              values={OBSTACLE_DENSITY_PRESETS}
              selected={worldConfig.obstacleDensity}
              format={(value) => `${Math.round(value * 100)}`}
              onSelect={(obstacleDensity) => setWorldConfig({ obstacleDensity })}
              isSelected={(value, selected) => Math.abs(value - selected) < 0.01}
            />
            <Readout
              label="Resource Distribution"
              value={RESOURCE_DISTRIBUTION_LABELS[worldConfig.resourceDistribution]}
            />
            <div className="grid grid-cols-3 gap-1">
              {RESOURCE_DISTRIBUTIONS.map((distribution) => (
                <PresetButton
                  key={distribution}
                  active={worldConfig.resourceDistribution === distribution}
                  onClick={() => setWorldConfig({ resourceDistribution: distribution })}
                >
                  {RESOURCE_DISTRIBUTION_LABELS[distribution]}
                </PresetButton>
              ))}
            </div>
            <Readout
              label="Terrain Mix"
              value={TERRAIN_PRESET_LABELS[worldConfig.terrainPreset]}
            />
            <div className="grid grid-cols-3 gap-1">
              {TERRAIN_PRESETS.map((preset) => (
                <PresetButton
                  key={preset}
                  active={worldConfig.terrainPreset === preset}
                  onClick={() => setWorldConfig({ terrainPreset: preset })}
                >
                  {TERRAIN_PRESET_LABELS[preset]}
                </PresetButton>
              ))}
            </div>
            <NumberField
              label="World Seed"
              value={worldConfig.seed}
              min={MIN_WORLD_SEED}
              max={MAX_WORLD_SEED}
              step={1}
              digits={0}
              onChange={(seed) => setWorldConfig({ seed })}
            />
            <button
              type="button"
              onClick={() =>
                setWorldConfig({
                  seed: MIN_WORLD_SEED + Math.floor(Math.random() * (MAX_WORLD_SEED - MIN_WORLD_SEED)),
                })
              }
              className="w-full border border-lab-border bg-lab-elevated px-2 py-1 text-[12px] text-lab-text hover:border-lab-accent/40"
            >
              New Seed
            </button>
            <Readout label="Simulation Speed" value={formatSpeed(speed)} />
            {pendingWorldConfig ? (
              <p className="pt-1 text-[12px] leading-5 text-lab-warn">
                Size, food, forage, tools, obstacles, distribution, terrain, and seed apply on Reset.
              </p>
            ) : (
              <p className="pt-1 text-[12px] leading-5 text-lab-muted">
                Idle changes rebuild the world. Food and forage regen rates apply immediately.
              </p>
            )}
          </div>
        </section>

        <section>
          <SectionLabel hint="Q-update의 α와 초기 epsilon은 각 개체 Genome 값이다. 여기 값은 새 개체 기본값과 할인/감쇠다.">
            학습
          </SectionLabel>
          <div className="mt-2 space-y-1">
            <Toggle
              label="학습 활성화"
              checked={learningEnabled}
              onChange={setLearningEnabled}
              title="끄면 Q-Table과 epsilon이 고정되고 현재 정책만 평가한다."
            />
            <NumberField
              label="Learning Rate"
              value={learningConfig.learningRate}
              min={LEARNING_CONFIG_RANGES.learningRate.min}
              max={LEARNING_CONFIG_RANGES.learningRate.max}
              step={0.01}
              digits={2}
              onChange={(learningRate) => setLearningConfig({ learningRate })}
            />
            <NumberField
              label="Discount Factor"
              value={learningConfig.discountFactor}
              min={LEARNING_CONFIG_RANGES.discountFactor.min}
              max={LEARNING_CONFIG_RANGES.discountFactor.max}
              step={0.01}
              digits={2}
              onChange={(discountFactor) => setLearningConfig({ discountFactor })}
            />
            <NumberField
              label="Initial Epsilon"
              value={learningConfig.initialEpsilon}
              min={LEARNING_CONFIG_RANGES.initialEpsilon.min}
              max={LEARNING_CONFIG_RANGES.initialEpsilon.max}
              step={0.05}
              digits={2}
              onChange={(initialEpsilon) => setLearningConfig({ initialEpsilon })}
            />
            <NumberField
              label="Minimum Epsilon"
              value={learningConfig.minEpsilon}
              min={LEARNING_CONFIG_RANGES.minEpsilon.min}
              max={LEARNING_CONFIG_RANGES.minEpsilon.max}
              step={0.01}
              digits={2}
              onChange={(minEpsilon) => setLearningConfig({ minEpsilon })}
            />
            <Readout label="Epsilon Decay" value={learningConfig.epsilonDecay.toFixed(4)} />
            <div className="grid grid-cols-3 gap-1">
              {EPSILON_DECAY_OPTIONS.map((epsilonDecay) => (
                <PresetButton
                  key={epsilonDecay}
                  active={learningConfig.epsilonDecay === epsilonDecay}
                  onClick={() => setLearningConfig({ epsilonDecay })}
                >
                  {epsilonDecay}
                </PresetButton>
              ))}
            </div>
            <p className="pt-1 text-[12px] leading-5 text-lab-muted">
              Discount, min epsilon, decay, and rewards apply on the next learning step. Learning
              Rate와 Initial Epsilon은 새 개체의 Genome 기본값이다.
            </p>
          </div>
        </section>

        <section>
          <SectionLabel>보상</SectionLabel>
          <div className="mt-2 space-y-1">
            <NumberField
              label="Eat Success"
              value={rewardConfig.eatSuccess}
              min={REWARD_CONFIG_RANGES.eatSuccess.min}
              max={REWARD_CONFIG_RANGES.eatSuccess.max}
              step={1}
              digits={1}
              onChange={(eatSuccess) => setRewardConfig({ eatSuccess })}
            />
            <NumberField
              label="Gather / unit"
              value={rewardConfig.gatherUnit}
              min={REWARD_CONFIG_RANGES.gatherUnit.min}
              max={REWARD_CONFIG_RANGES.gatherUnit.max}
              step={0.5}
              digits={1}
              onChange={(gatherUnit) => setRewardConfig({ gatherUnit })}
            />
            <NumberField
              label="Pick Up"
              value={rewardConfig.pickupSuccess}
              min={REWARD_CONFIG_RANGES.pickupSuccess.min}
              max={REWARD_CONFIG_RANGES.pickupSuccess.max}
              step={0.5}
              digits={1}
              onChange={(pickupSuccess) => setRewardConfig({ pickupSuccess })}
            />
            <NumberField
              label="Interact Success"
              value={rewardConfig.interactSuccess}
              min={REWARD_CONFIG_RANGES.interactSuccess.min}
              max={REWARD_CONFIG_RANGES.interactSuccess.max}
              step={0.5}
              digits={1}
              onChange={(interactSuccess) => setRewardConfig({ interactSuccess })}
              hint="Lab switch toggle / box push reward."
            />
            <NumberField
              label="Wasted Energy"
              value={rewardConfig.wastedEnergy}
              min={REWARD_CONFIG_RANGES.wastedEnergy.min}
              max={REWARD_CONFIG_RANGES.wastedEnergy.max}
              step={0.5}
              digits={1}
              onChange={(wastedEnergy) => setRewardConfig({ wastedEnergy })}
            />
            <NumberField
              label="Collision"
              value={rewardConfig.collision}
              min={REWARD_CONFIG_RANGES.collision.min}
              max={REWARD_CONFIG_RANGES.collision.max}
              step={1}
              digits={1}
              onChange={(collision) => setRewardConfig({ collision })}
            />
            <NumberField
              label="Death"
              value={rewardConfig.death}
              min={REWARD_CONFIG_RANGES.death.min}
              max={REWARD_CONFIG_RANGES.death.max}
              step={1}
              digits={1}
              onChange={(death) => setRewardConfig({ death })}
            />
            <NumberField
              label="Efficient Rest"
              value={rewardConfig.efficientRest}
              min={REWARD_CONFIG_RANGES.efficientRest.min}
              max={REWARD_CONFIG_RANGES.efficientRest.max}
              step={0.1}
              digits={1}
              onChange={(efficientRest) => setRewardConfig({ efficientRest })}
            />
            {!isLab ? (
              <>
                <NumberField
                  label="Attack Hit / dmg"
                  value={rewardConfig.attackHitUnit}
                  min={REWARD_CONFIG_RANGES.attackHitUnit.min}
                  max={REWARD_CONFIG_RANGES.attackHitUnit.max}
                  step={0.1}
                  digits={2}
                  onChange={(attackHitUnit) => setRewardConfig({ attackHitUnit })}
                />
                <NumberField
                  label="Attack Miss"
                  value={rewardConfig.attackMiss}
                  min={REWARD_CONFIG_RANGES.attackMiss.min}
                  max={REWARD_CONFIG_RANGES.attackMiss.max}
                  step={0.1}
                  digits={1}
                  onChange={(attackMiss) => setRewardConfig({ attackMiss })}
                />
                <NumberField
                  label="Damage Taken / dmg"
                  value={rewardConfig.damageTakenUnit}
                  min={REWARD_CONFIG_RANGES.damageTakenUnit.min}
                  max={REWARD_CONFIG_RANGES.damageTakenUnit.max}
                  step={0.1}
                  digits={2}
                  onChange={(damageTakenUnit) => setRewardConfig({ damageTakenUnit })}
                />
                <NumberField
                  label="Defend Reduce / dmg"
                  value={rewardConfig.defendReduceUnit}
                  min={REWARD_CONFIG_RANGES.defendReduceUnit.min}
                  max={REWARD_CONFIG_RANGES.defendReduceUnit.max}
                  step={0.1}
                  digits={2}
                  onChange={(defendReduceUnit) => setRewardConfig({ defendReduceUnit })}
                />
                <NumberField
                  label="Flee Success"
                  value={rewardConfig.fleeSuccess}
                  min={REWARD_CONFIG_RANGES.fleeSuccess.min}
                  max={REWARD_CONFIG_RANGES.fleeSuccess.max}
                  step={0.1}
                  digits={1}
                  onChange={(fleeSuccess) => setRewardConfig({ fleeSuccess })}
                />
              </>
            ) : (
              <p className="pt-1 text-[12px] leading-5 text-lab-muted">
                Combat reward weights are hidden in Human Behavior Lab. Attack, defend, and flee
                stay masked and do not run.
              </p>
            )}
          </div>
        </section>

        <section>
          <SectionLabel hint="성욕이 찬 성숙 개체가 가까이 오면 교배한다. 인구가 Population Limit이면 자식은 태어나지 않는다.">
            진화
          </SectionLabel>
          {isLab ? (
            <p className="mt-2 text-[12px] leading-5 text-lab-muted">
              Unavailable in Human Behavior Lab. Genetics, mating, reproduction, lifespan death, and
              genetic action bias stay off so a single agent can be observed without population
              dynamics.
            </p>
          ) : (
            <div className="mt-2 space-y-1">
              <Toggle
                label="유전 활성화"
                checked={geneticsEnabled}
                onChange={setGeneticsEnabled}
                title="끄면 교배·돌연변이·유전 bias·노화 사망을 멈춘다. 학습만 관찰할 때 쓴다. 시작 전이면 모든 개체가 같은 기본 Genome으로 다시 만들어진다."
              />
              <Toggle
                label="Q-Table 상속"
                checked={inheritQTable}
                onChange={setInheritQTable}
                title="켜면 자식이 더 적합한 부모의 Q-Table 복사본으로 시작한다. 기본은 빈 표다."
              />
              <NumberStepper
                label="Population Limit"
                value={populationLimit}
                min={MIN_AGENT_COUNT}
                max={MAX_AGENT_COUNT}
                onChange={setPopulationLimit}
                title="살아있는 개체 수가 이 값 이상이면 교배 후에도 자식이 태어나지 않는다."
              />
              <Readout label="돌연변이 확률" value={`${(mutationRate * 100).toFixed(0)}% / gene`} />
              <p className="pt-1 text-[12px] leading-5 text-lab-muted">
                유전이 꺼져 있으면 교배와 노화 사망이 없고, 모든 새 개체는 같은 기본 Genome을 쓴다.
                켜면 성욕이 찬 성숙 개체가 가까이 올 때 교배한다. Q-Table 상속은 기본 꺼짐이다.
              </p>
            </div>
          )}
        </section>

        <section>
          <SectionLabel>오브젝트 레이어</SectionLabel>
          <div className="mt-2 space-y-1">
            <Toggle
              label="격자 표시"
              checked={settings.showGrid}
              onChange={(checked) => setSetting('showGrid', checked)}
            />
            <Toggle
              label="나무"
              checked={settings.showTrees}
              onChange={(checked) => setSetting('showTrees', checked)}
            />
            <Toggle
              label="바위"
              checked={settings.showRocks}
              onChange={(checked) => setSetting('showRocks', checked)}
            />
            <Toggle
              label="먹이"
              checked={settings.showFood}
              onChange={(checked) => setSetting('showFood', checked)}
            />
            <Toggle
              label="채집 자원"
              checked={settings.showForage}
              onChange={(checked) => setSetting('showForage', checked)}
            />
            <Toggle
              label="도구"
              checked={settings.showTools}
              onChange={(checked) => setSetting('showTools', checked)}
            />
            <Toggle
              label="에이전트"
              checked={settings.showAgents}
              onChange={(checked) => setSetting('showAgents', checked)}
            />
          </div>
        </section>

        <section>
          <SectionLabel>행동 시각화</SectionLabel>
          <div className="mt-2 space-y-1">
            <Toggle
              label="이동 경로"
              checked={settings.showAgentTrails}
              onChange={(checked) => setSetting('showAgentTrails', checked)}
            />
            <Toggle
              label="시야 범위"
              checked={settings.showVisionRange}
              onChange={(checked) => setSetting('showVisionRange', checked)}
            />
            <Toggle
              label="먹이 탐색 경로"
              checked={settings.showFoodSeek}
              onChange={(checked) => setSetting('showFoodSeek', checked)}
            />
            <Toggle
              label="행동 표시"
              checked={settings.showActionMarkers}
              onChange={(checked) => setSetting('showActionMarkers', checked)}
            />
            <Toggle
              label="행동 대상 표시"
              checked={settings.showActionCues}
              onChange={(checked) => setSetting('showActionCues', checked)}
            />
          </div>
        </section>

        <section>
          <SectionLabel>배치</SectionLabel>
          <p className="mt-2 text-[12px] leading-5 text-lab-muted">
            지형 위 빈 공간에 기본 오브젝트를 추가한다.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {PLACEABLE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addObject(type)}
                className="border border-lab-border bg-lab-elevated px-3 py-2 text-left text-[13px] text-lab-text transition-colors hover:border-lab-accent/50 hover:bg-lab-bg"
              >
                {OBJECT_REGISTRY[type].label} 추가
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>카메라</SectionLabel>
          <div className="mt-2 space-y-1">
            <Toggle
              label="선택 개체 추적"
              checked={settings.followSelectedAgent}
              onChange={(checked) => setSetting('followSelectedAgent', checked)}
              title="개체를 선택하면 카메라가 그 개체를 따라간다. 회전·확대는 그대로 된다."
            />
            <button
              type="button"
              onClick={resetCamera}
              className="w-full border border-lab-border bg-lab-elevated px-3 py-2 text-[13px] text-lab-text transition-colors hover:border-lab-accent/50"
            >
              시점 초기화
            </button>
          </div>
        </section>
      </div>
    </aside>
  )
}

function PanelTitle({ children }: { children: string }) {
  return (
    <div className="border-b border-lab-border px-4 py-3 text-[11px] text-lab-muted">
      {children}
    </div>
  )
}

function SectionLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <h2 className="text-[11px] text-lab-muted">
      {children}
      {hint ? <Hint>{hint}</Hint> : null}
    </h2>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]">
      <span className="text-lab-text">{label}</span>
      <span className="font-mono text-lab-muted">{value}</span>
    </div>
  )
}

function PresetRow<T extends number>({
  values,
  selected,
  format,
  onSelect,
  isSelected,
}: {
  values: readonly T[]
  selected: number
  format: (value: T) => string
  onSelect: (value: T) => void
  isSelected?: (value: T, selected: number) => boolean
}) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {values.map((value) => (
        <PresetButton
          key={String(value)}
          active={isSelected ? isSelected(value, selected) : value === selected}
          onClick={() => onSelect(value)}
        >
          {format(value)}
        </PresetButton>
      ))}
    </div>
  )
}

function PresetButton({
  children,
  active,
  onClick,
}: {
  children: string | number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-1.5 py-1 font-mono text-[11px] transition-colors ${
        active
          ? 'border-lab-accent bg-lab-accent/15 text-lab-accent'
          : 'border-lab-border bg-lab-elevated text-lab-muted hover:border-lab-accent/40'
      }`}
    >
      {children}
    </button>
  )
}
