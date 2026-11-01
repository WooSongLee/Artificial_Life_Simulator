# Artificial Life Simulator — Product & Technical Specification

> **문서 목적:** 이 문서는 Artificial Life Simulator의 제품 요구사항, 시뮬레이션 규칙, 기술 구조, 개발 단계 및 변경 이력을 관리하는 기준 명세서다. Cursor와 개발자는 구현 전에 이 문서를 확인하고, 구현 결과와 문서가 항상 일치하도록 유지한다.
>
> **프로젝트 원칙:** 먼저 작동하는 작은 인공 생태계를 만든다. 이후 강화학습, 진화, 실험 관리 기능을 단계적으로 확장한다. 실제로 계산된 데이터만 시각화하며, 학습하거나 진화하는 것처럼 보이도록 결과를 꾸며내지 않는다.

---

## 0. 문서 관리

| 항목 | 값 |
|---|---|
| 프로젝트명 | Artificial Life Simulator |
| 문서 파일 | `ARTIFICIAL_LIFE_SPEC.md` |
| 문서 버전 | 0.21.0 |
| 문서 상태 | 초기 기준 명세 (Draft) |
| 기본 제품 형태 | 브라우저에서 실행되는 3D 인공 생태계 시뮬레이터 |
| 기본 사용자 | 개발자 본인 및 시뮬레이션을 관찰·실험하는 사용자 |
| 기준 언어 | UI는 우선 영어 명칭 사용 가능, 문서 및 설명은 한국어 |

### 0.1 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| 0.21.0 | 2026-11-01 | 학습 관찰을 위해 유전 On/Off 토글을 추가한다. 새 세션 기본은 Off다. Off면 교배·유전 bias·노화 사망을 멈추고 새 개체는 동일 기본 Genome을 쓴다. 대사·먹이·전투 기본값을 다시 완화하고, 선택 개체 추적 카메라를 추가한다. |
| 0.20.0 | 2026-11-01 | STEP 14 Persistence & Learning Integration. observation/action 스키마 호환, Q-Table pad/reset 경고, 희소 Q 진단, Action 분석(탐험·지형·도구·전투), 동일 Seed/정책 비교, 3D 행동 대상 표시를 연결한다. PPO는 도입하지 않는다. |
| 0.19.0 | 2026-11-01 | STEP 13 Extended Genome Traits. Strength/Aggression/Caution/ToolAffinity를 Genome에 추가한다. 교차·돌연변이는 GENOME_GENES 순회를 쓴다. Strength는 피해량, ToolAffinity는 도구 회복·내구도 소모에 쓰인다. Aggression/Caution은 정책 선택 점수의 선천적 bias이며 Q 값을 덮어쓰지 않는다. bias 상한은 0.25다. 빠진 유전자 기본값은 1.0이다. 옛 세대 기록의 새 평균은 만들지 않고 미기록(null)으로 둔다. |
| 0.18.0 | 2026-11-01 | STEP 12 Combat & Defense. SPEAR/SHIELD를 기존 단일 슬롯 PICK_UP으로 습득한다. Action v3는 ATTACK/DEFEND/FLEE를 뒤에 붙인다. 기본 공격·방어는 도구 없이도 가능하고, 창은 사거리·피해를, 방패는 방어 성공 시 피해 감소를 바꾼다. Observation v4는 최근접 개체 방향/거리, 체력 구간을 뒤에 붙인다. 이론 상태 공간은 170,100,000이며 Q-Table은 희소 저장을 유지한다. 피해·방어·도주 보상은 실제 결과에만 지급한다. schemaVersion 4와 v1–v3 마이그레이션을 추가한다. 진영·동맹·Genome Strength 확장은 구현하지 않는다. |
| 0.17.0 | 2026-11-01 | STEP 11 Tools & Foraging. Food 자동 섭취는 유지하고 BERRY_BUSH/ROOT_PATCH 채집 자원과 Basket/Digging Stick을 추가한다. Action v2는 PICK_UP/GATHER를 뒤에 붙이고 Mask로 불가능한 행동을 뺀다. Observation v3는 forage/nearbyTool/heldTool 이산 토큰이다. 이론 상태 공간은 945,000이며 Q-Table은 희소 저장을 유지한다. 도구 내구도는 성공 사용 시 감소하고 0이면 파손된다. schemaVersion 3과 v1/v2 마이그레이션을 추가한다. 전투·무기·다중 슬롯·제작은 구현하지 않는다. |
| 0.16.1 | 2026-11-01 | 지형 3D는 풀 메시 없이 단일 Plane의 표면 질감과 높이만 쓴다. Grassland는 밝은 초원색, Forest는 어두운 낙엽 바닥색으로 구분한다. |
| 0.16.0 | 2026-11-01 | STEP 10 Terrain Ecology. 시드 기반 군집 패치 지형(Grassland/Forest/Rocky/Wetland/Water)을 추가하고 이동·에너지·시야·은신·자원 가중·물 통과 불가를 적용한다. Observation v2는 현재/전방 지형 토큰을 키 뒤에 붙인다. 이론 상태 공간은 9,000이며 Q-Table은 희소 저장을 유지한다. schemaVersion 2와 v1→v2 마이그레이션을 추가한다. 도구·전투·새 Genome은 구현하지 않는다. |
| 0.15.0 | 2026-11-01 | STEP 9 Action Observatory. 선택·실행 이벤트를 같은 eventId로 연결하고, Learning 탭에 Action 시계열·초기/후기 비율 비교·개체 Timeline을 추가한다. ExperimentRecord와 SerializedBrain에 action/observation 스키마 버전을 기록하고, schemaVersion 1 기록은 필드를 채운 뒤 Q-Table을 유지한다. 지형·도구·전투는 구현하지 않는다. |
| 0.14.0 | 2026-11-01 | 지형·도구·전투·행동 관찰 확장의 설계 로드맵을 17장에 추가한다. 희소 Q-Table, Action Mask, action/observation 스키마 분리, 선택·실행 이벤트 연결, schemaVersion 1 마이그레이션 규칙을 정의한다. 이 버전은 명세만 갱신하며 기능 코드는 변경하지 않는다. |
| 0.13.0 | 2026-10-31 | STEP 8 최적화와 출고 점검. NaN 가드, 3D 메시 유지/useFrame 위치 갱신, 통계 스로틀, 세션 로딩 상태, Vitest 핵심 테스트, README를 추가한다. InstancedMesh와 Web Worker는 현재 규모에서 도입하지 않는다. |
| 0.12.0 | 2026-10-31 | 실시간 교배 번식과 수명을 추가한다. 성욕(libido/desire)이 찬 성숙 개체가 가까이 오면 교배하고, 교배 중에는 에너지가 줄며 하트가 표시된다. 세대는 자식이 태어날 때 올라간다. 속도는 1–100,000,000 로그 슬라이더이며 고속은 프레임 시간 예산으로 진행한다. |
| 0.11.0 | 2026-10-31 | STEP 7 Sandbox & Persistence. 월드/학습 설정, IndexedDB 실험 저장, JSON 입출력, Experiments 탭 비교, 세션 복원을 추가한다. |
| 0.10.0 | 2026-10-31 | STEP 6 진화 시스템. Genome, 세대 단위 번식, 돌연변이, 세대 통계, Q-Table 상속(기본 꺼짐), Evolution 탭을 추가한다. |
| 0.9.1 | 2026-10-31 | 분석 화면을 Simulation 탭과 Learning 탭으로 분리한다. Simulation은 생태계 통계, Learning은 학습 지표·차트·비교를 담당한다. |
| 0.9.0 | 2026-10-31 | 우측 정보 패널을 제거하고 Cursor형 탭 워크스페이스로 분리한다. 시뮬레이션 속도에 100x/1000x를 추가한다. 고속은 프레임당 스텝 상한(최대 400)을 두어 프레임이 멈추지 않게 한다. |
| 0.8.0 | 2026-10-31 | STEP 5 학습 대시보드. 차트는 1초 샘플·최근 180개만 유지하고, 초기 30초와 최근 30초를 겹치지 않을 때만 비교한다. 차트는 Recharts 없이 실제 기록 SVG로 그린다. 3D에 행동 표시·먹이 탐색 경로 토글을 추가한다. |
| 0.7.0 | 2026-10-31 | 학습 초기 수명이 너무 짧아 대사·먹이·이동 배율을 다시 맞춘다. 이동은 기본의 1.4배로 에너지를 쓰고, 목표 먹이는 개체 수 × 1.6(최소 12)이다. 초기 2분은 대부분 생존하고, 첫 사망은 대략 3–4분에 난다. |
| 0.6.0 | 2026-10-31 | 이동 비용은 보상 페널티가 아니라 실제 에너지 소모로 둔다. `MOVE_FORWARD`는 기본 대사의 1.8배로 에너지를 쓴다. 탐색 이동에는 보상 페널티를 주지 않는다. 무작위 탐험은 전진에 가중치를 둔다. |
| 0.5.0 | 2026-10-31 | 좌측 설정에서 Learning Rate, Discount, Min Epsilon, Epsilon Decay를 숨긴다. 섭취 가능 거리 안의 먹이는 행동과 관계없이 섭취한다. 생존 개체가 없으면 `ended` 상태와 종료 오버레이를 표시한다. |
| 0.4.0 | 2026-10-31 | 학습 시간을 확보하도록 대사를 완화하고, 좌측 설정에서 개체 수(1–50)를 조절한다. 목표 먹이 수는 개체 수 × 1.4(최소 10, 최대 48)로 맞춘다. |
| 0.3.0 | 2026-10-31 | STEP 4 Tabular Q-Learning 구현. 섭취는 EAT 행동으로만 수행하고, 에이전트별 Q-Table은 React 렌더 상태 밖에 둔다. Epsilon은 학습 스텝마다 곱셈 감쇠하며 기본 Decay는 0.999이다. |
| 0.2.0 | 2026-10-31 | STEP 1–3 구현 상태를 반영. 시뮬레이션 속도 옵션을 1x/2x/5x/10x로 고정하고, Simulation Time은 `tick × SIMULATION_STEP_DT`로 계산하며, 선택 개체 이동 경로는 최근 80지점만 유지한다. |
| 0.1.0 | 2026-10-31 | 기존 8단계 개발 계획을 통합한 최초 명세 작성 |

**변경 규칙**
- 요구사항, 동작 규칙, 데이터 모델, 기술 선택, 완료 조건이 바뀌면 이 표에 변경 내용을 기록한다.
- 구현이 명세와 달라졌다면 구현을 명세에 맞추거나, 의도된 변경인지 판단한 뒤 명세를 먼저 갱신한다.
- 구현되지 않은 기능을 완료된 것으로 표시하지 않는다.
- 명세 변경 시 문서 버전을 올린다. 작은 문구 수정은 Patch, 기능·요구사항 변경은 Minor, 핵심 구조 변경은 Major 버전으로 관리한다.

---

# 1. 제품 개요

## 1.1 한 문장 정의

**사용자가 가상의 생태계를 만들고, 그 안에 자율적으로 행동하고 학습하는 인공 생명체를 배치하여 개체의 행동·학습·생존·세대별 진화 과정을 3D로 관찰하고 실험하는 웹 시뮬레이터.**

## 1.2 제품 비전

사용자는 위에서 내려다보는 3D 세계를 관찰한다. 각 개체는 에너지, 허기, 체력 등의 내부 상태를 가지며 주변 환경을 관찰하고 행동을 선택한다. 초기에는 단순한 강화학습으로 먹이를 찾고 에너지를 관리하는 방법을 학습한다. 이후 번식과 유전 시스템을 추가해 세대에 따른 특성 변화를 관찰한다.

핵심 재미는 다음과 같다.
1. 개체가 처음에는 비효율적으로 행동하다가 경험을 통해 전략을 개선하는 모습을 본다.
2. 여러 개체가 같은 환경에서 각자 다른 행동을 하는 모습을 비교한다.
3. 환경 조건을 바꾸어 생존 및 학습 결과가 어떻게 달라지는지 실험한다.
4. 여러 세대가 지나면서 유전 특성과 행동 전략이 어떻게 변하는지 관찰한다.
5. 개체 하나를 선택해 해당 개체의 현재 상태와 학습·생존 기록을 살펴본다.

## 1.3 제품 범위

### 초기 목표(MVP)
- 브라우저에서 실행되는 단일 사용자용 3D 시뮬레이터
- 하나의 월드와 여러 개의 간단한 3D 에이전트
- 자원 탐색, 이동, 섭취, 에너지 소비 및 사망
- 재생·일시정지·초기화·속도 조절
- 에이전트 선택 및 상태 확인
- Q-Learning 기반의 실제 자율 행동 학습
- 학습 및 생존 통계 시각화
- 실시간 교배 번식, 유전, 돌연변이, 수명 및 세대 비교
- 사용자 정의 월드/학습 설정
- 실험 저장·불러오기·내보내기·가져오기 및 실험 비교

### 후속 목표
- 다수 에이전트 및 장시간 시뮬레이션 성능 개선
- 추후 PPO 등 확장된 학습 알고리즘 검토
- 학습 중 Action이 시간순으로 어떻게 바뀌는지 관찰 (STEP 9에서 기존 5Action 기준으로 구현)
- Grassland / Forest / Rocky / Wetland / Water 지형과 이동·시야·자원 차이 (STEP 10에서 구현)
- Basket, Digging Stick 등 도구 습득과 채집 (STEP 11에서 구현)
- Spear, Shield 등 개체 간 전투·방어·도주 (STEP 12에서 구현)
- Strength, Aggression, Caution, Tool Affinity 등 유전 특성 확장 (STEP 13에서 구현)
- 위 요소를 Tabular Q-Learning과 실시간 진화에 연결

상세 설계, 호환 규칙, 단계별 완료 조건은 **17장 확장 로드맵**을 따른다. 17장의 단계는 구현 전까지 `Not Started`로 둔다.

### 초기 범위에서 제외
- 실제 인간 수준의 지능 또는 인간 심리 구현
- LLM 기반 에이전트
- 사실적인 근육·골격·생체역학 시뮬레이션
- 멀티플레이어 및 온라인 공유
- 서버 계정, 결제, 구독 기능
- 현실 세계의 인간 행동을 예측한다고 주장하는 기능

---

# 2. 사용자 경험 및 화면 구조

## 2.1 기본 레이아웃

데스크톱 우선의 실험실형 대시보드를 사용한다.

| 영역 | 역할 |
|---|---|
| 중앙 | Cursor형 탭 워크스페이스. World는 3D Viewer와 전멸 오버레이, Simulation은 생태계 통계, Learning은 학습 분석, Evolution은 세대 통계, Experiments는 저장·비교 |
| 좌측 패널 | 월드 설정, 학습 파라미터, 보상, 진화 및 뷰어 설정 |
| 하단 컨트롤 | Play, Pause, Reset, 1–100,000,000 로그 속도 슬라이더 및 시간. 종료 상태에서는 Play 비활성 |
| 분석 화면/탭 | Simulation, Learning, Evolution, Experiments 탭. 학습 지표는 Learning, 세대 비교는 Evolution, 실험 저장·비교는 Experiments에 둔다. 개체를 선택하면 해당 탭에서 상세를 표시한다. |

## 2.2 시각 디자인

- 전체 UI는 차콜 또는 어두운 네이비 기반의 다크 테마를 기본으로 한다.
- 3D 월드는 지형 종류를 표면 질감·색·높이로 구분하고, 나무·바위·먹이는 별도 오브젝트로 표시한다. 풀 잎 메시는 쓰지 않는다. Grassland는 밝은 초원, Forest는 어두운 낙엽 바닥으로 보인다.
- 실험실 관찰 도구처럼 정돈된 정보 계층을 제공한다.
- 과도한 글래스모피즘, 강한 네온 효과, 장식성 애니메이션은 지양한다.
- 수치, 단위, 상태 및 차트 범례를 명확하게 표시한다.
- 선택 상태, 사망 상태, 학습 상태는 색상만으로 구분하지 않고 라벨·형태·아이콘을 함께 사용한다.

## 2.3 카메라 및 월드 조작

- 기본 시점은 높은 위치에서 내려다보는 3/4 Top-down Perspective Camera다.
- 마우스 드래그로 회전할 수 있다.
- 휠 또는 트랙패드로 확대·축소할 수 있다.
- 카메라 이동 및 회전의 범위를 제한하여 월드를 잃어버리지 않도록 한다.
- 살아 있는 개체를 선택하면 카메라가 그 개체를 따라간다. 궤도 회전·확대는 유지한다. 설정에서 추적을 끌 수 있다.

## 2.4 주요 사용자 흐름

