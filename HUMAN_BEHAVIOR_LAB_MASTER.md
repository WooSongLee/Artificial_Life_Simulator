# Human Behavior Lab — Master Handover

이 파일이 저장소의 **유일한** Human Behavior Lab 개발 인계서다. 매 세션 이 문서의 Repository facts / Current status / Next slice만 갱신한다. 별도 계획·상태 md를 만들지 않는다.

## Related docs (do not duplicate)

| Document | Role |
|---|---|
| `README.md` | 앱 개요, 스택, 실행 명령, Ecology 기본 RL 설명 |
| `ARTIFICIAL_LIFE_SPEC.md` | 제품 명세·버전 로그·STEP 15–23 Lab 완료 조건 (권위 명세) |
| `HUMAN_BEHAVIOR_LAB_CURSOR_GUIDE.md` | Cursor bootstrap/continue **프롬프트**만. 상태·로드맵은 여기(MASTER)가 기준 |

코드와 문서가 다르면 **코드가 사실**이다.

---

## Final goal

욕구(homeostasis) → 지각/주의 → 기억 → 목표 → 계획 → 행동 → 결과 비교 → 학습이 연결되어, 보상 치트·행동 스크립트 없이 인간다운 행동이 **발달**하는 embodied Lab agent.

성공 관찰 예: 생존과 휴식의 사전 준비, 탐색과 중단, affordance 사물 연쇄, 기억 기반 재방문, 실패 후 재계획, 습관과 성향 차이, decision/reward 사후 분석.

**Environment track:** 단순 욕구 충족 챔버 → 다구역·다사물 **Human Life Sandbox** (Bedroom / Living / Kitchen / Bathroom / Workshop / Garden / Hallway). 개체가 학습 정책·목표로 행동을 **조합**한다 (사전 스크립트 금지).

## Invariants (until user changes them)

- Lab = `human_behavior_lab`, 단일 개체
- 사망 금지 (`allowsDeath=false`, `LAB_HEALTH_FLOOR = 5`)
- 전투 / 유전 / 교배 / 개체 감지 비활성
- 생존 축 `energy / hunger / health` + drive `fatigue / curiosity / comfort` 유지
- `labCondition`: `baseline | food_scarce | rest_locked | curiosity_prime | tradeoff_hard`
- Curriculum: `survival_primer → drive_discovery → tradeoff` 유지
- 기존 action schema + Tabular Q-Learning 우선 보존 (PPO/Dreamer 등 미이식)
- **Action schema 확장 최소화:** affordance는 기존 `GATHER` / `PICK_UP` / `EAT` / `REST` 등으로 실행
- Ecology·기존 Lab 실험·학습 데이터/정책 호환성 유지; Learning On / Frozen 비교 가능
- 기존 기능을 임의 제거하지 않음

## Target architecture (incremental)

Body/Needs · Traits · Perception · **Affordance world (data catalog + runtime)** · Memory · Goal · Skills/options · Actor (기존 actions) · Learning · Introspection

시간 계층: goal → skill/option → 기존 `AGENT_ACTIONS`.

### Life Sandbox environment architecture (designed)

```
LabZone (7) ── bounds / presence(active|planned)
     │
LabObjectTypeDefinition (catalog, ~40 types)
     │  object_type, object_state, affordances[], preconditions,
     │  state_transitions, effects, resource_cost, durability,
     │  interaction_range, object_relations, discovery_status
     │
LabAffordance ── kind → executorAction (AgentAction v3)
     │
LabObjectInstance (WorldState.labObjects; Env-P1/P2 kitchen runtime + held slot)
     │
Interactable (legacy runtime — door/switch/box/bed/lookout)
```

**호환 전략:** 카탈로그가 권위 데이터 모델. 기존 `Interactable`은 유지. Env-P1부터 Kitchen 핵심 사물은 `labObjects` + 공통 실행기. Legacy kind는 점진 수렴.

**상호작용 동사 (새 Action 없음):** open/close, pick/drop/store/retrieve, toggle/operate, inspect/observe, consume, prepare/combine, repair, clean, move_object, wait(+rest_use). 전부 `AFFORDANCE_EXECUTOR` → 기존 schema.

