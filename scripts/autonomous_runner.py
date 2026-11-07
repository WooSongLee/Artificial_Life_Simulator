#!/usr/bin/env python3
"""Autonomous Cursor Agent orchestrator for Artificial Life Simulator.

Spawns independent headless Cursor Agent sessions until STEP 18–20 completion
criteria are met (or safety limits stop the loop). Does not rely on prior chat
history between sessions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = SCRIPT_DIR / "runner_config.json"


@dataclass
class SessionRecord:
    session_index: int
    started_at: str
    ended_at: str = ""
    chat_id: Optional[str] = None
    exit_code: Optional[int] = None
    timed_out: bool = False
    checkpoint_before_hash: str = ""
    checkpoint_after_hash: str = ""
    checkpoint_updated: bool = False
    next_task_hash: str = ""
    tests_ok: Optional[bool] = None
    build_ok: Optional[bool] = None
    stop_reason: Optional[str] = None
    log_path: str = ""
    dry_run: bool = False


@dataclass
class RunnerState:
    version: int = 1
    created_at: str = ""
    updated_at: str = ""
    sessions_run: int = 0
    consecutive_test_failures: int = 0
    consecutive_no_checkpoint_update: int = 0
    last_next_task_hash: str = ""
    identical_next_task_streak: int = 0
    sessions_today: int = 0
    sessions_today_date: str = ""
    last_stop_reason: str = ""
    completed: bool = False
    history: list[dict[str, Any]] = field(default_factory=list)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    tmp.replace(path)


def resolve_project_root(config: dict[str, Any], config_path: Path) -> Path:
    root = Path(config.get("project_root", ".")).expanduser()
    if not root.is_absolute():
        # Config lives in scripts/; project root is parent unless overridden.
        root = (config_path.parent.parent / root).resolve()
    else:
        root = root.resolve()
    return root


def file_sha256(path: Path) -> str:
    if not path.exists():
        return ""
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def extract_next_task(checkpoint_text: str) -> str:
    m = re.search(
        r"##\s*Next Task\s*\n(.*?)(?=\n##\s|\Z)",
        checkpoint_text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return (m.group(1).strip() if m else checkpoint_text.strip())[:2000]


def next_task_hash(checkpoint_path: Path) -> str:
    if not checkpoint_path.exists():
        return ""
    text = checkpoint_path.read_text(encoding="utf-8")
    return hashlib.sha256(extract_next_task(text).encode("utf-8")).hexdigest()


def parse_step_status(spec_text: str, step_num: int) -> Optional[str]:
    # Prefer SPEC roadmap table / §18 headings.
    patterns = [
        rf"STEP\s*{step_num}\s*[—\-].*?\|\s*(Done|In Progress|Not Started|Blocked)\s*\|",
        rf"##\s*\d+\.\d+\s+STEP\s*{step_num}\b[\s\S]*?\*\*상태:\*\*\s*([^\n]+)",
        rf"Current Step:\s*STEP\s*{step_num}\s*\nStep Status:\s*([^\n]+)",
    ]
    for pat in patterns:
        m = re.search(pat, spec_text, flags=re.IGNORECASE)
        if m:
            raw = m.group(1).strip()
            if re.search(r"\bDone\b", raw, re.I):
                return "Done"
            if re.search(r"In Progress", raw, re.I):
                return "In Progress"
            if re.search(r"Not Started", raw, re.I):
                return "Not Started"
            if re.search(r"Blocked", raw, re.I):
                return "Blocked"
            return raw
    return None


def parse_checkpoint_steps(checkpoint_text: str) -> dict[str, str]:
    """Best-effort checkpoint hints. SPEC remains authoritative for Done."""
    out: dict[str, str] = {}
    m_cur = re.search(r"Current Step:\s*STEP\s*(\d+)", checkpoint_text, re.I)
    m_status = re.search(r"Step Status:\s*([^\n]+)", checkpoint_text, re.I)
    if m_cur and m_status:
        cur = int(m_cur.group(1))
        status_line = m_status.group(1).strip()
        out["current"] = f"STEP {cur}: {status_line}"
        # Only the current step gets status from Step Status line.
        # Prefer explicit In Progress / Not Started before bare "Done"
        # (e.g. "In Progress (… slice Done)").
        if re.search(r"In Progress", status_line, re.I):
            out[str(cur)] = "In Progress"
        elif re.search(r"Not Started", status_line, re.I):
            out[str(cur)] = "Not Started"
        elif re.search(r"Blocked", status_line, re.I):
            out[str(cur)] = "Blocked"
        elif re.match(r"Done\b", status_line, re.I):
            out[str(cur)] = "Done"
    # Previous Step: STEP N — Done (completed prior step only)
    m_prev = re.search(
        r"Previous Step:\s*STEP\s*(\d+)\s*[—\-]\s*Done\b",
        checkpoint_text,
        re.I,
    )
    if m_prev:
        out[m_prev.group(1)] = "Done"
    return out


def find_agent_launcher(config: dict[str, Any]) -> tuple[list[str], str]:
    """Return (argv_prefix, description).

    Prefers standalone `cursor-agent`. Falls back to `cursor agent` subcommand.
    """
    candidates = config.get("cursor_bin_candidates") or []
    path_dirs = os.environ.get("PATH", "").split(os.pathsep)
    expanded: list[str] = []
    for c in candidates:
        expanded.append(c)
    for name in ("cursor-agent", "agent", "cursor"):
        which = shutil.which(name)
        if which:
            expanded.append(which)
    # App bundle CLI
    expanded.append("/Applications/Cursor.app/Contents/Resources/app/bin/cursor")

    seen: set[str] = set()
    for raw in expanded:
        p = Path(raw).expanduser()
        key = str(p)
        if key in seen:
            continue
        seen.add(key)
        if not p.exists() and shutil.which(raw) is None:
            continue
        bin_path = shutil.which(raw) or str(p)
        base = Path(bin_path).name
        if base in ("cursor-agent", "agent"):
            return [bin_path], f"standalone:{bin_path}"
        if base == "cursor":
            # Verify subcommand exists by --help (cheap).
            try:
                proc = subprocess.run(
                    [bin_path, "agent", "--help"],
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
                if proc.returncode == 0 or "Start the Cursor Agent" in (proc.stdout + proc.stderr):
                    return [bin_path, "agent"], f"subcommand:{bin_path} agent"
            except (OSError, subprocess.TimeoutExpired):
                continue
    raise RuntimeError(
        "Cursor Agent CLI not found. Install via https://cursor.com/install "
        "or ensure Cursor.app CLI (`cursor agent`) is available."
    )


def check_auth(argv_prefix: list[str]) -> dict[str, Any]:
    info: dict[str, Any] = {"ok": False, "raw": ""}
    try:
        proc = subprocess.run(
            [*argv_prefix, "status"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        raw = (proc.stdout or "") + (proc.stderr or "")
        info["raw"] = raw.strip()
        info["exit_code"] = proc.returncode
        lower = raw.lower()
        if "not logged in" in lower:
            info["ok"] = False
            info["reason"] = "not_logged_in"
        elif proc.returncode == 0:
            info["ok"] = True
            info["reason"] = "status_ok"
        else:
            # API key may still work even if status looks odd.
            if os.environ.get("CURSOR_API_KEY"):
                info["ok"] = True
                info["reason"] = "api_key_present"
            else:
                info["ok"] = False
                info["reason"] = "status_failed"
    except (OSError, subprocess.TimeoutExpired) as exc:
        info["reason"] = f"status_error:{exc}"
        if os.environ.get("CURSOR_API_KEY"):
            info["ok"] = True
            info["reason"] = "api_key_present_status_error"
    return info


_CHAT_ID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.I,
)


def create_independent_chat(argv_prefix: list[str], timeout_sec: int = 45) -> Optional[str]:
    try:
        proc = subprocess.run(
            [*argv_prefix, "create-chat"],
            capture_output=True,
            text=True,
            timeout=timeout_sec,
        )
        blob = ((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()
        if not blob:
            return None
        for line in blob.splitlines():
            line = line.strip()
            if not line:
                continue
            if _CHAT_ID_RE.fullmatch(line):
                return line
            m = _CHAT_ID_RE.search(line)
            if m and ("install" not in line.lower()):
                return m.group(0)
        # Some CLIs print only the id with RC != 0 after side noise.
        m = _CHAT_ID_RE.search(blob)
        if m:
            return m.group(0)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return None


def build_agent_command(
    argv_prefix: list[str],
    config: dict[str, Any],
    project_root: Path,
    prompt: str,
    chat_id: Optional[str],
) -> list[str]:
    cmd = [*argv_prefix, "--print", "--output-format", str(config.get("output_format", "json"))]
    if config.get("trust_workspace", True):
        cmd.append("--trust")
    if config.get("force_tools", False):
        cmd.append("--force")
    if config.get("approve_mcps", False):
        cmd.append("--approve-mcps")
    model = config.get("agent_model")
    if model:
        cmd.extend(["--model", str(model)])
    cmd.extend(["--workspace", str(project_root)])
    if chat_id:
        cmd.extend(["--resume", chat_id])
    api_key = os.environ.get("CURSOR_API_KEY")
    if api_key:
        cmd.extend(["--api-key", api_key])
    cmd.append(prompt)
    return cmd


def _fmt_duration(seconds: float) -> str:
    sec = max(0, int(seconds))
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}h{m:02d}m{s:02d}s"
    if m:
        return f"{m}m{s:02d}s"
    return f"{s}s"


def summarize_agent_line(line: str, max_chars: int = 140) -> Optional[str]:
    """Turn a raw agent stdout line into a short terminal-friendly status."""
    s = line.strip()
    if not s:
        return None
    if s.startswith("#"):
        return None

    label = "agent"
    text = s
    if s.startswith("{"):
        try:
            obj = json.loads(s)
        except json.JSONDecodeError:
            obj = None
        if isinstance(obj, dict):
            typ = str(obj.get("type") or obj.get("event") or obj.get("role") or "").strip()
            # Prefer human-readable payload fields when present.
            for key in (
                "text",
                "message",
                "content",
                "delta",
                "thinking",
                "result",
                "name",
                "tool",
                "subtitle",
                "title",
            ):
                val = obj.get(key)
                if isinstance(val, str) and val.strip():
                    text = val.strip()
                    break
                if isinstance(val, list):
                    parts: list[str] = []
                    for item in val:
                        if isinstance(item, str):
                            parts.append(item)
                        elif isinstance(item, dict):
                            maybe = item.get("text") or item.get("content")
                            if isinstance(maybe, str):
                                parts.append(maybe)
                    if parts:
                        text = " ".join(parts).strip()
                        break
            if typ:
                label = typ
            elif obj.get("subtype"):
                label = str(obj.get("subtype"))
            # Skip empty keepalive / noise objects.
            if not text or text == s:
                keys = ",".join(sorted(obj.keys())[:6])
                text = f"keys={keys}" if keys else "event"
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None
    if len(text) > max_chars:
        text = text[: max_chars - 1] + "…"
    return f"{label}: {text}"


def run_subprocess_timeout(
    cmd: list[str],
    cwd: Path,
    timeout_sec: int,
    log_path: Path,
    *,
    heartbeat_sec: float = 30.0,
    tee_to_terminal: bool = True,
    tee_max_chars: int = 140,
) -> tuple[int, bool]:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("w", encoding="utf-8") as log:
        log.write(f"# cmd: {json.dumps(cmd)}\n")
        log.write(f"# cwd: {cwd}\n")
        log.write(f"# started: {utc_now_iso()}\n\n")
        log.flush()
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=str(cwd),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
        except OSError as exc:
            log.write(f"failed to start: {exc}\n")
            status(f"failed to start agent: {exc}")
            return 127, False

        timed_out = False
        started = time.time()
        deadline = started + timeout_sec
        last_heartbeat = started
        last_output_at = started
        line_count = 0
        teed_count = 0
        assert proc.stdout is not None
        status(
            f"agent started pid={proc.pid} timeout={_fmt_duration(timeout_sec)} "
            f"log={log_path.name}"
        )
        try:
            while True:
                now = time.time()
                if now > deadline:
                    timed_out = True
                    proc.send_signal(signal.SIGTERM)
                    try:
                        proc.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                    log.write("\n# timed out; sent SIGTERM/KILL\n")
                    status(
                        f"agent TIMED OUT after {_fmt_duration(now - started)} "
                        f"({line_count} log lines)"
                    )
                    break
                line = proc.stdout.readline()
                if line:
                    log.write(line)
                    log.flush()
                    line_count += 1
                    last_output_at = now
                    if tee_to_terminal:
                        preview = summarize_agent_line(line, max_chars=tee_max_chars)
                        if preview:
                            # Avoid flooding: tee first lines aggressively, then every Nth.
                            should_tee = teed_count < 12 or line_count % 8 == 0
                            if should_tee:
                                status(preview)
                                teed_count += 1
                elif proc.poll() is not None:
                    # Drain remainder
                    rest = proc.stdout.read()
                    if rest:
                        log.write(rest)
                        line_count += rest.count("\n") or 1
                    break
                else:
                    if now - last_heartbeat >= heartbeat_sec:
                        idle = now - last_output_at
                        remaining = max(0.0, deadline - now)
                        status(
                            f"agent still running… elapsed={_fmt_duration(now - started)} "
                            f"idle={_fmt_duration(idle)} lines={line_count} "
                            f"timeout_in={_fmt_duration(remaining)}"
                        )
                        last_heartbeat = now
                    time.sleep(0.05)
        finally:
            code = proc.poll()
            if code is None:
                proc.kill()
                code = proc.wait()
        elapsed = time.time() - started
        log.write(f"\n# ended: {utc_now_iso()} exit={code} timed_out={timed_out}\n")
        status(
            f"agent finished exit={code} timed_out={timed_out} "
            f"elapsed={_fmt_duration(elapsed)} lines={line_count}"
        )
        return int(code if code is not None else 1), timed_out


def run_cmd_capture(cmd: list[str], cwd: Path, timeout_sec: int = 600) -> tuple[int, str]:
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout_sec,
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        return proc.returncode, out
    except subprocess.TimeoutExpired as exc:
        return 124, f"timeout: {exc}"
    except OSError as exc:
        return 127, str(exc)


def git_status_porcelain(project_root: Path) -> str:
    code, out = run_cmd_capture(["git", "status", "--porcelain"], project_root, 60)
    if code != 0:
        return f"<git status failed: {out.strip()}>"
    return out


def load_state(path: Path) -> RunnerState:
    if not path.exists():
        st = RunnerState(created_at=utc_now_iso(), updated_at=utc_now_iso())
        return st
    data = load_json(path)
    return RunnerState(
        version=int(data.get("version", 1)),
        created_at=data.get("created_at") or utc_now_iso(),
        updated_at=data.get("updated_at") or utc_now_iso(),
        sessions_run=int(data.get("sessions_run", 0)),
        consecutive_test_failures=int(data.get("consecutive_test_failures", 0)),
        consecutive_no_checkpoint_update=int(data.get("consecutive_no_checkpoint_update", 0)),
        last_next_task_hash=data.get("last_next_task_hash") or "",
        identical_next_task_streak=int(data.get("identical_next_task_streak", 0)),
        sessions_today=int(data.get("sessions_today", 0)),
        sessions_today_date=data.get("sessions_today_date") or "",
        last_stop_reason=data.get("last_stop_reason") or "",
        completed=bool(data.get("completed", False)),
        history=list(data.get("history") or []),
    )


def persist_state(path: Path, state: RunnerState) -> None:
    state.updated_at = utc_now_iso()
    save_json(path, asdict(state))


def bump_daily_session_counter(state: RunnerState) -> None:
    today = date.today().isoformat()
    if state.sessions_today_date != today:
        state.sessions_today_date = today
        state.sessions_today = 0
    state.sessions_today += 1


def evaluate_completion(
    config: dict[str, Any],
    project_root: Path,
    tests_ok: Optional[bool],
    build_ok: Optional[bool],
) -> tuple[bool, dict[str, Any]]:
    req = config.get("completion_requires") or {}
    spec_path = project_root / config["spec_path"]
    ck_path = project_root / config["checkpoint_path"]
    spec_text = spec_path.read_text(encoding="utf-8") if spec_path.exists() else ""
    ck_text = ck_path.read_text(encoding="utf-8") if ck_path.exists() else ""
    ck_steps = parse_checkpoint_steps(ck_text)

    details: dict[str, Any] = {}
    ok = True
    # Any completion_requires key like step_N is checked against SPEC status.
    for key, want in req.items():
        m = re.fullmatch(r"step_(\d+)", str(key))
        if not m:
            continue
        step = int(m.group(1))
        from_spec = parse_step_status(spec_text, step)
        from_ck = ck_steps.get(str(step))
        # STEP Done only if SPEC says Done (authoritative roadmap / § headings).
        step_ok = from_spec == want
        details[key] = {
            "required": want,
            "spec": from_spec,
            "checkpoint": from_ck,
            "ok": step_ok,
        }
        if not step_ok:
            ok = False

    if req.get("tests_pass", True):
        details["tests_pass"] = {"ok": tests_ok is True, "value": tests_ok}
        if tests_ok is not True:
            ok = False
    if req.get("build_pass", True):
        details["build_pass"] = {"ok": build_ok is True, "value": build_ok}
        if build_ok is not True:
            ok = False

    if req.get("ecology_mode_preserved", True):
        ecology_ok = (
            "ecology" in spec_text.lower()
            and re.search(r"Ecology.*보존|Ecology mode|mode.*ecology", spec_text, re.I) is not None
        )
        # Heuristic code presence check
        lab_mode = project_root / "src" / "simulation" / "labMode.ts"
        ecology_ok = ecology_ok and lab_mode.exists()
        details["ecology_mode_preserved"] = {"ok": ecology_ok}
        if not ecology_ok:
            ok = False

    if req.get("save_compat_confirmed", True):
        migrate = project_root / "src" / "experiments" / "migrate.ts"
        compat_ok = migrate.exists() and (
            "schemaVersion" in spec_text or "EXPERIMENT_SCHEMA_VERSION" in spec_text
        )
        # Prefer explicit checkpoint validation mention for STEP 17 completion era;
        # until then, structural presence is required but not sufficient alone for ok=True
        # when earlier steps incomplete — already handled by step checks.
        details["save_compat_confirmed"] = {"ok": compat_ok, "note": "structural checks"}
        if not compat_ok:
            ok = False

    return ok, details


def _checkpoint_prompt_excerpt(text: str, max_chars: int = 900) -> str:
    """Token-tight excerpt: Next Task + Queue head only (not full checkpoint/SPEC)."""
    next_task = extract_next_task(text).strip()
    queue_match = re.search(
        r"##\s*Queue\s*\n(.*?)(?=\n##\s|\Z)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    queue_lines: list[str] = []
    if queue_match:
        for raw in queue_match.group(1).splitlines():
            line = raw.strip()
            if not line:
                continue
            queue_lines.append(line)
            if len(queue_lines) >= 3:
                break
    parts = [
        f"## Next Task\n{next_task or '(missing)'}",
    ]
    if queue_lines:
        parts.append("## Queue (next)\n" + "\n".join(queue_lines))
    step = re.search(r"Current Step:\s*([^\n]+)|Step:\s*([^\n]+)", text, re.I)
    if step:
        parts.insert(0, f"Step: {(step.group(1) or step.group(2) or '').strip()}")
    excerpt = "\n\n".join(parts)
    if len(excerpt) > max_chars:
        return excerpt[: max_chars - 1] + "…"
    return excerpt


def compose_prompt(prompt_path: Path, project_root: Path, session_index: int) -> str:
    body = prompt_path.read_text(encoding="utf-8")
    ck = project_root / "docs" / "CURSOR_SESSION_STATE.md"
    ck_excerpt = ""
    if ck.exists():
        ck_excerpt = _checkpoint_prompt_excerpt(ck.read_text(encoding="utf-8"))
    return (
        f"{body}\n\n"
        f"---\n"
        f"S{session_index}. One slice. Update checkpoint Next Task←Queue. Short replies.\n\n"
        f"{ck_excerpt}\n"
    )


def stop_requested(stop_file: Path) -> bool:
    return stop_file.exists()


def write_stop_file(stop_file: Path, reason: str) -> None:
    stop_file.parent.mkdir(parents=True, exist_ok=True)
    stop_file.write_text(f"{utc_now_iso()}\n{reason}\n", encoding="utf-8")


def print_banner(msg: str) -> None:
    print(f"\n=== {msg} ===", flush=True)


def status(msg: str) -> None:
    """Timestamped progress line for long-running orchestrator work."""
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def checkpoint_status_summary(checkpoint_path: Path) -> str:
    if not checkpoint_path.exists():
        return "(checkpoint missing)"
    text = checkpoint_path.read_text(encoding="utf-8")
    cur = re.search(r"Current Step:\s*([^\n]+)", text, re.I)
    st = re.search(r"Step Status:\s*([^\n]+)", text, re.I)
    nxt = extract_next_task(text)
    nxt_one = re.sub(r"\s+", " ", nxt).strip()
    if len(nxt_one) > 160:
        nxt_one = nxt_one[:159] + "…"
    parts = []
    if cur:
        parts.append(cur.group(1).strip())
    if st:
        parts.append(f"status={st.group(1).strip()}")
    if nxt_one:
        parts.append(f"next={nxt_one}")
    return " | ".join(parts) if parts else "(no step/next-task fields)"


def cmd_verify(config: dict[str, Any], project_root: Path) -> int:
    print_banner("Orchestrator self-verification")
    errors: list[str] = []

    for rel in (
        config["agent_prompt_path"],
        config["checkpoint_path"],
        config["spec_path"],
    ):
        path = project_root / rel
        ok = path.exists()
        print(f"[{'OK' if ok else 'MISSING'}] {path}")
        if not ok:
            errors.append(f"missing {rel}")

    try:
        argv_prefix, desc = find_agent_launcher(config)
        print(f"[OK] agent launcher: {desc} -> {argv_prefix}")
    except RuntimeError as exc:
        print(f"[FAIL] agent launcher: {exc}")
        errors.append(str(exc))
        argv_prefix = []

    if argv_prefix:
        # Version
        code, out = run_cmd_capture([*argv_prefix, "--version"], project_root, 30)
        print(f"[OK] version exit={code}: {out.strip()[:120]}")
        # Help / print flag presence
        code, out = run_cmd_capture([*argv_prefix, "--help"], project_root, 60)
        help_text = out
        for flag in ("--print", "--trust", "--force", "--resume", "create-chat"):
            present = flag in help_text
            print(f"[{'OK' if present else 'FAIL'}] help mentions {flag}")
            if not present:
                errors.append(f"help missing {flag}")

        auth = check_auth(argv_prefix)
        print(f"[INFO] auth: {auth.get('reason')} | {auth.get('raw', '')[:160]}")
        if not auth.get("ok"):
            print(
                "[WARN] Not authenticated. Full -p agent runs will fail until "
                "`cursor agent login` or CURSOR_API_KEY is set."
            )

        if auth.get("ok"):
            chat_id = create_independent_chat(argv_prefix, timeout_sec=30)
            if chat_id:
                print(f"[OK] create-chat => {chat_id}")
                print("[OK] independent session id acquired (single create-chat probe)")
            else:
                print("[FAIL] create-chat did not return an id")
                errors.append("create-chat failed")
        else:
            print(
                "[WARN] skip create-chat while logged out "
                "(runner can omit --resume for independent -p sessions)"
            )

    # Dry cycle of checkpoint hashing / completion eval without agent
    ck = project_root / config["checkpoint_path"]
    before = file_sha256(ck)
    nth = next_task_hash(ck)
    print(f"[OK] checkpoint hash={before[:12]}… next_task_hash={nth[:12]}…")
    done, details = evaluate_completion(config, project_root, tests_ok=False, build_ok=False)
    print(f"[OK] completion currently={done}")
    print(json.dumps(details, indent=2, ensure_ascii=False)[:1500])

    # Stop file mechanism
    stop_file = project_root / config["stop_file"]
    if stop_file.exists():
        print(f"[INFO] stop file already present: {stop_file}")
    print(f"[OK] stop file path: {stop_file}")

    if errors:
        print_banner(f"VERIFY FAILED ({len(errors)})")
        for e in errors:
            print(f" - {e}")
        return 1
    print_banner("VERIFY PASSED (orchestrator mechanics)")
    print("Note: this does not mean STEP 18–20 product work is complete.")
    return 0


def run_loop(
    config: dict[str, Any],
    project_root: Path,
    max_sessions: int,
    dry_run: bool,
    resume: bool,
) -> int:
    state_path = project_root / config["state_file"]
    stop_file = project_root / config["stop_file"]
    prompt_path = project_root / config["agent_prompt_path"]
    checkpoint_path = project_root / config["checkpoint_path"]
    session_log_dir = project_root / config["session_log_dir"]
    session_log_dir.mkdir(parents=True, exist_ok=True)

    state = load_state(state_path) if resume else RunnerState(created_at=utc_now_iso())
    if not resume:
        persist_state(state_path, state)

    print_banner("Autonomous Runner")
    status(f"project_root={project_root}")
    status(f"max_sessions={max_sessions} dry_run={dry_run} resume={resume}")
    status(f"prior sessions_run={state.sessions_run} completed={state.completed}")
    status(f"checkpoint: {checkpoint_status_summary(checkpoint_path)}")
    porcelain = git_status_porcelain(project_root)
    dirty_n = len([ln for ln in porcelain.splitlines() if ln.strip()]) if porcelain else 0
    status(f"git dirty files={dirty_n}" + ("" if dirty_n == 0 else f"\n{porcelain}"))

    if config.get("require_git_clean_or_allow_dirty") == "require_clean":
        if porcelain.strip():
            status("Refusing to run on dirty git tree (require_clean).")
            return 2

    try:
        argv_prefix, desc = find_agent_launcher(config)
        status(f"agent launcher: {desc}")
    except RuntimeError as exc:
        status(str(exc))
        return 2

    if not dry_run:
        auth = check_auth(argv_prefix)
        if not auth.get("ok"):
            status(
                "Authentication required before live agent sessions. "
                "Run `cursor agent login` or set CURSOR_API_KEY."
            )
            status(f"auth detail: {auth}")
            return 3
        status(f"auth ok ({auth.get('reason')})")

    api_guard = config.get("api_usage_guard") or {}
    tests_ok: Optional[bool] = None
    build_ok: Optional[bool] = None
    heartbeat_sec = float(config.get("terminal_heartbeat_sec", 30))
    tee_agent = bool(config.get("terminal_tee_agent_output", True))

    for i in range(1, max_sessions + 1):
        if stop_requested(stop_file):
            reason = "stop_file_present"
            state.last_stop_reason = reason
            persist_state(state_path, state)
            print_banner(f"Stopped: {reason}")
            return 0

        if state.completed:
            print_banner("Already marked completed in runner state")
            return 0

        if api_guard.get("enabled", True):
            bump_daily_session_counter(state)
            # undo bump if we abort before starting? keep as scheduled attempt
            limit = api_guard.get("max_sessions_per_calendar_day")
            if limit is not None and state.sessions_today > int(limit):
                reason = "daily_session_cap"
                state.last_stop_reason = reason
                persist_state(state_path, state)
                print_banner(f"Stopped: {reason}")
                return 4

        print_banner(f"Session {i}/{max_sessions}")
        before_hash = file_sha256(checkpoint_path)
        before_task = next_task_hash(checkpoint_path)
        rec = SessionRecord(
            session_index=state.sessions_run + 1,
            started_at=utc_now_iso(),
            checkpoint_before_hash=before_hash,
            next_task_hash=before_task,
            dry_run=dry_run,
        )
        status(
            f"session_index={rec.session_index} "
            f"today={state.sessions_today} "
            f"no_ckpt_streak={state.consecutive_no_checkpoint_update} "
            f"test_fail_streak={state.consecutive_test_failures} "
            f"same_task_streak={state.identical_next_task_streak}"
        )
        status(f"before: {checkpoint_status_summary(checkpoint_path)}")
        status(f"checkpoint_hash={before_hash[:12] + '…' if before_hash else '(none)'}")

        prompt = compose_prompt(prompt_path, project_root, rec.session_index)
        log_path = session_log_dir / f"session_{rec.session_index:04d}_{int(time.time())}.log"
        rec.log_path = str(log_path)

        if dry_run:
            status(f"[dry-run] would run agent; prompt_chars={len(prompt)}")
            # Skip create-chat when logged out; it often hangs and is optional
            # (fresh -p without --resume still yields an independent session).
            auth = check_auth(argv_prefix)
            chat_id = None
            if auth.get("ok"):
                status("[dry-run] create-chat…")
                chat_id = create_independent_chat(argv_prefix, timeout_sec=20)
            else:
                status("[dry-run] skip create-chat (not authenticated)")
            rec.chat_id = chat_id
            status(f"[dry-run] create-chat => {chat_id}")
            cmd = build_agent_command(argv_prefix, config, project_root, "<prompt omitted>", chat_id)
            # Redact api key if present
            safe_cmd = []
            skip_next = False
            for part in cmd:
                if skip_next:
                    safe_cmd.append("<redacted>")
                    skip_next = False
                    continue
                if part == "--api-key":
                    safe_cmd.append(part)
                    skip_next = True
                else:
                    safe_cmd.append(part)
            status("[dry-run] cmd: " + " ".join(safe_cmd))
            log_path.write_text(
                json.dumps({"dry_run": True, "cmd": safe_cmd, "prompt_chars": len(prompt)}, indent=2)
                + "\n",
                encoding="utf-8",
            )
            rec.exit_code = 0
            rec.ended_at = utc_now_iso()
            # Dry-run does not mutate checkpoint; safety path should detect no update if we pretended live.
            after_hash = file_sha256(checkpoint_path)
            rec.checkpoint_after_hash = after_hash
            rec.checkpoint_updated = after_hash != before_hash and after_hash != ""
            rec.stop_reason = "dry_run_session"
            state.sessions_run += 1
            state.history.append(asdict(rec))
            state.last_stop_reason = "dry_run_session"
            persist_state(state_path, state)
            status("[dry-run] session recorded; no live agent work performed")
            # In dry-run, run only one simulated session unless user raised max.
            if i >= max_sessions:
                break
            continue

        status("create-chat…")
        chat_id = create_independent_chat(argv_prefix)
        rec.chat_id = chat_id
        if chat_id:
            status(f"chat_id={chat_id}")
        else:
            status("[WARN] create-chat failed; launching without --resume (still usually a new chat)")
        cmd = build_agent_command(argv_prefix, config, project_root, prompt, chat_id)
        timeout = int(config.get("session_timeout_sec", 1800))
        status(f"launching agent (timeout={_fmt_duration(timeout)}, prompt_chars={len(prompt)})")
        exit_code, timed_out = run_subprocess_timeout(
            cmd,
            project_root,
            timeout,
            log_path,
            heartbeat_sec=heartbeat_sec,
            tee_to_terminal=tee_agent,
        )
        rec.exit_code = exit_code
        rec.timed_out = timed_out
        rec.ended_at = utc_now_iso()

        after_hash = file_sha256(checkpoint_path)
        after_task = next_task_hash(checkpoint_path)
        rec.checkpoint_after_hash = after_hash
        rec.checkpoint_updated = bool(after_hash) and after_hash != before_hash
        status(
            f"checkpoint_updated={rec.checkpoint_updated} "
            f"hash={after_hash[:12] + '…' if after_hash else '(none)'} "
            f"next_task_changed={bool(after_task) and after_task != before_task}"
        )
        status(f"after: {checkpoint_status_summary(checkpoint_path)}")

        if config.get("run_tests_after_session", True):
            status("running tests…")
            t_code, t_out = run_cmd_capture(list(config.get("test_command") or ["npm", "test"]), project_root)
            tests_ok = t_code == 0
            rec.tests_ok = tests_ok
            (session_log_dir / f"session_{rec.session_index:04d}_tests.txt").write_text(t_out, encoding="utf-8")
            status(f"tests={'OK' if tests_ok else 'FAIL'} exit={t_code}")
            status("running build…")
            b_code, b_out = run_cmd_capture(list(config.get("build_command") or ["npm", "run", "build"]), project_root)
            build_ok = b_code == 0
            rec.build_ok = build_ok
            (session_log_dir / f"session_{rec.session_index:04d}_build.txt").write_text(b_out, encoding="utf-8")
            status(f"build={'OK' if build_ok else 'FAIL'} exit={b_code}")
        else:
            tests_ok = None
            build_ok = None
            status("tests/build skipped (run_tests_after_session=false)")

        # Safety counters
        if not rec.checkpoint_updated:
            state.consecutive_no_checkpoint_update += 1
        else:
            state.consecutive_no_checkpoint_update = 0

        if rec.tests_ok is False:
            state.consecutive_test_failures += 1
        elif rec.tests_ok is True:
            state.consecutive_test_failures = 0

        if after_task and after_task == state.last_next_task_hash:
            state.identical_next_task_streak += 1
        else:
            state.identical_next_task_streak = 1 if after_task else 0
        state.last_next_task_hash = after_task

        state.sessions_run += 1
        state.history.append(asdict(rec))

        completed, details = evaluate_completion(config, project_root, tests_ok, build_ok)
        (session_log_dir / f"session_{rec.session_index:04d}_completion.json").write_text(
            json.dumps(details, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        step_bits = []
        for key in sorted(
            (k for k in details if str(k).startswith("step_")),
            key=lambda k: int(str(k).split("_", 1)[1]),
        ):
            info = details.get(key) or {}
            if not info:
                continue
            step_bits.append(f"{key}={info.get('spec') or '?'}({'ok' if info.get('ok') else 'no'})")
        status(
            f"completion={completed} "
            + " ".join(step_bits)
            + f" tests={details.get('tests_pass', {}).get('ok')} "
            f"build={details.get('build_pass', {}).get('ok')}"
        )

        stop_reason = None
        if timed_out:
            stop_reason = "session_timeout"
        elif exit_code not in (0,):
            # Non-zero from agent is a warning; stop only if checkpoint also stagnates later.
            status(f"[WARN] agent exit_code={exit_code}")
        # Prefer product completion over stagnation stops (Done work may leave Next Task empty).
        if completed:
            stop_reason = "completion_criteria_met"
            state.completed = True
        elif state.consecutive_test_failures >= int(config.get("max_consecutive_test_failures", 2)):
            stop_reason = "consecutive_test_failures"
        elif state.consecutive_no_checkpoint_update >= int(
            config.get("max_consecutive_no_checkpoint_update", 1)
        ):
            stop_reason = "checkpoint_not_updated"
        elif state.identical_next_task_streak > int(config.get("max_identical_next_task_repeats", 2)):
            stop_reason = "identical_next_task_loop"

        if stop_requested(stop_file):
            stop_reason = "stop_file_present"

        if stop_reason:
            rec.stop_reason = stop_reason
            state.history[-1] = asdict(rec)
            state.last_stop_reason = stop_reason
            persist_state(state_path, state)
            print_banner(f"Stopped: {stop_reason}")
            status(
                f"streaks: no_ckpt={state.consecutive_no_checkpoint_update} "
                f"test_fail={state.consecutive_test_failures} "
                f"same_task={state.identical_next_task_streak}"
            )
            print(json.dumps(details, indent=2, ensure_ascii=False)[:2000], flush=True)
            return 0 if stop_reason == "completion_criteria_met" else 1

        persist_state(state_path, state)
        status(
            f"session done exit={exit_code} checkpoint_updated={rec.checkpoint_updated} "
            f"tests={rec.tests_ok} build={rec.build_ok} "
            f"log={log_path.name}"
        )

    state.last_stop_reason = "max_sessions_reached"
    persist_state(state_path, state)
    print_banner("Stopped: max_sessions_reached")
    status("Note: max sessions is a safety limit, not product completion.")
    return 0


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Autonomous Cursor Agent orchestrator for Artificial Life Simulator",
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH)
    parser.add_argument("--max-sessions", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true", help="Validate wiring without live coding agent")
    parser.add_argument("--resume", action="store_true", help="Continue from scripts/runner_state state file")
    parser.add_argument(
        "--stop",
        action="store_true",
        help="Write STOP file so a running/next loop exits safely",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Self-test CLI discovery, create-chat, checkpoint/completion wiring",
    )
    parser.add_argument(
        "--clear-stop",
        action="store_true",
        help="Remove STOP file",
    )
    args = parser.parse_args(argv)

    config_path = args.config.resolve()
    if not config_path.exists():
        print(f"Config not found: {config_path}", file=sys.stderr)
        return 2
    config = load_json(config_path)
    project_root = resolve_project_root(config, config_path)

    stop_file = project_root / config["stop_file"]
    if args.clear_stop:
        if stop_file.exists():
            stop_file.unlink()
            print(f"Removed {stop_file}")
        else:
            print("No stop file present")
        return 0

    if args.stop:
        write_stop_file(stop_file, "user_requested_stop")
        print(f"Wrote {stop_file}")
        return 0

    if args.verify:
        return cmd_verify(config, project_root)

    if args.max_sessions is not None:
        max_sessions = args.max_sessions
    elif args.dry_run:
        # Dry-run validates wiring; default to a single simulated cycle.
        max_sessions = 1
    else:
        max_sessions = int(config.get("max_sessions", 10))
    return run_loop(
        config=config,
        project_root=project_root,
        max_sessions=max_sessions,
        dry_run=bool(args.dry_run),
        resume=bool(args.resume),
    )


if __name__ == "__main__":
    raise SystemExit(main())