1. 사용자가 시뮬레이터에 접속한다.
2. 기본 월드 또는 새 실험을 생성한다.
3. 개체 수, 먹이 수, 월드 크기 등 환경을 설정한다.
4. 시뮬레이션을 시작한다.
5. 개체들이 이동하고 자원을 탐색하며 학습한다.
6. 사용자가 특정 개체를 클릭해 상태와 행동 기록을 확인한다.
7. Simulation 탭에서 생존 통계를, Learning 탭에서 학습 결과를 확인한다.
8. 실험을 저장하거나 다른 조건으로 새 실험을 진행한다.

---

# 3. 기술 스택 및 아키텍처

## 3.1 기본 기술 스택

| 구분 | 기술 | 사용 목적 |
|---|---|---|
| Language | TypeScript | 애플리케이션 및 시뮬레이션 로직 |
| Frontend | React + Vite | 웹 애플리케이션 및 개발 서버 |
| 3D | Three.js + React Three Fiber | 3D 월드 및 에이전트 렌더링 |
| 3D Helpers | @react-three/drei | 카메라, 컨트롤 및 3D 편의 기능 |
| Styling | Tailwind CSS | UI 스타일링 |
| State | Zustand | UI 및 저빈도 애플리케이션 상태 |
| Charts | 프로젝트 내부 SVG LineChart | 학습 및 생존 통계. Recharts는 설치하지 않음 |
| Persistence | IndexedDB | 실험 및 시뮬레이션 데이터 저장 |
| Testing | Vitest + React Testing Library | 단위 및 UI 테스트 |
| E2E (필요 시) | Playwright | 주요 사용자 흐름 검증 |
| Deployment | Vercel | 웹 배포 |

**주의:** 차트 라이브러리와 테스트 패키지는 실제 프로젝트 상태를 확인하고 결정한다. 이미 적절한 도구가 설치되어 있으면 중복 설치하지 않는다. 버전은 구현 시점의 호환 가능한 안정 버전을 사용한다.

## 3.2 아키텍처 원칙

- 시뮬레이션 계산과 3D 렌더링을 분리한다.
- 학습 알고리즘과 에이전트 생존 규칙을 분리한다.
- UI 컴포넌트가 Q-Learning이나 에이전트 이동의 상세 구현을 직접 소유하지 않게 한다.
- 타입과 도메인 규칙을 명시적으로 정의한다.
- 실제 시뮬레이션 데이터와 화면 표시용 파생 데이터를 구분한다.
- 시뮬레이션의 시간 흐름은 프레임률과 독립적이어야 한다.
- 매 프레임마다 Zustand 전체 상태를 갱신하거나 모든 React 컴포넌트를 리렌더링하지 않는다.
- 초기에는 단일 스레드로 단순하게 구현하고, 프로파일링 결과 병목이 확인되면 Web Worker 등을 도입한다.

## 3.3 권장 디렉터리 구조

프로젝트 초기 상태를 확인하고 조정하되 다음과 같은 책임 분리를 권장한다.

```text
src/
  app/                  # 앱 진입점 및 전역 레이아웃
  components/
    layout/             # 패널, 툴바, 레이아웃
    controls/           # 재생, 일시정지, 속도 조절
    panels/             # 통계 및 에이전트 상세 패널
    charts/             # 분석 차트
  world/
    components/         # 지형, 먹이, 장애물 렌더링
    camera/             # 카메라 및 뷰 컨트롤
  agents/
    components/         # 에이전트 3D 표현 및 선택
    model/              # Agent 타입 및 상태
    systems/            # 이동, 생존, 충돌 등
  simulation/
    engine/             # 고정 시간 간격 업데이트 및 루프
    environment/        # 월드 및 자원 규칙
    systems/            # 월드 단위 시스템 조정
    metrics/             # 통계 수집 및 집계
  learning/
    qlearning/           # Q-Table, 정책, 업데이트
    rewards/             # 보상 계산
    state/               # 관찰값 및 상태 인코딩
  evolution/
    genome/              # 유전 정보
    reproduction/        # 번식 및 부모 선택
    mutation/            # 돌연변이
    generations/         # 세대 관리
  experiments/
    model/               # 실험 설정 및 스냅샷 타입
    storage/             # IndexedDB 저장소
    serialization/       # JSON 내보내기/가져오기
  store/                 # Zustand UI 및 앱 상태
  hooks/                 # React hooks
  types/                 # 공통 타입
  utils/                 # 공통 유틸리티
```

디렉터리 구조를 그대로 강제하지 않는다. 기존 프로젝트 구조가 더 적합하면 책임을 유지하면서 합리적으로 조정한다.

## 3.4 시뮬레이션 업데이트

- 시뮬레이션은 고정 시간 간격(fixed timestep) 기반 업데이트를 우선한다.
- 렌더링 프레임과 시뮬레이션 업데이트 횟수를 분리한다.
- 속도 배율은 시뮬레이션 시간 진행에 적용한다.
- 큰 프레임 지연이 발생해도 비정상적으로 긴 단일 업데이트가 발생하지 않도록 최대 누적 시간 또는 최대 업데이트 횟수를 제한한다.
- UI에는 실제 시뮬레이션 시간과 속도 배율을 표시한다.
- Simulation Time은 `tick × SIMULATION_STEP_DT`로 계산하고, 하단 컨트롤에는 `MM:SS.t` 형식으로 표시한다.
- Reset은 월드, 에이전트, 학습 상태, 통계, 선택 상태, 이동 경로를 명확한 초기 상태로 되돌린다. 속도 배율과 뷰어 설정은 사용자 조작값으로 유지한다.

---

# 4. 핵심 도메인 모델

> 아래는 초기 설계 기준이다. 실제 구현 과정에서 세부 타입과 필드는 조정할 수 있지만, 명세 변경 없이 서로 다른 의미를 혼용하지 않는다.

## 4.1 World

월드가 관리할 정보:
- 월드 ID
- 너비 및 깊이
- 시뮬레이션 시간
- 먹이 자원 목록
- 장애물 목록
- 지형 격자 (`cellSize`, `size`, `cells`)
- 월드 Seed 및 지형 프리셋
- 현재 에이전트 목록 또는 에이전트 저장소
- 월드 환경 설정
- 현재 세대 및 통계

월드는 사각형이며 연속 좌표(x, z)로 이동한다. 지형은 `cellSize = 2`인 격자로 덮고, 좌표는 해당 셀의 지형 효과를 따른다. 나무/바위는 원형 장애물이고 지형 타일과 역할을 분리한다. 물은 통과 불가 지형이다.

## 4.2 Agent

초기 에이전트는 사실적인 인간 모델보다 단순하고 명확한 3D 캡슐 또는 로우폴리 인간형으로 표현한다.

| 필드 | 의미 | 기본 규칙 |
|---|---|---|
| id | 고유 식별자 | 중복 불가 |
| position | 월드 좌표 (x, z) | 월드 경계 안에 존재 |
| rotation | 바라보는 방향 | 이동 방향과 일관성 유지 |
| energy | 에너지 (0~100) | 이동 및 생존에 따라 변화 |
| hunger | 허기 (0~100) | 시간에 따라 증가, 먹이 섭취 시 감소 |
| health | 체력 (0~100) | 허기·에너지 고갈 등에 따라 감소 가능 |
| speed | 이동 속도 | 이동 거리에 영향 |
| vision | 탐지 범위 | 관찰 가능한 자원 및 장애물 범위 |
| age | 생존 시간 | 시뮬레이션 시간 기준 증가 |
| maxLifespan | 수명 | Genome lifespan에서 복사. 유전이 켜져 있고 나이에 도달하면 사망 |
| desire | 현재 성욕 (0~100) | 시간에 따라 증가, 교배 완료 시 충족되어 낮아짐 |
| alive | 생존 여부 | 사망 시 false |
| deathCause | 사망 원인 | `health`, `age`, 또는 `combat`. 생존 중에는 null |
| matingPartnerId / matingTimeLeft | 교배 상태 | 교배 중 상대와 남은 시간 |
| learningState | 학습 진행 상태 | 학습 단계에서 추가 |
| genome | 유전 정보 | 진화 단계에서 추가 |
| equipment | 장착 도구 | 단일 슬롯. `basket` / `digging_stick` / `spear` / `shield`와 내구도. 없으면 null |
| defendTimeLeft | 방어 잔여 시간 | DEFEND 성공 시 설정. 받는 피해 감소 |
| attackCooldownLeft | 공격 쿨다운 | 사거리 안 공격 후에만 시작 |
| lastAttackerId / lastCombatTick | 최근 전투 | 저장·복원용. 없으면 null / 0 |

에너지와 허기는 서로 다른 개념으로 유지한다. 허기는 필요 상태, 에너지는 행동 및 생존에 사용할 수 있는 자원이다.

## 4.3 Food Resource

- 고유 ID
- 월드 좌표
- 에너지 회복량
- 생성/재생성 시간 또는 상태
- 섭취 가능 여부

에이전트가 섭취 가능 거리(`FOOD_EAT_RADIUS`, 1.6) 안에 있으면 현재 행동과 관계없이 그 틱에서 먹이를 섭취한다. `EAT`는 같은 섭취를 명시적으로 시도하는 행동이다. 섭취 가능 거리 밖에 있는데 `EAT`를 선택하면 실제 섭취 보상을 지급하지 않는다.

## 4.6 Forage Resource와 Tool

채집 자원은 Food와 별도다. 자동 섭취되지 않으며 `GATHER`로만 수량이 줄어든다.

| 종류 | 채집 조건 | 기본 효과 |
|---|---|---|
| BERRY_BUSH | 도구 없음 | 1단위. 에너지 +10, 허기 −12 |
| ROOT_PATCH | 사용 가능한 Digging Stick | 1단위. 에너지 +16, 허기 −18 |

도구:

| 도구 | 효과 | 내구도 |
|---|---|---|
| Basket | 베리 채집 2단위, 단위당 허기 추가 −4 | 성공 채집마다 −1. 0이면 파손되어 슬롯에서 제거 |
| Digging Stick | 뿌리 채집 가능 | 성공 채집마다 −1. 0이면 파손되어 슬롯에서 제거 |
| Spear | 공격 사거리와 피해 증가 | 실제 피해를 준 공격마다 −1. 0이면 파손 |
| Shield | 방어 성공 시 피해 감소 | 실제 피해를 줄인 방어마다 −1. 0이면 파손 |

월드 도구는 실제 오브젝트다. `PICK_UP` 성공 시 월드에서 사라지고 Agent.equipment가 채워진다. 슬롯이 이미 있으면 Mask가 PICK_UP을 제외한다. 사망 시 장착 도구는 월드에 한 번만 떨어진다.

## 4.4 Obstacle

- 고유 ID
- 위치 및 크기
- 충돌 형태
- 시각적 표현

초기에는 원형 또는 사각형 충돌 형태만 지원한다. 복잡한 물리 엔진 도입은 초기 범위가 아니다.

## 4.5 Genome (진화 단계)

유전 정보는 학습된 Q-Table과 별도 관리한다. 에이전트의 `speed`와 `vision`은 Genome에서 복사한다.

| 유전자 | 범위 | 시뮬레이션 효과 |
|---|---|---|
| Speed | 1.35–2.75 | 이동 거리 |
| Vision | 6.5–13 | 먹이 탐지 범위 |
| Energy Efficiency | 0.85–1.20 | 에너지 소모 ÷ 이 값 |
| Learning Rate | 0.05–0.25 | 해당 개체의 Q-update α |
| Exploration Rate | 0.50–1.00 | 해당 개체의 초기 epsilon |
| Libido | 0.45–1.35 | 성욕이 차는 속도 |
| Lifespan | 240–480초 | 최대 생존 시간. 유전이 꺼져 있으면 노화 사망은 적용하지 않는다 |
| Strength | 0.60–1.40 | 공격 성공 시 피해량 배율. 기본값 1.00은 기존 전투와 같다 |
| Aggression | 0.40–1.60 | 위협이 있을 때 ATTACK 선택 점수에 작은 선천적 편향. Q 값은 바꾸지 않는다 |
| Caution | 0.40–1.60 | 체력 ≤ 33 또는 가까운 위협에서 DEFEND/FLEE 선택 점수에 작은 선천적 편향 |
| Tool Affinity | 0.60–1.40 | 도구 사용 시 회복량과 내구도 소모. 기본값 1.00은 기존 도구 소모와 같다 |

각 특성은 허용 가능한 최소·최대 범위를 가진다. 돌연변이 후 범위를 벗어나면 clamp한다. 실험 설정의 Learning Rate/Initial Epsilon은 기본 참고값이며, 실제 학습 갱신과 초기 탐험은 Genome을 쓴다. 저장 데이터에 새 유전자가 없으면 1.00을 채운다. Aggression/Caution의 정책 bias는 `(gene − 1) × 0.4`이며 절댓값 상한은 0.25다. 탐험 선택은 기존 가중 무작위이며, 활용(exploitation)만 Q + bias로 고른다.

---

# 5. 시뮬레이션 규칙

## 5.1 초기 기본값

초기 구현을 위한 시작값이며, 사용자 설정 기능이 추가되면 설정값으로 관리한다.

| 설정 | 초기값 |
|---|---:|
| World Size | 기본 48 × 48. 설정에서 32/48/64/80 |
| Initial Population | 20 (설정에서 1–50 조절) |
| Initial / Target Food | 기본 40. 설정에서 4–60. 재생성은 이 수를 목표로 한다 |
| Agent Energy | 82–100에서 생성 |
| Agent Hunger | 4–18에서 생성 |
| Agent Health | 92–100에서 생성 |
| Simulation Speed | 1x (로그 슬라이더 1–100,000,000) |
| Maximum Population | 50 (UI 및 생성 제한) |
| Agent Vision | 6.5–13 월드 단위 |
| Agent Speed | 1.35–2.75 월드 단위/초 |

이 수치들은 생태계 밸런스를 검증하기 위한 임시 기본값이다. 과학적·현실적 상수가 아니다.

개체 수 변경 규칙:
- 시뮬레이션이 아직 시작되지 않았으면(`idle`, tick 0) 해당 수로 월드를 다시 생성한다.
- 실행 중이거나 일시정지 상태면 생존 개체를 우선 유지한 채 개체를 추가하거나 줄인다. 줄일 때는 사망 개체부터 제거한다.
- Reset은 현재 설정된 개체 수로 새 월드를 만든다.
- 새로 추가된 개체는 빈 Q-Table을 받는다. 제거된 개체의 학습 상태는 삭제한다.
- 시뮬레이션 상태는 `idle` | `running` | `paused` | `ended`다. `ended`는 생존 개체가 없을 때만 들어간다.

## 5.2 이동 및 경계

- 에이전트는 방향과 속도를 기반으로 월드 안에서 이동한다.
- 이동은 delta time 또는 고정 시뮬레이션 timestep에 기반한다.
- 실제 이동 거리는 `speed × terrain.moveSpeedMultiplier × dt`다.
- 에너지 소모는 기본 대사에 `terrain.energyDrainMultiplier`를 곱한다.
- 시야는 `vision × terrain.visionMultiplier`이고, 대상 셀 concealment는 탐지 거리를 줄인다.
- 월드 경계, 나무/바위, 물(`walkable=false`)은 같은 충돌 경로로 이동을 막는다.
- 초기 단계의 회전 및 이동은 단순한 운동 모델을 사용한다.
- 겹침 방지나 정교한 군집 이동은 후속 개선 항목으로 둔다.

## 5.3 생존 및 자원

- 시간이 흐르면 허기가 증가한다.
- 기본 생존에 에너지가 소모된다. `MOVE_FORWARD`는 기본 에너지 소모를 1.25배로 늘린다. REST는 기본 에너지 소모를 0.4배로 줄인다. 회전과 EAT는 기본 소모만 적용한다.
- 먹이를 섭취하면 에너지가 회복되고 허기가 감소한다.
- 에너지가 위험 임계값 이하로 떨어지면 체력이 감소한다. 허기가 높으면 에너지가 추가로 소모된다.
- 체력이 0 이하가 되면 사망한다.
- 유전이 켜져 있고 나이가 `maxLifespan`에 도달하면 체력과 관계없이 노화로 사망한다. 유전이 꺼져 있으면 나이는 증가하지만 노화 사망은 하지 않는다.
- 사망한 에이전트는 더 이상 이동, 섭취, 학습, 번식 행동을 수행하지 않는다.
- 사망 개체는 통계에는 남길 수 있으나, 활성 시뮬레이션 업데이트와 렌더링 리소스에서 적절히 분리한다.
- 생존 개체가 0이 되면 시뮬레이션 상태는 `ended`가 된다. 월드 뷰어에 종료 오버레이를 띄우고 Play를 막는다. Reset으로만 다시 시작한다.

