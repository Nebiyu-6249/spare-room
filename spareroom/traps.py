"""Trap registry and the demo target list.

A trap is a harmless fixture, one per documented trick, that runs on some
trigger (opening a folder, installing a package, running a dev script). Every
trap calls the single probe in probe.py, which only checks path reachability and
never reads contents or uses the network. The harness (phase 4) runs every trap
in both accounts; phase 1 ships the VS Code folder-open trap.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List

from .models import TrapResult
from .probe import run
from .scanner import demo_roots

# The planted secret paths in the bundled fake laptop, relative to its home dir.
# These mirror what the campaigns in locations.py reach for.
_DEMO_HOME_RELATIVE = [
    ".ssh/id_rsa",
    ".aws/credentials",
    "AppData/Roaming/gcloud/application_default_credentials.json",
    ".azure/azureProfile.json",
    ".npmrc",
    "AppData/Roaming/GitHub CLI/hosts.yml",
    ".config/solana/id.json",
    "AppData/Roaming/Exodus/exodus.wallet/seed.seco",
    ".claude/.credentials.json",
    "AppData/Roaming/Microsoft/Windows/PowerShell/PSReadLine/ConsoleHost_history.txt",
    "AppData/Local/Google/Chrome/User Data/Default/Login Data",
    "AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings/nkbihfbeogaeaoehlefnkodbefgpgknn/000003.log",
    "projects/demo-app/.env",
]


def demo_targets(demo_base: Path = None) -> List[Path]:
    base = demo_base or (Path(__file__).resolve().parent.parent / "demo" / "fake_laptop")
    home, _ = demo_roots(base)
    return [home.joinpath(*rel.split("/")) for rel in _DEMO_HOME_RELATIVE]


@dataclass(frozen=True)
class Trap:
    id: str
    trigger: str
    description: str
    folder: str  # path under traps/, for the README and fixture


TRAPS = [
    Trap("vscode_task", "VS Code task on folder open",
         "A .vscode/tasks.json with runOn: folderOpen runs when the folder is opened in a trusted workspace.",
         "vscode_task"),
    # Added in phase 4: npm_preinstall, blank_lines_dev, python_setup, claude_startup_hook.
]


def fire_trap(trap: Trap, account_label: str, targets: List[Path] = None) -> TrapResult:
    """Run a trap's probe and return a TrapResult. Phase 1 uses the demo targets."""
    paths = [str(p) for p in (targets if targets is not None else demo_targets())]
    result = run(trap.id, trap.trigger, paths, account_label)
    return TrapResult(**result)