**환경 동적 시스템 (단계적):** Day/Night, Temperature, Lighting, Weather, Noise, Cleanliness, Durability, Plant Growth, Food Freshness — P3부터 시간·조명·온도만 먼저.

**욕구 후보 (P4, 사물·측정 준비 시):** 기존 6축 유지 + thirst / hygiene / boredom / competence / autonomy / safety 검토. 중복·보상 남발 금지.

**관찰 HUD (P6):** Need / Goal / Candidate Actions / π / Predicted Outcome / Plan / Memories / Reward Breakdown / Object Δ / Action Timeline — **실제 정책·내부 상태만** (사후 서사 금지).

## Roadmap

### A. Cognition / learning (기존)

| Phase | Goal | Done when |
|---|---|---|
| **Obs-P0** Baseline & Observability | 재현·계측 | seed 재현, Lab 테스트, behavior/reward 계측 — **대부분 완료** (drive 시계열·스핀 카운터·UI smoke 잔여) |
| Cog-P1 Homeostasis v2 | 욕구 확장 IF, trait/state | Env-P4와 정렬 |
| Cog-P2 Affordance Objects | 데이터+공통 실행 | **Env 트랙으로 이관** |
| Cog-P3…P8 | Spatial / Memory / Goals / Traits / Predictive / Social | Env 기반 위에 단계 진행 |

### B. Environment expansion (활성 트랙)

| Phase | Goal | Done when |
|---|---|---|
| **Env-P0** 세계 공간 + Object Data Model | 7존·카탈로그·브리지·테스트 | **완료 (2026-11-07)** |
| **Env-P1** Kitchen / Bedroom 핵심 사물 | fridge/stove/sink 런타임 + bed 유지 | **완료 (2026-11-07)** — GATHER/EAT 상태 변경 |
| **Env-P2** 다단계 의존 | held food + stove/table | **완료 (2026-11-07)** — requiresHeldType + blocked 로그 |
| **Env-P3** 시간·조명·온도 | 주야/조명/온도 틱 + 관측·로그 | **완료 (2026-11-07)** — `labEnvironment` + Observation v7 `env` |
| **Obs lab/held** | LabObject/held Q 조건화 | **완료 (2026-11-07)** — Observation v8 `labObject`+`heldLab` |
| Env-P4 | 욕구 확장 + 선택 고도화 | 새 욕구가 고유 행동 분포에 영향, Frozen 비교 |
| Env-P5 | 기억·장기 목표 ↔ 환경 | 회상으로 재방문/연쇄 개선 |
| Env-P6 | HUD + 실험 평가 | 내부 상태 기반 introspection UI |

한 세션 = 검증 가능한 vertical slice 하나. 전체 기능을 한 번에 구현하지 않는다.

## Experiment metrics (required)

- action / affordance / object 분포·전이
- 욕구 결핍·충족·지속 시간
- goal/plan 통계 (Cog-P5+)
- 이동·유효이동·회전/스핀·idle·충돌·wasted energy
- reward 항목별 기여, entropy
- 기억 재사용 (Env-P5+)
- Frozen vs Learning On, 동일 seed, 다회 episode
- zone 방문 분포, object-type 사용 다양성 (Env-P1+)

필수 시나리오: survival primer, drive discovery, tradeoff, blocked affordance, changed layout, chained task, novelty, trait comparison.

## Implementation rules

- 한 세션 = 검증 가능한 vertical slice 하나
- 미구현을 완료로 쓰지 않음; 미실행 테스트를 통과로 쓰지 않음
- 새 알고리즘/라이브러리는 필요성·비용·비교 방법 선행
- 사물은 데이터+공통 affordance; 특수 if/else 남발 금지
- 신규 AgentAction 추가 금지 (어댑터로 기존 schema 재사용)

## Reference research (optional direction)

- DreamerV3 / world models (Nature 2025) — 후순위 비교 실험
- Hierarchical RL temporal abstraction (arXiv 2506.14045)
- Episodic memory reviews (PMC11449156)
- RND intrinsic motivation (OpenAI 2018)

---

## Repository facts (code-verified)