현재 밸런스(학습 초기 탐험이 끝나기 전에 전멸하지 않도록 설정):

| 항목 | 값 | 의미 |
|---|---:|---|
| Energy drain | 0.42 /초 | 기본 에너지 소모 (회전, EAT) |
| Move energy drain | 0.525 /초 | `MOVE_FORWARD` = 기본 × 1.25 |
| Hunger gain | 0.5 /초 | 허기 증가 |
| Hungry extra drain | 0.16 /초 | 허기 ≥ 82일 때 추가 에너지 소모 |
| Energy critical | 10 | 이 이하에서 체력 감소 시작 |
| Health drain | 최대 0.8 /초 | 에너지 0일 때 최대 |
| Health regen | 1.6 /초 | 에너지 > 60이고 허기 < 40일 때 |
| Food restore | 에너지 +58, 허기 −68 | EAT 성공 시 |
| Food regen | 2.0 /초 | 목표 먹이 수 미만일 때 |
| Attack base damage | 6 | 맨손 기본 피해. 창은 ×1.45 |

학습 초기 수 분은 대부분 생존한다. 첫 에너지 사망은 대략 4–6분에 난다. 유전이 꺼져 있으면 노화 사망이 없어 같은 코호트의 학습 변화를 더 오래 본다. 이는 학습을 꾸며내기 위한 무제한 생존이 아니라, Q-Table이 갱신될 시간을 주기 위한 밸런스다.

수치와 임계값은 `src/simulation/constants.ts`에서 관리한다. 여러 컴포넌트에 하드코딩하지 않는다.

## 5.4 행동 정책 단계

- 초기 STEP 2에서는 임시 무작위 또는 규칙 기반 행동을 사용해 생태계 루프를 검증한다.
- STEP 4 이후 에이전트는 Tabular Q-Learning의 Epsilon-Greedy 정책으로 행동을 선택한다. 이전의 규칙 기반 탐색/배회는 학습 정책으로 대체한다.
- 규칙 기반 행동과 강화학습 행동을 명확히 구분할 수 있도록 정책 인터페이스를 둔다. 현재 구현은 `epsilon-greedy`와 비교용 `random` 정책을 제공한다.
- 학습이 꺼져 있으면 Q-Table 및 학습 파라미터(epsilon, learning steps)가 변경되지 않는다. 개체는 현재 Q-Table과 고정된 epsilon으로 계속 행동한다.

---

# 6. 자율 학습 시스템

## 6.1 첫 번째 알고리즘: Tabular Q-Learning

초기 구현은 디버깅과 학습 결과 검증이 쉬운 Tabular Q-Learning을 사용한다. 에이전트가 작은 상태 공간에서 먹이를 찾고 에너지를 관리하는 전략을 습득하는 것을 첫 번째 성공 기준으로 삼는다.

Q-Learning 업데이트:

```text
Q(s, a) ← Q(s, a) + α [r + γ max_a' Q(s', a') - Q(s, a)]
```

초기 기본 파라미터:

| 파라미터 | 초기값 |
|---|---:|
| Learning Rate (α) | 0.1 |
| Discount Factor (γ) | 0.95 |
| Initial Epsilon | 1.0 |
| Minimum Epsilon | 0.05 |
| Epsilon Decay | 기본값 0.999. 학습 스텝마다 `epsilon ← max(minEpsilon, epsilon × decay)` |

실험 설정의 Learning Rate와 Initial Epsilon은 새 개체의 Genome 기본값이다. 실제 Q-update α는 개체의 Genome Learning Rate를 쓰고, 새 개체의 초기 epsilon은 Genome Exploration Rate를 쓴다. Discount, Min Epsilon, Epsilon Decay, Reward는 다음 학습 스텝부터 적용한다. 좌측 설정에서 이 값들을 바꾸고, 범위 밖 입력은 거부한다.

## 6.2 Observation (관찰 상태)

에이전트가 관찰할 수 있는 정보는 초기에는 제한된 범위로 설계한다.

- Energy Level: 낮음 / 보통 / 높음 (0–33 / 34–66 / 67–100)
- Hunger Level: 낮음 / 보통 / 높음 (0–33 / 34–66 / 67–100)
- Nearest Food Direction: 없음 / 전방 / 후방 / 좌측 / 우측
- Food Distance: 가까움(섭취 가능 거리 이하) / 중간(시야의 50% 이하) / 멂(시야 안) / 탐지 범위 밖
- Obstacle Ahead: 있음 / 없음. 물과 월드 경계도 장애물로 본다
- Terrain: grassland / forest / rocky / wetland / water
- Terrain Ahead: 전방 `AGENT_LOOKAHEAD` 지점의 지형

- Forage: none / berry_close / berry_fwd / berry_oth / root_close / root_fwd / root_oth
- Nearby Tool: none / basket / stick / spear / shield
- Held Tool: none / basket_high / basket_low / stick_high / stick_low / spear_high / spear_low / shield_high / shield_low
- Nearby Agent Direction: none / forward / back / left / right
- Nearby Agent Distance: close(공격 사거리) / mid / far / out
- Health Level: 낮음 / 보통 / 높음 (0–33 / 34–66 / 67–100)

연속값은 이산 구간으로 변환해 상태 키로 인코딩한다. 상태 인코딩은 별도 모듈로 분리하며, 같은 관찰은 항상 같은 상태 키를 생성해야 한다. Observation v4 이론 상태 공간은 945,000 × (5/3) × (9/5) × 5 × 4 × 3 = 170,100,000이다. Q-Table은 방문한 상태만 저장한다. 지형에 들어갔다는 이유만으로 보상하지 않는다. 채집 성공만으로 획득량과 무관한 큰 보상을 주지 않는다. 공격 횟수나 방어 유지 자체에는 보상하지 않는다.

초기에는 상태 공간이 지나치게 커지지 않도록 한다. 구간 수와 방향 구분을 늘리는 경우 메모리와 학습 효율에 미치는 영향을 확인한다.

## 6.3 Action Space

현재 행동은 다음 10개다. 뒤의 3개는 STEP 12에서 추가했다.

| Action | 동작 |
|---|---|
| MOVE_FORWARD | 현재 방향으로 이동. 기본 에너지 소모를 1.25배로 늘린다 |
| TURN_LEFT | 일정 각도 좌회전 |
| TURN_RIGHT | 일정 각도 우회전 |
| EAT | 섭취 가능한 먹이가 가까이 있으면 섭취 시도. 같은 거리의 먹이는 다른 행동 직후에도 섭취된다 |
| REST | 이동을 멈추고 짧은 시간 휴식. 기본 에너지 소모를 0.4배로 줄인다. |
| PICK_UP | 습득 반경의 월드 도구를 빈 장비 슬롯으로 옮긴다 |
| GATHER | 채집 반경의 자원을 조건이 맞으면 채집한다 |
| ATTACK | 탐지된 최근접 생존 개체를 공격. 사거리 안에서만 피해. 창이 있으면 사거리·피해 증가 |
| DEFEND | 짧은 방어 상태를 만든다. 방패가 있으면 감소 폭이 크다 |
| FLEE | 최근접 위협의 반대 방향으로 회전한 뒤 전진한다 |

각 행동은 기존 시뮬레이션 엔진의 실제 동작과 연결되어야 한다. 행동 이름만 바뀌고 월드 상태가 바뀌지 않는 가짜 동작은 허용하지 않는다.

## 6.4 Epsilon-Greedy

- 확률 epsilon으로 무작위 행동을 선택한다. 탐험 분포는 균등이 아니라 전진에 가중치를 둔다. 기본 가중치는 MOVE 0.40, TURN_LEFT 0.12, TURN_RIGHT 0.12, EAT 0.08, REST 0.08, PICK_UP 0.10, GATHER 0.10, ATTACK 0.08, DEFEND 0.05, FLEE 0.05이다. 마스크된 Action의 가중치는 남은 후보 안에서 다시 정규화한다.
- 나머지 확률로 현재 Q-값이 가장 높은 행동을 선택한다.
- 동점 행동 선택 규칙을 정의해 재현성과 편향을 관리한다. 현재 exploit는 `AGENT_ACTIONS` 순서에서 첫 번째 최댓값을 고른다.
- epsilon은 에이전트별 학습 스텝마다 곱셈 감쇠한다. 학습이 꺼져 있으면 감쇠하지 않는다.
- epsilon이 낮아져도 최소 탐험률을 유지한다.

## 6.5 Reward Design

초기 보상은 다음을 시작점으로 사용한다. 실제 학습 결과를 보면서 조정한다.

| 사건 | 초기 보상 |
|---|---:|
| 먹이 실제 섭취 성공 | +10 |
| 채집 성공 | 실제 획득량 × 2.5. 성공 여부만으로 +10을 주지 않는다 |
| 도구 습득 성공 | +1 |
| 실제 피해를 준 공격 | 피해량 × 0.3 |
| 유효 대상이 없거나 사거리 밖 공격 | −0.4 |
| 실제 피해를 받음 (사망 틱 제외) | 피해량 × −0.3 |
| 방어로 실제 피해를 줄임 | 감소량 × 0.2 |
| 도주 후 위협과 거리가 실제로 벌어짐 | +0.7 |
| 섭취 가능 거리에서 떠난 전진 또는 실패한 EAT | -1 |
| 장애물 또는 경계 충돌 | -2 |
| 허기 또는 에너지 고갈로 사망 | -20 |
| 에너지가 낮고 허기가 급하지 않을 때 REST | +0.4 |
| 탐색을 위한 전진 | 보상 없음. 대사에서 추가 에너지 소모 |
| 단순히 먹이 쪽으로 이동 | 성공 보상 없음 |

이동 비용은 Q-보상으로 주지 않고 실제 에너지 소모로 준다. 모든 전진에 −1을 주면 제자리 회전이 더 이득이 되어 학습 초기에 전멸하기 쉽다.

보상은 실제 환경 결과에 의해 계산한다. 먹이를 향해 이동했다는 이유만으로 섭취 성공 보상을 주지 않는다. 같은 사건에 보상이 중복 지급되지 않도록 한다.

보상은 별도 모듈에서 계산하며, 실험별 보상 파라미터를 추후 변경할 수 있게 한다.

## 6.6 학습 데이터

에이전트별 또는 실험별로 다음 지표를 기록한다.
- Total Learning Steps: 학습이 켜진 동안 수행된 Q-update 횟수의 합
- Total Reward: 학습 스텝에서 받은 보상의 합
- Average Reward: 최근 80개 학습 보상의 평균
- Action Distribution: 학습 중 선택된 행동 횟수
- Current Epsilon: 생존 개체의 현재 epsilon 평균. 생존 개체가 없으면 전체 평균
- Average Q Value: 방문한 상태-행동 칸에 저장된 Q 값의 평균
- Exploration Rate: 최근 80개 학습 행동 중 탐험(무작위 선택) 비율. Genome의 Exploration Rate와 다른 값이다
- Survival Time: 에이전트 age. 대시보드의 Average Survival Time은 사망 개체의 평균 수명이다

시계열 기록 규칙:
- 샘플 주기: 20틱(1초). Reset 시 tick 0 기준점 1개를 기록한다
- 차트용 `series`: 최근 180개만 유지한다
- 비교용 `earlySeries`: 처음 30개 샘플을 모은 뒤 고정한다
- 초기/현재 비교는 두 구간이 겹치지 않을 때만 표시한다. 최소 약 60초의 기록이 필요하다
- `learningHistory.actionCounts`는 그 1초 동안 정책이 선택한 행동 횟수다. 누적 `brain.actionCounts`와 섞지 않는다
- 학습 스텝, 보상, 또는 구간 Action 횟수가 없으면 해당 지표는 0이 아니라 Empty State 또는 `—`로 표시한다
- 저장된 실험에는 링 버퍼가 아니라 1초 구간 Action 분포만 남긴다

선택·실행 이벤트:
- 정책이 행동을 고른 시점에 `eventId`를 발급하고, 실행과 보상 계산 후에 같은 ID로 결과를 채운다
- 이벤트에는 tick, simulationTime, agentId, stateKey, selectedAction, decisionType, epsilon, 선택 당시 Q-value, outcome, targetId, reward, energyDelta, healthDelta, damageDealt, damageReduced를 둔다
- outcome은 실행 결과로만 정한다. `success` / `failed` / `blocked` / `no-target` / `died`
- 교배·구애로 학습을 건너뛴 틱은 이벤트로 기록하지 않는다
- `lastAction` / `lastReward` / `lastStateKey`는 최신 표시용이며 시간순 분석의 원본이 아니다

Q-Table과 학습 파라미터는 렌더링용 월드 상태와 분리된 학습 저장소에 둔다. 모든 프레임 데이터를 무제한 저장하지 않는다.

## 6.7 학습 검증 기준

학습이 실제로 작동하는지 다음 방식으로 검증한다.
1. 동일하거나 통제된 초기 환경을 반복 실행한다.
2. 학습 전/초기 구간과 학습 후 구간을 비교한다.
3. 평균 보상, 먹이 획득률, 생존 시간 등을 측정한다.
4. 랜덤 정책 또는 학습 비활성 정책과 비교할 수 있도록 한다. 학습을 처음부터 끄면 초기 epsilon 1.0이 유지되어 행동이 무작위 정책과 같다. 학습 후 끄면 현재 Q-Table을 고정 정책으로 평가할 수 있다.
5. 개선되지 않으면 그 결과를 그대로 표시하고 보상·상태·행동 설계를 점검한다.

학습 결과가 반드시 개선된다고 가정하거나 차트에 임의의 상승 추세를 만들지 않는다.

## 6.8 향후 알고리즘 확장

- Tabular Q-Learning을 첫 성공 기준으로 한다.
- 상태 공간이 커져 Tabular 방식이 부적절해지는 경우 함수 근사 또는 PPO를 검토한다.
- PPO 도입은 별도 명세 변경 및 성능·학습 검증 후 진행한다.
- 알고리즘을 교체할 수 있도록 공통 AgentPolicy 또는 LearningAlgorithm 인터페이스를 고려한다.

---

# 7. 분석 및 시각화

## 7.1 전체 생태계 통계

- Total Agents
- Alive Agents
- Dead Agents
- Average Energy
- Average Health
- Average Lifespan
- Current Generation 및 현재 세대 경과 시간

## 7.2 학습 통계

Learning 탭에 다음을 표시한다.

- Total Learning Steps
- Average Reward (최근 80 step)
- Average Survival Time (사망 개체 평균 수명)
- Average Energy (생존 개체)
- Exploration Rate (최근 80 step)
- Population Size (생존/전체)
- Reward / Survival / Energy / Learning Steps 차트
- Action Distribution. 누적 횟수와 1초 구간 비율 시계열을 함께 표시한다
- Explore/Exploit 비율, 개체별 행동 분포, 지형별 행동 비율, 도구 보유/미보유 성공률, ATTACK/DEFEND/FLEE 선택과 실제 결과
- Q-Table 진단: 방문 상태 수, 개체당 최대 방문 상태, 저장된 Q 칸 수. 이론 상태 공간은 참고값이다
- 선택된 개체의 Action Timeline. Action, exploration/exploitation, epsilon, outcome, reward, Q, genetic bias를 표시한다
- 학습 초기 30초와 최근 30초 비교. 향상이 없으면 음수 또는 0으로 그대로 표시한다. 행동 비율 비교도 같은 겹치지 않는 구간에만 표시하며, 비율 변화를 생존·자원 획득 향상으로 해석하지 않는다. 가능한 지표는 결정 횟수로 나눈다
- epsilon이 낮아진 사실만으로 학습 성능이 좋아졌다고 표시하지 않는다

각 지표는 단위, 집계 범위, 샘플링 간격을 화면에 명시한다. 데이터가 없으면 Empty State를 표시한다.

## 7.3 에이전트 상세 정보

에이전트를 선택하면 다음을 표시한다.
- ID 및 생존 상태
- 위치 및 방향
- Energy / Hunger / Health
- Age / Speed / Vision
- 최근 행동
- Action Timeline (decisionType, epsilon, outcome, reward, Q, genetic bias)
- 현재 관찰 상태의 행동별 Q-value와 genetic bias, 선택 점수(Q + bias)
- 이동 경로
- Learning Steps / Reward / Epsilon
- 행동 분포 또는 Q-Table 요약
- Genome 정보, 부모 ID, 부모값/자식값/변이 여부, 돌연변이 유전자

선택한 개체가 사망한 경우에도 기록이 남아 있다면 이력은 조회할 수 있다.

## 7.4 이동 및 행동 시각화

