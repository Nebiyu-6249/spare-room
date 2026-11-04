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

# The fake secrets in the bundled fake laptop, relative to its home dir, with
# their category. These mirror what the campaigns in locations.py reach for.
DEMO_TARGETS = [
    ("ssh", ".ssh/id_rsa"),
    ("cloud", ".aws/credentials"),
    ("cloud", "AppData/Roaming/gcloud/application_default_credentials.json"),
    ("cloud", ".azure/azureProfile.json"),
    ("token", ".npmrc"),
    ("token", "AppData/Roaming/GitHub CLI/hosts.yml"),
    ("desktop_wallet", ".config/solana/id.json"),
    ("desktop_wallet", "AppData/Roaming/Exodus/exodus.wallet/seed.seco"),
    ("ai_tool", ".claude/.credentials.json"),
    ("shell_history", "AppData/Roaming/Microsoft/Windows/PowerShell/PSReadLine/ConsoleHost_history.txt"),
    ("browser_store", "AppData/Local/Google/Chrome/User Data/Default/Login Data"),
    ("wallet_extension",
     "AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings/nkbihfbeogaeaoehlefnkodbefgpgknn/000003.log"),
    ("env_file", "projects/demo-app/.env"),
]


def bundled_fake_laptop() -> Path:
    return Path(__file__).resolve().parent.parent / "demo" / "fake_laptop"


def demo_target_rows(demo_base: Path = None) -> List[tuple]:
    """(category, path relative to the fake home, absolute path) for each fake secret."""
    home, _ = demo_roots(demo_base or bundled_fake_laptop())
    return [(cat, rel, home.joinpath(*rel.split("/"))) for cat, rel in DEMO_TARGETS]


def demo_targets(demo_base: Path = None) -> List[Path]:
    return [p for _, _, p in demo_target_rows(demo_base)]


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