| Item | Fact |
|---|---|
| Stack | TypeScript, React 19, Vite, R3F/Three, Zustand, Vitest |
| RL | **Tabular Q-Learning** (`src/learning/qLearning.ts`), ε-greedy + genetic/drive/curriculum bias. **PPO 없음** |
| Schemas | Action v3 (10 actions), Observation **v8** (18 tokens, + `labObject` + `heldLab`) |
| Actions | `MOVE_FORWARD`…`FLEE` — Lab masks combat. Affordance executors ⊆ {GATHER, PICK_UP, EAT, REST} |
| Loop | `engine.stepSimulation` → decide → execute → metabolism/drives → **labEnvironment tick** → learn/`computeReward` |
| Lab drives | `labMode.tickLabDrives` + curriculum; rest_bed/lookout via **GATHER**; cold/dim ambient comfort bonus |
| Interactables (legacy) | `door`, `switch`, `movable_box`, `rest_bed`, `lookout` |
| **Lab objects (P2)** | `WorldState.labObjects` — fridge/food/stove/sink/**dining_table**; `Agent.heldLabObjectId` |
| **Lab env (P3)** | `WorldState.labEnvironment` — time/period/lighting/temp; Ecology `null`; day≈60s |
| **Obs cues (v8)** | `labObject` (fridge/stove/sink/table/food × close/fwd/oth); `heldLab` (none/food/food_ck); Ecology `na` |
| Life Sandbox modules | `labObject.ts`, `labZones`, `labObjectCatalog`, `labAffordance`, `labObjectBridge`, `labObjectRuntime`, `labEnvironment`, `labWorld` |
| Zones | 7 defined; **4 active**; **3 planned** |
| Object catalog | **42** types; 5 bridged_legacy; **5 runtime** (kitchen); rest catalog_only |
| Conditions | `src/simulation/labConditions.ts` |
| Curriculum | `src/learning/labCurriculum.ts` — tick≈600/1400 |
| Reward telemetry | `computeRewardBreakdown`; probe `rewardΣ` |
| Probe | `npm run lab:probe` |
| Commands | `npm test`, `npm run lab:probe`, `npm run dev`, `npm run build` |

### Doc vs code deltas

- README Ecology-first 13-feature obs vs Lab Observation **v8 / 18 tokens**.
- Kitchen 메시/HUD 없음; Lab ambient은 상태·관측·probe 로그만 (장면 조명 미연동).
- Reward breakdown 구현됨. Drive deficiency time-series / true spin counter / UI smoke = 미완.

## Current status

| Track / Phase | Status |
|---|---|
| Obs-P0 Baseline | Partial — behavior + rewardΣ done; drive series / spin counter / UI smoke 잔여 |
| **Env-P0** Data model + zones | **Done** |
| **Env-P1** Kitchen/Bedroom runtime | **Done** |
| **Env-P2** Held + multi-step deps | **Done** |
| **Env-P3** Time / light / temp | **Done** |
| **Obs labObject/held** | **Done** (v8 cue; Env track observation slice) |
| Env-P4…P6 | Not started |
| Cog-P1…P8 | Not started (Env와 교차 예정) |

**Already in repo (Lab):** mode gates, immortality, drives, chamber, curriculum, interactables, Mixamo, probe, trail/UI, Life Sandbox catalog+zones+bridge, kitchen labObjects + held chains, `labEnvironment` day cycle + `env` obs, **`labObject`/`heldLab` obs cues**.

**Not implemented:** chamber mesh for kitchen, scene light tied to `labEnvironment`, expanded needs, memory/goals, Sandbox HUD, cutting_board runtime.

## Current experiment

| Field | Value |
|---|---|
| Seed | 42 |
| Ticks/arm | 1800 |
| Condition | `baseline` |
| Arms | Learning On vs Frozen Q |
| Learning | driveRate 13.0% overall; late drive 22.9% / surv 77.1%; curriculumShift=true; beats Frozen |
| Learning drives@end | E=97 H=2 F=52 C=28 Cm=60; avgR=0.974 |
| Learning env@end | night t=21.0h light=0.21 temp=19.4C transitions=6 |
| Learning held@end | labObject=food_oth heldLab=none |
| Learning rewardΣ | eat=1600 drive=67.5 seek=122.4 spin=-32.4 coll=-716 interact=226.5 |
| Learning behavior | move 67.7% turn 21.2% eat 0.6% gather 8.2% turn/move=0.31 |
| Frozen | driveRate 0%; F/C=100 Cm=0; avgR=-1.085 |
| Note | Observation v8 reset Q; labObject/held cues enable chain conditioning. Learning still beats Frozen; gather share↓ vs v7 (re-learn). |

## Last completed slice

**Obs v8 LabObject/held compact cues (2026-11-07)**

- Observation **v8** (18 tokens): `labObject` (nearest runtime object kind × close/fwd/oth) + `heldLab` (none/food/food_ck/other). Ecology → `na`.
- Locked/contained food hidden from cues (fridge is the navigation signal). Held food excluded from nearest.
- `findVisibleLabObject` / `isLabObjectObservable` in runtime; probe `held@end`.
- Tests: `npm test` **193/193** pass. `tsc --noEmit` OK. seed 42: Learning beats Frozen; curriculumShift=true.

Files: `types.ts`, `schema.ts`, `observation.ts`, `labObjectRuntime.ts`, `labProbe.ts`, tests (`labObjectRuntime`, `learning`, `qCompatibility`, `experiments`, `labEnvironment`, `interactables`), `runChecks.ts`, `HUMAN_BEHAVIOR_LAB_MASTER.md`.

## Known issues

- **Scene lighting 미연동:** `labEnvironment.lighting`은 정책/probe만; R3F LabLights 고정.
- **Planned zones 미물리화:** living/bathroom/garden 데이터만.
- **이중 모델:** Interactable + labObjects 공존.
- **Kitchen 메시 없음:** 런타임 좌표만; 시각 피드백 없음.
- **욕구 시계열 / 스핀 카운터 / UI smoke:** Obs 잔여.
- **v8 Q reset:** gather/chain 재학습 필요; held@end이 아직 none인 짧은 1800틱 런이 흔함.

## Next slice

**단 하나:** Env-P4 욕구 확장 후보 중 **측정·사물과 함께 준비된 1축** (thirst 또는 hygiene) — 상태·회복/소모·보상·관측 지표를 한 번에. 장면 조명 연동·cutting_board는 그 다음.

## Decision log

- 2026-11-07: MASTER를 유일한 Lab 인계서로 둔다. Tabular Q 보존. Obs-P0 = 관측·계측 우선.
- 2026-11-07: Reward breakdown은 **raw pre-curriculum** 성분을 brain에 누적.
- 2026-11-07: **Env expansion 착수.** 카탈로그+존을 Interactable과 병행; 새 AgentAction 금지; active 존은 현 facility에 매핑하고 planned 존은 AABB만.
- 2026-11-07: **Env-P1**는 InteractableKind를 늘리지 않고 `labObjects` + 공통 실행기로 kitchen을 심음. Legacy bed 유지. Observation 확장은 P2로 미룸(스키마 충격 최소화).
- 2026-11-07: **Env-P2** held 슬롯은 Ecology `equipment`와 분리. Powered stove에서 held 없으면 operate를 blocked로 드러내고 toggle로 조용히 끄지 않음(의존 학습 가능). Observation held 토큰은 P3 이후로 재연기.
- 2026-11-07: **Env-P3** ambient은 단일 compact `env` 토큰으로 Obs v7 범프 (Q reset 허용). 장면 조명 연동·held 토큰은 별도 slice.
- 2026-11-07: **Obs v8** labObject+heldLab는 interactable/heldTool 패턴의 **두 토큰** (packed 단일 토큰 대신). Q reset 허용; locked food는 관측에서 숨김.

## Session log (recent ≤5)

1. **2026-11-07 Obs v8 labObject/held** — nearest + held cues; probe held@end; 193 tests.
2. **2026-11-07 Env-P3 ambient env** — labEnvironment tick + env obs v7 + probe; 190 tests.
3. **2026-11-07 Env-P2 held chains** — heldLabObjectId, stove cook / table eat, blocked affordance; 186 tests.
4. **2026-11-07 Env-P1 kitchen runtime** — labObjects seed + GATHER/EAT executor; fridge food path; 182 tests.
5. **2026-11-07 Env-P0 sandbox model** — 7 zones, 42 object types, affordance→action map, legacy bridge; 175 tests.
