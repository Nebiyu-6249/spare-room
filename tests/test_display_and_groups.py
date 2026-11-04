"""v0.1.2: fake-laptop-relative paths in printed output, and verify's three groups."""

from __future__ import annotations

import json
from pathlib import Path

from spareroom import cli, probe
from spareroom.models import Finding, ScanReport
from spareroom.scanner import fake_laptop_label, scan
from spareroom.traps import bundled_fake_laptop
from spareroom.verify import group_findings, verify

ROOT = Path(__file__).resolve().parent.parent


def test_fake_laptop_label_forms(tmp_path):
    base = tmp_path / "x" / "fake_laptop"
    home = base / "C" / "Users" / "testdev"
    assert fake_laptop_label(str(home / ".ssh" / "id_rsa"), home, base) == "<fake laptop>\\.ssh\\id_rsa".replace("\\", __import__("os").sep)
    d = fake_laptop_label(str(base / "D" / "work" / ".env"), home, base)
    assert d.startswith("<fake laptop D:>")
    assert fake_laptop_label(r"C:\elsewhere\f", home, base) == r"C:\elsewhere\f"


def test_demo_scan_prints_relative_paths_but_json_keeps_full_ones(capsys):
    report = scan("demo")
    cli._print_summary(report)
    out = capsys.readouterr().out
    assert "<fake laptop>" in out
    assert str(bundled_fake_laptop()) not in out and "_MEI" not in out
    assert all(str(bundled_fake_laptop()) in f["path"] for f in report.to_dict()["findings"])


def test_probe_prints_relative_paths(tmp_path, capsys):
    out_json = tmp_path / "r.json"
    assert probe.main(["--demo", "--out", str(out_json)]) == 0
    printed = capsys.readouterr().out
    assert "fake laptop: bundled with the tool" in printed
    assert "visible  <fake laptop>" in printed and str(bundled_fake_laptop()) not in printed
    assert all(str(bundled_fake_laptop()) in p for p in json.loads(out_json.read_text())["visible"])


def test_vscode_trap_runs_from_repo_root():
    tasks = json.loads((ROOT / "traps" / "vscode_task" / ".vscode" / "tasks.json").read_text())
    t = tasks["tasks"][0]
    assert t["runOptions"]["runOn"] == "folderOpen"
    assert t["options"]["cwd"] == "${workspaceFolder}/../.."
    assert (ROOT / "traps" / "vscode_task" / ".." / ".." / "spareroom" / "probe.py").exists()


def _f(i, path, sev="high", kind="k", cat="browser_store"):
    return Finding(i, cat, path, kind, sev, "r", "f", None)


def test_groups_split_and_headline_count():
    home = Path(r"C:\Users\interview")
    rep = ScanReport("t", "real", "interview", "now", 1, 10, [
        _f("browser-edge", r"C:\Users\interview\AppData\Local\Microsoft\Edge\User Data\Default\Login Data"),
        _f("env-0", r"C:\dev\proj\.env", cat="env_file"),
        _f("xprofile-me-0", r"C:\Users\me\.ssh\id_rsa", cat="ssh"),
        _f("setting-missing-0", str(home), "medium", "not applied: npm ignore-scripts", "editor_setting"),
    ])
    g = group_findings(rep, home, other_present=12, other_blocked=11)
    assert [f.id for f in g["own"]] == ["browser-edge"] and g["own"][0].severity == "info"
    assert [f.id for f in g["shared"]] == ["env-0"]
    assert [f.id for f in g["other"]["readable"]] == ["xprofile-me-0"]
    assert g["takeable"] == 2 and len(g["missing"]) == 1


def test_verify_prints_groups_in_order(tmp_path, capsys):
    users = tmp_path / "Users"
    own, me = users / "interview", users / "me"
    (own / ".aws").mkdir(parents=True)
    (own / ".aws" / "credentials").write_text("placeholder")      # the room's own file
    (me / ".ssh").mkdir(parents=True)
    d = tmp_path / "D" / "shared"
    d.mkdir(parents=True)
    (d / ".env").write_text("placeholder")                          # readable by every account
    report, blocked = verify(home=own, drives=[tmp_path / "D"], users_root=users, only_profiles=["me"])
    cli._print_verify(report, blocked)
    out = capsys.readouterr().out
    i1, i2, i3 = (out.index(s) for s in ("Your other accounts:", "Readable by every account:",
                                         "This spare room's own files"))
    assert i1 < i2 < i3
    assert "1 thing stranger code could take from here." in out          # only the shared .env
    own_part = out[i3:]
    assert "credentials" in own_part and "[high" not in own_part
    assert all(f.severity == "info" for f in report.groups["own"])
