import { GENERATION_DURATION_PRESETS } from '../../evolution/constants'
import {
  AGENT_COUNT_PRESETS,
  MAX_AGENT_COUNT,
  MIN_AGENT_COUNT,
  getTargetFoodCount,
} from '../../simulation/constants'
import { OBJECT_REGISTRY } from '../../simulation/objectRegistry'
import { useSimulationStore } from '../../store/useSimulationStore'
import type { WorldObjectType } from '../../types/world'
import { NumberStepper } from '../ui/NumberStepper'
import { Toggle } from '../ui/Toggle'

const PLACEABLE_TYPES: WorldObjectType[] = ['tree', 'rock', 'food']

export function SettingsPanel() {
  const worldSize = useSimulationStore((state) => state.world.config.size)
  const settings = useSimulationStore((state) => state.settings)
  const setSetting = useSimulationStore((state) => state.setSetting)
  const addObject = useSimulationStore((state) => state.addObject)
  const resetCamera = useSimulationStore((state) => state.resetCamera)
  const learningEnabled = useSimulationStore((state) => state.learningEnabled)
  const setLearningEnabled = useSimulationStore((state) => state.setLearningEnabled)
  const agentCount = useSimulationStore((state) => state.world.config.agentCount)
  const setAgentCount = useSimulationStore((state) => state.setAgentCount)
  const inheritQTable = useSimulationStore((state) => state.evolutionConfig.inheritQTable)
  const setInheritQTable = useSimulationStore((state) => state.setInheritQTable)
  const populationLimit = useSimulationStore((state) => state.evolutionConfig.populationLimit)
  const setPopulationLimit = useSimulationStore((state) => state.setPopulationLimit)
  const generationDuration = useSimulationStore((state) => state.evolutionConfig.generationDuration)
  const setGenerationDuration = useSimulationStore((state) => state.setGenerationDuration)
  const mutationRate = useSimulationStore((state) => state.evolutionConfig.mutationRate)

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-lab-border bg-lab-panel">
      <PanelTitle>설정</PanelTitle>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <section>
          <SectionLabel>학습</SectionLabel>
          <div className="mt-2 space-y-1">
            <Toggle
              label="학습 활성화"
              checked={learningEnabled}
              onChange={setLearningEnabled}
            />
            <p className="pt-1 text-[12px] leading-5 text-lab-muted">
              학습을 끄면 Q-Table과 epsilon이 고정된다. 개체는 현재 정책으로 계속 행동한다.
              현재 학습 파라미터와 차트는 Learning 탭에서 확인한다.
            </p>
          </div>
        </section>

        <section>
          <SectionLabel>개체군</SectionLabel>
          <div className="mt-2 space-y-1">
            <NumberStepper
              label="개체 수"
              value={agentCount}
              min={MIN_AGENT_COUNT}
              max={MAX_AGENT_COUNT}
              onChange={setAgentCount}
            />
            <Readout label="목표 먹이" value={`${getTargetFoodCount(agentCount)}`} />
            <div className="pt-1">
              <div className="grid grid-cols-4 gap-1">
                {AGENT_COUNT_PRESETS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setAgentCount(count)}
                    className={`border px-1.5 py-1 font-mono text-[11px] transition-colors ${
                      agentCount === count
                        ? 'border-lab-accent bg-lab-accent/15 text-lab-accent'
                        : 'border-lab-border bg-lab-elevated text-lab-muted hover:border-lab-accent/40'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] leading-5 text-lab-muted">
                시작 전 변경은 월드를 다시 배치한다. 실행 중에는 개체를 바로 더하거나 줄인다.
              </p>
            </div>
          </div>
        </section>

        <section>
          <SectionLabel>진화</SectionLabel>
          <div className="mt-2 space-y-1">
            <Toggle
              label="Q-Table 상속"
              checked={inheritQTable}
              onChange={setInheritQTable}
            />
            <NumberStepper
              label="Population Limit"
              value={populationLimit}
              min={MIN_AGENT_COUNT}
              max={MAX_AGENT_COUNT}
              onChange={setPopulationLimit}
            />
            <Readout label="돌연변이 확률" value={`${(mutationRate * 100).toFixed(0)}% / gene`} />
            <Readout label="세대 길이" value={`${generationDuration}s`} />
            <div className="pt-1">
              <div className="grid grid-cols-4 gap-1">
                {GENERATION_DURATION_PRESETS.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => setGenerationDuration(seconds)}
                    className={`border px-1.5 py-1 font-mono text-[11px] transition-colors ${
                      generationDuration === seconds
                        ? 'border-lab-accent bg-lab-accent/15 text-lab-accent'
                        : 'border-lab-border bg-lab-elevated text-lab-muted hover:border-lab-accent/40'
                    }`}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] leading-5 text-lab-muted">
                생존 개체만 부모 후보가 된다. 자식은 부모 유전자를 조합하고 유전자별 돌연변이를
                적용한다. Q-Table 상속은 기본 꺼짐이다.
              </p>
            </div>
          </div>
        </section>

        <section>
          <SectionLabel>월드</SectionLabel>
          <div className="mt-2 space-y-1">
            <Readout label="지형 크기" value={`${worldSize} × ${worldSize}`} />
            <Toggle
              label="격자 표시"
              checked={settings.showGrid}
              onChange={(checked) => setSetting('showGrid', checked)}
            />
          </div>
        </section>

        <section>
          <SectionLabel>오브젝트 레이어</SectionLabel>
          <div className="mt-2 space-y-1">
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
            <p className="pt-1 text-[12px] leading-5 text-lab-muted">
              경로와 시야는 선택한 개체에만 표시한다. 행동 표시는 생존 개체 모두에 글자와 색을 함께
              쓴다.
            </p>
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
          <p className="mt-2 text-[12px] leading-5 text-lab-muted">
            3/4 탑다운 시점을 유지한 채 회전과 확대만 허용한다.
          </p>
          <button
            type="button"
            onClick={resetCamera}
            className="mt-3 w-full border border-lab-border bg-lab-elevated px-3 py-2 text-[13px] text-lab-text transition-colors hover:border-lab-accent/50"
          >
            시점 초기화
          </button>
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

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="text-[11px] text-lab-muted">
      {children}
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
