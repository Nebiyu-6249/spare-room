"""`verify`: run inside the interview account to list what is still reachable.

It does three things on top of a normal scan of this account:
  1. Looks into every other profile under C:\\Users for the same known secret
     locations. In a working setup each one is blocked; anything visible is a
     finding (for example a profile whose permissions were loosened).
  2. The normal all-drive .env hunt already reports any .env this account can
     list, such as one on D:\\ that every user can read.
  3. Notes any protection finish-setup should have applied but did not.

Only metadata is queried (os.stat, os.access, directory listings); no file
contents are read and nothing touches the network.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Tuple

from . import locations as L
from .hardening import check_applied
from .models import Finding, ScanReport
from .probe import check_paths
from .scanner import real_roots, scan_roots

# Profile folders that are not real people.
_SKIP_PROFILES = {"public", "default", "default user", "all users", "defaultuser0", "defaultapppool"}


def home_relative_targets() -> List[Tuple[str, Tuple[str, ...]]]:
    """(category, path parts) for every known secret location under a home dir."""
    targets = [(s.category, s.rel) for s in L.SPECS if s.rel and s.check != "claude_creds"]
    targets += [("ai_tool", (".claude", ".credentials.json")), ("ai_tool", (".claude.json",))]
    for _, rel in L.BROWSER_USER_DATA:
        targets.append(("browser_store", rel + ("Local State",)))
        for profile in L.BROWSER_PROFILES:
            targets.append(("browser_store", rel + (profile, "Login Data")))
            for extid in L.WALLET_EXTENSIONS:
                targets.append(("wallet_extension", rel + (profile, "Local Extension Settings", extid)))
    return targets


def other_profiles(users_root: Path, own_home: Path) -> List[Path]:
    try:
        entries = list(os.scandir(users_root))
    except OSError:
        return []
    own = os.path.normcase(str(own_home))
    out = []
    for e in entries:
        try:
            if not e.is_dir(follow_symlinks=False):
                continue
        except OSError:
            continue
        if e.name.lower() in _SKIP_PROFILES or os.path.normcase(e.path) == own:
            continue
        out.append(Path(e.path))
    return out


def cross_profile_findings(users_root: Path, own_home: Path,
                           only_profiles=None) -> Tuple[List[Finding], int, int]:
    """Return (findings, locations_checked, blocked_count). With only_profiles,
    look only at those profile folder names and leave everyone else's alone."""
    findings: List[Finding] = []
    checked = 0
    blocked_total = 0
    targets = home_relative_targets()
    profiles = other_profiles(users_root, own_home)
    if only_profiles is not None:
        wanted = {n.lower() for n in only_profiles}
        profiles = [p for p in profiles if p.name.lower() in wanted]
    for profile in profiles:
        paths = [str(profile.joinpath(*rel)) for _, rel in targets]
        checked += len(paths)
        visible, blocked = check_paths(paths)
        blocked_total += len(blocked)
        category_of = {str(profile.joinpath(*rel)): cat for cat, rel in targets}
        for i, v in enumerate(visible):
            findings.append(Finding(
                f"xprofile-{profile.name}-{i}".lower(), category_of.get(v, "token"), v,
                "another account's secret file is readable", "high",
                "This file belongs to a different account but code running here can read it.",
                "Fix the permissions on this file or folder, or move it somewhere only its owner can read.",
                None))
    return findings, checked, blocked_total


def settings_findings(home: Path) -> List[Finding]:
    missing = check_applied(home)
    return [Finding(
        f"setting-missing-{i}", "editor_setting", str(home), f"not applied: {name}", "medium",
        "finish-setup normally turns this on for the interview account.",
        "Run finish-setup again inside this account.",
        L.SRC_VSCODE_TASKS if name.startswith("VS Code") else None)
        for i, name in enumerate(missing)]


def verify(home: Path = None, drives: List[Path] = None, users_root: Path = None,
           account_label: str = "", budget_seconds: float = 50.0,
           only_profiles=None) -> Tuple[ScanReport, int]:
    """Return (report, blocked_count). blocked_count is how many known secret
    locations in other profiles were correctly out of reach."""
    if home is None or drives is None:
        real_home, real_drives = real_roots()
        home = home or real_home
        drives = drives if drives is not None else real_drives
    users_root = users_root or home.parent
    state = {}

    def extra():
        xf, xc, blocked = cross_profile_findings(users_root, home, only_profiles)
        state["blocked"] = blocked
        sf = settings_findings(home)
        return xf + sf, xc + 3

    report = scan_roots(home, drives, mode="real",
                        account_label=account_label or os.environ.get("USERNAME", ""),
                        budget_seconds=budget_seconds, extra=extra)
    return report, state.get("blocked", 0)
