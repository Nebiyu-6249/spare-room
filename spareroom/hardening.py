"""Safer editor, npm and AI-tool defaults for the interview account.

Run once inside the new account by `finish-setup`. Each step edits one user
settings file, keeps a backup of anything it changes, and reports what it did.
Setting names are checked against the official docs:

  VS Code  security.workspace.trust.enabled = true  (default true)
           task.allowAutomaticTasks = "off"         (values: on | off)
           https://code.visualstudio.com/docs/editing/workspaces/workspace-trust
           https://code.visualstudio.com/docs/debugtest/tasks
  npm      ignore-scripts = true  (default false: "If true, npm does not run
           scripts specified in package.json files"; scripts you call by name,
           such as npm start or npm run dev, still run)
           https://docs.npmjs.com/cli/v10/using-npm/config
  Claude   disableAllHooks = true; permissions.disableBypassPermissionsMode = "disable"
           https://code.claude.com/docs/en/hooks
           https://code.claude.com/docs/en/permissions
           A repo's own .claude/settings.json can set disableAllHooks back to
           false, so this is a default, not a guarantee.

No Gemini CLI setting is applied: its settings docs could not be confirmed.
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

BACKUP_SUFFIX = ".spareroom-backup"


@dataclass
class StepResult:
    name: str
    path: str
    changes: List[str] = field(default_factory=list)
    note: str = ""
    error: str = ""

    def to_dict(self) -> dict:
        return {"name": self.name, "path": self.path, "changes": self.changes,
                "note": self.note, "error": self.error}


# --- JSON with comments (VS Code and Claude settings allow them) -------------

def strip_jsonc(text: str) -> str:
    """Remove // and /* */ comments and trailing commas, leaving strings intact."""
    out = []
    i, n = 0, len(text)
    in_str = False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
        elif c == "/" and i + 1 < n and text[i + 1] == "/":
            while i < n and text[i] not in "\r\n":
                i += 1
        elif c == "/" and i + 1 < n and text[i + 1] == "*":
            end = text.find("*/", i + 2)
            i = n if end == -1 else end + 2
        else:
            out.append(c)
            i += 1
    cleaned = "".join(out)
    # Drop trailing commas before a closing brace or bracket (outside strings,
    # which the pass above has already preserved verbatim).
    result = []
    in_str = False
    i, n = 0, len(cleaned)
    while i < n:
        c = cleaned[i]
        if in_str:
            result.append(c)
            if c == "\\" and i + 1 < n:
                result.append(cleaned[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
        elif c == ",":
            j = i + 1
            while j < n and cleaned[j] in " \t\r\n":
                j += 1
            if j < n and cleaned[j] in "}]":
                i += 1
                continue
        result.append(c)
        i += 1
    return "".join(result)


def _load_settings(path: Path) -> dict:
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8-sig")
    if not text.strip():
        return {}
    data = json.loads(strip_jsonc(text))
    if not isinstance(data, dict):
        raise ValueError("settings file is not a JSON object")
    return data


def _write_settings(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        shutil.copy2(path, path.with_name(path.name + BACKUP_SUFFIX))
    path.write_text(json.dumps(data, indent=4) + "\n", encoding="utf-8")


def _apply(data: dict, key: str, value, changes: List[str]) -> None:
    if data.get(key) != value:
        changes.append(f"{key}: {json.dumps(data.get(key))} -> {json.dumps(value)}")
        data[key] = value


# --- Individual steps --------------------------------------------------------

def vscode_settings_path(home: Path) -> Path:
    return home / "AppData" / "Roaming" / "Code" / "User" / "settings.json"


def harden_vscode(home: Path) -> StepResult:
    path = vscode_settings_path(home)
    step = StepResult("VS Code", str(path))
    try:
        data = _load_settings(path)
    except (ValueError, OSError) as e:
        step.error = f"Could not read settings ({e}). Nothing changed; add the two settings by hand."
        return step
    _apply(data, "security.workspace.trust.enabled", True, step.changes)
    _apply(data, "task.allowAutomaticTasks", "off", step.changes)
    if step.changes:
        _write_settings(path, data)
    step.note = "Folders open in Restricted Mode until you trust them; folder-open tasks never run on their own."
    return step


def npmrc_path(home: Path) -> Path:
    return home / ".npmrc"


def harden_npm(home: Path) -> StepResult:
    path = npmrc_path(home)
    step = StepResult("npm", str(path))
    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines() if path.exists() else []
    except OSError as e:
        step.error = f"Could not read .npmrc ({e}). Nothing changed."
        return step
    kept, previous = [], None
    for line in lines:
        key = line.split("=", 1)[0].strip().lower()
        if key == "ignore-scripts":
            previous = line.split("=", 1)[1].strip() if "=" in line else ""
            continue
        kept.append(line)
    if previous != "true":
        kept.append("ignore-scripts=true")
        step.changes.append(f"ignore-scripts: {json.dumps(previous)} -> \"true\"")
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            shutil.copy2(path, path.with_name(path.name + BACKUP_SUFFIX))
        path.write_text("\n".join(kept) + "\n", encoding="utf-8")
    step.note = ("npm install no longer runs preinstall/postinstall scripts. "
                 "Scripts you start by name (npm start, npm run dev) still run.")
    return step


def claude_settings_path(home: Path) -> Path:
    return home / ".claude" / "settings.json"


def harden_claude(home: Path) -> StepResult:
    path = claude_settings_path(home)
    step = StepResult("Claude Code", str(path))
    try:
        data = _load_settings(path)
    except (ValueError, OSError) as e:
        step.error = f"Could not read settings ({e}). Nothing changed."
        return step
    _apply(data, "disableAllHooks", True, step.changes)
    perms = data.get("permissions")
    if not isinstance(perms, dict):
        perms = {}
    if perms.get("disableBypassPermissionsMode") != "disable":
        step.changes.append(
            f"permissions.disableBypassPermissionsMode: {json.dumps(perms.get('disableBypassPermissionsMode'))} -> \"disable\"")
        perms["disableBypassPermissionsMode"] = "disable"
        data["permissions"] = perms
    if step.changes:
        _write_settings(path, data)
    step.note = ("Hooks are off by default and bypass-permissions mode is blocked. A repo's own "
                 ".claude/settings.json can turn hooks back on; for an untrusted repo, start Claude with "
                 "--settings '{\"disableAllHooks\": true}'.")
    return step


def apply_all(home: Path) -> List[StepResult]:
    return [harden_vscode(home), harden_npm(home), harden_claude(home)]


# --- Read-only checks used by verify ----------------------------------------

def check_applied(home: Path) -> List[str]:
    """Names of protections that are NOT in place for this home dir."""
    missing = []
    try:
        vs = _load_settings(vscode_settings_path(home))
        if vs.get("security.workspace.trust.enabled", True) is not True:
            missing.append("VS Code Workspace Trust")
        if vs.get("task.allowAutomaticTasks", "off") != "off":
            missing.append("VS Code automatic tasks off")
    except (ValueError, OSError):
        missing.append("VS Code settings (unreadable)")
    try:
        p = npmrc_path(home)
        lines = p.read_text(encoding="utf-8-sig").splitlines() if p.exists() else []
        on = any(l.split("=", 1)[0].strip().lower() == "ignore-scripts"
                 and l.split("=", 1)[-1].strip() == "true" for l in lines)
        if not on:
            missing.append("npm ignore-scripts")
    except OSError:
        missing.append("npm settings (unreadable)")
    try:
        cs = _load_settings(claude_settings_path(home))
        if cs.get("disableAllHooks") is not True:
            missing.append("Claude Code hooks off")
    except (ValueError, OSError):
        missing.append("Claude Code settings (unreadable)")
    return missing
