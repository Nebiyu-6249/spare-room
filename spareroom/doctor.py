"""`doctor`: run inside the interview account to see whether the usual coding
tools are available there, and how to install any that are missing for all users.

Read-only and offline: it looks each tool up on PATH and runs `<tool> --version`
(npm with its update check turned off). It installs and changes nothing.

Install routes are from official sources: winget package IDs checked with
`winget show`, `--scope machine` from winget's own help, VS Code's "System
setup" from https://code.visualstudio.com/docs/setup/windows, the Python full
installer's "Customize installation" from https://docs.python.org/3/using/windows.html,
and Git for Windows' installers from https://git-scm.com/install/windows.
Installing for all users needs administrator rights, so run these from your
own (administrator) account, not from the interview account.
"""

from __future__ import annotations

import datetime
import os
import shutil
import subprocess
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Callable, List, Optional

ALL_USERS, THIS_ACCOUNT, OTHER = "all users", "this account only", "other"

# name, what it is, how to install it for all users
TOOLS = [
    ("node", "Node.js",
     "Install Node.js LTS for all users: winget install --id OpenJS.NodeJS.LTS -e --scope machine "
     "(from an administrator terminal), or run the Windows Installer (.msi) from nodejs.org."),
    ("npm", "npm (comes with Node.js)",
     "npm is installed with Node.js. Install Node.js LTS for all users: "
     "winget install --id OpenJS.NodeJS.LTS -e --scope machine."),
    ("python", "Python",
     "Install Python for all users: winget install --id Python.Python.3.12 -e --scope machine, or run the "
     "python.org full installer, choose Customize installation and pick the all-users option."),
    ("git", "Git",
     "Install Git for all users: winget install --id Git.Git -e --scope machine, or run the "
     "Git for Windows x64 Setup from git-scm.com as an administrator."),
    ("code", "VS Code",
     "Install VS Code with the System setup (not the User setup) from code.visualstudio.com, or: "
     "winget install --id Microsoft.VisualStudioCode -e --scope machine."),
]

PER_ACCOUNT_NOTE = ("A copy installed only in another account (for example VS Code's User setup under "
                    "%LOCALAPPDATA%) is not available here.")


@dataclass
class ToolStatus:
    name: str
    label: str
    found: bool
    path: Optional[str]
    scope: Optional[str]
    version: Optional[str]
    note: str
    install: str

    def to_dict(self) -> dict:
        return asdict(self)


def _norm(p: str) -> str:
    return os.path.normcase(os.path.abspath(p))


def scope_of(path: str, env: dict = None) -> str:
    """Where a tool lives: shared by every account, inside this account's own
    folder, or somewhere else."""
    env = env if env is not None else os.environ
    p = _norm(path)
    shared = [env.get(k) for k in ("ProgramFiles", "ProgramFiles(x86)", "ProgramW6432", "ProgramData", "SystemRoot")]
    if any(s and p.startswith(_norm(s) + os.sep) for s in shared):
        return ALL_USERS
    home = env.get("USERPROFILE") or os.path.expanduser("~")
    if home and p.startswith(_norm(home) + os.sep):
        return THIS_ACCOUNT
    return OTHER


def is_store_alias(path: str) -> bool:
    """The `python` App Execution Alias in ...\\Microsoft\\WindowsApps only
    opens the Microsoft Store when Python is not installed."""
    parts = [x.lower() for x in Path(path).parts]
    return "windowsapps" in parts and Path(path).stem.lower() in ("python", "python3")


def _version(path: str, timeout: int = 15) -> Optional[str]:
    env = dict(os.environ, NO_UPDATE_NOTIFIER="1", npm_config_update_notifier="false")
    try:
        out = subprocess.run([path, "--version"], capture_output=True, text=True, timeout=timeout, env=env)
    except (OSError, subprocess.SubprocessError):
        return None
    text = (out.stdout or out.stderr or "").strip()
    return text.splitlines()[0].strip() if text else None


def check(which: Callable = shutil.which, version: Callable = _version, env: dict = None) -> List[ToolStatus]:
    results = []
    for name, label, install in TOOLS:
        path = which(name)
        if path and is_store_alias(path):
            results.append(ToolStatus(name, label, False, None, None, None,
                                      "Only the Microsoft Store shortcut is present; Python itself is not installed.",
                                      install))
            continue
        if not path:
            results.append(ToolStatus(name, label, False, None, None, None, PER_ACCOUNT_NOTE, install))
            continue
        results.append(ToolStatus(name, label, True, path, scope_of(path, env), version(path), "", ""))
    return results


def report(results: List[ToolStatus], account_label: str = "") -> dict:
    return {
        "account_label": account_label or os.environ.get("USERNAME", ""),
        "ran_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "tools": [r.to_dict() for r in results],
    }


def print_report(results: List[ToolStatus]) -> None:
    ready = sum(1 for r in results if r.found)
    print(f"{ready} of {len(results)} coding tools are available in this account.\n")
    for r in results:
        if r.found:
            where = "" if r.scope == ALL_USERS else f" ({r.scope})"
            print(f"  available  {r.label:<26} {r.version or ''}{where}")
        else:
            print(f"  missing    {r.label}")
            if r.note:
                print(f"             {r.note}")
            print(f"             {r.install}")
    if ready < len(results):
        print("\nInstalling for all users needs administrator rights: run these from your own account,")
        print("then sign in to this one again.")