- 선택한 에이전트의 최근 이동 경로를 표시한다. 경로 구간은 당시 행동 색을 사용하고, 범례에 행동 글자를 함께 표시한다.
- 시야 범위는 선택된 에이전트에만 표시한다.
- 선택된 에이전트가 시야 안의 먹이를 보면 먹이 탐색 경로(점선)를 표시한다.
- 살아 있는 에이전트의 이동 방향을 화살표로 표시한다.
- 생존 개체의 최근 행동은 색과 글자(F/L/R/E/S)로 함께 표시한다.
- 선택된 개체의 최근 행동 이름은 상태 라벨 옆에 명확히 표시한다. 이 텍스트는 `useFrame`으로만 갱신한다.
- 사망 개체는 쓰러진 자세, 회색 재질, Dead 라벨로 생존 개체와 구분한다.
- 경로 및 행동 이력에는 최대 길이 또는 시간 제한을 둔다.
- 이동 경로는 에이전트별로 최근 80개 지점만 유지한다. 직전 지점과의 거리가 0.08 월드 단위 미만이면 새 샘플을 추가하지 않는다.
- 좌측 설정에서 이동 경로, 시야 범위, 먹이 탐색 경로, 행동 표시, 행동 대상 표시를 켜고 끌 수 있다.
- 공격·방어·도주·채집·도구 습득은 글자뿐 아니라 서로 다른 표식과 대상 선으로 구분한다. 고속(>20x)에서는 선택 개체의 대상만 그린다.
- 시각화가 시뮬레이션 계산에 과도한 부하를 주지 않도록 샘플링한다.

## 7.5 차트 원칙

- 실제 측정 데이터만 표시한다.
- 데이터가 없으면 Empty State를 표시한다.
- 학습 성능 개선을 임의로 보간하거나 만들어내지 않는다.
- 평균값을 표시할 경우 모집단 범위와 계산 방식을 명시한다.
- 세대가 바뀌어도 이전 세대 통계가 사라지지 않도록 별도 기록한다.

---

# 8. 진화 시스템

## 8.1 구현 범위

진화 기능은 강화학습과 별도의 시스템으로 관리한다. 학습된 행동 전략과 유전 특성을 동일한 개념으로 취급하지 않는다.

## 8.2 세대 모델

현재 구현은 **실시간 교배와 overlapping generations**를 사용한다.
- 좌측 설정의 유전 토글로 진화 파이프라인을 잠시 끌 수 있다. 새 세션 기본은 Off다. Off면 교배·짝 찾기·유전 bias·노화 사망을 하지 않고, 새 개체는 동일 기본 Genome으로 시작한다. 학습과 환경 규칙은 그대로다. 옛 실험 기록에 필드가 없으면 On으로 복원한다.
- 부모는 시간 제한으로 일괄 교체되지 않는다. 살아 있는 동안 수명이 다하거나 체력이 0이 될 때까지 남는다.
- 성욕(`desire`)이 임계값(70) 이상이고 나이 ≥ 16초, 에너지 ≥ 28인 생존 개체가 시야 안의 상대를 찾아 다가간다.
- 두 후보가 교배 거리(1.7) 안에 있으면 2.4초 동안 교배한다. 그동안 둘 다 이동하지 않고 추가로 에너지를 소모하며, 3D UI에 하트를 표시한다.
- 교배가 끝나면 둘의 성욕은 충족되어 낮아진다(8). 생존 수가 Population Limit 미만이면 자식 1마리가 부모 근처에 태어난다.
- 자식 세대는 `max(부모 세대) + 1`이다. 월드 세대는 현재까지 태어난 최고 세대다.
- 전멸하면 다음 자식을 만들지 않고 시뮬레이션을 `ended`로 종료한다.

## 8.3 부모 선택 및 번식

- 실시간 교배는 가까이 있고 성욕이 찬 두 생존 개체가 부모가 된다. 죽은 개체, 미성숙 개체, 에너지가 부족한 개체는 교배하지 않는다.
- 자식 Genome은 유전자별 uniform crossover(각 유전자를 부모 중 하나에서 복사)로 만든다.
- 자식 수는 Population Limit을 초과하지 않는다. 한도가 가득해도 교배는 성욕을 충족시키지만 자식은 태어나지 않는다.
- 자식의 에너지·허기·체력·나이·성욕은 새로 뽑으며 부모 생존 상태를 이어받지 않는다.
- fitness = `age × 1.0 + max(0, totalReward) × 0.2 + energy × 0.5`는 Q-Table 상속 시 어느 부모를 복사할지 고를 때만 쓴다.

## 8.4 Mutation

- 유전자별 돌연변이 확률은 기본 0.15다.
- 돌연변이는 해당 유전자 범위의 ±18%를 더한 뒤 clamp한다.
- 개체 상세에서 어떤 유전자가 태어날 때 변이했는지 표시한다. 자식은 부모 Genome 스냅샷을 가지고 부모값·자식값·변이 여부를 같이 보여 준다.
- 돌연변이가 항상 유리하다고 가정하지 않는다.

## 8.5 Learning Inheritance

- 기본값은 자식이 새로운 Q-Table로 학습을 시작하는 것이다.
- 좌측 설정에서 유전 활성화와 Q-Table 상속을 바꿀 수 있다. 상속을 켜면 두 부모 중 fitness가 높은 쪽의 Q-Table 복사본을 받는다.
- 상속해도 학습 스텝·보상·epsilon은 이어받지 않는다. 자식 epsilon은 Genome Exploration Rate로 시작한다.
- Q-Table 상속은 유전 정보 전달과 분리된 설정으로 관리한다.
- Q-Table의 상태 인코딩이나 행동 공간 버전이 다르면 상속을 거부하거나 명시적인 변환 절차를 사용한다. 현재는 동일 인코딩만 사용한다.

## 8.6 세대 통계

다음 세대가 처음 태어날 때 이전 세대를 기록한다. 전멸하면 현재 세대를 기록한다. 진행 중 세대의 평균은 화면에만 보여 주고 기록에 섞지 않는다.

세대별로 다음을 기록한다.
- Population Size
- Survival Rate (기록 시점 생존 수 / 해당 세대 개체 수)
- Average Lifespan (해당 세대 모든 개체의 age 평균)
- Average Reward (학습 스텝이 있는 개체의 `totalReward / totalSteps` 평균)
- Average Speed / Vision / Energy Efficiency / Learning Rate / Exploration Rate
- Average Strength / Aggression / Caution / Tool Affinity. 옛 기록에 없으면 미기록(`null`)이며 추정하지 않는다
- Mutation Summary (태어날 때 변이한 개체·유전자 수)
- End Reason (`birth` 또는 `extinction`)

Evolution 탭에서 세대 번호 축으로 평균 생존 시간, Speed, Vision, Energy Efficiency, Reward, Population Size를 비교한다. 값이 나빠도 그대로 표시한다.

진화가 반드시 지능 또는 생존 능력의 향상을 의미하지 않는다는 점을 UI에서도 왜곡 없이 표현한다.

---

# 9. 실험 설정 및 데이터 저장

## 9.1 World Configuration

사용자가 설정할 항목:
- World Size
- Initial Population
- Initial Food Count
- Food Regeneration Rate
- Obstacle Density
- Resource Distribution
- Terrain Mix preset (Balanced / Forest / Rocky / Wetland / Lakes)
- World Seed
- Maximum Population
- Simulation Speed

## 9.2 Learning Configuration

좌측 설정에서 사용자가 바꾸는 항목:
- Learning Enabled/Disabled
- Genetics Enabled/Disabled (새 세션 기본 Off. 학습 관찰용 일시 토글)
- Learning Rate
- Discount Factor
- Initial Epsilon
- Minimum Epsilon
- Epsilon Decay
- Reward Configuration

잘못된 범위의 입력은 저장 또는 적용 전에 검증하고 사용자에게 안내한다. Minimum Epsilon은 Initial Epsilon보다 클 수 없다.

## 9.3 Experiment Record

각 실험은 다음을 가진다.
- Experiment ID
- Experiment Name
- Created At / Updated At
- App/Schema Version (현재 4)
- actionSchemaVersion / observationSchemaVersion (현재 3 / 4)
- World Configuration
- Learning Configuration
- Current Simulation Time
- Current Generation
- Current World State
- Agent States
- Q-Tables 및 학습 상태
- Genome 및 진화 상태
- Statistics History

## 9.4 Persistence

- IndexedDB를 사용한다.
- LocalStorage는 가벼운 UI 환경설정 등 작은 데이터에만 사용한다.
- 저장 데이터는 schemaVersion을 포함한다.
- 불러오기 전에 데이터 구조와 값의 유효성을 검사한다.
- 저장 중 오류가 발생하면 사용자에게 명확히 알린다.
- 저장 데이터 크기를 고려해 통계 이력과 이동 경로의 보존 정책을 둔다.

## 9.5 Experiment 기능

- New Experiment
- Save Experiment
- Load Experiment
- Delete Experiment
- Export Experiment JSON
- Import Experiment JSON
- Compare Experiments

JSON 가져오기는 파일 크기, 버전, 필수 필드 및 값 범위를 검증한다. 임의의 파일을 신뢰하지 않는다.

---

# 10. 비기능 요구사항

## 10.1 성능

- 초기 목표는 20개 에이전트에서 부드럽게 동작하는 것이다.
- 구조가 안정된 뒤 50~100개 에이전트까지 확장 테스트한다.
- 인스턴스 렌더링(InstancedMesh)은 다수의 동일 오브젝트가 병목이 될 때 적용한다.
- 학습 및 시뮬레이션 계산이 렌더링을 막는지 프로파일링한다.
- 실제 병목이 확인되면 Web Worker로 계산을 분리한다.
- 시뮬레이션 속도를 높일수록 렌더링 프레임과 계산 횟수가 무조건 동일 비율로 증가하지 않도록 설계한다.

## 10.2 안정성

- NaN, Infinity, undefined 상태가 시뮬레이션에 유입되지 않도록 한다.
- 에너지, 허기, 체력 및 유전자 값의 범위를 검증한다.
- 사망한 개체는 행동하지 않는다.
- 월드 경계와 충돌 규칙을 일관되게 적용한다.
- Reset 후 이전 실험의 데이터가 새 실험에 섞이지 않는다.
- 저장 및 복원 전후 핵심 상태가 일치하는지 테스트한다.

## 10.3 접근성 및 사용성

- 핵심 컨트롤은 명확한 텍스트 라벨과 툴팁을 제공한다.
- 색상만으로 상태를 표현하지 않는다.
- 작은 화면에서 3D 뷰와 패널이 겹치지 않도록 기본 대응을 한다.
- 장시간 실행 중 현재 실행 상태와 시뮬레이션 속도를 쉽게 확인할 수 있어야 한다.

## 10.4 개인정보 및 네트워크

초기 버전은 로컬 브라우저 중심으로 동작하며 사용자 계정이나 개인 데이터 수집을 요구하지 않는다. 외부 API 또는 서버가 필요해지면 별도 명세를 추가한다.

---

# 11. 단계별 구현 계획 및 완료 조건

각 단계는 실행 가능한 상태를 유지해야 한다. 다음 단계로 넘어가기 전에 해당 단계의 완료 조건을 확인한다.

| 단계 | 제목 | 핵심 산출물 | 상태 |
|---|---|---|---|
| 1 | Project Foundation & 3D World | 앱 골격, 3D 지형, 카메라, 기본 UI | Done |
| 2 | Agents & Ecosystem | 에이전트, 먹이, 이동, 에너지, 사망 | Done |
| 3 | Controls & Inspection | Play/Pause/Reset, 속도, 선택, 상세 패널 | Done |
| 4 | Reinforcement Learning | Observation, Action, Q-Learning, Reward | Done |
| 5 | Learning Analytics | 학습 지표, 차트, 경로 및 행동 시각화 | Done |
| 6 | Evolution | Genome, 선택, 번식, 돌연변이, 세대 기록 | Done |
| 7 | Sandbox & Persistence | 환경 설정, IndexedDB, JSON 입출력, 실험 비교 | Done |
| 8 | Optimization & Release | 테스트, 성능, 안정성, 문서, 빌드 | Done |
| 9 | Action Timeline & Schema Contract | 선택·실행 이벤트, Action 시계열, 스키마 버전 필드 | Done |
| 10 | Terrain | 지형 격자, 이동·시야·자원 효과, current/ahead terrain 관찰 | Done |
| 11 | Tools & Gathering | Basket, Digging Stick, 단일 장비 슬롯, PICK_UP/GATHER, 채집 노드 | Done |
| 12 | Combat & Defense | Spear, Shield, ATTACK/DEFEND/FLEE, 개체 탐지 관찰 | Done |
| 13 | Extended Genome Traits | Strength, Aggression, Caution, Tool Affinity | Done |
| 14 | Persistence & Learning Integration | 마이그레이션 UI, 새 통계, Q/진화 연결 점검 | Done |

상태는 `Not Started`, `In Progress`, `Blocked`, `Done` 중 하나를 사용한다. 완료 조건을 실제로 검증하기 전에는 `Done`으로 변경하지 않는다.

## STEP 1 — Project Foundation & 3D World

- React + TypeScript + Vite 프로젝트 기반 구성
- Three.js + React Three Fiber 연결
- 중앙 3D World Viewer
- 평면 지형 및 격자 패턴
- 기본 먹이/나무/바위 오브젝트 표현을 위한 구조
- 3/4 Top-down 카메라, 회전·확대·축소, 선택 개체 추적
- 좌측 설정, World/Simulation/Learning/Evolution/Experiments 탭, 하단 컨트롤 레이아웃

**완료 조건**
- `npm run dev` 실행 성공
- 3D 지형 표시
- 카메라 조작 가능
- UI 레이아웃 정상 표시
- TypeScript 검사 및 빌드 오류 없음

## STEP 2 — Agents & Ecosystem

- 초기 에이전트는 기본 20개이며, 설정에서 1–50개로 조절한다.
- 단순 캡슐 또는 로우폴리 인간형 모델
- 개체별 독립 상태 및 이동
- 먹이 생성 및 섭취
- 허기·에너지·체력·나이 업데이트
- 사망 처리
- 월드 경계 및 단순 장애물 충돌
- 전체 생태계 통계

**완료 조건**
- 개체들이 독립적으로 움직임
- 먹이를 실제로 섭취하고 에너지가 회복됨
- 에너지/허기 조건에 따라 체력이 변하고 사망 가능
- 통계가 실제 시뮬레이션 결과를 반영함
- 프레임률에 따라 생존 규칙이 달라지지 않음

## STEP 3 — Controls & Inspection

- Play / Pause / Reset
- 전멸 시 `ended` 상태와 월드 위 종료 오버레이. Play는 막고 Reset으로 다시 시작한다.
- 1–100,000,000 로그 속도 슬라이더. 고속은 프레임 시간 예산과 스텝 상한으로 실제 진행이 배율보다 느릴 수 있다.
- Simulation Time 표시
- 개체 클릭 및 선택 표시
- 상세 상태 패널
- 이동 방향, 시야 범위, 최근 이동 경로

**완료 조건**
- 컨트롤이 시뮬레이션에 정확히 반영됨
- 선택된 에이전트의 정보가 실시간으로 갱신됨
- Reset 시 월드 및 모든 관련 상태가 초기화됨
- 이동 경로 데이터가 무제한 누적되지 않음

## STEP 4 — Reinforcement Learning

- Observation 설계 및 상태 인코딩
- 5개 기본 행동 연결
- 에이전트별 Q-Table
- Epsilon-Greedy
- Q-Learning 업데이트
- 실제 결과 기반 Reward 계산
- 학습 on/off 및 핵심 지표

구현 위치: `src/learning/` (관찰, 보상, Q-Learning, 학습 저장소), `src/simulation/agentSystem.ts` (행동 실행), 설정/통계 UI.

**완료 조건**
- Q-Table이 실제 경험에 따라 갱신됨
- 학습 off 시 학습 상태가 변경되지 않음
- 실제 행동 결과가 보상에 반영됨
- 통제 실험에서 학습 전후 성능을 비교할 수 있음
- 랜덤 정책과 비교 가능하거나 비교 방법이 문서화됨

## STEP 5 — Learning Analytics

- 학습 및 생존 지표 집계
- Reward, Survival, Energy 등 차트
- 개체별 Q-Table 요약 및 Action Distribution
- 이동 경로 및 행동 시각화
- 초기/후기 구간 비교

**완료 조건**
- 차트가 실제 저장된 통계에 연결됨
- 데이터가 없으면 Empty State 표시
- 평균 및 window 계산 방식이 명시됨
- 학습 향상을 임의로 표현하지 않음

## STEP 6 — Evolution

