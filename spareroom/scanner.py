"""The scanner. Checks known locations, classifies by name/header/key-name, and
returns a ScanReport. It reads only what classification needs and never stores
or prints a secret value. Permission errors become a "could not check" finding,
never a crash.
"""

from __future__ import annotations

import datetime
import os
import time
from pathlib import Path
from typing import Iterator, List, Tuple

from . import TOOL_VERSION
from .access import VISIBLE, path_state
from .models import Finding, ScanReport
from . import locations as L


# --- Root resolution ---------------------------------------------------------

def demo_roots(base: Path) -> Tuple[Path, List[Path]]:
    """Home dir and drive roots inside the bundled fake laptop."""
    home = base / "C" / "Users" / "testdev"
    drives = [base / "C", base / "D"]
    return home, [d for d in drives if d.exists()]


def real_roots() -> Tuple[Path, List[Path]]:
    """Home dir and fixed-drive roots on the live machine."""
    home = Path(os.environ.get("USERPROFILE") or os.path.expanduser("~"))
    drives: List[Path] = []
    if os.name == "nt":
        for letter in "CDEFGHIJKLMNOPQRSTUVWXYZ":
            root = Path(f"{letter}:\\")
            if root.exists():
                drives.append(root)
    else:  # pragma: no cover - cross-platform dev convenience
        drives.append(Path("/"))
    return home, drives


# --- Small, side-effect-free helpers ----------------------------------------

def _exists(path: Path) -> bool:
    try:
        return path.exists()
    except OSError:
        return False


def _peek_header(path: Path, n: int = 40) -> bytes:
    """Read only the first n bytes, to *label* a file, never to keep its value."""
    with open(path, "rb") as fh:
        return fh.read(n)


def _could_not_check(spec_id: str, path: Path, category: str, source_ref: str) -> Finding:
    return Finding(
        id=f"{spec_id}-noaccess",
        category=category,
        path=str(path),
        kind="could not check",
        severity="info",
        reason="This location exists but could not be read (permission denied). Stranger code running as you might still reach it.",
        fix="Re-run from an account that can read it, or check its permissions.",
        source_ref=source_ref,
    )


# --- Per-check classifiers ---------------------------------------------------

def _check_simple(spec: L.LocationSpec, home: Path) -> Iterator[Finding]:
    path = home.joinpath(*spec.rel)
    if not _exists(path):
        return
    yield Finding(spec.id, spec.category, str(path), spec.kind, spec.severity,
                  spec.reason, spec.fix, spec.source_ref)


def _check_private_key(spec: L.LocationSpec, home: Path) -> Iterator[Finding]:
    path = home.joinpath(*spec.rel)
    if not _exists(path):
        return
    kind = spec.kind
    try:
        head = _peek_header(path)
        if head.startswith(b"-----BEGIN"):
            kind = "SSH private key (PEM)"
        elif head.startswith(b"PuTTY-User-Key"):
            kind = "PuTTY private key"
    except OSError:
        yield _could_not_check(spec.id, path, spec.category, spec.source_ref)
        return
    yield Finding(spec.id, spec.category, str(path), kind, spec.severity,
                  spec.reason, spec.fix, spec.source_ref)


def _check_npmrc(spec: L.LocationSpec, home: Path) -> Iterator[Finding]:
    path = home.joinpath(*spec.rel)
    if not _exists(path):
        return
    has_token = False
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                key = line.split("=", 1)[0].strip().lower()
                # Key names only; the value after "=" is never read or kept.
                if key.endswith("_authtoken") or key.endswith("_auth") or key.endswith(":_password"):
                    has_token = True
                    break
    except OSError:
        yield _could_not_check(spec.id, path, spec.category, spec.source_ref)
        return
    if has_token:
        yield Finding(spec.id, spec.category, str(path), "npm auth token present",
                      "high", spec.reason, spec.fix, spec.source_ref)
    else:
        yield Finding(spec.id, spec.category, str(path), ".npmrc (no auth-token key)",
                      "info",
                      "This .npmrc has no auth-token line, but it is still read by install scripts.",
                      spec.fix, spec.source_ref)


