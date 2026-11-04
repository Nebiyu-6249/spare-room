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
        state["readable"] = len(xf)
        sf = settings_findings(home)
        return xf + sf, xc + 3

    report = scan_roots(home, drives, mode="real",
                        account_label=account_label or os.environ.get("USERNAME", ""),
                        budget_seconds=budget_seconds, extra=extra)
    blocked = state.get("blocked", 0)
    report.groups = group_findings(report, home, blocked + state.get("readable", 0), blocked)
    return report, blocked


def group_findings(report: ScanReport, home: Path, other_present: int, other_blocked: int) -> dict:
    """Split verify's findings into what it means for the person reading it.

    other   - known secret locations in the user's other accounts: how many
              exist, how many are out of reach, and any that are readable
    shared  - readable from here but outside this account (for example a .env
              every account can read): things stranger code could take
    own     - this account's own files; in a new spare room they hold nothing
              of the user's, so they are information, never high
    missing - protections finish-setup should have applied here
    Only `other.readable` and `shared` count as things stranger code could take.
    """
    own_root = os.path.normcase(str(home))
    other, shared, own, missing = [], [], [], []
    for f in report.findings:
        p = os.path.normcase(f.path)
        if f.id.startswith("xprofile"):
            other.append(f)
        elif f.id.startswith("setting-missing"):
            missing.append(f)
        elif p == own_root or p.startswith(own_root + os.sep):
            f.severity = "info"
            own.append(f)
        else:
            shared.append(f)
    return {"other": {"present": other_present, "out_of_reach": other_blocked, "readable": other},
            "shared": shared, "own": own, "missing": missing,
            "takeable": len(other) + len(shared)}


def groups_to_dict(groups: dict) -> dict:
    o = groups["other"]
    return {
        "takeable": groups["takeable"],
        "other_accounts": {"present": o["present"], "out_of_reach": o["out_of_reach"],
                           "readable": [f.to_dict() for f in o["readable"]]},
        "readable_by_every_account": [f.to_dict() for f in groups["shared"]],
        "this_account_own_files": [f.to_dict() for f in groups["own"]],
        "not_applied": [f.to_dict() for f in groups["missing"]],
    }
