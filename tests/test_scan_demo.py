"""The demo scan runs end to end and behaves as the success criteria require."""

from __future__ import annotations

import json

from spareroom.models import CATEGORIES, SEVERITIES
from spareroom.report import render_html
from spareroom.scanner import scan


def test_demo_scan_finds_every_category_fast():
    report = scan("demo")
    assert report.mode == "demo"
    assert report.duration_ms < 60_000  # criterion 1: under 60 s
    assert report.locations_checked > 0
    assert report.findings, "demo scan should find the planted items"

    found = {f.category for f in report.findings}
    assert found == set(CATEGORIES), f"missing categories: {set(CATEGORIES) - found}"


def test_every_finding_is_well_formed():
    report = scan("demo")
    ids = set()
    for f in report.findings:
        assert f.category in CATEGORIES
        assert f.severity in SEVERITIES
        assert f.path and f.reason and f.fix
        assert f.id not in ids, f"duplicate finding id: {f.id}"
        ids.add(f.id)


def test_env_hunt_crosses_drives_and_skips_node_modules():
    report = scan("demo")
    env = [f for f in report.findings if f.category == "env_file"]
    # One .env on the C drive project and one on the D drive; the node_modules
    # one must be skipped.
    assert len(env) == 2, [f.path for f in env]
    assert not any("node_modules" in f.path for f in report.findings)
    assert any(f.path.replace("\\", "/").split("/")[-4:-3] == ["D"] or "\\D\\" in f.path or "/D/" in f.path
               for f in env), "expected a .env on the D drive"


def test_report_renders_and_counts():
    report = scan("demo")
    html = render_html(report)
    assert "<!doctype html>" in html.lower()
    assert str(len(report.findings)) in html
    assert "Fix:" in html
    # Loads nothing external.
    for needle in ("http-equiv=\"refresh\"", "<script", "src=\"http", "href=\"http://fonts",
                   "cdn.", "googleapis"):
        assert needle not in html.lower(), f"report should not reference {needle}"


def test_json_roundtrips():
    report = scan("demo")
    blob = json.dumps(report.to_dict())
    back = json.loads(blob)
    assert back["mode"] == "demo"
    assert len(back["findings"]) == len(report.findings)
    assert {"id", "category", "path", "kind", "severity", "reason", "fix", "source_ref"} <= set(back["findings"][0])