def _check_vscode_user(spec: L.LocationSpec, home: Path) -> Iterator[Finding]:
    path = home.joinpath(*spec.rel)
    if not _exists(path):
        return
    trust_off = False
    auto_on = False
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        yield _could_not_check(spec.id, path, spec.category, spec.source_ref)
        return
    # Cheap text probe for two risky settings; we record only these booleans.
    lowered = text.replace(" ", "")
    if '"security.workspace.trust.enabled":false' in lowered:
        trust_off = True
    if '"task.allowautomatictasks":"on"' in lowered.lower():
        auto_on = True
    if trust_off or auto_on:
        why = []
        if trust_off:
            why.append("Workspace Trust is disabled")
        if auto_on:
            why.append("automatic tasks are set to run")
        yield Finding(spec.id, spec.category, str(path),
                      "VS Code auto-run enabled", "high",
                      "Opening any folder can run its .vscode/tasks.json without asking: " + ", ".join(why) + ".",
                      "Turn Workspace Trust on and set task.allowAutomaticTasks to off.",
                      spec.source_ref)
    else:
        yield Finding(spec.id, spec.category, str(path),
                      "VS Code user settings", "info", spec.reason, spec.fix, spec.source_ref)


def _check_claude(spec: L.LocationSpec, home: Path) -> Iterator[Finding]:
    candidates = [
        (home / ".claude" / ".credentials.json", "Claude Code stored credentials", "high"),
        (home / ".claude.json", "Claude Code account config", "medium"),
        (home / ".claude" / "settings.json", "Claude Code settings (may define startup hooks)", "info"),
    ]
    for i, (path, kind, severity) in enumerate(candidates):
        if _exists(path):
            yield Finding(f"{spec.id}-{i}", spec.category, str(path), kind, severity,
                          spec.reason, spec.fix, spec.source_ref)


# --- Browser extension and password stores (scanner-driven) ------------------

def _check_wallets_and_stores(home: Path) -> Tuple[List[Finding], int]:
    findings: List[Finding] = []
    checked = 0
    for browser, rel in L.BROWSER_USER_DATA:
        user_data = home.joinpath(*rel)
        # Local State lives once at the User Data root (holds the decryption key).
        ls = user_data / "Local State"
        checked += 1
        if _exists(ls):
            findings.append(Finding(
                f"browser-{browser}-local_state".lower(), "browser_store", str(ls),
                f"{browser}: browser master key", "medium",
                "Local State holds the key that decrypts the saved-password DB.",
                "Keep browsers signed out in the interview account; do not sync profiles there.",
                L.SRC_T1555_003))
        for profile in L.BROWSER_PROFILES:
            prof = user_data / profile
            # Saved-password and autofill stores (browser_store), per profile.
            for fname, kind, severity, reason in (
                ("Login Data", "saved browser passwords", "high",
                 "Chromium stores site logins in Login Data (MITRE T1555.003). Stranger code can copy the DB and the key."),
                ("Web Data", "saved autofill and cards", "medium",
                 "Web Data holds autofill entries and saved payment cards."),
            ):
                path = prof / fname
                checked += 1
                if _exists(path):
                    findings.append(Finding(
                        f"browser-{browser}-{profile}-{fname}".replace(" ", "_").lower(),
                        "browser_store", str(path), f"{browser}: {kind}", severity,
                        reason, "Keep browsers signed out in the interview account; do not sync profiles there.",
                        L.SRC_T1555_003))
            # Wallet extension storage (wallet_extension).
            les = prof / "Local Extension Settings"
            for extid, name in L.WALLET_EXTENSIONS.items():
                path = les / extid
                checked += 1
                if _exists(path):
                    findings.append(Finding(
                        f"wallet-{browser}-{profile}-{extid}".lower(),
                        "wallet_extension", str(path), f"{name} wallet ({browser})", "high",
                        f"{name}'s browser-extension storage is present. BeaverTail enumerates these wallet extension IDs.",
                        "Do not install wallet extensions in the account where you run stranger code.",
                        L.SRC_UNIT42))
    return findings, checked


