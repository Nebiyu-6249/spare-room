"""Real-mode scanning: bounded, crash-free, and correct about drives and time.

The live full scan is asserted structurally (it depends on the machine). The
env-walk budget and node_modules skip are tested deterministically on temp trees.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import pytest

from spareroom.models import CATEGORIES, SEVERITIES
from spareroom.scanner import _check_env_files, real_roots, scan


def test_real_roots_shape():
    home, drives = real_roots()
    assert isinstance(home, Path)
    assert isinstance(drives, list)
    if os.name == "nt":
        assert drives, "expected at least one drive on Windows"
        assert all(str(d).rstrip("\\").endswith(":") for d in drives)


@pytest.mark.skipif(os.name != "nt", reason="live full scan is Windows-first")
def test_real_scan_is_bounded_and_wellformed():
    t = time.monotonic()
    report = scan("real")
    assert time.monotonic() - t < 60
    assert report.mode == "real"
    assert report.duration_ms < 60_000
    assert report.locations_checked > 0
    for f in report.findings:
        assert f.category in CATEGORIES
        assert f.severity in SEVERITIES
        assert f.path and f.reason and f.fix


def test_env_walk_stops_at_deadline(tmp_path):
    # A tree deep enough to walk more than one node.
    deep = tmp_path
    for i in range(5):
        deep = deep / f"d{i}"
    deep.mkdir(parents=True)
    (deep / ".env").write_text("API_KEY=should-not-matter\n")

    # Deadline already in the past -> walk breaks immediately and records it.
    findings, checked = _check_env_files([tmp_path], deadline=time.monotonic() - 1)
    assert checked == 1
    notes = [f for f in findings if f.kind == "env scan time-limited"]
    assert notes and notes[0].severity == "info"


def test_env_walk_finds_and_skips_node_modules(tmp_path):
    (tmp_path / "proj").mkdir()
    (tmp_path / "proj" / ".env").write_text("A=1\n")
    nm = tmp_path / "proj" / "node_modules" / "pkg"
    nm.mkdir(parents=True)
    (nm / ".env").write_text("B=2\n")

    findings, _ = _check_env_files([tmp_path], deadline=None)
    paths = [f.path for f in findings if f.kind == "environment file"]
    assert len(paths) == 1
    assert "node_modules" not in paths[0]