- Genome 도입 (`src/evolution/`)
- 성욕·수명 유전자와 실시간 교배
- 유전 정보 조합
- 돌연변이
- 자식 탄생 시 세대 기록
- Q-Table 상속 옵션(기본 비활성)
- Evolution 탭 세대 비교 차트

**완료 조건**
- 부모 유전 정보가 자식에게 전달됨
- 돌연변이 확률 및 범위가 적용됨
- Population Limit 준수
- 세대별 통계가 유지됨
- 유전 정보와 학습된 Q-Table이 분리됨

## STEP 7 — Sandbox & Persistence

- 월드/학습 설정 UI
- 설정 유효성 검사
- IndexedDB 저장
- 실험 생성·저장·불러오기·삭제
- JSON 내보내기·가져오기
- 실험 간 통계 비교

**완료 조건**
- 브라우저 새로고침 후 저장된 실험 복원
- 복원 전후 핵심 상태 일치
- 잘못된 JSON 파일 거부 및 오류 안내
- 실험 간 통계 비교 가능

## STEP 8 — Optimization & Release

- 렌더링 및 시뮬레이션 성능 점검
- 필요시 InstancedMesh / Web Worker 적용
- 수치 범위 및 예외 처리
- 핵심 도메인 단위 테스트
- 사용자 흐름 테스트
- README 및 실행 문서
- 최종 프로덕션 빌드

**완료 조건**
- `npm run build` 성공
- TypeScript 오류 없음
- 핵심 테스트 통과
- 주요 사용자 흐름 정상 작동
- 성능 측정 및 알려진 제한 사항 문서화

---

# 12. 테스트 전략

## 12.1 도메인 단위 테스트

최소한 다음 로직을 독립적으로 테스트한다.
- Agent movement 및 world boundary
- Food consumption
- Energy / Hunger / Health update
- Death condition
- Observation encoding
- Epsilon-Greedy action selection
- Q-Learning update
- Reward calculation
- Action decision/outcome event linking
- schemaVersion 1 action/observation field migration
- Reproduction 및 genome crossover
- Mutation range
- Save / Load serialization

## 12.2 통합 테스트

- 시뮬레이션 시작부터 먹이 섭취까지
- 에너지 고갈부터 사망까지
- 학습 활성화 전후 Q-Table 변화
- Reset 이후 초기 상태 일치
- 실험 저장 후 재불러오기
- 실시간 교배 및 자식 탄생

## 12.3 재현성

가능한 경우 난수 생성기를 주입하거나 Seed를 설정할 수 있도록 설계한다. 동일한 seed와 설정으로 실험을 재실행했을 때 결과가 완전히 같아야 한다고 무조건 보장하지는 않지만, 디버깅과 비교를 위해 난수 제어 수단을 제공하는 방향을 권장한다.

---

# 13. 알려진 설계상 주의점 및 향후 결정

다음 항목은 초기 구현 과정에서 관찰 및 검증한 뒤 확정한다. 임의로 복잡한 기능을 먼저 추가하지 않는다.

| 항목 | 초기 결정 | 재검토 조건 |
|---|---|---|
| 에이전트 외형 | 캡슐/로우폴리 인간형 | 기본 시뮬레이션 안정화 후 |
| 학습 알고리즘 | Tabular Q-Learning. 이론 공간 1.701e8이지만 희소 저장. PPO 미도입 | 개체당 방문 상태가 수천을 넘고 학습이 수렴하지 않을 때 |
| 학습 실행 위치 | 초기 브라우저 메인 스레드 | 프로파일링에서 병목 확인 시 Worker 검토 |
| 세대 모델 | 실시간 교배 overlapping generations | 성능 또는 통계 모델이 한계에 달할 때 |
| Q-Table 상속 | 기본 비활성 | 독립 학습과 상속 학습의 실험 비교 후 |
| 물리 엔진 | 단순 자체 충돌 로직 | 복잡한 물리 상호작용이 필요해질 때 |
| 저장 | IndexedDB | 서버 동기화가 필요해질 때 |
| 초기 규모 | 20 Agents | 성능 테스트 후 점진 확대 |

---

# 14. Cursor 작업 규칙 — 반드시 준수

이 문서는 Cursor가 프로젝트를 수정할 때 참조하는 **단일 기준 명세(Source of Truth)**다.

## 14.1 작업 시작 전

모든 기능 구현 또는 수정 작업 전에 다음을 수행한다.
1. 프로젝트 루트에서 `ARTIFICIAL_LIFE_SPEC.md`를 읽는다.
2. 현재 코드 구조와 관련 구현을 확인한다.
3. 요청한 변경 사항이 기존 명세와 일치하는지 확인한다.
4. 명세에 없는 요구사항이거나 기존 규칙과 충돌하면, 충돌 내용을 먼저 요약하고 합리적인 최소 변경안을 제시한다. 사용자가 명확히 변경을 요청했다면 해당 방향으로 명세를 갱신한다.

## 14.2 구현 중

- 기존 동작을 분석하지 않고 대규모 리팩터링하지 않는다.
- 요청하지 않은 기능을 임의로 확장하지 않는다.
- 기존 기능을 깨뜨리지 않도록 변경 범위를 최소화한다.
- 도메인 로직, 렌더링, UI 상태를 분리한다.
- 실제 동작하지 않는 목업 통계나 학습 효과를 만들지 않는다.
- 임시 구현은 `TODO` 또는 명확한 주석으로 표시한다.
- 의존성을 추가하기 전 현재 설치된 패키지와 대체 가능성을 확인한다.
- 동작·데이터 구조 변경 시 기존 저장 데이터와의 호환성을 검토한다.

## 14.3 구현 후

1. 변경된 파일과 핵심 동작을 요약한다.
2. 가능한 테스트, 타입 검사, 빌드를 실행한다.
3. 실행하지 못한 검증은 성공했다고 표현하지 않는다.
4. 명세와 구현이 달라진 부분을 확인한다.
5. 요구사항 또는 구현 결정이 변경되었다면 이 파일을 함께 수정한다.
6. 변경 이력과 단계별 상태를 갱신한다.
7. 미완료 항목, 제한 사항 및 다음 작업을 명시한다.

## 14.4 명세 수정 원칙

- 사용자가 명시적으로 바꾸라고 한 내용은 명세에 반영한다.
- 구현 편의를 위해 요구사항을 임의로 삭제하거나 축소하지 않는다.
- 기술적 이유로 기존 명세를 지키기 어렵다면 이유와 대안을 명세에 기록한다.
- 완료된 요구사항도 삭제하지 않고, 변경 이력 또는 대체 요구사항으로 추적 가능하게 한다.
- 새 요구사항은 적절한 섹션에 추가하고 관련 단계의 완료 조건도 갱신한다.
- 문서 안의 기술 스택, 데이터 모델, 단계별 계획이 서로 모순되지 않는지 확인한다.

## 14.5 Cursor 요청 시 기본 작업 절차

사용자가 자연어로 기능을 요청하면 다음 순서로 처리한다.

```text
1. Read ARTIFICIAL_LIFE_SPEC.md
2. Inspect current implementation
3. Identify affected requirements and files
4. Implement the smallest coherent change
5. Run relevant tests and build checks
6. Update ARTIFICIAL_LIFE_SPEC.md if requirements or decisions changed
7. Report implementation, validation, spec changes, and remaining issues
```

## 14.6 단계 완료 처리

- 해당 단계의 모든 완료 조건을 검증한 뒤에만 상태를 `Done`으로 변경한다.
- 일부만 구현되었다면 `In Progress`로 유지하고 남은 조건을 기록한다.
- 테스트가 실패하면 실패 원인과 미해결 항목을 기록한다.
- Cursor는 사용자가 요청하지 않은 다음 단계를 자동으로 구현하지 않는다.

---

# 15. Cursor에 전달할 공통 작업 지시문

아래 지시문은 새 기능을 요청할 때 함께 붙여넣거나 Cursor 프로젝트 규칙 파일에 옮겨 사용할 수 있다.

```text
프로젝트 루트의 ARTIFICIAL_LIFE_SPEC.md를 반드시 먼저 읽어라.
이 파일은 프로젝트의 단일 기준 명세(Source of Truth)다.

작업 전 현재 코드 구조와 기존 구현을 확인하고, 명세의 관련 요구사항 및 완료 조건을 파악하라.
기존 기능을 불필요하게 재작성하지 말고 요청한 변경을 최소 범위로 구현하라.
시뮬레이션 로직, 학습 로직, 3D 렌더링, UI를 분리하라.
실제로 계산되지 않은 학습 결과나 통계를 하드코딩하지 마라.

작업 후 관련 테스트, TypeScript 검사 및 빌드를 실행하라.
실행하지 못한 검증은 성공했다고 말하지 마라.
요구사항이나 기술 결정이 변경되었다면 ARTIFICIAL_LIFE_SPEC.md도 함께 수정하고 변경 이력을 갱신하라.
단계의 모든 완료 조건을 검증하기 전에는 해당 단계를 Done으로 표시하지 마라.

최종 보고에는 다음을 포함하라.
1. 구현 내용
2. 변경된 파일
3. 실행한 검증과 결과
4. 명세서 변경 사항
5. 미완료 항목 및 알려진 문제
```

---

# 16. 현재 개발 상태

| 항목 | 상태 | 메모 |
|---|---|---|
| 프로젝트 초기 저장소 | Done | Vite + React + TypeScript 프로젝트 |
| STEP 1 — 3D World | Done | 3D 지형, 카메라, 기본 레이아웃 |
| STEP 2 — Agents & Ecosystem | Done | 기본 20개체(1–50 조절), 먹이, 생존 규칙, 통계 |
| STEP 3 — Controls & Inspection | Done | Play/Pause/Reset, 1–100,000,000 로그 슬라이더, 선택, 시야/경로/방향 |
| STEP 4 — Reinforcement Learning | Done | Tabular Q-Learning, 에이전트별 Q-Table, Epsilon-Greedy, 보상 모듈, 학습 on/off |
| STEP 5 — Learning Analytics | Done | 대시보드, 차트, 개체 검사, 3D 행동 시각화, 초기/현재 비교 |
| STEP 6 — Evolution | Done | Genome, 실시간 교배, 성욕/수명, 돌연변이, 세대 차트, Q-Table 상속(기본 꺼짐) |
| STEP 7 — Persistence | Done | 월드/학습 설정, IndexedDB, JSON, 실험 비교 |
| STEP 8 — Optimization & Release | Done | Vitest, NaN 가드, 렌더/통계 분리, README |
| STEP 9 — Action Timeline & Schema Contract | Done | 선택·실행 이벤트, Action 시계열, 스키마 버전, v1 마이그레이션 패스스루 |
| STEP 10 — Terrain | Done | 시드 패치 지형, 이동/에너지/시야/은신, Observation v2, schemaVersion 2 |
| STEP 11 — Tools & Gathering | Done | 베리/뿌리 채집, Basket/Digging Stick, 내구도, Action Mask, Observation v3, schemaVersion 3 |
| STEP 12 — Combat & Defense | Done | Spear/Shield, ATTACK/DEFEND/FLEE, Observation v4, schemaVersion 4 |
| STEP 13 — Extended Genome Traits | Done | Strength/Aggression/Caution/ToolAffinity, 정책 bias, 세대 평균, 저장 기본값 |
| STEP 14 — Persistence & Learning Integration | Done | 스키마 호환, Q 진단, Action 분석, Seed/정책 비교, 3D 행동 대상 |

**현재 다음 작업:** 출고 이후 성능 관찰은 유지한다. 방문 상태가 개체당 수천을 넘고 학습이 수렴하지 않는다는 측정이 나오기 전에는 PPO로 바꾸지 않는다. 50개체 이상에서 병목이 측정되면 InstancedMesh 또는 Worker를 재검토한다.

**STEP 14 구현 메모**
- `actionSchemaVersion` 3, `observationSchemaVersion` 4를 ExperimentRecord와 각 SerializedBrain에 기록한다. 키 토큰 수와 행 길이가 버전과 맞는지 검사한다.
- Action만 뒤에 추가된 데이터는 행을 0으로 패딩하고 `qTableStatus = 'padded'`다. Observation 토큰이 바뀌거나 키가 유효하지 않으면 Q-Table만 초기화한다. `totalSteps` / `totalReward` / 기존 actionCounts는 남긴다. epsilon은 Genome Exploration Rate로 되돌린다.
- 조용한 삭제는 없다. `qTableResetReason`과 migration 배너를 세션 복원·불러오기·JSON import에 보여 준다.
- 희소 `Map`만 유지한다. 이론 상태 공간 170,100,000은 참고값이다. 커버리지로 학습 완료를 주장하지 않는다.
- Action Mask는 선택과 `max_a' Q(s', a')`와 선택 당시 보상 업데이트에 적용한다. 마스크된 Action은 Q를 갱신하지 않는다.
- 1초 구간 analytics는 결정 수 기준으로 Explore/Exploit, 지형별 비율, 도구 성공, 전투 결과를 남긴다. 이벤트 링 버퍼는 저장하지 않는다.
- 실험 비교는 기존 지표를 유지하고 Food/Resource/Tool Success/Damage/Combat/Reproduction/Visited States를 더한다. Seed나 설정이 다르면 동등한 실험이라고 쓰지 않는다. 같은 Seed에서 정책만 다르면 정책 비교로 표시한다. 환경·학습 설정이 같고 Seed만 다르면 선택 집합의 평균±편차를 보여 준다.
- 학습 Off + 빈 Q-Table은 random-like, 학습 Off + 방문 상태 있음은 Frozen Q, 학습 On은 Learning이다. 한 번의 결과는 일반적 학습 성공으로 표시하지 않는다.
- 3D는 행동 글자 모양을 구분하고, 선택 개체에 Action과 Target을 표시한다. `showActionCues` 토글이 있으며 속도 > 20이면 선택 개체만 대상 선을 그린다.
- Q 상속은 부모 brain의 action/observation 버전이 현재와 같을 때만 복사한다.

**STEP 13 구현 메모**
- 새 유전자 범위는 기존 배율 유전자처럼 1.0을 중립으로 둔다. Strength 0.60–1.40, Aggression/Caution 0.40–1.60, ToolAffinity 0.60–1.40. 빠진 필드 기본값은 1.00이다.
- `crossoverGenomes`, `clampGenome`, `createRandomGenome`, `averageGenomes`는 `GENOME_GENES`를 순회한다.
- Strength는 `rawAttackDamage`에 곱한다. ToolAffinity는 도구 사용 회복과 내구도 소모(`1 / affinity`, 0.5–2.0 clamp)에 쓴다.
- Aggression/Caution은 `geneticActionBias`로 선택 점수에만 더한다. Q-Table 갱신과 탐험 가중치는 그대로다. bias 상한은 ±0.25다.
- 자식은 `parentGenomes` 스냅샷을 저장한다. Q-Table 상속 옵션은 그대로 분리한다.
- 옛 세대 기록의 Strength/Aggression/Caution/ToolAffinity 평균은 `null`로 두고 차트/표에서 `—`로 표시한다. 과거 통계를 만들지 않는다.

**STEP 12 구현 메모**
- 기본 공격 사거리 2.0, 창 2.8. 기본 피해 10, 창 배율 1.45. 피해는 Genome Strength를 곱한다. 기본값 1.0은 기존과 같다.
- DEFEND는 0.6초. 기본 방어 계수 0.72, 방패 0.4. 같은 틱의 방어는 계수를 중첩하지 않는다.
- 엔진은 먼저 모든 개체의 이동·채집·방어·도주 의도를 적용한 뒤 공격을 한 번씩 해석한다.
- 사망 시 장비는 새 WorldTool로 한 번만 떨어진다. 이미 사망한 개체를 다시 처리할 때는 떨어뜨리지 않는다.

**STEP 11 구현 메모**
- FoodResource 자동 섭취는 그대로다. 채집 자원은 `forageNodes`로 분리한다. 같은 틱에 먹이를 먹고 채집하면 서로 다른 사건이며 같은 자원에 보상을 중복하지 않는다.
- BERRY_BUSH는 도구 없이 1단위 채집. Basket이 있으면 2단위와 추가 허기 감소. ROOT_PATCH는 사용 가능한 Digging Stick이 있어야 채집된다.
- 도구는 월드 오브젝트다. PICK_UP은 빈 슬롯에만 허용되고 월드 도구를 제거한다. 슬롯은 1개다. DROP, 제작, 조합, 무기는 없다.
- 성공한 채집에서 해당 도구 내구도가 1 줄어든다. 0이면 장비가 제거되어 더 이상 쓸 수 없다.
- Action v2: 기존 5개 뒤에 `PICK_UP`, `GATHER`. Mask는 대상/조건이 없으면 EAT/PICK_UP/GATHER를 후보에서 뺀다.
- Observation v4 키: 기존 10토큰 뒤에 `agentDirection|agentDistance|health`. nearbyTool 5값, heldTool 9값. 이론 상태 공간 170,100,000. Q 칸 1,701,000,000. 희소 `Map`만 사용한다.
- 채집 보상은 실제 획득량 × `gatherUnit`(기본 2.5)이다. 성공 여부만으로 eatSuccess급 보상을 주지 않는다.
- 자원 재생성은 기존 Food spawn과 분리된 `forageRegenRate`다. 고갈된 노드의 수량을 회복한다.
- schemaVersion 3. v1/v2 로드는 채집/도구를 시드하고 Observation이 바뀌므로 Q-Table만 초기화한다. 월드/Genome/통계는 유지한다.

