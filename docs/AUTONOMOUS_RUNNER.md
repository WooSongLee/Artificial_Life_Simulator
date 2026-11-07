# Autonomous Cursor Development Orchestrator

독립 Cursor Agent 세션을 반복 실행해 STEP 15→16→17 개발을 이어 가는 오케스트레이터다.

**중요:** 이 시스템을 만들었다고 STEP 15–17 제품 개발이 끝난 것은 아니다. 오케스트레이터 구축과 시뮬레이터 구현 진척은 별개다.

## 목적

- 사용자가 매번 Continue & Implement 프롬프트를 붙여 넣지 않아도 된다.
- 매 세션은 **새 독립 Agent**다 (이전 대화 기억에 의존하지 않음).
- 진행 상태는 `docs/CURSOR_SESSION_STATE.md`와 `ARTIFICIAL_LIFE_SPEC.md`에만 의존한다.
- 완료는 Agent의 자기선언이 아니라 **체크포인트/명세 상태 + 테스트/빌드**로 판정한다.

## 사전 요구

| 항목 | 확인 |
|---|---|
| OS | macOS (검증 환경: Darwin arm64) |
| Python | 3.10+ (검증: 3.12) |
| Cursor Agent CLI | `cursor-agent` 또는 `cursor agent` |
| 인증 | `cursor agent login` **또는** `CURSOR_API_KEY` |
| 프로젝트 | 루트에 SPEC + `docs/CURSOR_SESSION_STATE.md` |

CLI 설치 (미설치 시):

```bash
curl https://cursor.com/install -fsS | bash
```

이 환경에서는 Cursor.app 번들의 `cursor agent`와 `~/.local/bin/cursor-agent`가 확인되었다.

### 지원되는 CLI 기능 (가정하지 않고 확인한 것)

- `cursor agent -p/--print` : 비대화형 실행
- `--output-format json|text|stream-json`
- `--trust` : 워크스페이스 신뢰 (headless)
- `--force` / `--yolo` : 도구/명령 자동 승인 (파일 수정에 필요)
- `--workspace <path>`
- `--resume <chatId>`
- `create-chat` : 독립 세션 ID 생성
- `status` / `login` : 인증

지원되지 않거나 확인되지 않은 기능은 구현에 넣지 않았다.

## 파일

| 경로 | 역할 |
|---|---|
| `scripts/autonomous_runner.py` | 오케스트레이터 본체 |
| `scripts/agent_prompt.md` | 세션마다 전달하는 Continue & Implement 규칙 |
| `scripts/runner_config.json` | 한도·명령·완료 조건 |
| `scripts/runner_state/` | 런 상태·세션 로그 (생성됨) |
| `docs/AUTONOMOUS_RUNNER.md` | 이 문서 |

## 실행

```bash
# 1) 오케스트레이터 자체 검증 (권장 최초 단계)
python3 scripts/autonomous_runner.py --verify

# 2) dry-run: create-chat + 명령 조립만 (코딩 Agent 미실행)
python3 scripts/autonomous_runner.py --dry-run --max-sessions 1

# 3) 실제 자동 반복 (인증 필요)
python3 scripts/autonomous_runner.py

# 옵션
python3 scripts/autonomous_runner.py --max-sessions 5
python3 scripts/autonomous_runner.py --resume
python3 scripts/autonomous_runner.py --stop          # 안전한 중단 요청
python3 scripts/autonomous_runner.py --clear-stop
```

기본 `max_sessions`는 설정 파일 기준 **10**이다.

### 인증

```bash
cursor agent login
# 또는
export CURSOR_API_KEY=cursor_...
```

로그인 없이 `-p` 실행은 대기/실패할 수 있다. 오케스트레이터는 live 모드에서 인증을 먼저 확인한다.

## 실행 사이클

1. 프로젝트 루트 확인  
2. Git 상태 출력 (기본은 dirty 허용, 삭제는 금지 규칙으로 Agent에 지시)  
3. 체크포인트 해시 기록  
4. `create-chat`으로 독립 세션 생성  
5. `agent_prompt.md` + 체크포인트 발췌를 프롬프트로 `-p` 실행  
6. 종료 코드/타임아웃/로그 수집  
7. 체크포인트 갱신 여부 확인  
8. `npm test` / `npm run build`  
9. STEP 15–17 Done + 테스트/빌드 등으로 완료 판정  
10. 미완료면 다음 독립 세션  

## 안전장치

- 최대 세션 수 (`max_sessions`, 기본 10)
- 세션 타임아웃 (`session_timeout_sec`, 기본 1800s)
- 연속 테스트 실패 중단
- 체크포인트 미갱신 중단
- 동일 Next Task 반복 감지
- `--stop` / `STOP` 파일
- 일일 세션 상한 (`api_usage_guard`)
- `--force`는 설정으로만 켜며, **로그인을 우회하지 않음**
- MCP 자동 승인 기본 OFF
- 파괴적 git / 외부 배포 / 사용자 데이터 삭제 금지를 프롬프트에 명시

## 완료 판정

다음을 **모두** 만족해야 자동 종료한다 (`completion_requires`).

- SPEC상 STEP 15/16/17이 Done
- 테스트 성공
- 빌드 성공
- Ecology 모드 보존 구조 확인
- 저장 호환(migrate/schema) 구조 확인

Agent가 “다 끝났습니다”라고만 말해도 종료하지 않는다.

## North Star (제품 의도)

Human Behavior Lab의 학습 행동이 점점 더 사람처럼 보이게 하는 것이 장기 목표다.  
관찰자가 “감정이 있나? 의식이 있나?”라고 물을 수 있을 정도의 **행동/옵션/모션**을 지향하되, 실제 의식·감정을 주장하거나 가짜 감정 미터로 대체하지 않는다.

## 제한사항

- CLI 미로그인 상태에서는 live Agent 세션을 시작할 수 없다.
- `--force` 없이는 headless에서 파일 수정이 적용되지 않는다 (Cursor 문서 기준). 기본 설정은 자동 개발을 위해 `force_tools: true`다.
- 완료 판정의 Ecology/저장 호환은 구조적 휴리스틱이며, 수동 브라우저 스모크를 대체하지 않는다.
- 오케스트레이터는 비용을 정확히 달러 정산하지 않는다. 세션 수/일일 상한으로만 제한한다.
- 네트워크·모델 장애·권한 팝업은 세션 실패로 이어질 수 있다.

## 검증 결과 (구축 시점)

구축 세션에서 확인한 것:

- `cursor-agent --version` 성공
- `cursor agent` / `create-chat`으로 독립 chat ID 발급 성공
- `--print`, `--trust`, `--force`, `--resume` 헬프에 존재
- `status` = Not logged in → live `-p`는 인증 전제
- `python3 scripts/autonomous_runner.py --verify` / `--dry-run`으로 오케스트레이터 검증

실제 STEP 16/17 구현 루프는 인증 후 사용자가 live 실행할 때 시작된다.
