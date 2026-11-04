"""Data model for Spare Room, mirroring the JSON shapes in CLAUDE.md.

These are plain dataclasses with ``to_dict`` so the CLI can emit stable JSON
without any third-party serializer. Nothing here stores a secret value: a
Finding records *where* something is and *why* it matters, never its contents.
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from typing import Optional

# Allowed vocabularies, kept here so tests and the scanner agree on one source.
CATEGORIES = (
    "ssh",
    "cloud",
    "token",
    "env_file",
    "wallet_extension",
    "desktop_wallet",
    "browser_store",
    "ai_tool",
    "shell_history",
    "editor_setting",
)

SEVERITIES = ("high", "medium", "info")

MODES = ("real", "demo")


@dataclass
class Finding:
    """One thing stranger code could reach. Never carries a secret value."""

    id: str
    category: str
    path: str
    kind: str
    severity: str
    reason: str
    fix: str
    source_ref: Optional[str] = None

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)


@dataclass
class ScanReport:
    tool_version: str
    mode: str
    account_label: str
    started_at: str
    duration_ms: int
    locations_checked: int
    findings: list = field(default_factory=list)

    def to_dict(self) -> dict:
        d = dataclasses.asdict(self)
        d["findings"] = [f.to_dict() if isinstance(f, Finding) else f for f in self.findings]
        return d


@dataclass
class TrapResult:
    trap_id: str
    trigger: str
    account_label: str
    visible: list = field(default_factory=list)
    blocked: list = field(default_factory=list)
    ran_at: str = ""

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)


@dataclass
class CoverageItem:
    attacker_source: dict  # {"name": ..., "url": ...}
    target: str
    check_id: Optional[str] = None

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)