**STEP 10 구현 메모**
- 지형 격자는 `cellSize = 2`, 셀 수 = 월드 크기 / 2다. 생성은 외부 노이즈 라이브러리 없이 `mulberry32`와 군집 패치 성장이다. 같은 seed+preset+size면 같은 배치가 나온다. 지형 RNG는 오브젝트/개체 RNG와 분리한다.
- 수치는 게임 밸런스 파라미터다. Grassland 1/1/1, Forest 0.85/1.1/0.7, Rocky 0.7/1.25/1.0, Wetland 0.65/1.2/0.9, Water 이동 0·통과 불가.
- 나무/바위는 계속 원형 장애물이다. 숲은 나무 스폰 가중을 높이고, 바위 지형은 돌 가중을 높인다. 습지는 먹이 가중과 별도 샘플을 쓴다. 물에는 개체를 스폰하지 않는다.
- Observation v2 키: `energy|hunger|foodDirection|foodDistance|obstacleAhead|terrain|terrainAhead`. 이론 9,000 상태, Q 칸 45,000. 희소 `Map`만 사용한다. 지형 진입 보상은 없다. 물 충돌은 기존 collision 보상 경로를 쓴다.
- 3D는 생성 시 한 번 albedo 질감과 높이로 칠한 단일 Plane이다. 셀별 Mesh와 풀 잎 InstancedMesh는 만들지 않는다. Grassland/Forest 색을 초원/낙엽 바닥으로 나눈다. World 뷰어에 범례를 두고, 설정에는 Terrain Mix와 Seed만 추가한다.
- schemaVersion 2. v1 로드는 시드로 지형을 만들고, Observation이 바뀌므로 Q-Table만 초기화한다. 월드/Genome/통계는 유지한다. 저장된 셀과 seed 재생성 결과가 다르면 저장된 셀을 쓰고 경고한다.

**STEP 9 구현 메모**
- 정책이 행동을 고른 뒤에야 `ActionDecisionEvent`를 만들고, 실행·보상 계산 후에 같은 `eventId`로 outcome을 채운다. 보상은 추정하지 않는다.
- 이벤트는 brains와 같이 React 밖 링 버퍼에 둔다. 개체당 최근 80개, 전체 최근 400개. 저장하지 않으며 Reset/Load 때 비운다.
- 고속 `advance`에서는 상세 이벤트만 샘플링한다. 1초 구간 `actionCounts`는 모든 정책 선택을 센다.
- `learningHistory` 샘플의 `actionCounts`는 그 1초 구간의 횟수다. 누적 합과 구분한다. 차트는 횟수와 비율을 함께 보여 주고, 없으면 Empty State다.
- 초기/최근 행동 비교는 겹치지 않는 30초 구간에서만 한다. 비율 변화를 생존·자원 획득 향상으로 쓰지 않는다. epsilon 감소만으로 학습이 좋아졌다고 표시하지 않는다.
- ExperimentRecord와 SerializedBrain에 `actionSchemaVersion` / `observationSchemaVersion`(현재 1)을 기록한다. 없는 v1 기록은 필드를 채우고 Q-Table은 유지한다. 360/5 검증은 v1에만 적용한다.
- 3D는 기존 행동 글자/경로 색을 유지하고, 선택 개체의 행동 이름은 `useFrame`으로만 갱신한다.

**STEP 8 구현 메모**
- 수치 가드: `clamp`/`wrapAngle`/`updateQValue`는 NaN을 통과시키지 않는다. 저장 복원 시 월드와 Q 행을 한 번 더 정리한다.
- 3D: 에이전트/오브젝트 메시는 ID로 유지하고 위치·회전은 `useFrame`에서 읽는다. 레이아웃은 선택 ID만 구독해서 Canvas 전체가 매 틱 다시 그려지지 않게 한다.
- 통계 UI는 약 150ms마다 갱신한다. 학습 이력 샘플(1초, 180개)은 그대로다.
- InstancedMesh는 개체 외형·선택·행동 표시가 달라 적용하지 않았다. Web Worker는 메인 스레드 프레임 예산으로 충분해 도입하지 않았다.
- 세션 복원 전에는 Play를 막고 로딩 오버레이를 보여 준다. 복원 실패는 오류 안내 후 새 실험으로 시작한다.
- 핵심 도메인 테스트는 Vitest다. `runChecks.ts` 스크립트는 수동 검증용으로 남겨 둔다.

**STEP 7 구현 메모**
- 월드 설정: Size(32/48/64/80), Initial Population, Initial Food Count, Food Regen Rate, Obstacle Density, Resource Distribution(uniform/clustered/edge). Speed는 하단 컨트롤과 실험 기록에 저장한다.
- 시작 전(idle, tick 0) 구조 설정 변경은 월드를 다시 만든다. 실행 중 변경은 Reset 때 적용한다. Food Regen Rate는 즉시 적용한다.
- 학습 설정과 보상은 좌측 패널에서 편집한다. 범위 밖 값은 적용하지 않는다. Learning Rate/Initial Epsilon은 새 개체 Genome 기본값이다.
- 실험 기록 schemaVersion은 1이다. IndexedDB에 이름 있는 실험과 현재 세션을 저장한다. 실행 중 15초마다, Pause/Ended, 페이지 숨김 때 세션을 저장한다. 새로고침 후 세션을 복원한다. 실행 중이었다면 paused로 재개한다.
- JSON 가져오기는 버전, 필수 필드, 수치 범위를 검사하고 잘못된 파일은 거부한다. 이동 경로는 저장하지 않고 불러온 뒤 다시 만든다.
- Experiments 탭에서 저장·불러오기·삭제·내보내기·가져오기와 실험 간 Survival/Reward/Lifespan/Generation/Genome 평균을 비교한다.

**STEP 6 구현 메모**
- 세대 모델은 실시간 교배다. 성욕이 찬 성숙 개체가 가까이 오면 2.4초 교배하고, 끝나면 성욕이 충족되며 자식이 태어난다. 전멸이면 `ended`다.
- Genome은 Speed, Vision, Energy Efficiency, Learning Rate, Exploration Rate, Libido, Lifespan, Strength, Aggression, Caution, Tool Affinity다. Q-Table과 분리한다. Q-update α와 초기 epsilon은 Genome을 쓴다.
- 자식은 uniform crossover 후 유전자별 15% 돌연변이를 적용한다. 자식 세대는 `max(부모 세대)+1`이다.
- 생존 수가 Population Limit 이상이면 자식은 태어나지 않지만 성욕은 충족된다.
- 유전이 켜져 있고 수명에 도달한 개체는 노화로 사망한다. 교배 중에는 둘 다 추가 에너지를 쓰고 하트를 표시한다.
- 유전 토글은 학습 관찰용이다. 꺼져 있으면 교배·유전 bias·노화 사망을 하지 않고 동일 기본 Genome을 쓴다. 새 세션 기본은 Off다.
- Q-Table 상속은 설정에서만 켠다. 기본은 빈 Q-Table이다. 상속해도 학습 통계와 epsilon은 새 생명 기준으로 시작한다.
- Evolution 탭 차트는 다음 세대가 태어나거나 전멸할 때 남긴 기록만 사용한다. 향상을 가정하거나 보간하지 않는다.

**STEP 5 구현 메모**
- 우측 패널 대신 World/Simulation/Learning/Evolution 탭을 둔다. Simulation은 생태계 통계, Learning은 학습 대시보드, Evolution은 세대 비교를 담당한다. 개체를 선택하면 해당 탭에서 상세를 표시한다.
- 차트는 실제 `learningHistory`만 사용한다. 샘플은 1초마다 남기고 최근 180개만 유지한다. 학습 파라미터는 Learning 탭에서 확인하고 좌측 설정에서 편집한다.
- Average Survival Time과 Survival 차트는 사망 개체가 있을 때만 값을 표시한다.
- 초기/현재 비교는 첫 30초와 최근 30초가 겹치지 않을 때만 계산한다. 값이 나빠도 그대로 보여 준다.
- 학습 하이퍼파라미터는 대시보드에서 읽기 전용으로 표시한다.

**STEP 4 구현 메모**
- 섭취 가능 거리 안의 먹이는 현재 행동과 관계없이 섭취한다. `EAT`는 같은 섭취를 명시적으로 시도한다.
- STEP 4–5에서는 학습 하이퍼파라미터를 좌측 설정에 노출하지 않았다. STEP 7부터 학습 파라미터와 보상을 설정할 수 있다.
- 생존 개체가 없으면 상태를 `ended`로 바꾸고 월드 위에 종료 오버레이를 표시한다.
- Q-Table은 Zustand/렌더 상태 밖의 학습 저장소에 둔다. UI는 집계값과 최근 행동만 읽는다.
- Average Reward는 최근 80개 학습 보상의 평균, Average Q는 방문한 상태-행동 Q 값의 평균, Exploration Rate는 최근 80개 학습 행동의 탐험 비율이다.
- 학습 초기(epsilon≈1)에는 무작위 행동 때문에 수명이 짧아질 수 있다. 이는 실제 학습 전 성능이며 꾸며내지 않는다. 0.21.0부터는 대사·먹이·전투를 다시 완화해 초기 수 분은 대부분 생존하고, 유전 Off면 같은 코호트를 더 오래 관찰한다.
- 랜덤 정책 비교: 학습을 처음부터 끄면 epsilon이 1.0으로 유지되어 무작위 정책과 같다. 학습 후 끄면 고정 정책을 평가할 수 있다.

---

# 17. 확장 로드맵 — 지형·도구·전투·행동 관찰

> **문서 범위:** 이 장은 2026-11-01 코드 점검에 기반한 설계다. 기능 코드는 이 장만으로 구현된 것으로 보지 않는다. 구현 세션은 해당 STEP의 완료 조건을 검증한 뒤에만 상태를 `Done`으로 바꾼다.
>
> **설계 원칙:** 희소 Q-Table을 유지하고, 불가능한 Action은 Mask로 제외하며, `actionSchemaVersion`과 `observationSchemaVersion`을 분리한다. 선택 이벤트와 실행 결과 이벤트를 같은 ID로 연결한다. schemaVersion 1 데이터를 조용히 삭제하지 않는다. 모든 프레임에서 React 전체 상태를 갱신하지 않는다.

## 17.1 현재 코드의 실제 구조

권장 디렉터리(3.3장)와 달리 현재 구현은 더 평탄하다. 책임은 분리되어 있으나 `src/learning/qlearning/`, `src/agents/` 같은 하위 폴더는 없다.

### 17.1.1 관련 파일

| 책임 | 실제 파일 |
|---|---|
| Agent 타입 | `src/types/agent.ts` |
| World / Food / Obstacle 타입 | `src/types/world.ts` |
| 시뮬레이션 상태·이력 타입 | `src/types/simulation.ts` |
| Genome / 세대 기록 | `src/evolution/types.ts`, `src/evolution/genome.ts`, `src/evolution/constants.ts` |
| 교배·번식 | `src/evolution/mating.ts`, `src/evolution/reproduction.ts`, `src/evolution/crossover.ts`, `src/evolution/mutation.ts` |
| Q-Table 상속 | `src/evolution/inheritance.ts` |
| 세대 통계 | `src/evolution/generations.ts`, `src/evolution/metrics.ts` |
| Observation / state key | `src/learning/observation.ts`, `src/learning/types.ts` |
| Q-Table · 정책 | `src/learning/qLearning.ts`, `src/learning/brain.ts` |
| Action 선택·Q 갱신 | `src/learning/controller.ts` |
| Action 이벤트 링 버퍼 | `src/learning/actionEvents.ts` |
| Action/Observation 스키마 버전 | `src/learning/schema.ts` |
| Reward | `src/learning/rewards.ts` |
| 학습 상수 | `src/learning/constants.ts` |
| Action 실행 · 대사 · 섭취 | `src/simulation/agentSystem.ts` |
| 틱 루프 · 먹이 재생성 · 교배 호출 | `src/simulation/engine.ts` |
| 월드 생성 | `src/simulation/worldFactory.ts`, `src/simulation/agentFactory.ts` |
| 거리·충돌·스폰 | `src/simulation/spatial.ts` |
| 학습 이력 샘플 | `src/simulation/metrics.ts` |
| 고정 timestep 루프 | `src/hooks/useSimulationLoop.ts` |
| Zustand 상태 | `src/store/useSimulationStore.ts` |
| 3D 루트 | `src/components/world/WorldScene.tsx`, `src/components/world/WorldViewer.tsx` |
| 지형 메시 | `src/components/world/Terrain.tsx` |
| 오브젝트 메시 | `src/components/world/WorldObjects.tsx`, `src/components/world/WorldObjectMesh.tsx` |
| 에이전트 메시 | `src/components/world/Agents.tsx`, `src/components/world/AgentMesh.tsx` |
| 경로·탐색선 | `src/components/world/AgentTrail.tsx`, `src/components/world/FoodSeekPath.tsx` |
| Action Distribution UI | `src/components/panels/LearningDashboard.tsx`, `src/components/panels/AgentInspection.tsx` |
| 통계 스로틀 | `src/hooks/useThrottledStore.ts`, `src/hooks/useLearningStats.ts` |
| IndexedDB | `src/experiments/storage.ts`, `src/experiments/constants.ts` |
| JSON · 검증 · 마이그레이션 | `src/experiments/serialization.ts`, `src/experiments/validation.ts`, `src/experiments/migrate.ts` |
| 스냅샷 | `src/experiments/snapshot.ts`, `src/experiments/types.ts` |
| 세션 복원 | `src/hooks/useExperimentPersistence.ts` |

### 17.1.2 확인된 핵심 타입

**Agent** (`src/types/agent.ts`): `id`, `position {x,z}`, `rotation`, `energy`, `hunger`, `health`, `speed`, `vision`, `age`, `maxLifespan`, `desire`, `alive`, `deathCause: 'health' \| 'age' \| 'combat' \| null`, `generation`, `parentIds`, `parentGenomes`, `inheritParentId`, `genome`, `mutatedGenes`, `matingPartnerId`, `matingTimeLeft`, `turnRate`, `turnBias`, `wanderTimer`, `wanderInterval`, `lastAction`, `lastReward`, `lastStateKey`, `equipment`, `defendTimeLeft`, `attackCooldownLeft`, `lastAttackerId`, `lastCombatTick`, `combatCue`.

`turnBias` / `wanderTimer` / `wanderInterval`은 생성만 되고 Q-Learning 경로에서는 읽히지 않는다. 공격 피해는 Genome Strength를 쓴다. 값이 없으면 `COMBAT_STRENGTH_DEFAULT = 1`이다.

**Genome** (`src/evolution/types.ts`): `speed`, `vision`, `energyEfficiency`, `learningRate`, `explorationRate`, `libido`, `lifespan`, `strength`, `aggression`, `caution`, `toolAffinity`. `crossoverGenomes`, `clampGenome`, `createRandomGenome`, `averageGenomes`는 `GENOME_GENES`를 순회한다. 저장 검증의 `validateGenome`도 이 목록을 따른다. 빠진 유전자는 1.00으로 채운다.

**WorldObject** (`src/types/world.ts`): `type: 'tree' \| 'rock' \| 'food'`, `position {x,y,z}`, `scale`, `rotation`. 먹이 회복량은 오브젝트 필드가 아니라 상수 `FOOD_ENERGY_RESTORE` / `FOOD_HUNGER_RELIEF`다.

**WorldState**: `config`, `objects`, `agents`, `foodSpawnCooldown`, `generation`, `generationStartTick`, `birthCount`, `terrain`. `WorldConfig`에 `seed`와 `terrainPreset`이 있다.

**Observation**: v2. `energy` 3단, `hunger` 3단, `foodDirection` 5값, `foodDistance` 4값, `obstacleAhead` 2값, `terrain` 5값, `terrainAhead` 5값. 이론 상태 공간 9,000. 키는 `energy|hunger|foodDirection|foodDistance|obstacleAhead|terrain|terrainAhead`.

