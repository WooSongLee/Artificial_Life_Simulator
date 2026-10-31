import { EPSILON_DECAY_OPTIONS } from '../../learning/constants'
import { OBJECT_REGISTRY } from '../../simulation/objectRegistry'
import { useSimulationStore } from '../../store/useSimulationStore'
import type { WorldObjectType } from '../../types/world'
import { Toggle } from '../ui/Toggle'

const PLACEABLE_TYPES: WorldObjectType[] = ['tree', 'rock', 'food']

export function SettingsPanel() {
  const worldSize = useSimulationStore((state) => state.world.config.size)
  const settings = useSimulationStore((state) => state.settings)
  const setSetting = useSimulationStore((state) => state.setSetting)
  const addObject = useSimulationStore((state) => state.addObject)
  const resetCamera = useSimulationStore((state) => state.resetCamera)
  const learningEnabled = useSimulationStore((state) => state.learningEnabled)
  const learningConfig = useSimulationStore((state) => state.learningConfig)
  const setLearningEnabled = useSimulationStore((state) => state.setLearningEnabled)
  const setEpsilonDecay = useSimulationStore((state) => state.setEpsilonDecay)

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
            <Readout label="Learning Rate" value={learningConfig.learningRate.toFixed(2)} />
            <Readout label="Discount γ" value={learningConfig.discountFactor.toFixed(2)} />
            <Readout label="Min Epsilon" value={learningConfig.minEpsilon.toFixed(2)} />
            <div className="pt-1">
              <p className="mb-2 text-[13px] text-lab-text">Epsilon Decay</p>
              <div className="grid grid-cols-3 gap-1">
                {EPSILON_DECAY_OPTIONS.map((decay) => (
                  <button
                    key={decay}
                    type="button"
                    onClick={() => setEpsilonDecay(decay)}
                    className={`border px-1.5 py-1 font-mono text-[11px] transition-colors ${
                      learningConfig.epsilonDecay === decay
                        ? 'border-lab-accent bg-lab-accent/15 text-lab-accent'
                        : 'border-lab-border bg-lab-elevated text-lab-muted hover:border-lab-accent/40'
                    }`}
                  >
                    {decay}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] leading-5 text-lab-muted">
                학습을 끄면 Q-Table과 epsilon이 고정된다. 개체는 현재 정책으로 계속 행동한다.
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