# --- .env hunt across drives -------------------------------------------------

def _check_env_files(drives: List[Path], deadline: float = None) -> Tuple[List[Finding], int]:
    findings: List[Finding] = []
    checked = 0
    for drive in drives:
        checked += 1
        drive_str = str(drive)
        truncated = False
        for n, (root, dirs, files) in enumerate(os.walk(drive, topdown=True, onerror=lambda e: None)):
            # Stop this drive if we are out of time, so a full scan stays bounded.
            if deadline is not None and (n & 0x3FF) == 0 and time.monotonic() > deadline:
                truncated = True
                break
            # Bound the walk and skip noisy/irrelevant trees (system + node_modules).
            depth = root[len(drive_str):].count(os.sep)
            if depth >= L.ENV_MAX_DEPTH:
                dirs[:] = []
            dirs[:] = [d for d in dirs if d not in L.ENV_SKIP_DIRS]
            for fname in files:
                if fname in L.ENV_FILENAMES:
                    path = Path(root) / fname
                    # Listed is not the same as readable; report only what this account can read.
                    if path_state(path) != VISIBLE:
                        continue
                    findings.append(Finding(
                        f"env-{len(findings)}", "env_file", str(path),
                        "environment file", "high",
                        "A .env usually holds API keys and connection strings. InvisibleFerret collects .env files across all drives, skipping node_modules.",
                        "Keep project .env files out of the interview account, or load secrets from a vault.",
                        L.SRC_UNIT42))
        if truncated:
            findings.append(Finding(
                f"env-timelimited-{drive_str}".replace("\\", "").replace(":", "").lower(),
                "env_file", drive_str, "env scan time-limited", "info",
                f"The .env search on {drive_str} ran out of time and did not finish. More .env files may exist here.",
                "Re-run the scan, or search this drive for .env files when you have more time.",
                L.SRC_UNIT42))
    return findings, checked


# --- Orchestration -----------------------------------------------------------

_SIMPLE_DISPATCH = {
    "exists": _check_simple,
    "private_key": _check_private_key,
    "npmrc_token": _check_npmrc,
    "vscode_user": _check_vscode_user,
    "claude_creds": _check_claude,
}


def scan(mode: str = "demo", demo_base: Path = None, account_label: str = "",
         budget_seconds: float = 50.0) -> ScanReport:
    if mode == "demo":
        base = demo_base or (Path(__file__).resolve().parent.parent / "demo" / "fake_laptop")
        home, drives = demo_roots(base)
    else:
        home, drives = real_roots()
    return scan_roots(home, drives, mode=mode, account_label=account_label,
                      budget_seconds=budget_seconds)


def scan_roots(home: Path, drives: List[Path], mode: str = "real", account_label: str = "",
               budget_seconds: float = 50.0, extra=None) -> ScanReport:
    """Scan one home dir and a set of drive roots. ``extra`` is an optional
    callable returning (findings, locations_checked), used by verify."""
    started = time.monotonic()
    started_at = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    deadline = started + budget_seconds

    findings: List[Finding] = []
    checked = 0

    for spec in L.SPECS:
        if spec.check == "claude_creds":
            checked += 3  # three candidate files
        else:
            checked += 1
        handler = _SIMPLE_DISPATCH[spec.check]
        try:
            findings.extend(handler(spec, home))
        except OSError:
            findings.extend([_could_not_check(spec.id, home.joinpath(*(spec.rel or ())), spec.category, spec.source_ref)])

    wf, wc = _check_wallets_and_stores(home)
    findings.extend(wf)
    checked += wc

    ef, ec = _check_env_files(drives, deadline=deadline)
    findings.extend(ef)
    checked += ec

    if extra is not None:
        xf, xc = extra()
        findings.extend(xf)
        checked += xc

    duration_ms = int((time.monotonic() - started) * 1000)
    return ScanReport(
        tool_version=TOOL_VERSION,
        mode=mode,
        account_label=account_label or os.environ.get("USERNAME", ""),
        started_at=started_at,
        duration_ms=duration_ms,
        locations_checked=checked,
        findings=findings,
    )