**AgentAction**: `MOVE_FORWARD`, `TURN_LEFT`, `TURN_RIGHT`, `EAT`, `REST`.

**AgentBrain**: `qTable: Map<StateKey, number[]>`, `epsilon`, `totalSteps`, `totalReward`, `recentRewards`, `recentExplored`, `actionCounts`. Q-Table은 Zustand 밖 모듈 전역 `Map`에 있다.

### 17.1.3 확인된 데이터 흐름

```text
useSimulationLoop
  → store.advance(steps, budgetMs)
    → stepSimulation
      → updateAgent (개체별)
          observeAgent → encodeObservation
          peekQValues → selectEpsilonGreedy
          beginActionDecision (eventId, 보상 없음)
          executeAction (이동/회전/섭취/휴식)
          applyMetabolism
          computeReward → updateQValue → recordLearningStep
          completeActionOutcome (같은 eventId, 실제 reward/outcome)
      → respawnFood
      → processMating (쌍 맺기, 자식, 사망 개체 정리)
    → assignChildBrains / removeBrains
    → recordLearningHistory (20틱마다, 구간 actionCounts 포함)
    → recordAgentTrails
```

교배 중이거나 성욕이 차 상대를 찾아갈 때는 Q-Learning을 건너뛴다. `lastAction`은 `REST` 또는 `MOVE_FORWARD`로 기록하고 `lastReward`는 0이며 Q-Table은 갱신되지 않는다.

## 17.2 재사용 가능한 로직과 주의점

### 17.2.1 재사용할 것

- **희소 Q-Table:** `Map<StateKey, number[]>`는 방문한 상태만 만든다. 전체 360칸을 미리 할당하지 않는다. 확장 시에도 이 구조를 유지한다.
- **정책 인터페이스:** `AgentPolicy`와 `epsilon-greedy` / `random` 분리는 그대로 쓴다. Action Mask는 `selectAction` 앞단 또는 정책 인자로 넣는다.
- **관찰·보상·실행 분리:** `observation.ts`, `rewards.ts`, `agentSystem.ts`의 경계를 유지한다.
- **거리 계산:** `distanceSq` + 시야 제곱 비교. `findNearestFood`, `findNearestMate`와 같은 선형 탐색을 개체 탐지에도 재사용한다. 50개체 규모에서는 추가 공간 해시를 먼저 넣지 않는다.
- **충돌:** `collidesWithObstacles`는 나무/바위 원형 충돌이다. 물은 초기에 동일 차단 또는 `walkable=false`로 처리한다. 물리 엔진은 도입하지 않는다.
- **3D 갱신:** 에이전트 메시는 ID로 유지하고 위치·회전은 `useFrame`에서 `getState()`로 읽는다. 통계 UI는 `useThrottledStore`(약 150ms)를 쓴다. 이 패턴을 도구·전투 표시에도 적용한다.
- **학습 이력 샘플:** 20틱(1초), 최근 180개, 초기 30개 고정. Action 시계열도 같은 주기를 쓴다.
- **진화 파이프라인:** uniform crossover, 유전자별 돌연변이, 실시간 교배, Q-Table 상속(기본 꺼짐)을 재사용한다. 새 유전자는 범위 clamp 후 기존 규칙에 태운다.
- **저장 골격:** `ExperimentRecord` + IndexedDB + JSON 검증. 새 필드는 검증·마이그레이션을 통과한 뒤에만 저장한다.

### 17.2.2 주의할 점

- `createEmptyQValues`와 `ZERO_Q_VALUES`는 길이 5로 고정되어 있다. Action을 늘리면 `qLearning.ts`, `brain.ts` 직렬화, 탐험 가중치, UI 라벨/색/글자를 함께 바꿔야 한다.
- 저장 검증은 `qTable.length > 360`이면 거부하고, 각 행은 **유한한 값 5개**를 요구한다. Observation/Action을 늘린 채 검증을 그대로 두면 저장·불러오기가 실패한다.
- `schemaVersion !== 1`이면 실험 전체를 거부한다. `listExperiments`와 `loadSession`도 검증 실패한 기록을 버린다. 버전을 올리면 마이그레이션 없이 기존 세션이 화면에서 사라진다.
- `inheritBrain`은 키와 행 길이를 확인하지 않고 Q-Table을 복사한다. 스키마가 다르면 상속을 거부해야 한다.
- `decodeObservation`은 토큰을 검증하지 않고 캐스팅한다. 스키마가 바뀌면 잘못된 키를 통과시킬 수 있다.
- 섭취 가능 거리의 먹이는 행동과 관계없이 먹힌다. 도구 채집과 구분해야 한다. Basket으로 들고 있는 먹이는 즉시 섭취로 처리하지 않는다.
- 에이전트-에이전트 이동 충돌은 없다. 전투 사거리는 교배 거리와 별도 상수로 둔다.
- `lastAction`은 매 틱 덮어쓴다. 시간순 관찰을 이 필드만으로 재구성할 수 없다. `actionCounts`는 누적 합이라 초반/후반을 나누지 못한다.
- `learningHistory`에는 Action 분포가 없다. Reward/Survival/Energy/Steps만 샘플한다.
- `crossoverGenomes`는 `GENOME_GENES`를 순회하지 않는다. 유전자를 추가하면 교차가 빠질 수 있다.
- `SEEK_ENERGY_THRESHOLD`, `SEEK_HUNGER_THRESHOLD`, `WANDER_TURN_MAX`는 현재 읽히지 않는다. 새 탐색 로직의 기본값으로 오용하지 않는다.
- 지형은 단색 평면이다. `tree`/`rock`은 장애물이지 타일 타입이 아니다.
- 교배 탐색은 학습을 우회한다. 전투·도주·채집은 우회하지 않고 정책과 Mask를 통과시킨다.

## 17.3 확장 후 권장 도메인 모델

기존 타입은 유지하고 필드를 더한다. 의미가 다른 값을 한 필드에 섞지 않는다.

### 17.3.1 스키마 버전

| 버전 필드 | 현재  implicit 값 | 의미 |
|---|---:|---|
| `schemaVersion` | 4 | 실험 기록 봉투. 월드, 개체, 이력, brains 컨테이너. v1–v3는 읽기 때 4로 마이그레이션한다 |
| `actionSchemaVersion` | 3 | `AGENT_ACTIONS` 순서와 구성 |
| `observationSchemaVersion` | 4 | state key 토큰 순서와 구간 |

`actionSchemaVersion`과 `observationSchemaVersion`은 `ExperimentRecord`와 각 `SerializedBrain`에 모두 저장한다. 실험 단위와 개체 단위가 어긋나면 해당 개체 Q-Table만 변환 또는 초기화한다.

현재 Action v3:

```text
[MOVE_FORWARD, TURN_LEFT, TURN_RIGHT, EAT, REST, PICK_UP, GATHER, ATTACK, DEFEND, FLEE]
```

현재 Observation v4 키:

```text
energy|hunger|foodDirection|foodDistance|obstacleAhead|terrain|terrainAhead|forage|nearbyTool|heldTool|agentDirection|agentDistance|health
```

### 17.3.2 Terrain

```text
TerrainType = grassland | forest | rocky | wetland | water

TerrainCell
  type: TerrainType

WorldState.terrain
  cellSize            # 월드 단위. 초기 권장 2
  size                # 한 변 셀 수
  cells: TerrainType[]  # row-major, 길이 size^2
```

| 지형 | 이동 | 에너지 소모 | 시야 | 자원 | 통과 |
|---|---|---|---|---|---|
| Grassland | 1.0 | 1.0 | 1.0 | 기본 먹이 가중 | 가능 |
| Forest | 0.85 | 1.1 | 0.7 | 먹이·채집 가중 높음 | 가능. 기존 나무 장애물은 별도 |
| Rocky | 0.7 | 1.25 | 1.0 | 먹이 낮음 | 가능. 바위 장애물은 별도 |
| Wetland | 0.65 | 1.2 | 0.9 | Digging Stick 채집 가중 | 가능 |
| Water | 0 | — | — | 없음 | 불가. 전진은 충돌과 같이 처리 |

수치는 밸런스 시작값이다. 과학 상수가 아니다. `src/simulation/constants.ts`에 모은다.

월드 생성: 기존 `resourceDistribution`(uniform/clustered/edge)과 장애물 밀도는 유지한다. 지형은 시드 기반 셀 생성 후, 물은 덩어리, 숲은 나무 밀도 쪽으로 치우치게 맞춘다. 기존 평면 메시 위에 표면 질감을 입힌다. 셀마다 Mesh나 풀 잎을 만들지 말고, 월드 생성 시에만 갱신하는 단일 geometry와 albedo 질감을 권장한다. Grassland는 밝은 초원, Forest는 어두운 낙엽 바닥으로 구분한다.

### 17.3.3 Tool 및 Inventory

```text
ToolType = basket | digging_stick | spear | shield

InventorySlot
  tool: ToolType

Agent.inventory: InventorySlot[]   # 최대 2
Agent.carriedFood: number          # Basket이 있을 때만 0 초과 가능

WorldObjectType += tool
WorldObject.tool?: ToolType        # type === 'tool'일 때
```

| 도구 | 효과 |
|---|---|
| Basket | 먹이를 즉시 섭취하지 않고 1개까지 운반. 이후 EAT 또는 자동 섭취로 소모 |
| Digging Stick | Forest/Wetland에서 GATHER가 실제 자원을 만든다 |
| Spear | ATTACK 가능. 공격력에 Strength를 곱한다 |
| Shield | BLOCK 가능. 받는 피해를 줄인다 |

도구는 월드에 스폰되는 오브젝트다. 습득은 `PICK_UP`, 폐기는 `DROP`. 가짜 아이콘만 바꾸고 월드 상태가 바뀌지 않으면 안 된다.

### 17.3.4 Combat

```text
Agent.deathCause += 'combat'
Agent.lastCombatTick?: number
Agent.lastAttackerId?: string | null

CombatOutcome
  attackerId
  defenderId
  damage
  blocked: boolean
  died: boolean
```

- 탐지: `findNearestFood` / `findNearestMate`와 같은 시야 안 최근접 생존 개체.
- 공격 거리: 교배 거리(1.7)와 분리. 초기 권장 2.0.
- 피해: `baseDamage * COMBAT_STRENGTH_DEFAULT`. Spear면 사거리·피해 증가. DEFEND 중이면 감소하고, Shield면 더 많이 감소.
- 에이전트 이동 겹침은 계속 허용한다. 전투는 거리 판정이지 물리 충돌이 아니다.
- 사망 원인이 `combat`이면 기존 health/age 통계와 구분해 기록한다.

### 17.3.5 확장 Genome

| 유전자 | 범위(시작값) | 효과 |
|---|---|---|
| Strength | 0.60–1.40, 기본 1.00 | 공격 피해 배율 |
| Aggression | 0.40–1.60, 기본 1.00 | 위협 시 ATTACK 선택 점수 bias. Q를 덮어쓰지 않음 |
| Caution | 0.40–1.60, 기본 1.00 | 저체력/근접 위협 시 DEFEND/FLEE 선택 점수 bias |
| Tool Affinity | 0.60–1.40, 기본 1.00 | 도구 사용 회복과 내구도 소모 |

학습률·탐험률처럼 실제 수치에 연결한다. UI 장식용 라벨로만 두지 않는다. 교차·돌연변이·세대 평균·Evolution 차트에 포함한다.

### 17.3.6 Action 확장

기존 5개는 순서를 유지한 채 뒤에만 추가한다. 중간 삽입이나 재정렬은 Q 행 변환을 불가능하게 만든다.

| Action | 도입 STEP | 동작 |
|---|---|---|
| MOVE_FORWARD | 현재 | 현 방향으로 이동. 지형 배율 적용 |
| TURN_LEFT / TURN_RIGHT | 현재 | 회전 |
| EAT | 현재 | 근접 먹이 또는 운반 중 먹이 섭취 |
| REST | 현재 | 이동 없음, 에너지 소모 감소 |
| PICK_UP | 11 | 섭취 반경 안 도구를 인벤토리에 넣음 |
| DROP | 11 | 들고 있는 도구 또는 운반 먹이를 월드에 놓음 |
| GATHER | 11 | Digging Stick + Forest/Wetland에서 자원 채집 |
| ATTACK | 12 | 탐지된 최근접 생존 개체 공격. 창이면 사거리·피해 증가 |
| DEFEND | 12 | 짧은 방어 상태. 방패가 있으면 감소 폭이 큼 |
| FLEE | 12 | 최근접 위협 반대 방향으로 회전 후 전진 |

### 17.3.7 Observation 확장

필드는 뒤에만 추가한다.

| 필드 | 구간 | 도입 STEP |
|---|---|---|
| energy / hunger / foodDirection / foodDistance / obstacleAhead | 현행 | 현재 (v1) |
| terrain | grassland / forest / rocky / wetland / water | 10 (v2) |
| terrainAhead | grassland / forest / rocky / wetland / water | 10 (v2) |
| heldTool | none / basket_high / basket_low / stick_high / stick_low / spear_high / spear_low / shield_high / shield_low | 11–12 (v3/v4) |
| agentDirection | none / forward / back / left / right | 12 (v4) |
| agentDistance | close / mid / far / out. close는 현재 공격 사거리 | 12 (v4) |
| health | low / mid / high | 12 (v4) |

키 예(v4):

```text
mid|high|forward|close|no|forest|spear|left|mid|high
```

### 17.3.8 Action Mask

선택 직전에 실행 가능한 Action만 남긴다.

| Action | 가능 조건 |
|---|---|
| MOVE_FORWARD | 항상. 물/장애물/경계는 실행 후 충돌로 처리 |
| TURN_*, REST | 항상 |
| EAT | 근접 먹이 또는 `carriedFood > 0` |
| PICK_UP | 인벤토리 여유 + 근접 도구 |
| DROP | 인벤토리 또는 운반 먹이 존재 |
| GATHER | Digging Stick 보유 + 채집 가능 지형 + 해당 셀 자원 여유 |
| ATTACK | 시야 안 생존 개체 + 공격 쿨다운 없음. 창은 필수가 아니다 |
| DEFEND | 시야 안 생존 개체. 방패는 필수가 아니다 |
| FLEE | 시야 안 다른 생존 개체 존재 |

마스크된 Action은 탐험 가중치와 `argmax`/`maxQ`에서 뺀다. 가능한 Action이 없으면 `REST`를 강제한다. 다음 상태의 `max_a' Q(s', a')`도 그 상태의 마스크를 적용한다.

### 17.3.9 선택·실행 이벤트

```text
ActionDecisionEvent
  eventId: string
  tick: number
  agentId: string
  stateKey: StateKey
  selectedAction: AgentAction
  legalActions: AgentAction[]
  explored: boolean
  epsilon: number
  actionSchemaVersion: number
  observationSchemaVersion: number

ActionOutcomeEvent
  eventId: string          # Decision과 동일
  tick: number
  agentId: string
  action: AgentAction
  ate: boolean
  collided: boolean
  died: boolean
  gathered: boolean
  pickedUp: ToolType | null
  dropped: ToolType | null
  combat: CombatOutcome | null
  reward: number
  nextStateKey: StateKey | null
```

이벤트는 brains와 같이 React 밖에 링 버퍼로 둔다. 개체당 최근 80개, 실험 전체 최근 400개를 넘기지 않는다. 저장 시에는 링 버퍼 전체가 아니라 1초 샘플의 Action 분포와 경고 플래그만 남긴다.

`lastAction` / `lastReward` / `lastStateKey`는 최신 표시용으로 유지하되, 시간순 분석의 원본으로 쓰지 않는다.

## 17.4 Observation / Action 확장과 상태 공간

### 17.4.1 이론 공간 증가

| 단계 | 관찰 조합 | Action 수 | 이론 Q 칸 |
|---|---:|---:|---:|
| 현재 v1 | 3×3×5×4×2 = 360 | 5 | 1,800 |
| STEP 10 지형 | 360×5×5 = 9,000 | 5 | 45,000 |
| STEP 11 도구 | 9,000×7×3×5 = 945,000 | 7 | 6,615,000 |
| STEP 12 전투 | 945,000×(5/3)×(9/5)×5×4×3 = 170,100,000 | 10 | 1,701,000,000 |

밀집 배열로 미리 할당하면 안 된다. 현재처럼 방문 상태만 `Map`에 넣고, 행 배열 길이는 그 시점 `AGENT_ACTIONS.length`와 같게 둔다.

### 17.4.2 관리 방안

1. **희소 저장:** `getOrCreateQValues`는 처음 방문한 키만 행을 만든다.
2. **Action Mask:** 불가능한 칸을 탐험·갱신에서 빼 샘플을 낭비하지 않는다.
3. **단계적 관찰 추가:** 한 STEP에서 지형·도구·전투 관찰을 동시에 넣지 않는다.
4. **커버리지 지표:** `STATE_SPACE_SIZE`를 저장 상한으로 쓰지 않는다. UI 커버리지는 참고값이며, 이론 공간이 커지면 `visitedStates`와 최근 고유 상태 수를 우선 표시한다.
5. **검증 상한:** schemaVersion 1의 360/5 제한은 해당 버전에만 적용한다. 이후 버전은 `visitedStates` 상한(예: 개체당 8,000)과 행 길이 = 해당 `actionSchemaVersion`의 Action 수로 검사한다.
6. **함수 근사 / PPO:** 방문 상태가 개체당 수천을 넘고 학습이 더 이상 수렴하지 않을 때만 6.8장을 따라 재검토한다. 이 로드맵의 기본은 Tabular Q-Learning이다.

## 17.5 저장 데이터 호환성 및 Migration

### 17.5.1 현재 저장 형태 (schemaVersion 2)

- 상수: `EXPERIMENT_SCHEMA_VERSION = 4`, IndexedDB `EXPERIMENT_DB_VERSION = 1`, DB 이름 `artificial-life-simulator`.
- schemaVersion 1 기록은 `migrateExperimentRecord`가 지형·seed·Q 초기화를 채운 뒤 2로 올린다.
- 실험 기록: `worldConfig`, `learningConfig`, `rewardConfig`, `evolutionConfig`, `world`, `brains`, `learningHistory`, `generationHistory`, `statistics`.
- `actionSchemaVersion` / `observationSchemaVersion`은 0.15.0부터 기록한다. 없는 v1 데이터는 읽기 때 1로 채운다.
- 이동 경로는 저장하지 않고 복원 후 다시 만든다.

**현재 Q-Table JSON 형태**

```text
brains: [
  {
    agentId: string,
    qTable: Array<[stateKey: string, qValues: [number, number, number, number, number]]>,
    epsilon: number,
    totalSteps: number,
    totalReward: number,
    recentRewards: number[],
    recentExplored: number[],
    actionCounts: { MOVE_FORWARD, TURN_LEFT, TURN_RIGHT, EAT, REST }
  }
]
```

`stateKey` 예: `"low|mid|forward|close|no"`. `qValues[i]`는 v1 `AGENT_ACTIONS[i]`다. 런타임 `Map`을 `Array.from(entries)`로 직렬화한다.

### 17.5.2 변환 가능 여부

| 변경 | Q-Table 변환 | 결과 |
|---|---|---|
| Action을 뒤에만 추가 | 가능 | 각 행 뒤에 0을 패딩. `qTableStatus = 'padded'` |
| Action 순서 변경·삭제·중간 삽입 | 불가능 | Q-Table만 초기화. 경고 |
| Observation 토큰을 뒤에 추가 | 불가능 | 옛 키와 새 키가 일치하지 않음. Q-Table만 초기화. 경고 |
| Observation 구간 재정의 | 불가능 | 동일 |
| Genome 필드 추가 | Q와 무관 | 빠진 유전자는 범위 중앙값으로 채움 |
| 지형·도구·인벤토리 없음 | Q와 무관 | 기본값 부여. 지형은 전부 grassland 또는 시드로 재생성하되 개체 위치는 유지 |

### 17.5.3 schemaVersion 1 → 이후 버전 규칙

1. **읽기 시 마이그레이션:** `validateExperimentRecord` 전에 `migrateExperimentRecord`를 실행한다. 마이그레이션 없이 버전을 올리면 기존 IndexedDB/JSON이 목록에서 사라진다.
2. **보존:** 월드 크기, 개체 위치·생존 상태, 기존 Genome, 세대 통계, `learningHistory`의 Reward/Survival/Energy/Steps, tick, 실험 이름·시간은 보존한다.
3. **Q-Table:** 안전하게 변환할 수 있으면 변환한다. 없으면 Q-Table과 새 Action의 `actionCounts`만 초기화한다. `totalSteps` / `totalReward` / 기존 5Action counts는 이력으로 남긴다. epsilon은 해당 개체 `genome.explorationRate`로 되돌려 빈 테이블을 낮은 epsilon으로 착취하지 않게 한다.
4. **조용한 삭제 금지:** 기록에 `qTableStatus: 'intact' \| 'padded' \| 'reset'`와 `qTableResetReason`을 남긴다. 불러온 뒤 한 번 경고를 보여 준다. 세션 자동 복원에도 동일하다.
5. **경고 문구 예:** `Observation schema v1 → v2는 상태 키를 변환할 수 없어 Q-Table을 초기화했다. 월드, Genome, 세대 통계는 유지했다.`
6. **JSON 가져오기:** 파일 크기·필수 필드·범위 검사는 유지한다. v1 파일은 마이그레이션 후 새 id를 부여하는 현재 import 규칙을 따른다.
7. **Q-Table 상속:** 부모·자식의 action/observation 버전이 다르면 상속하지 않고 빈 테이블을 준다. 이 경우도 숨기지 않고 개체 상세에 표시한다.
8. **IndexedDB object store 버전:** 스토어 이름과 keyPath가 바뀌지 않으면 `EXPERIMENT_DB_VERSION`은 올리지 않아도 된다. 레코드 내부 `schemaVersion`과 DB 버전을 혼동하지 않는다.

### 17.5.4 기본값 채우기

schemaVersion 1 기록에 없는 확장 필드:

| 필드 | 기본값 |
|---|---|
| `actionSchemaVersion` | 1 |
| `observationSchemaVersion` | 1 |
| `world.terrain` | 모든 셀 `grassland`, `cellSize = 2` |
| `agent.inventory` | `[]` |
| `agent.carriedFood` | 0 |
| `agent.deathCause` | 기존 값 유지 |
| 새 Genome 유전자 | 1.00 (Strength/Aggression/Caution/ToolAffinity 중립값) |
| `learningHistory.actionCounts` | 샘플마다 당시 누적 또는 0. 없으면 차트 Empty State |
| 도구 오브젝트 | 없음. 이후 리셋 또는 설정으로 스폰 |

지형을 시드로 다시 만들 경우에도 개체 좌표와 기존 tree/rock/food는 유지한다. 물 셀이 개체 발밑이면 가장 가까운 통과 가능 셀로만 옮기고, 그 사실을 경고한다.

## 17.6 단계별 구현 순서

각 단계는 실행 가능한 상태를 유지한다. 다음 단계로 넘어가기 전에 완료 조건을 확인한다. 구현 전에는 상태를 `Not Started`로 둔다.

### STEP 9 — Action Timeline & Schema Contract

**상태:** Done (0.15.0)

**목표:** Action이 학습 과정에서 어떻게 변하는지 시간순으로 본다. 이후 확장을 위한 버전·이벤트 계약을 넣는다. 지형·도구·전투는 아직 넣지 않는다.

**작업**
- `ActionDecisionEvent`와 `ActionOutcomeEvent`를 같은 `eventId`로 연결한다.
- brains와 같이 React 밖 링 버퍼에 둔다.
- `learningHistory` 1초 샘플에 `actionCounts`를 추가한다. Learning 탭에 초기/최근 분포와 시계열을 표시한다.
- `ExperimentRecord`와 `SerializedBrain`에 `actionSchemaVersion`, `observationSchemaVersion`을 기록한다. 현 값은 둘 다 1이다.
- `migrateExperimentRecord` 골격을 추가한다. v1 기록은 버전 필드를 채우고 Q-Table은 그대로 둔다.
- 저장 검증의 360/5 제한은 v1에만 적용한다.

**완료 조건**
- 학습이 켜진 동안 선택과 실행 결과가 같은 `eventId`로 조회된다.
- Action Distribution이 누적 합뿐 아니라 시간 샘플로 보인다.
- 초기 30초와 최근 30초의 행동 비율을 겹치지 않을 때만 비교한다. 값이 나빠도 그대로 표시한다.
- schemaVersion 1 JSON/세션을 불러도 Q-Table이 유지된다.
- 매 틱 Zustand 전체 구독으로 이벤트를 밀어 넣지 않는다.
- 기능 테스트: 이벤트 연결, 샘플 주기, v1 마이그레이션 패스스루.

### STEP 10 — Terrain

**상태:** Done (0.16.0)

**목표:** 지형별 이동·시야·자원 차이를 시뮬레이션과 학습에 연결한다.

**작업**
- 월드 생성에 지형 격자를 추가한다.
- 이동 속도, 에너지 소모, 시야, 먹이 스폰 가중, 물 통과 불가를 적용한다.
- Observation v2: `terrain` 토큰을 키 뒤에 추가한다.
- 3D는 생성 시 한 번 색칠한다. 셀별 개별 Mesh는 피한다.
- v1 로드: 기본 grassland 또는 시드 재생성 + 명시적 경고. Observation이 v2가 되므로 Q-Table은 초기화하고 경고한다.

**완료 조건**
- 같은 행동이 지형에 따라 이동 거리·시야·에너지 소모가 달라진다.
- 물로는 들어가지 못하고 충돌 보상과 같은 경로로 처리된다.
- `observeAgent`의 지형 값이 실제 셀과 일치한다.
- Q-Table 키가 v2 형식을 쓰고, v1 실험 로드 시 월드/Genome/통계는 남고 Q-Table만 초기화 + 경고가 뜬다.
- 지형 메시가 매 프레임 재생성되지 않는다.

### STEP 11 — Tools & Gathering

**상태:** Done (0.17.0)

**목표:** Basket, Digging Stick 습득과 채집을 실제 월드 변화와 학습에 연결한다. 기존 Food 자동 섭취는 유지한다.

**작업**
- 채집 노드 `BERRY_BUSH` / `ROOT_PATCH`와 월드 도구 `basket` / `digging_stick`을 스폰한다. 수량은 채집 시 감소하고 재생성은 Food spawn과 분리한다.
- 장비 슬롯은 1개다. DROP, 다중 슬롯, 제작, 조합, 무기는 넣지 않는다.
- Action: `PICK_UP`, `GATHER`. Action v2로 뒤에 추가한다. Observation이 바뀌므로 Q-Table은 초기화 + 경고.
- Observation v3: `forage`, `nearbyTool`, `heldTool` 이산 토큰.
- Action Mask: 대상이 없거나 조건이 없으면 EAT/PICK_UP/GATHER를 제외한다. 뿌리 채집은 Digging Stick이 있어야 한다.
- Basket은 베리 채집량과 허기 감소를 늘린다. Digging Stick은 뿌리 채집을 가능하게 한다. 성공 사용 시 내구도가 줄고 0이면 파손된다.
- 보상은 실제 획득량에 비례한다.

**완료 조건**
- PICK_UP으로 월드 도구가 Agent 소유로 이동한다.
- GATHER로 자원이 줄고 에너지/허기가 실제로 변한다.
- Basket/Digging Stick 효과가 결과에 반영된다.
- 내구도 감소와 파손이 작동한다.
- Action Observatory에 대상, 획득량, 내구도 변화, 성공/실패가 남는다.
- Save/Load 후 도구와 자원 상태가 보존된다. 이전 스키마 로드는 Q 초기화 + 경고다.

### STEP 12 — Combat & Defense

**상태:** Done (0.18.0)

**목표:** 개체 간 공격·방어·도주를 학습 루프에 넣는다.

**작업**
- Spear, Shield 도구. Action: `ATTACK`, `DEFEND`, `FLEE`.
- 시야 안 최근접 개체 탐지. Observation v4: `agentDirection`, `agentDistance`, `health`.
- 피해, 방어 감소, `deathCause: 'combat'`. 사망 시 장착 도구를 월드에 한 번 떨어뜨린다.
- 보상: 실제 피해/감소/거리 변화에만 제한된 값을 준다. 사망 −20 경로는 재사용하고 중복 지급하지 않는다.
- 교배 우회는 유지한다. 전투는 우회하지 않는다. 초기에는 모든 생존 개체가 경쟁 대상이다.

**완료 조건**
- 도구 없이도 ATTACK/DEFEND가 가능하고, Spear/Shield는 결과를 바꾼다.
- 체력이 0이 되면 `combat` 사망이 기록되고 기존 사망/통계/번식 경로를 탄다.
- FLEE는 위협 반대 방향으로 실제 이동한다.
- 관찰된 상대 방향/거리가 실제 최근접 개체와 일치한다.
- 헛공격·무한 방어가 이득이 되지 않는다.
- v3 → v4 로드 시 Q-Table 초기화 + 경고. 월드/Genome/통계는 유지.

### STEP 13 — Extended Genome Traits

**상태:** Done (0.19.0)

**목표:** Strength, Aggression, Caution, Tool Affinity를 유전·학습·전투·채집에 연결한다.

**작업**
- `GENOME_GENES`, 범위, `clampGenome`, `createRandomGenome`, `crossoverGenomes`, `averageGenomes`, 세대 기록, Evolution 차트를 함께 수정한다.
- Strength → 공격 피해. Aggression/Caution → 정책 선택 단계의 genetic bias. Tool Affinity → 도구 회복·내구도 소모.
- 빠진 Genome 필드는 1.00으로 채운다. 옛 세대 평균은 만들지 않고 `null`로 둔다.

**완료 조건**
- 자식 Genome에 네 유전자가 교차·돌연변이로 전달된다.
- Strength와 Tool Affinity가 실제 피해·도구 결과에 영향을 준다.
- 같은 Q라도 Aggression/Caution bias가 활용 선택을 바꿀 수 있고, Q-Table은 그대로다.
- Evolution 탭에 새 유전자 평균이 실제 기록으로 표시된다. 옛 기록은 `—`다.
- 빠진 유전자가 있는 실험을 불러도 크래시 없이 기본값이 채워진다.

### STEP 14 — Persistence & Learning Integration

**상태:** Done (0.20.0)

**목표:** 확장을 저장·비교·분석까지 닫고, Q-Learning과 진화 연결을 점검한다.

**작업**
- Experiments 비교에 지형 이용, 도구 보유, 전투 사망, 새 유전자 평균을 선택적으로 추가한다.
- Q 상속은 동일 `actionSchemaVersion` + `observationSchemaVersion`일 때만 허용한다.
- 마이그레이션 경고를 Experiments와 세션 복원 UI에 고정한다.
- Action 시계열, 마스크율, 방문 상태 수, Q 초기화 여부를 Learning 탭에 명시한다.
- 단위 테스트: 마스크, 지형 효과, 도구 실행, 전투 피해, Genome 교차, v1 마이그레이션, Q 패딩/초기화.

**완료 조건**
- schemaVersion 1 실험이 월드/Genome/통계를 유지한 채 로드된다.
- Q를 버릴 때는 항상 경고와 `qTableResetReason`이 남는다.
- 학습 off면 Q·epsilon·이벤트 집계가 변하지 않는다.
- 새 Action/Observation이 실제 보상과 세대 통계에 반영된다.
- `npm` 테스트와 타입이 통과한다. 실행하지 못한 검증은 완료로 표시하지 않는다.

**STEP 14 알려진 한계**
- 상세 Action 이벤트 링 버퍼는 저장하지 않는다. 시간 구간 분석은 1초 analytics 샘플을 쓴다.
- 여러 Seed 반복의 평균±편차는 사용자가 저장해 선택한 실험에만 계산한다. 자동 배치 러너는 없다.
- Random Policy는 학습을 처음부터 끈 경우(epsilon 유지)와 같다. 별도 정책 전환 UI는 두지 않았다.
- Combat Survival은 전투가 있었던 실험에서 `1 − combatDeaths / totalAgents`다. 전투에 참여한 개체만의 조건부 생존이 아니다.
- 3D 대상 선은 고속에서 선택 개체로 줄인다. 선택하지 않으면 고속에서는 대상 선을 그리지 않는다.

## 17.7 구현 제약

- 이 장의 기능을 한 세션에서 한꺼번에 구현하지 않는다. STEP 순서와 완료 조건을 따른다.
- 학습하거나 진화하는 것처럼 보이도록 통계를 보간하거나 가짜 상승을 만들지 않는다.
- LLM 에이전트, 사실 생체역학, 서버 동기화는 범위 밖이다.
- 모든 프레임에서 React 전체 상태를 갱신하지 않는다. 이벤트·Q-Table·링 버퍼는 렌더 상태 밖에 둔다.
- 기존 1–16장과 충돌하면 이 장이 확장 설계의 기준이다. 이미 완료된 STEP 1–8 요구사항은 삭제하지 않는다.


